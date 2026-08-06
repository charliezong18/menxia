// 门下 —— Preact 视图层（B 方案，2026-07-26 闸门触发后迁移）
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
import { decorateVerifyMarkers, countVerifyMarkers } from './verify.js';
import { parseZhupiLink, buildRef, parseDeepLink, buildDeepLink, parseHappySession, resolveRelativeDocLink } from './link.js';
import { siblingFor, visibleDocs, getLang, setLang, variantOf } from './lang.js';
import { getReadStep, setReadStep, scaleOf, clampStep } from './readsize.js';
import { Setup } from './components/setup.js';
import { DraftCard, ShownThread, ZongpiCard } from './components/cards.js';
import { Sidebar } from './components/sidebar.js';
import { Topbar } from './components/topbar.js';
import { OtherThreads } from './components/other-threads.js';
import { ThreadView } from './components/thread-view.js';
import { ZongpiShown } from './components/zongpi-shown.js';
import { FolderBody, hasDecisions, parseFolderBody } from './components/folder-body.js';
import { assembleCarry } from './carry.js';
import { Outline, ChapterList, ChapterRail } from './components/outline.js';
import { ScrollEnds } from './components/scroll-ends.js';
import { extractOutline, hasOutline, chapterList, shouldUseChapterList } from './toc.js';
import { matchAnchor } from './slug.js';
import { S } from './strings.js';

const params = new URLSearchParams(location.search);
const DEMO = params.get('demo') === '1';
const AUTO = params.get('auto') === '1';
const api = DEMO ? demoApi : gh;

// Pages 发 max-age=600 且模块 URL 无版本号 → 手机上可能跑着 10 分钟前的旧代码，
// 而用户无从判断新旧。启动时强制回源取一遍源码算指纹，与上次记录比：变了就提示刷新。
// cache:'reload' 同时把新文件写进 HTTP 缓存，所以点刷新立刻生效。
// 覆盖全部源文件——早先只列 5 个，之后新增的 link/search/lang/demo 改了都不会提示新版
// （清单式配置随代码增长而腐烂，第六轮评审实证）
// 新增源文件必须登记在这里，否则改了它不算「新版本」、用户手上会一直跑旧代码。
// 子组件拆出去后曾漏登记，改 cards.js 不触发提示（2026-07-28 补）。
const BUILD_FILES = ['index.html', 'src/style.css', 'src/ui.js', 'src/github.js', 'src/anchor.js',
  'src/render.js', 'src/link.js', 'src/search.js', 'src/lang.js', 'src/demo.js', 'src/strings.js',
  'src/carry.js',
  'src/components/cards.js', 'src/components/setup.js', 'src/components/sidebar.js',
  'src/components/topbar.js', 'src/components/other-threads.js', 'src/components/zongpi-shown.js',
  'src/components/comment-body.js', 'src/components/folder-body.js', 'src/components/thread-view.js',
  'src/toc.js', 'src/components/outline.js', 'src/track.js', 'src/readsize.js'];
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

// F12 携卷：写剪贴板。navigator.clipboard 在非安全上下文 / 被拒时会 reject——返回布尔，
// 调用方据此决定要不要走可全选文本框兜底。大卷（22 章 ≈ 上百 KB）照常直接放，只在真写不进时兜底。
async function writeClipboard(text) {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch { return false; }
}

