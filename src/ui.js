// 御笔朱批 —— Preact 视图层（B 方案，2026-07-26 闸门触发后迁移）
// 免构建形态：htm/preact standalone vendored，push 即部署的性质不变。
// 纯逻辑（锚定/hunk/草稿）在 anchor.js，API 在 github.js，渲染在 render.js——迁移零改动。
import {
  html, render, useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo,
} from '../vendor/preact-standalone.mjs';
import * as gh from './github.js';
import { renderMarkdown, hydrateRelativeImages } from './render.js';
import * as A from './anchor.js';
import { demoApi, autoAnnotate } from './demo.js';
import { buildIndex, searchIndex } from './search.js';
import { parseZhupiLink, buildRef, parseDeepLink, buildDeepLink, parseHappySession, resolveRelativeDocLink } from './link.js';
import { siblingFor, visibleDocs, getLang, setLang, variantOf } from './lang.js';
import { Setup } from './components/setup.js';
import { DraftCard, ShownThread, ZongpiCard } from './components/cards.js';
import { Sidebar } from './components/sidebar.js';
import { Topbar } from './components/topbar.js';
import { OtherThreads } from './components/other-threads.js';

const params = new URLSearchParams(location.search);
const DEMO = params.get('demo') === '1';
const AUTO = params.get('auto') === '1';
const api = DEMO ? demoApi : gh;

// Pages 发 max-age=600 且模块 URL 无版本号 → 手机上可能跑着 10 分钟前的旧代码，
// 而用户无从判断新旧。启动时强制回源取一遍源码算指纹，与上次记录比：变了就提示刷新。
// cache:'reload' 同时把新文件写进 HTTP 缓存，所以点刷新立刻生效。
// 覆盖全部源文件——早先只列 5 个，之后新增的 link/search/lang/demo 改了都不会提示新版
// （清单式配置随代码增长而腐烂，第六轮评审实证）
const BUILD_FILES = ['index.html', 'src/style.css', 'src/ui.js', 'src/github.js', 'src/anchor.js',
  'src/render.js', 'src/link.js', 'src/search.js', 'src/lang.js'];
async function detectNewBuild() {
  try {
    const texts = await Promise.all(BUILD_FILES.map((f) => fetch(`./${f}`, { cache: 'reload' }).then((r) => r.text())));
    let h = 7;
    for (const t of texts) for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
    const sig = String(h);
    const prev = localStorage.getItem('zhupi.build');
    localStorage.setItem('zhupi.build', sig);
    return Boolean(prev && prev !== sig);
  } catch { return false; }
}

const isDoc = (f) => f.filename.endsWith('.md') && f.status !== 'removed';