// 剪贴板写不进时的兜底：弹一个可全选（自动 select）的文本框，用户 ⌘A/⌘C 手动拷。
// 用命令式 DOM（不进 Preact 渲染树）：携卷是一次性动作，overlay 关了就销毁，不留状态、不动共享组件。
function showCopyFallback(text) {
  const prev = document.querySelector('.carry-fallback');
  if (prev) prev.remove();
  const overlay = document.createElement('div');
  overlay.className = 'carry-fallback';
  const panel = document.createElement('div');
  panel.className = 'carry-fallback-panel';
  const title = document.createElement('div');
  title.className = 'carry-fallback-title';
  title.textContent = S.carry.fallbackTitle;
  const ta = document.createElement('textarea');
  ta.className = 'carry-fallback-text';
  ta.readOnly = true;
  ta.value = text;
  const close = document.createElement('button');
  close.className = 'btn-ghost carry-fallback-close';
  close.textContent = S.carry.fallbackClose;
  const dismiss = () => overlay.remove();
  close.addEventListener('click', dismiss);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) dismiss(); });
  panel.append(title, ta, close);
  overlay.append(panel);
  document.body.append(overlay);
  ta.focus();
  ta.select();
}



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
  const [zongpis, setZongpis] = useState([]);    // 已呈判（会话区），否则判只能发不能看
  const [viewed, setViewed] = useState(null);    // 正在读的 rev sha；null=head
  const [viewThread, setViewThread] = useState(null); // 展读浮窗：存 root comment id，不存对象——
                                                      // 存对象会在刷新/新回话到达后定格成旧快照
  const [otherOpen, setOtherOpen] = useState(false); // 「其他 N 串」折叠组展开态
  const [zongpiOpen, setZongpiOpen] = useState(false); // 「已呈判」折叠组展开态（默认收起，issue #1）
  const [bodyOpen, setBodyOpen] = useState(false);   // 「折子说明」展开态：有「待你拍板」才默认展开（issue #13）
  // 折号 → 体例检查判词。CI 只在 open 折上跑，已画可的不查。
  const [checks, setChecks] = useState({});
  const [verifyN, setVerifyN] = useState(0);         // F13：当前打开这篇文档里的「需核实」标记数（0=不显示）
  // F13：折号 → 全折「需核实」总数，喂列表角标。**不为它单发请求**——只吃已有取文路径的
  // 副产物：搜索建索引时顺带全算一遍，或某折打开渲染后回填这一折。没搜过又没打开过的折不显示。
  const [verifyCounts, setVerifyCounts] = useState({});
  const [lang, setLangState] = useState(getLang()); // F8：中/EN 偏好，记住上次
  const [readStep, setReadStepState] = useState(getReadStep()); // 正文字号档位，记住上次
  const [stale, setStale] = useState(false);
  const [tab, setTab] = useState('open');        // open=待批 / done=已画可（归档，只读）
  const [donePrs, setDonePrs] = useState([]);
  const [q, setQ] = useState('');                // 搜索词：即输即filter标题；回车全折全文
  const [hits, setHits] = useState(null);        // null=没在搜；[]=搜了没命中
  const [searching, setSearching] = useState('');     // 手上跑的是旧版（见 detectNewBuild）
  const [carrying, setCarrying] = useState(false);    // F12 携卷：正在取全文拼装（大折要一会儿）

  const docRef = useRef(null);
  const autoRan = useRef(false); // 冒烟只跑一次（切折会让 docTick 回到 1）
  const deepLink = useRef(parseDeepLink(location.search));
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
  R.current = { cur, drafts, editing, busy, float, docPath, viewed, headSha, onHead, archived, canAnnotate, viewThread };

  const say = useCallback((t) => setNotice(t), []);

  // 把暂存的深链提示放出来。openPR 一进门就 setNotice('')，所以得等它之后再送——
  // 缺了这一步，pendingNotice 就是只写不读，深链失败会全程静默（#7 顺带修）。
  const flushPending = useCallback(() => {
    const m = pendingNotice.current;
    if (!m) return;
    pendingNotice.current = null;
    setTimeout(() => setNotice(m), 0);
  }, []);

  // 草稿变更统一走这里：内存 + localStorage 同步写，没有 effect 时序问题
  const mutateDrafts = useCallback((prNumber, fn) => {
    setDrafts((ds) => {
      const nd = fn(ds);
      const err = A.saveDrafts(prNumber, nd);
      // 存不下必须明说：草稿是这里唯一不可再生的数据（配额爆时曾静默吞掉）
      if (err) setTimeout(() => setNotice(S.draft.quotaFull), 0);
      return nd;
    });
  }, []);

  useEffect(() => { if (!DEMO) detectNewBuild().then(setStale); }, []);

  // 深链自带的仓 vs 本地配的仓（#7）。病根：以前深链是拿**收链人**配的仓去解析**发链人**给的折号——
  // 发给协审人的 ?pr=30 会落到他自己那个仓的第 30 折上（串台），?ref= 形态则被仓名比对直接判死（静默）。
  // 链接现在自我描述，这里负责对账。返回 true = 本地原本没配仓、这次是从链接里认来的。
  function adoptDeepLinkRepo() {
    const want = deepLink.current?.repo;
    if (!want) return false;                       // 老链接没带仓：照旧按当前仓解析，行为不变
    const have = gh.getRepoSlug();
    if (!have) { gh.setRepoSlug(want); return true; } // 头一回进来：省得收链人还得回头问仓名叫啥
    if (want.toLowerCase() === have.toLowerCase()) return false;
    // 切仓绝不静默：钥匙未必开得了那个仓，而且本地只存一个仓，切了就得手动切回来。
    // 全名摆在弹窗里也是防钓鱼——别人发的链接不能悄悄把 app 指到他的仓上。
    if (confirm(S.deepLink.repoSwitchConfirm(want, have))) {
      gh.setRepoSlug(want);
    } else {
      deepLink.current = null;                     // 不切，就别拿这条链去本仓瞎找折号
      pendingNotice.current = S.deepLink.repoSwitchDeclined(have, want);
    }
    return false;
  }

  // ── 启动 ──
  useEffect(() => {
    if (DEMO) { loadPRs(); return; }
    const adopted = adoptDeepLinkRepo();
    if (!gh.getToken()) {
      setPhase('setup');
      if (adopted) setSetupMsg(S.setup.repoAdoptedFromLink(gh.getRepoSlug()));
      return;
    }
    if (!gh.getRepoSlug()) { setPhase('setup'); setSetupMsg(S.setup.repoNowRequired); return; }
    loadPRs();
  }, []);

  // 并行取每折的体例检查结论。
  //
  // `unreadable`（钥匙缺 Checks: Read）**不逐折显示** —— 那会让 19 张卡同时打问号，
  // 是噪音不是信息。它是一次性的配置问题，出一条通知就够了。
  async function loadChecks(list) {
    if (!api.checkVerdict) return;                       // demo 模式没有这个口
    const open = list.filter((p) => !p.merged_at && p.head?.sha);
    const got = await Promise.all(open.map(async (p) => {
      try { return [p.number, await api.checkVerdict(p.head.sha)]; }
      catch { return [p.number, { state: 'none' }]; }     // 网络抖动不该长成红叉
    }));
    const map = Object.fromEntries(got);
    setChecks(map);
    if (Object.values(map).some((v) => v?.state === 'unreadable')) {
      setNotice(S.check.unreadableNotice);
    }
  }

  async function loadPRs() {
    setPhase('app');
    setNotice('');
    try {
      indexRef.current = null; // 拉了新清单就让搜索索引重建（缓存命中时几乎零成本）
      const list = await api.listOpenPRs();
      if (api.listMergedPRs) api.listMergedPRs().then(setDonePrs).catch(() => {});
      setPrs(list);
      // 体例检查的红绿。**不 await** —— 清单先出来，红绿随后补上；
      // 19 折就是 19 个请求，串起来等要好几秒，而它只是个角标。
      // 拿不到就当没有：这里失败不该拖累整个清单（loadChecks 自己吞异常）。
      loadChecks(list);
      const dl = deepLink.current;
      if (dl) {
        deepLink.current = null;   // 只认一次，之后随手切折不再被它拽回来
        const all = [...list, ...(await api.listMergedPRs?.().catch(() => []) || [])];
        const target = dl.prNumber ? all.find((p) => p.number === dl.prNumber) : null;
        if (target) {
          if (dl.path) jumpRef.current = { prNumber: target.number, path: dl.path, line: dl.line || 1 };
          setTab(target.merged_at ? 'done' : 'open');
          openPR(target);
          flushPending();
          return;
        }
        // 用 ref 暂存：紧接着的 boot/loadPRs 会 setNotice('') 把它冲掉
        pendingNotice.current = dl.prNumber
          ? S.deepLink.folderNotFound(dl.prNumber)
          : S.deepLink.noFolderNumber;
      }
      if (list.length && !R.current.cur) openPR(list[0]); // 在途中用户已手点开折子就别顶掉他
      flushPending();
    } catch (err) {
      if (err.tokenDead) { gh.clearToken(); setPhase('setup'); setSetupMsg(S.setup.tokenDead); return; }
      say(err.rateLimited ? S.list.rateLimited : S.list.failed(err.message));
    }
  }

  async function onSaveToken(repoRaw, tokenRaw) {
    const slug = gh.parseRepoSlug(repoRaw);
    if (!slug) return setSetupMsg(S.setup.repoFormat);
    if (!tokenRaw.trim()) return setSetupMsg(S.setup.tokenMissing);
    setSetupMsg(S.setup.verifying);
    gh.setRepoSlug(slug);
    gh.setToken(tokenRaw);
    try {
      const { canWrite, prAccess } = await gh.verifyToken();
      if (!prAccess) {
        gh.clearToken();
        return setSetupMsg(S.setup.tokenMissingPRScope);
      }
      setSetupMsg('');
      await loadPRs();
      if (!canWrite) say(S.setup.tokenNoWriteWarn);
    } catch (err) {
      gh.clearToken();
      setSetupMsg(S.setup.tokenCannotOpen(gh.repoSlug(), err.message));
    }
  }

  function openPR(pr) {
    setNotice('');
    setFloat(null);
    editElsewhere(null);  // 换折前收掉空草稿：它存进的是**上一折**的 localStorage，回来还会堵在那儿
    setZongpi(false);
    setDocErr(null);
    setDocPath(null);
    setDocTick(0);
    setViewed(null);      // 每次开折先回 head：docPath 置 null 期间就位，与岛屿 effect 的 null→值中转契约不冲突
    setCommits([]);
    setComments([]);
    setZongpis([]);
    setZongpiOpen(false);   // 每开一折都从收起态起：否则上一折展开过，下一折又被历史挡住正文
    // 「折子说明」相反：**这折有拍板点就默认摊开**（issue #13）——它不是历史，是这折要他决定的事，
    // 收起来就等于回到「拍板点静默消失」。没拍板点才收起，把常态成本压回一行标题。
    // 逐折重算（不是沿用上一折的状态）：展开与否是这折的属性，不是用户的偏好。
    setBodyOpen(hasDecisions(pr.body));
    setCur({ pr, files: null, docs: null });
    setDrafts(A.loadDrafts(pr.number));
    // 立刻清岛屿并示 loading：否则 listPRFiles 整个往返期间旧折正文挂着，
    // 这时划选会产出 path:null 的脏草稿（评审 N2）
    const el = docRef.current;
    if (el) {
      const p = document.createElement('p');
      p.className = 'state';
      p.textContent = S.doc.loading;
      el.replaceChildren(p);
    }
    (async () => {
      try {
        const files = await api.listPRFiles(pr.number);
        if (R.current.cur?.pr.number !== pr.number) return; // 世界已变，丢弃
        const docs = files.filter(isDoc);
        setCur({ pr, files, docs });
        if (!docs.length) setDocErr(S.doc.noMarkdown);
        else {
          const jp = jumpRef.current;
          const want = jp?.prNumber === pr.number && docs.find((f) => f.filename === jp.path);
          // 无指定目标时按语言偏好挑首篇（双语折默认开中文版）
          const visible = visibleDocs(docs.map((f) => f.filename), getLang());
          setDocPath(want ? jp.path : (visible[0] || docs[0].filename));
        }
      } catch (err) {
        if (R.current.cur?.pr.number !== pr.number) return;
        setDocErr(S.doc.loadFailed(err.message));
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

  // 已呈批注串：开折拉一次、提交涂归成功后重拉一次（让刚呈的立即可见）。不轮询。
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
    setVerifyN(0);                    // F13：切文档先清计数，取文/渲染后再据实设回
    const p = document.createElement('p');
    p.className = 'state';
    p.textContent = S.doc.loading;
    el.appendChild(p);
    (async () => {
      try {
        const text = await api.getFileText(docPath, ref);
        if (dead) return;
        el.innerHTML = renderMarkdown(text);
        // F13：渲染后在纯文本层给「需核实」标记加可见状态；返回本篇标记数供顶栏显示。
        setVerifyN(decorateVerifyMarkers(el, S.verify.markerTip));
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
            flashTo(target, 'center');
          }, 60);
        }
      } catch (err) {
        if (dead) return;
        el.replaceChildren();
        const q = document.createElement('p');
        q.className = 'state err';
        q.textContent = S.doc.loadFailed(err.message);
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
  // 评论正文里的相对路径图片（#5）：按「当前正文所在目录 + 当前 rev」解析，与正文岛屿同一套 base。
  // 判不锚任何文件、涂归锚的又多半就是在读的这篇，所以拿 docPath 当基准最贴读者的心智。
  // 必须 useCallback：身份不稳的话 CommentBody 的 effect 每次渲染都重跑，白打一轮 Contents API。
  const hydrateComment = useCallback((el) => {
    const pr = R.current.cur?.pr;
    if (!pr || !docPath) return;
    hydrateRelativeImages(el, { docPath, ref: viewed || pr.head.sha, fetchBlobUrl: api.getFileBlobUrl });
  }, [docPath, viewed]);

  const blockTops = useMemo(() => {
    const doc = docRef.current;
    if (!doc) return [];
    return [...doc.querySelectorAll('[data-line]')]
      .map((el) => ({ line: +el.dataset.line, el }))
      .filter((x) => x.line)
      .sort((a, b) => a.line - b.line);
    // docPath 也在依赖里（#2）：blockTops 描述的是「当前文档的块」，它的失效条件本来就该含
    // 「换了文档」。只认 docTick 的话，切 doc-tab 时 marginItems 已按新文档重建出一批新 DOM 节点，
    // 而 blockTops / layoutCards 身份不变 → 布局 effect 整个不触发 → 新卡片一个 style.top 都没有，
    // 全塌到容器顶端叠在一起，要等正文取回来（一整个网络往返）才归位。
    // 附带收益：岛屿 replaceChildren 之后旧 blockTops 里存的是已脱离文档的节点，
    // 这一版顺手让它跟着失效，不留 detached 引用。
  }, [docTick, docPath]);

  // F14 篇内大纲：与 blockTops 同源同失效条件（换文档/正文就位重算），只抽标题不动 DOM。
  const outlineItems = useMemo(() => extractOutline(docRef.current), [docTick, docPath]);

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

  // 只依赖「改变 margin-col 自身子元素集合/高度」的 state。正文之上的块（判、rev 行、tab 条）
  // 高度变了也不用重排：layoutCards 算的是 block.top − colRect.top，而 #doc 与 #margin-col 是
  // .read-row 里顶对齐的 flex 兄弟，一起上下平移，差值恒定。（评审实测：展/收判前后 tops 逐像素相同）
  // 大纲（.toc）不参与这套测量：它是 .stage-row 的第二栏、根本不在 .read-row 里，且是 sticky，
  // 滚动时的位移不进布局流。
  // readStep 必须在依赖里：改字号会改正文里每个块的 top，卡片得跟着重排。ResizeObserver 通常
  // 也会因为正文变高而触发，但那是巧合不是保证——高度碰巧不变而块位移了它就不响。
  useLayoutEffect(() => { layoutCards(); }, [drafts, editing, zongpi, docTick, comments, viewed, readStep, layoutCards]);
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
    // 当前选区 → 浮钮，鼠标与触屏两条路径共用的唯一落点
    const showFloat = () => {
      const a = A.computeAnchor(docRef.current);
      setFloat(a ? { ...a, rect: { left: a.rect.right, top: a.rect.bottom } } : null);
    };
    const onMouseUp = (e) => {
      // .thread-view 同理入列：浮窗里划字是「读」不是「批」，computeAnchor 本来也会因
      // 选区不在 #doc 内返回 null，但那条路径会顺手把浮钮清掉，白折腾一次 setState。
      if (e.target.closest('.zhupi-float, .anno-card, .zongpi-card, .thread-view')) return;
      if (e.target.closest('aside, .mainbar')) { if (R.current.float) setFloat(null); return; } // 点按钮也要收浮钮
      if (!R.current.canAnnotate) { if (R.current.float) setFloat(null); return; } // 旧版/归档只读：不出浮批钮
      setTimeout(showFloat, 0);
    };
    // 触屏路径：iOS Safari 把长按选字与拖选择手柄整段手势交给原生选择 UI，不派发合成的
    // mouse 事件——只挂 mouseup 的话 iPad 上手指选中后浮钮永远不出（接妙控走 mousedown 则正常）。
    // 只对触摸输入启用：桌面拖选途中 selectionchange 连续派发，放行会让浮钮在松手前跟着选区跳。
    let byTouch = false;
    let selTimer = 0;
    const onTouchStart = () => { byTouch = true; };  // 早于长按被系统接管，必定收得到
    const onMouseDown = () => { byTouch = false; };  // 含 iPad 接妙控：一律退回 mouseup 路径
    const onSelectionChange = () => {
      if (!byTouch) return;
      clearTimeout(selTimer);
      selTimer = setTimeout(() => {
        if (!byTouch) return; // 期间来了 mousedown（轻点收选区）：交回 mouseup 判
        if (!R.current.canAnnotate) { if (R.current.float) setFloat(null); return; } // 与 mouseup 同一道只读闸
        showFloat();
      }, 250); // 拖手柄期间连发，等停稳再出钮
    };
    const onKeyDown = (e) => {
      // Esc 收展读浮窗。放在 ⌘Enter 之前、且不排除输入框——浮窗里没有可编辑区，
      // 而「按 Esc 关不掉」是模态窗最招骂的一种坏法。
      if (e.key === 'Escape' && R.current.viewThread != null) { setViewThread(null); return; }
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'Enter') return;
      // 阻断修复：卡内 ⌘Enter 的同一事件会冒泡到这里——不排除输入框就会把整批当场呈出
      if (e.target.closest('textarea, input')) return;
      const { editing, drafts, busy } = R.current;
      if (!editing && drafts.length && !busy) submitRef.current?.();
    };
    const onScroll = () => { if (R.current.float) setFloat(null); }; // 内滚不派发 mousedown，浮钮会残留
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      clearTimeout(selTimer);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('selectionchange', onSelectionChange);
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
      ref: c.pr.head.sha, // 写于哪个版本：推新版后旧草稿降级判，绝不静默钉错行
      blockLine: a.blockLine,
      line: a.line,
      offset: a.offset || 0,
      quote: a.quote,
      quoteRaw: a.quoteRaw,
      note: '',
      ts: Date.now(),
    };
    mutateDrafts(c.pr.number, (ds) => [...ds, d]);
    editElsewhere(d.id);
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

  // 编辑焦点切走时，把还没写字的那条草稿一并收掉——**唯一的 setEditing 入口**（置 null 也走它）。
  //
  // 2026-08-05 报障：划句按「涂归」建了草稿却没写字，转头去划下一句，editing 一切走，
  // 空草稿就留在原地。它退出编辑态后画的是 `.anno-note`（高度全靠内容撑），空内容 ⇒ 0px ⇒
  // 点不着；作罢钮只在编辑态里 ⇒ 删不掉；呈回闸门又拦「空批注不呈」 ⇒ 交不上。三头堵死。
  //
  // 口径与 saveDraft 的「存了个空的＝作罢」完全一致，这里只是补上**隐式**切走这条路径。
  // 不必担心误删正在写的：编辑中点正文只是 blur，editing 不动，textarea 照样挂着。
  function editElsewhere(next) {
    const c = R.current.cur;
    const prev = R.current.editing;
    if (c && prev && prev !== next) {
      mutateDrafts(c.pr.number, (ds) => ds.filter((d) => d.id !== prev || d.note.trim()));
    }
    setEditing(next);
  }

  // 地址栏跟着当前折/文档走（replaceState 不进历史，免得返回键变成翻折）
  useEffect(() => {
    if (DEMO) return;
    const url = cur?.pr
      ? buildDeepLink(location.origin + location.pathname,
        { repo: gh.getRepoSlug(), prNumber: cur.pr.number, path: docPath })
      : location.origin + location.pathname;
    if (location.href !== url) history.replaceState(null, '', url);
  }, [cur?.pr?.number, docPath]);

  // 文档/批注里的本仓 GitHub 链接 → app 内跳转（外链不拦，照常新窗口打开）
  const onDocClick = useCallback((e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');

    // ⓪ 页内锚点 `[…](#slug)`：留在本篇里滚过去。**必须 preventDefault**——
    //    地址栏是深链的载体（buildDeepLink 的 replaceState 常驻），放浏览器自己去处理
    //    会往 URL 上挂一截 hash，跟那条 effect 来回打架，拷出去的直达链也变脏。
    if (href.startsWith('#')) {
      e.preventDefault();
      jumpToAnchor(href.slice(1));
      return;
    }

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
      else say(S.doc.relLinkMissing(rel));
      return;
    }

    // ② 本仓 GitHub permalink：拦成 app 内跳转（F6）
    const parsed = parseZhupiLink(href, gh.getRepoSlug() || (DEMO ? 'demo/repo' : ''));
    if (!parsed) return;
    e.preventDefault();
    jumpTo(parsed);
  }, [prs, donePrs, cur, docPath]);

  // 「引用此处」：把当前选中处拷成一条 GitHub permalink + 引文，粘进别的涂归即成链接
  async function copyRef(e) {
    const a = A.computeAnchor(docRef.current);
    const slug = gh.getRepoSlug() || 'demo/repo';
    // 默认给「涂归直达链」（点了直接进 app 读到那一段）；按住 Alt 给 GitHub permalink
    const wantGithub = Boolean(e?.altKey);
    const md = wantGithub
      ? (a ? buildRef({ slug, path: docPath, line: a.line, quote: a.quote, ref: curRevSha })
           : buildRef({ slug, prNumber: cur?.pr?.number }))
      : (() => {
          const url = buildDeepLink(location.origin + location.pathname,
            { repo: slug, prNumber: cur?.pr?.number, path: a ? docPath : null, line: a?.line });
          const q = (a?.quote || '').trim().slice(0, 60);
          return q ? `[「${q}」](${url})` : url;
        })();
    try { await navigator.clipboard.writeText(md); say(S.ref.copied(`${md.slice(0, 60)}${md.length > 60 ? '…' : ''}`)); }
    catch { say(S.ref.copyFailed(md)); }
  }

  // F12 携卷：把整折拼成自包含 markdown 拷进剪贴板，粘给任意 agent 接续。
  // 正文按需取（docs 只存元数据，正文是懒加载的）——走 getFileText 这条已有路径补齐每篇，
  // 不造新 API。批注串 / 判 / 拍板点本就在内存里，直接喂纯函数 assembleCarry（拼装逻辑单测在那）。
  async function carryOut() {
    const pr = R.current.cur?.pr;
    if (!pr) return;
    if (carrying) return;
    setCarrying(true);
    try {
      const ref = curRevSha || pr.head?.sha;
      const mdFiles = (R.current.cur.docs || []).filter((f) => f.filename.endsWith('.md'));
      // 每篇正文并行取（当前读的那一篇也照取一遍：便宜，且省得把 DOM 反解析回 markdown）。
      // 单篇失败不拖垮整卷——取不到就留 null，assembleCarry 落个占位。
      const docs = await Promise.all(mdFiles.map(async (f) => {
        let text = null;
        try { text = await api.getFileText(f.filename, ref); } catch { /* 单篇取不到不阻断 */ }
        return { path: f.filename, lang: variantOf(f.filename)?.lang || null, text };
      }));
      if (R.current.cur?.pr.number !== pr.number) return; // 组装期间切了折，丢弃
      if (!docs.some((d) => d.text != null) && mdFiles.length) {
        say(S.carry.empty);
        return;
      }
      const md = assembleCarry({
        pr: { number: pr.number, title: pr.title, url: pr.html_url, body: pr.body },
        docs,
        threads,
        zongpis,
        decisions: parseFolderBody(pr.body)?.decisions || null,
        deepLink: buildDeepLink(location.origin + location.pathname,
          { repo: gh.getRepoSlug() || undefined, prNumber: pr.number }),
        assembledAt: new Date().toLocaleString(),
        parseCommentBody: A.parseCommentBody,
        lang: curLangOf,   // 双语对只带在读的那篇；与 switchLang 同一个「当前语言」口径
      });
      const ok = await writeClipboard(md);
      if (ok) say(S.carry.done(md.length));
      else showCopyFallback(md);   // 大卷进不了剪贴板：弹可全选文本框，别把十万字塞进 notice
    } catch (err) {
      say(S.carry.failed(err.message));
    } finally {
      setCarrying(false);
    }
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
    if (query.length < 2) return say(S.search.tooShort);
    const all = [...prs, ...donePrs];
    if (!indexRef.current) {
      setSearching(S.search.indexing);
      indexRef.current = await buildIndex(api, all, (d, t) => setSearching(S.search.indexingProgress(d, t)));
      setSearching('');
      // F13：索引里已备齐各折全文——顺带把「需核实」总数全算一遍喂列表角标，不另发请求。
      // 中英成对文档（foo.md ↔ foo.zh-CN.md）是同一批声明，按 base 归并取最大值，不重复计。
      setVerifyCounts((prev) => {
        const next = { ...prev };
        for (const { pr, files } of indexRef.current) {
          const byBase = new Map();
          for (const [path, text] of Object.entries(files)) {
            const base = variantOf(path)?.base || path;
            byBase.set(base, Math.max(byBase.get(base) || 0, countVerifyMarkers(text)));
          }
          next[pr.number] = [...byBase.values()].reduce((s, n) => s + n, 0);
        }
        return next;
      });
    }
    setHits(searchIndex(indexRef.current, query));
  }
  function clearSearch() { setQ(''); setHits(null); }
  // 滚过去 + 闪一下。四个跳转入口（大纲 / 深链 / 搜索命中 / 页内锚点）共用一条落地动作，
  // 免得「跳到了但没闪」这种半截实现随新入口一个个长出来。
  function flashTo(el, block = 'start') {
    if (!el) return;
    el.scrollIntoView({ block });
    el.classList.add('search-flash');
    setTimeout(() => el.classList.remove('search-flash'), 1600);
  }
  // F14 大纲点标题：跳到当前文档里那一行。复用搜索/深链那条 scroll-to-line + 闪一下的路径
  // （找 data-line ≤ 目标行的最近块），不新造第二套定位逻辑。
  function jumpToLine(line) {
    const el = docRef.current;
    if (!el) return;
    let hit = null;
    el.querySelectorAll('[data-line]').forEach((b) => { if (+b.dataset.line <= line) hit = b; });
    flashTo(hit);
  }
  // 页内锚点 `[…](#slug)`：跳到本篇的那个标题（id 由 render.js 按 GitHub 口径生成）。
  // 用文档自己的标题集匹配，不用 getElementById——后者是**全文档**作用域，
  // 一个恰好叫 `doc`/`app`/`margin-col` 的 slug 会把读者送到界面骨架上去。
  function jumpToAnchor(raw) {
    const el = docRef.current;
    if (!el) return;
    let frag = raw;
    try { frag = decodeURIComponent(raw); } catch { /* 非法百分号编码：按字面匹配 */ }
    const heads = [...el.querySelectorAll('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]')]
      .map((h) => ({ id: h.id, text: h.textContent || '', el: h }));
    const hit = matchAnchor(heads, frag);
    if (!hit) return say(S.jump.anchorMissing(frag));
    flashTo(hit.el);
  }
  // 折间跳转：目标折在哪个栏自动切过去；带 path/line 就落到那一段
  function jumpTo({ prNumber, path, line }) {
    const all = [...prs, ...donePrs];
    const target = prNumber ? all.find((p) => p.number === prNumber) : cur?.pr;
    if (!target) return say(S.jump.folderMissing(prNumber));
    if (path) jumpRef.current = { prNumber: target.number, path, line: line || 1 };
    setTab(target.merged_at ? 'done' : 'open');
    if (target.number === cur?.pr?.number && path === docPath && line) {
      // 同折同文档：不用重开，直接滚
      const el = docRef.current;
      let hit = null;
      el?.querySelectorAll('[data-line]').forEach((b) => { if (+b.dataset.line <= line) hit = b; });
      flashTo(hit, 'center');
      return;
    }
    openPR(target);
  }

  function jumpToHit(pr, hit) {
    if (pr.number === cur?.pr?.number) return jumpTo({ prNumber: pr.number, path: hit.path, line: hit.line });
    jumpRef.current = hit.path ? { prNumber: pr.number, path: hit.path, line: hit.line || 1 } : null;
    // 归档折点进去自动切到已画可栏，视觉上不跳戏
    setTab(pr.merged_at ? 'done' : 'open');
    openPR(pr);
  }

  // ── 呈回 ──
  async function submitAll() {
    const c = R.current.cur;
    const ds = R.current.drafts;
    if (!c || !ds.length || R.current.busy) return;
    if (R.current.archived) return say(S.submit.archivedReadonly);
    if (!R.current.onHead) return say(S.submit.oldRevBlocked);
    if (R.current.editing) return say(S.submit.editingBlocked);
    const noteless = ds.filter((d) => !d.note.trim());
    if (noteless.length) return say(S.submit.emptyNotes(noteless.length));
    // 在途中世界可能变（切折/刷新）——入口快照，完成回调只认这份
    const prNumber = c.pr.number;
    const ref = c.pr.head.sha;
    const hunks = new Map();
    (c.files || []).forEach((f) => hunks.set(f.filename, A.validRightLines(f.patch)));
    const inline = [], fallback = [];
    ds.forEach((d) => {
      const stale = d.ref !== ref; // 旧版本草稿：行号可能漂移，宁降判不钉错行
      const set = hunks.get(d.path);
      if (!stale && set && set.has(d.line)) inline.push({ path: d.path, line: d.line, side: 'RIGHT', body: A.fmtDraft(d) });
      else fallback.push(d);
    });
    const body = fallback.length
      ? S.submit.fallbackBody(fallback.map(A.fmtDraft).join('\n\n---\n\n'))
      : S.submit.inlineBody(inline.length); // body 恒非空：COMMENT 的 body 是文档必填项，不赌空串
    setBusy(true);
    try {
      await api.submitReview(prNumber, { body, comments: inline, commitId: ref });
      A.saveDrafts(prNumber, []); // 直接清对应 key；内存只在世界没变时动
      if (R.current.cur?.pr.number === prNumber) setDrafts([]);
      loadComments(prNumber); // 重拉已呈串：让刚呈的立即出现在右缘（世界守卫在 loadComments 内）
      say(S.submit.done(inline.length, fallback.length));
    } catch (err) {
      say(S.submit.failed(err.message));
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
      loadComments(c.pr.number); // 重拉：让刚呈的判立刻显示在折首
      setZongpiOpen(true);       // 折叠组默认收起，自己刚发的那条必须展开给他看见——否则回到「只能发不能看」
      say(S.zongpi.sent);
    } catch (err) {
      say(S.zongpi.failed(err.message));
    } finally {
      setBusy(false);
    }
  }

  // ── 画可 ──
  async function qinci() {
    const c = R.current.cur;
    if (!c) return;
    if (!R.current.onHead) return say(S.merge.oldRevBlocked);
    const pr = c.pr;
    const pending = R.current.drafts.length;
    const warn = pending ? S.merge.pendingDraftsWarn(pending) : '';
    if (!confirm(S.merge.confirm(pr.number, pr.title, warn))) return;
    setBusy(true);
    try {
      if (pr.draft) {
        await api.markReady(pr.node_id);
        pr.draft = false; // 本地同步：merge 失败重试不再重打 markReady
      }
      await api.mergePR(pr.number, pr.head.sha); // 带 sha：agent 中途推新版则 409，所批即所合
      say(S.merge.done(pr.number));
      setCur(null);
      setDocPath(null);
      setDocErr(null);
      await loadPRs();
    } catch (err) {
      say(S.merge.failed(err.message, pr.draft, pr.number));
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
    onForget=${() => { gh.clearToken(); setSetupMsg(S.setup.tokenCleared); }} />`;

  const docDrafts = drafts.filter((d) => d.path === docPath);
  const others = drafts.length - docDrafts.length;
  const timeAgo = (iso) => {
    const mins = Math.round((Date.now() - new Date(iso)) / 60000);
    if (mins < 60) return S.time.minutesAgo(mins);
    if (mins < 1440) return S.time.hoursAgo(Math.round(mins / 60));
    return S.time.daysAgo(Math.round(mins / 1440));
  };

  // 已呈批注串：按能否定位到当前文档分两组
  const docThreads = [], otherThreads = [];
  threads.forEach((t) => {
    const r = t.root;
    const outdated = r.line == null;
    // outdated（line=null）先拿引文在当前版正文里反查行号；original_line 是旧版行号，
    // 直接拿它对齐会把卡片贴到错误的段落上（PAIN 2026-07-28 #14），只当反查失败的兜底。
    const reanchored = outdated
      ? A.reanchorByQuote(docRef.current, A.parseCommentBody(r.body).quote)
      : null;
    const anchorLine = r.line ?? reanchored ?? r.original_line;
    if (r.path === docPath && anchorLine != null) docThreads.push({ t, blockLine: anchorLine, outdated });
    else otherThreads.push(t);
  });
  docThreads.sort((a, b) => a.blockLine - b.blockLine);

  // 草稿卡与已呈串必须合并排序再渲染：layoutCards 是单调下压式堆叠，
  // 两组各自有序会把串卡整体压到全部草稿之下、离锚点任意远（第四轮评审 A）
  const marginItems = [
    ...docDrafts.map((d) => ({
      blockLine: d.blockLine,
      el: html`<${DraftCard} key=${d.id} d=${d} doc=${docRef.current} editing=${editing === d.id}
        onEdit=${editElsewhere} onSave=${saveDraft} onDrop=${dropDraft} />`,
    })),
    ...docThreads.map(({ t, blockLine, outdated }) => ({
      blockLine,
      el: html`<${ShownThread} key=${'c' + t.root.id} t=${t} blockLine=${blockLine} outdated=${outdated}
        hydrate=${hydrateComment} onExpand=${setViewThread} />`,
    })),
  ].sort((a, b) => a.blockLine - b.blockLine);

  // 展读浮窗按 id 现查现渲：串本身仍归 comments 那份 state 管，回话到了浮窗跟着更新。
  // 串被删/切了文档就查不到 → 自然不渲染，不必再写一路清理。
  const viewing = viewThread == null ? null : docThreads.find(({ t }) => t.root.id === viewThread);

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

  // F14：章多时用下拉取代 tab 条（双语已合并计数）；篇内大纲够长才出浮栏。
  const docNames = cur?.docs ? cur.docs.map((f) => f.filename) : [];
  const useChapterList = shouldUseChapterList(docNames, curLangOf);
  const chapters = useChapterList ? chapterList(docNames, docPath, curLangOf) : [];
  const showOutline = hasOutline(outlineItems);

  return html`
    <div id="app" style=${{ '--read-scale': scaleOf(readStep) }}>
      <${Sidebar} q=${q} hits=${hits} searching=${searching} prs=${prs} donePrs=${donePrs}
        tab=${tab} cur=${cur} demo=${DEMO} timeAgo=${timeAgo} checks=${checks} verifyCounts=${verifyCounts}
        onQuery=${(v) => { setQ(v); if (hits) setHits(null); }}
        onSearch=${runSearch} onClearSearch=${clearSearch} onJumpToHit=${jumpToHit}
        onTab=${setTab} onOpenPR=${openPR}
        onSettings=${() => { setPhase('setup'); setSetupMsg(''); }} />
      <main>
        <${Topbar} cur=${cur} archived=${archived} onHead=${onHead} busy=${busy}
          draftCount=${drafts.length} verifyN=${verifyN} happyUrl=${happyUrl} stale=${stale} notice=${notice}
          carrying=${carrying}
          readStep=${readStep}
          onReadStep=${(i) => { const c = clampStep(i); setReadStepState(c); setReadStep(c); }}
          onRefresh=${() => { setCur(null); setDocPath(null); loadPRs(); }}
          onCopyRef=${copyRef} onCarry=${carryOut} onZongpi=${() => setZongpi((z) => !z)}
          onSubmit=${submitAll} onQinci=${qinci} />
        <div class="work">
        <div class="stage-row">
          ${cur?.docs?.length > 1 && useChapterList && html`
            <${ChapterRail} chapters=${chapters}
              onOpenChapter=${(path) => { setViewed(null); setDocPath(path); }} />`}
        <div class="stage-main">
          ${cur?.docs?.length > 1 && useChapterList && html`
            <${ChapterList} chapters=${chapters}
              onOpenChapter=${(path) => { setViewed(null); setDocPath(path); }} />`}
          ${cur?.docs?.length > 1 && !useChapterList && html`
            <div class="doc-tabs">
              ${cur.docs.filter((f) => visibleDocs(cur.docs.map((x) => x.filename), curLangOf).includes(f.filename)).map((f) => html`
                <button key=${f.filename} class=${'doc-tab' + (f.filename === docPath ? ' active' : '')}
                  title=${f.filename} onClick=${() => { setViewed(null); setDocPath(f.filename); }}>
                  ${f.filename.split('/').pop().replace(/\.zh-CN\.md$/i, '.md')}
                </button>`)}
            </div>`}
          ${cur && revs.length > 1 && html`
            <div class="rev-row">
              <span class="rev-label">${S.rev.label}</span>
              <div class="rev-switch">
                ${revs.map((r) => html`
                  <button key=${r.sha}
                    class=${'rev-opt' + (r.sha === curRevSha ? ' active' : '')}
                    title=${S.rev.optionTitle(r.v, r.sha.slice(0, 7), r.when ? ' · ' + timeAgo(r.when) : '', r.isHead)}
                    onClick=${() => setViewed(r.isHead ? null : r.sha)}>
                    v${r.v}${r.isHead ? '' : ' · ' + r.sha.slice(0, 7)}
                  </button>`)}
              </div>
            </div>`}
          ${cur && archived && html`
            <p class="rev-notice">${S.rev.archivedNotice}</p>`}
          ${cur && !archived && !onHead && html`
            <p class="rev-notice">${S.rev.oldRevNotice(revs.find((r) => r.sha === curRevSha)?.v ?? '?')}</p>`}
          ${cur && html`<${FolderBody} body=${cur.pr.body} open=${bodyOpen}
            onToggle=${() => setBodyOpen((o) => !o)} hydrate=${hydrateComment} />`}
          ${cur && html`<${ZongpiShown} zongpis=${zongpis} open=${zongpiOpen}
            onToggle=${() => setZongpiOpen((o) => !o)} hydrate=${hydrateComment} />`}
          ${langSibling && html`
            <div class="lang-switch" title=${S.docLang.switchTitle}>
              <button class=${'lang-opt' + (curLangOf === 'zh' ? ' active' : '')} onClick=${() => switchLang('zh')}>${S.docLang.zh}</button>
              <button class=${'lang-opt' + (curLangOf === 'en' ? ' active' : '')} onClick=${() => switchLang('en')}>${S.docLang.en}</button>
            </div>`}
          <div class="read-row" onClick=${onDocClick}>
            ${docErr ? html`<article id="doc"><p class="state err">${docErr}</p></article>`
              : html`<article id="doc" key="doc-island" ref=${docRef}></article>`}
            <div id="margin-col" class="margin-col">
              ${zongpi && html`<${ZongpiCard} busy=${busy} onSend=${sendZongpi} onClose=${() => setZongpi(false)} />`}
              ${marginItems.map((m) => m.el)}
              ${others > 0 && html`<p class="margin-note">${S.margin.otherDocs(others)}</p>`}
            </div>
          </div>
          <${OtherThreads} threads=${otherThreads} open=${otherOpen}
            onToggle=${() => setOtherOpen((o) => !o)} hydrate=${hydrateComment} />
        </div>
        ${cur && !docErr && showOutline && html`
          <${Outline} items=${outlineItems} docRef=${docRef} onJump=${jumpToLine} />`}
        </div>
        </div>
      </main>
      ${cur && html`<${ScrollEnds} tick=${`${docTick}:${docPath}`} />`}
      ${float && html`
        <button class="zhupi-float" style=${{ left: `${Math.min(float.rect.left + 8, window.innerWidth - 76)}px`, top: `${float.rect.top + 6}px` }}
          onMouseDown=${(e) => e.preventDefault()} onClick=${addDraft}>${S.action.annotate}</button>`}
      ${viewing && html`
        <${ThreadView} key=${'v' + viewing.t.root.id} t=${viewing.t} blockLine=${viewing.blockLine}
          outdated=${viewing.outdated} hydrate=${hydrateComment} onClose=${() => setViewThread(null)} />`}
    </div>`;
}

render(html`<${App} />`, document.getElementById('root'));