// ── 主应用 ──
function App() {
  const [phase, setPhase] = useState('boot');
  const [setupMsg, setSetupMsg] = useState('');
  const [notice, setNotice] = useState('');
  const [prs, setPrs] = useState([]);
  const [cur, setCur] = useState(null);          // { pr, files, docs }
  const [docPath, setDocPath] = useState(null);
  const [docErr, setDocErr] = useState(null);
  const [docTick, setDocTick] = useState(0);     // 文档 DOM 就位的信号（岛屿内容不归 vdom 管）
  const [drafts, setDrafts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [zongpi, setZongpi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [float, setFloat] = useState(null);      // pendingAnchor
  const [commits, setCommits] = useState([]);    // rev 序列 v1..vN（vN=head）
  const [comments, setComments] = useState([]);  // 已呈 inline review comments（扁平）
  const [zongpis, setZongpis] = useState([]);    // 已呈总批（会话区），否则总批只能发不能看
  const [viewed, setViewed] = useState(null);    // 正在读的 rev sha；null=head
  const [otherOpen, setOtherOpen] = useState(false); // 「其他 N 串」折叠组展开态
  const [lang, setLangState] = useState(getLang()); // F8：中/EN 偏好，记住上次
  const [stale, setStale] = useState(false);
  const [tab, setTab] = useState('open');        // open=待批 / done=已钦此（归档，只读）
  const [donePrs, setDonePrs] = useState([]);
  const [q, setQ] = useState('');                // 搜索词：即输即filter标题；回车全折全文
  const [hits, setHits] = useState(null);        // null=没在搜；[]=搜了没命中
  const [searching, setSearching] = useState('');     // 手上跑的是旧版（见 detectNewBuild）

  const docRef = useRef(null);
  const autoRan = useRef(false); // 冒烟只跑一次（切折会让 docTick 回到 1）
  const deepLink = useRef(parseDeepLink(location.search, gh.getRepoSlug() || (DEMO ? 'demo/repo' : '')));
  const pendingNotice = useRef(null); // 深链失败提示：要熬过随后的 setNotice('')
  const jumpRef = useRef(null);  // 搜索命中 → 开折后跳到那一段 {prNumber, path, line}
  const indexRef = useRef(null); // 全文索引缓存（本次会话内）
  // 全局监听器只绑一次，读最新状态走这面镜子
  const R = useRef({});
  // headSha / viewedRef 入镜：全局 mouseup 要据此判定「旧版只读 → 不出浮批」
  const headSha = cur?.pr?.head?.sha || null;
  const onHead = !viewed || viewed === headSha;
  const archived = Boolean(cur?.pr?.merged_at);
  const canAnnotate = onHead && !archived;      // 旧版 / 归档折一律只读
  const happyUrl = parseHappySession(cur?.pr?.body);   // 呈折的那次奏对（agent 埋在 PR body 里）
  R.current = { cur, drafts, editing, busy, float, docPath, viewed, headSha, onHead, archived, canAnnotate };

  const say = useCallback((t) => setNotice(t), []);

  // 草稿变更统一走这里：内存 + localStorage 同步写，没有 effect 时序问题
  const mutateDrafts = useCallback((prNumber, fn) => {
    setDrafts((ds) => {
      const nd = fn(ds);
      const err = A.saveDrafts(prNumber, nd);
      // 存不下必须明说：草稿是这里唯一不可再生的数据（配额爆时曾静默吞掉）
      if (err) setTimeout(() => setNotice('草稿存不进本地存储（配额可能满了）——先提交已写的批注，别再往下攒。'), 0);
      return nd;
    });
  }, []);

  useEffect(() => { if (!DEMO) detectNewBuild().then(setStale); }, []);

  // ── 启动 ──
  useEffect(() => {
    if (DEMO) { loadPRs(); return; }
    if (!gh.getToken()) { setPhase('setup'); return; }
    if (!gh.getRepoSlug()) { setPhase('setup'); setSetupMsg('这版起奏折仓库改成填的了——补一次 owner/repo，钥匙照旧粘一遍。'); return; }
    loadPRs();
  }, []);

  async function loadPRs() {
    setPhase('app');
    setNotice('');
    try {
      indexRef.current = null; // 拉了新清单就让搜索索引重建（缓存命中时几乎零成本）
      const list = await api.listOpenPRs();
      if (api.listMergedPRs) api.listMergedPRs().then(setDonePrs).catch(() => {});
      setPrs(list);
      const dl = deepLink.current;
      if (dl) {
        deepLink.current = null;   // 只认一次，之后随手切折不再被它拽回来
        const all = [...list, ...(await api.listMergedPRs?.().catch(() => []) || [])];
        const target = dl.prNumber ? all.find((p) => p.number === dl.prNumber) : null;
        if (target) {
          if (dl.path) jumpRef.current = { prNumber: target.number, path: dl.path, line: dl.line || 1 };
          setTab(target.merged_at ? 'done' : 'open');
          openPR(target);
          return;
        }
        // 用 ref 暂存：紧接着的 boot/loadPRs 会 setNotice('') 把它冲掉
        pendingNotice.current = dl.prNumber
          ? `直达链接指向第 ${dl.prNumber} 折，但清单里没有（可能已删或不在本仓）。`
          : '这条直达链接没带折号（blob 形态只指到文件），已打开清单首折。';
      }
      if (list.length && !R.current.cur) openPR(list[0]); // 在途中用户已手点开折子就别顶掉他
    } catch (err) {
      if (err.tokenDead) { gh.clearToken(); setPhase('setup'); setSetupMsg('钥匙失效了，换一把。'); return; }
      say(err.rateLimited ? '碰到 GitHub 限流，缓一会儿再刷新。' : `拉取失败：${err.message}`);
    }
  }

  async function onSaveToken(repoRaw, tokenRaw) {
    const slug = gh.parseRepoSlug(repoRaw);
    if (!slug) return setSetupMsg('奏折仓库要填成 owner/repo（贴 GitHub 链接也行）。');
    if (!tokenRaw.trim()) return setSetupMsg('先粘一把钥匙。');
    setSetupMsg('验钥中…');
    gh.setRepoSlug(slug);
    gh.setToken(tokenRaw);
    try {
      const { canWrite, prAccess } = await gh.verifyToken();
      if (!prAccess) {
        gh.clearToken();
        return setSetupMsg('钥匙差一项：Pull requests: Read and write。回 GitHub 的 token 页补上（不用重新生成，改完点 Update），再回来点存钥。');
      }
      setSetupMsg('');
      await loadPRs();
      if (!canWrite) say('提醒：这把钥匙没有 Contents 写权限，读批都行，但「钦此」（merge）会失败。');
    } catch (err) {
      gh.clearToken();
      setSetupMsg(`这把钥匙开不了 ${gh.repoSlug()}：${err.message}`);
    }
  }

  function openPR(pr) {
    setNotice('');
    setFloat(null);
    setEditing(null);
    setZongpi(false);
    setDocErr(null);
    setDocPath(null);
    setDocTick(0);
    setViewed(null);      // 每次开折先回 head：docPath 置 null 期间就位，与岛屿 effect 的 null→值中转契约不冲突
    setCommits([]);
    setComments([]);
    setZongpis([]);
    setCur({ pr, files: null, docs: null });
    setDrafts(A.loadDrafts(pr.number));
    // 立刻清岛屿并示 loading：否则 listPRFiles 整个往返期间旧折正文挂着，
    // 这时划选会产出 path:null 的脏草稿（评审 N2）
    const el = docRef.current;
    if (el) {
      const p = document.createElement('p');
      p.className = 'state';
      p.textContent = '展折中…';
      el.replaceChildren(p);
    }
    (async () => {
      try {
        const files = await api.listPRFiles(pr.number);
        if (R.current.cur?.pr.number !== pr.number) return; // 世界已变，丢弃
        const docs = files.filter(isDoc);
        setCur({ pr, files, docs });
        if (!docs.length) setDocErr('此折无 markdown 正文（代码 PR 的 diff 视图在北极星里）。');
        else {
          const jp = jumpRef.current;
          const want = jp?.prNumber === pr.number && docs.find((f) => f.filename === jp.path);
          // 无指定目标时按语言偏好挑首篇（双语折默认开中文版）
          const visible = visibleDocs(docs.map((f) => f.filename), getLang());
          setDocPath(want ? jp.path : (visible[0] || docs[0].filename));
        }
      } catch (err) {
        if (R.current.cur?.pr.number !== pr.number) return;
        setDocErr(`展折失败：${err.message}`);
      }
    })();
    // rev 序列 + 已呈批注串：与正文并行拉，各自带世界守卫，失败不影响读折主线
    (async () => {
      try {
        const cs = await api.listPRCommits(pr.number);
        if (R.current.cur?.pr.number === pr.number) setCommits(cs);
      } catch { /* rev 拉不到就只读 head，不报错打断 */ }
    })();
    loadComments(pr.number);
  }

  // 已呈批注串：开折拉一次、提交朱批成功后重拉一次（让刚呈的立即可见）。不轮询。
  async function loadComments(prNumber) {
    try {
      const [cs, zs] = await Promise.all([
        api.listPRComments(prNumber),
        api.listIssueComments ? api.listIssueComments(prNumber) : Promise.resolve([]),
      ]);
      if (R.current.cur?.pr.number === prNumber) { setComments(cs); setZongpis(zs); }
    } catch { /* 批注串拉失败不打断读折 */ }
  }

  // ── 文档岛屿：内容不归 vdom 管，effect 负责取文与注入；cleanup 即世代守卫 ──
  // viewed 纳入依赖 → 切 rev 触发重取。openPR 里 viewed 在 setDocPath(null) 之前先归 null，
  // 故新折展开时 docPath null→值 的中转期间 viewed 已是 head，effect（docPath 为空即 return）
  // 只在 docPath 就位那一拍以正确的 ref 跑一次，不会拿旧 rev 去打新折。
  useEffect(() => {
    const el = docRef.current;
    if (!el || !cur?.pr || !docPath) return;
    const ref = viewed || cur.pr.head.sha; // null=head
    let dead = false;
    el.replaceChildren();
    const p = document.createElement('p');
    p.className = 'state';
    p.textContent = '展折中…';
    el.appendChild(p);
    (async () => {
      try {
        const text = await api.getFileText(docPath, ref);
        if (dead) return;
        el.innerHTML = renderMarkdown(text);
        await hydrateRelativeImages(el, { docPath, ref, fetchBlobUrl: api.getFileBlobUrl });
        if (dead) return;
        setDocTick((t) => t + 1);
        const jp = jumpRef.current;
        if (jp && jp.prNumber === cur.pr.number && (!jp.path || jp.path === docPath)) {
          jumpRef.current = null;
          setTimeout(() => {
            // 找覆盖该行的块：优先 data-line ≤ 目标行的最近块
            let target = null;
            el.querySelectorAll('[data-line]').forEach((b) => { if (+b.dataset.line <= jp.line) target = b; });
            if (target) {
              target.scrollIntoView({ block: 'center' });
              target.classList.add('search-flash');
              setTimeout(() => target.classList.remove('search-flash'), 1600);
            }
          }, 60);
        }
      } catch (err) {
        if (dead) return;
        el.replaceChildren();
        const q = document.createElement('p');
        q.className = 'state err';
        q.textContent = `展折失败：${err.message}`;
        el.appendChild(q);
      }
    })();
    return () => { dead = true; };
  }, [cur?.pr?.number, docPath, viewed]);

  // demo 自动划批（真实事件路径的冒烟）
  useEffect(() => {
    if (DEMO && AUTO && docTick === 1 && !autoRan.current) { autoRan.current = true; autoAnnotate(docRef.current); }
  }, [docTick]);

  // ── 高亮 ──（旧版只读：不画草稿高亮，行号可能已漂移）
  useEffect(() => {
    if (!('highlights' in CSS)) return;
    const doc = docRef.current;
    const hl = new Highlight();
    if (doc && docTick > 0 && onHead) {
      drafts.filter((d) => d.path === docPath).forEach((d) => {
        const r = A.rangeForDraft(doc, d);
        if (r) hl.add(r);
      });
    }
    CSS.highlights.set('zhupi-draft', hl);
    return () => CSS.highlights.delete('zhupi-draft');
  }, [drafts, docTick, docPath, onHead]);

  // ── 批注卡对齐（图片/字体异步加载改块高 → ResizeObserver 重排）──
  // 退化对齐（评审取舍）：草稿卡的 blockLine 精确命中某个 [data-line]；已呈批注串的
  // blockLine 是「源文件行号」，块级 data-line 不一定精确命中 → 找 data-line ≤ 目标行的最近块
  // 挂靠（列表/表格内的行落在其容器块上，语义足够近）。二选一里取「就近向上」而非「最接近」，
  // 理由：向上挂靠保证卡片不会跑到被批句子的上方，读起来锚点永远在卡片视线的同高或稍上。
  const blockTops = useMemo(() => {
    const doc = docRef.current;
    if (!doc) return [];
    return [...doc.querySelectorAll('[data-line]')]
      .map((el) => ({ line: +el.dataset.line, el }))
      .filter((x) => x.line)
      .sort((a, b) => a.line - b.line);
  }, [docTick]);

  const layoutCards = useCallback(() => {
    const col = document.getElementById('margin-col');
    const doc = docRef.current;
    if (!col || !doc) return;
    const colRect = col.getBoundingClientRect();
    let prevBottom = 0;
    [...col.children].forEach((card) => {
      let top = prevBottom + 12;
      const line = +card.dataset.blockLine;
      // 旧版视图下行号系 head 坐标，对旧版 DOM 会系统性挂错块——改静态堆叠（第四轮评审 D）
      if (line && R.current.onHead) {
        let block = doc.querySelector(`[data-line="${line}"]`);
        if (!block) { // 退化：最近的 data-line ≤ line 的块
          let cand = null;
          for (const b of blockTops) { if (b.line <= line) cand = b.el; else break; }
          block = cand;
        }
        if (block) top = Math.max(block.getBoundingClientRect().top - colRect.top, prevBottom + 12);
      }
      card.style.top = `${Math.max(top, 0)}px`;
      prevBottom = Math.max(top, 0) + card.offsetHeight;
    });
    col.style.minHeight = `${prevBottom + 20}px`;
  }, [blockTops]);

  useLayoutEffect(() => { layoutCards(); }, [drafts, editing, zongpi, docTick, comments, viewed, layoutCards]);
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !docRef.current) return;
    const ro = new ResizeObserver(() => layoutCards());
    ro.observe(docRef.current);
    return () => ro.disconnect();
  }, [docPath, docErr]); // 每次换文档/错误恢复都扎实重挂，不赌 vdom 节点复用（评审：布尔依赖太脆）
  useEffect(() => {
    const onResize = () => layoutCards();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── 全局监听：划选 / ⌘Enter / 滚动收浮钮 ──
  const submitRef = useRef();
  useEffect(() => {
    const onMouseUp = (e) => {
      if (e.target.closest('.zhupi-float, .anno-card, .zongpi-card')) return;
      if (e.target.closest('aside, .mainbar')) { if (R.current.float) setFloat(null); return; } // 点按钮也要收浮钮
      if (!R.current.canAnnotate) { if (R.current.float) setFloat(null); return; } // 旧版/归档只读：不出浮批钮
      setTimeout(() => {
        const a = A.computeAnchor(docRef.current);
        setFloat(a ? { ...a, rect: { left: a.rect.right, top: a.rect.bottom } } : null);
      }, 0);
    };
    const onKeyDown = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'Enter') return;
      // 阻断修复：卡内 ⌘Enter 的同一事件会冒泡到这里——不排除输入框就会把整批当场呈出
      if (e.target.closest('textarea, input')) return;
      const { editing, drafts, busy } = R.current;
      if (!editing && drafts.length && !busy) submitRef.current?.();
    };
    const onScroll = () => { if (R.current.float) setFloat(null); }; // 内滚不派发 mousedown，浮钮会残留
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  // ── 草稿动作 ──
  function addDraft() {
    const a = R.current.float;
    const c = R.current.cur;
    if (!a || !c) return;
    const d = {
      id: `d${Date.now()}${Math.floor(Math.random() * 1e4)}`,
      path: R.current.docPath,
      ref: c.pr.head.sha, // 写于哪个版本：推新版后旧草稿降级总批，绝不静默钉错行
      blockLine: a.blockLine,
      line: a.line,
      offset: a.offset || 0,
      quote: a.quote,
      quoteRaw: a.quoteRaw,
      note: '',
      ts: Date.now(),
    };
    mutateDrafts(c.pr.number, (ds) => [...ds, d]);
    setEditing(d.id);
    setFloat(null);
    window.getSelection()?.removeAllRanges();
  }

  function saveDraft(id, note) {
    const c = R.current.cur;
    if (!c) return;
    const v = note.trim();
    if (!v) return dropDraft(id);
    mutateDrafts(c.pr.number, (ds) => ds.map((d) => (d.id === id ? { ...d, note: v } : d)));
    setEditing(null);
  }

  function dropDraft(id) {
    const c = R.current.cur;
    if (!c) return;
    mutateDrafts(c.pr.number, (ds) => ds.filter((d) => d.id !== id));
    setEditing((e) => (e === id ? null : e));
  }

  // 地址栏跟着当前折/文档走（replaceState 不进历史，免得返回键变成翻折）
  useEffect(() => {
    if (DEMO) return;
    const url = cur?.pr
      ? buildDeepLink(location.origin + location.pathname, { prNumber: cur.pr.number, path: docPath })
      : location.origin + location.pathname;
    if (location.href !== url) history.replaceState(null, '', url);
  }, [cur?.pr?.number, docPath]);

  // 文档/批注里的本仓 GitHub 链接 → app 内跳转（外链不拦，照常新窗口打开）
  const onDocClick = useCallback((e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');

    // ① 文档内相对链接：同折里有这个文件就换文档（双语互链就靠它），
    //    没有就开 GitHub 上的对应文件——绝不能放它去 Pages 源站撞 404
    const rel = resolveRelativeDocLink(href, docPath);
    if (rel) {
      e.preventDefault();
      const inFolder = cur?.docs?.some((f) => f.filename === rel);
      if (inFolder) { setDocPath(rel); return; }
      const slug = gh.getRepoSlug();
      const ref = cur?.pr?.head?.sha;
      if (slug && ref) window.open(`https://github.com/${slug}/blob/${ref}/${rel}`, '_blank', 'noopener');
      else say(`这折里没有 ${rel}`);
      return;
    }

    // ② 本仓 GitHub permalink：拦成 app 内跳转（F6）
    const parsed = parseZhupiLink(href, gh.getRepoSlug() || (DEMO ? 'demo/repo' : ''));
    if (!parsed) return;
    e.preventDefault();
    jumpTo(parsed);
  }, [prs, donePrs, cur, docPath]);

  // 「引用此处」：把当前选中处拷成一条 GitHub permalink + 引文，粘进别的朱批即成链接
  async function copyRef(e) {
    const a = A.computeAnchor(docRef.current);
    const slug = gh.getRepoSlug() || 'demo/repo';
    // 默认给「朱批直达链」（点了直接进 app 读到那一段）；按住 Alt 给 GitHub permalink
    const wantGithub = Boolean(e?.altKey);
    const md = wantGithub
      ? (a ? buildRef({ slug, path: docPath, line: a.line, quote: a.quote, ref: curRevSha })
           : buildRef({ slug, prNumber: cur?.pr?.number }))
      : (() => {
          const url = buildDeepLink(location.origin + location.pathname,
            { prNumber: cur?.pr?.number, path: a ? docPath : null, line: a?.line });
          const q = (a?.quote || '').trim().slice(0, 60);
          return q ? `[「${q}」](${url})` : url;
        })();
    try { await navigator.clipboard.writeText(md); say(`已拷贝引用：${md.slice(0, 60)}${md.length > 60 ? '…' : ''}`); }
    catch { say(`拷贝失败，手动复制：${md}`); }
  }

  // F8 切语言：留在当前折当前篇，只换语言变体（找不到对应版就什么都不做）
  // 目标语言由参数决定，不是「翻到对面」——此前点已激活的语言键会把人翻到另一语言，
  // 且 chip 继续显示旧状态（第六轮评审）。当前语言一律从 docPath 派生，偏好只管默认选篇。
  function switchLang(next) {
    setLang(next);
    setLangState(next);
    if (curLangOf === next) return;                  // 已经在这个语言：只记偏好
    const sib = siblingFor(docPath, (cur?.docs || []).map((f) => f.filename));
    if (sib) setDocPath(sib);
  }

  // ── 搜索：标题即输即filter；回车翻全折全文（含归档），命中点击直达段落 ──
  async function runSearch() {
    const query = q.trim();
    if (query.length < 2) return say('搜索词至少两个字。');
    const all = [...prs, ...donePrs];
    if (!indexRef.current) {
      setSearching('翻折中…');
      indexRef.current = await buildIndex(api, all, (d, t) => setSearching(`翻折中 ${d}/${t}…`));
      setSearching('');
    }
    setHits(searchIndex(indexRef.current, query));
  }
  function clearSearch() { setQ(''); setHits(null); }
  // 折间跳转：目标折在哪个栏自动切过去；带 path/line 就落到那一段
  function jumpTo({ prNumber, path, line }) {
    const all = [...prs, ...donePrs];
    const target = prNumber ? all.find((p) => p.number === prNumber) : cur?.pr;
    if (!target) return say(`跳不过去：本仓没有第 ${prNumber} 折（可能已删或不在清单里）。`);
    if (path) jumpRef.current = { prNumber: target.number, path, line: line || 1 };
    setTab(target.merged_at ? 'done' : 'open');
    if (target.number === cur?.pr?.number && path === docPath && line) {
      // 同折同文档：不用重开，直接滚
      const el = docRef.current;
      let hit = null;
      el?.querySelectorAll('[data-line]').forEach((b) => { if (+b.dataset.line <= line) hit = b; });
      if (hit) { hit.scrollIntoView({ block: 'center' }); hit.classList.add('search-flash'); setTimeout(() => hit.classList.remove('search-flash'), 1600); }
      return;
    }
    openPR(target);
  }

  function jumpToHit(pr, hit) {
    if (pr.number === cur?.pr?.number) return jumpTo({ prNumber: pr.number, path: hit.path, line: hit.line });
    jumpRef.current = hit.path ? { prNumber: pr.number, path: hit.path, line: hit.line || 1 } : null;
    // 归档折点进去自动切到已钦此栏，视觉上不跳戏
    setTab(pr.merged_at ? 'done' : 'open');
    openPR(pr);
  }

  // ── 呈回 ──
  async function submitAll() {
    const c = R.current.cur;
    const ds = R.current.drafts;
    if (!c || !ds.length || R.current.busy) return;
    if (R.current.archived) return say('这折已钦此归档，只读——要再批就开新折。');
    if (!R.current.onHead) return say('正在读旧版——批注只能呈给最新版，先切回 head 再提交。');
    if (R.current.editing) return say('有一条朱批还在编辑：先「存批」或「作罢」它，再呈回。');
    const noteless = ds.filter((d) => !d.note.trim());
    if (noteless.length) return say(`还有 ${noteless.length} 条朱批没写内容（空批注不呈）——写完或作罢它们再提交。`);
    // 在途中世界可能变（切折/刷新）——入口快照，完成回调只认这份
    const prNumber = c.pr.number;
    const ref = c.pr.head.sha;
    const hunks = new Map();
    (c.files || []).forEach((f) => hunks.set(f.filename, A.validRightLines(f.patch)));
    const inline = [], fallback = [];
    ds.forEach((d) => {
      const stale = d.ref !== ref; // 旧版本草稿：行号可能漂移，宁降总批不钉错行
      const set = hunks.get(d.path);
      if (!stale && set && set.has(d.line)) inline.push({ path: d.path, line: d.line, side: 'RIGHT', body: A.fmtDraft(d) });
      else fallback.push(d);
    });
    const body = fallback.length
      ? `以下朱批锚定不到可批注行（或写于旧版本），并入总批：\n\n${fallback.map(A.fmtDraft).join('\n\n---\n\n')}`
      : `御笔朱批 · ${inline.length} 条`; // body 恒非空：COMMENT 的 body 是文档必填项，不赌空串
    setBusy(true);
    try {
      await api.submitReview(prNumber, { body, comments: inline, commitId: ref });
      A.saveDrafts(prNumber, []); // 直接清对应 key；内存只在世界没变时动
      if (R.current.cur?.pr.number === prNumber) setDrafts([]);
      loadComments(prNumber); // 重拉已呈串：让刚呈的立即出现在右缘（世界守卫在 loadComments 内）
      say(`已呈回 ${inline.length} 条朱批${fallback.length ? `（${fallback.length} 条并入总批）` : ''}——回 Happy 说「读批注」。`);
    } catch (err) {
      say(`呈递失败（草稿都还在）：${err.message}`);
    } finally {
      setBusy(false);
    }
  }
  submitRef.current = submitAll;

  async function sendZongpi(text) {
    const c = R.current.cur;
    const v = text.trim();
    if (!c || !v || R.current.busy) return;
    setBusy(true);
    try {
      await api.createIssueComment(c.pr.number, v);
      setZongpi(false);
      loadComments(c.pr.number); // 重拉：让刚呈的总批立刻显示在折首
      say('总批已呈——回 Happy 说「读批注」。');
    } catch (err) {
      say(`总批呈递失败：${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  // ── 钦此 ──
  async function qinci() {
    const c = R.current.cur;
    if (!c) return;
    if (!R.current.onHead) return say('正在读旧版——钦此定的是最新版，先切回 head 再钦此。');
    const pr = c.pr;
    const pending = R.current.drafts.length;
    const warn = pending ? `\n注意：还有 ${pending} 条朱批草稿没呈回，merge 之后就没处提交了。` : '';
    if (!confirm(`钦此定稿：squash merge #${pr.number}「${pr.title}」？${warn}`)) return;
    setBusy(true);
    try {
      if (pr.draft) {
        await api.markReady(pr.node_id);
        pr.draft = false; // 本地同步：merge 失败重试不再重打 markReady
      }
      await api.mergePR(pr.number, pr.head.sha); // 带 sha：agent 中途推新版则 409，所批即所合
      say(`已钦此：#${pr.number} 定稿归档。对外交付回 Happy 说一声。`);
      setCur(null);
      setDocPath(null);
      setDocErr(null);
      await loadPRs();
    } catch (err) {
      say(`钦此失败：${err.message}${pr.draft ? `（此折是 draft；若是 GraphQL 被钥匙拒了，回 Happy 说「钦此 #${pr.number}」我来执行）` : ''}`);
    } finally {
      setBusy(false);
    }
  }

  // 已呈批注串的串线——hooks 必须在任何 early-return 之前（Rules of Hooks，第四轮评审 B：
  // 原先在 return 之后，靠 Preact「新 hook 恒在末位」侥幸不炸）
  const threads = useMemo(() => A.threadComments(comments), [comments]);

  // ── 视图 ──
  if (phase === 'boot') return null;
  if (phase === 'setup') return html`<${Setup} msg=${setupMsg} onSave=${onSaveToken}
    canCancel=${Boolean(gh.getToken() && gh.getRepoSlug())}
    onCancel=${() => { setSetupMsg(''); setPhase('app'); if (!prs.length) loadPRs(); }}
    onForget=${() => { gh.clearToken(); setSetupMsg('钥匙已清除。粘一把新的再进来。'); }} />`;

  const docDrafts = drafts.filter((d) => d.path === docPath);
  const others = drafts.length - docDrafts.length;
  const timeAgo = (iso) => {
    const mins = Math.round((Date.now() - new Date(iso)) / 60000);
    if (mins < 60) return `${mins} 分钟前`;
    if (mins < 1440) return `${Math.round(mins / 60)} 小时前`;
    return `${Math.round(mins / 1440)} 天前`;
  };

  // 已呈批注串：按能否定位到当前文档分两组
  const docThreads = [], otherThreads = [];
  threads.forEach((t) => {
    const r = t.root;
    const anchorLine = r.line ?? r.original_line; // outdated（line=null）退回 original_line
    if (r.path === docPath && anchorLine != null) docThreads.push({ t, blockLine: anchorLine, outdated: r.line == null });
    else otherThreads.push(t);
  });
  docThreads.sort((a, b) => a.blockLine - b.blockLine);

  // 草稿卡与已呈串必须合并排序再渲染：layoutCards 是单调下压式堆叠，
  // 两组各自有序会把串卡整体压到全部草稿之下、离锚点任意远（第四轮评审 A）
  const marginItems = [
    ...docDrafts.map((d) => ({
      blockLine: d.blockLine,
      el: html`<${DraftCard} key=${d.id} d=${d} doc=${docRef.current} editing=${editing === d.id}
        onEdit=${(id) => setEditing(id)} onSave=${saveDraft} onDrop=${dropDraft} />`,
    })),
    ...docThreads.map(({ t, blockLine, outdated }) => ({
      blockLine,
      el: html`<${ShownThread} key=${'c' + t.root.id} t=${t} blockLine=${blockLine} outdated=${outdated} />`,
    })),
  ].sort((a, b) => a.blockLine - b.blockLine);

  // rev 序列升序（旧→新）标 v 号；vN=head——demo smoke 依赖升序取首个当 v1
  const revs = commits.map((c, i) => ({
    sha: c.sha,
    v: i + 1,
    isHead: c.sha === headSha,
    when: c.commit?.committer?.date || c.commit?.author?.date,
  }));
  const curRevSha = viewed || headSha;
  // F8：当前篇有语言变体才出切换 chip（单语折一切照旧，不添噪音）
  const langSibling = cur?.docs ? siblingFor(docPath, cur.docs.map((f) => f.filename)) : null;
  // 只有当前篇真属于双语对时才从 docPath 派生语言；单语文档（无 .zh-CN 变体）一律按偏好，
  // 否则 `demo.md` 会被 variantOf 判成「英文」把整排 tab 翻成英文版（本轮自查踩到）
  const curLangOf = langSibling ? (variantOf(docPath)?.lang || lang) : lang;

  return html`
    <div id="app">
      <${Sidebar} q=${q} hits=${hits} searching=${searching} prs=${prs} donePrs=${donePrs}
        tab=${tab} cur=${cur} demo=${DEMO} timeAgo=${timeAgo}
        onQuery=${(v) => { setQ(v); if (hits) setHits(null); }}
        onSearch=${runSearch} onClearSearch=${clearSearch} onJumpToHit=${jumpToHit}
        onTab=${setTab} onOpenPR=${openPR}
        onSettings=${() => { setPhase('setup'); setSetupMsg(''); }} />
      <main>
        <${Topbar} cur=${cur} archived=${archived} onHead=${onHead} busy=${busy}
          draftCount=${drafts.length} happyUrl=${happyUrl} stale=${stale} notice=${notice}
          onRefresh=${() => { setCur(null); setDocPath(null); loadPRs(); }}
          onCopyRef=${copyRef} onZongpi=${() => setZongpi((z) => !z)}
          onSubmit=${submitAll} onQinci=${qinci} />
        <div class="work">
          ${cur?.docs?.length > 1 && html`
            <div class="doc-tabs">
              ${cur.docs.filter((f) => visibleDocs(cur.docs.map((x) => x.filename), curLangOf).includes(f.filename)).map((f) => html`
                <button key=${f.filename} class=${'doc-tab' + (f.filename === docPath ? ' active' : '')}
                  title=${f.filename} onClick=${() => { setViewed(null); setDocPath(f.filename); }}>
                  ${f.filename.split('/').pop().replace(/\.zh-CN\.md$/i, '.md')}
                </button>`)}
            </div>`}
          ${cur && revs.length > 1 && html`
            <div class="rev-row">
              <span class="rev-label">版本</span>
              <div class="rev-switch">
                ${revs.map((r) => html`
                  <button key=${r.sha}
                    class=${'rev-opt' + (r.sha === curRevSha ? ' active' : '')}
                    title=${`v${r.v} · ${r.sha.slice(0, 7)}${r.when ? ' · ' + timeAgo(r.when) : ''}${r.isHead ? '（最新）' : ''}`}
                    onClick=${() => setViewed(r.isHead ? null : r.sha)}>
                    v${r.v}${r.isHead ? '' : ' · ' + r.sha.slice(0, 7)}
                  </button>`)}
              </div>
            </div>`}
          ${cur && archived && html`
            <p class="rev-notice">此折已钦此归档 · 只读（要再批就开新折）</p>`}
          ${cur && !archived && !onHead && html`
            <p class="rev-notice">在读 v${revs.find((r) => r.sha === curRevSha)?.v ?? '?'}（旧版）· 批注请回最新版</p>`}
          ${cur && zongpis.length > 0 && html`
            <div class="zongpi-shown">
              <div class="zongpi-shown-label">已呈总批 · ${zongpis.length}</div>
              ${zongpis.map((z) => html`
                <div class="zongpi-shown-item" key=${'z' + z.id}>
                  <span class="anno-who">${z.user?.login || '?'}</span>
                  <span class="zongpi-shown-body">${z.body}</span>
                </div>`)}
            </div>`}
          ${langSibling && html`
            <div class="lang-switch" title="同一折的中英两版，切页不离开当前折">
              <button class=${'lang-opt' + (curLangOf === 'zh' ? ' active' : '')} onClick=${() => switchLang('zh')}>中</button>
              <button class=${'lang-opt' + (curLangOf === 'en' ? ' active' : '')} onClick=${() => switchLang('en')}>EN</button>
            </div>`}
          <div class="read-row" onClick=${onDocClick}>
            ${docErr ? html`<article id="doc"><p class="state err">${docErr}</p></article>`
              : html`<article id="doc" key="doc-island" ref=${docRef}></article>`}
            <div id="margin-col" class="margin-col">
              ${zongpi && html`<${ZongpiCard} busy=${busy} onSend=${sendZongpi} onClose=${() => setZongpi(false)} />`}
              ${marginItems.map((m) => m.el)}
              ${others > 0 && html`<p class="margin-note">另有 ${others} 条朱批在此折其他文档</p>`}
            </div>
          </div>
          <${OtherThreads} threads=${otherThreads} open=${otherOpen}
            onToggle=${() => setOtherOpen((o) => !o)} />
        </div>
      </main>
      ${float && html`
        <button class="zhupi-float" style=${{ left: `${Math.min(float.rect.left + 8, window.innerWidth - 76)}px`, top: `${float.rect.top + 6}px` }}
          onMouseDown=${(e) => e.preventDefault()} onClick=${addDraft}>朱批</button>`}
    </div>`;
}

render(html`<${App} />`, document.getElementById('root'));
