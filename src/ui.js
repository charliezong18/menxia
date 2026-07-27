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

const params = new URLSearchParams(location.search);
const DEMO = params.get('demo') === '1';
const AUTO = params.get('auto') === '1';
const api = DEMO ? demoApi : gh;

const isDoc = (f) => f.filename.endsWith('.md') && f.status !== 'removed';

// ── 设置页 ──
function Setup({ msg, onSave }) {
  const [preview, setPreview] = useState(gh.parseRepoSlug(gh.getRepoSlug()) || '你上面填的那个仓库');
  const repoRef = useRef();
  const tokenRef = useRef();
  const submit = () => onSave(repoRef.current.value, tokenRef.current.value);
  return html`
    <section id="setup">
      <div class="setup-card">
        <div class="brand-row"><span class="seal">朱</span><span class="brand">御笔朱批</span></div>
        <p class="setup-lead">读 AI 呈上来的奏折，划句落朱批。先说清读哪个仓库，再给一把只开这个仓库的钥匙。</p>
        <ol class="setup-steps">
          <li>填<b>奏折仓库</b>：agent 往哪个仓库开 PR，就填哪个，格式 <code>owner/repo</code>（建议私有）</li>
          <li>去 <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">GitHub 生成 fine-grained token</a>（名字随意，Expiration 建议 90 days）</li>
          <li>Repository access：默认停在 Public repositories，<b>必须改成 Only select repositories</b> → 选 <code>${preview}</code>（不是 zhupi 本身）</li>
          <li>Permissions → Repository permissions 加<b>两</b>项：<b>Contents: Read and write</b> ＋ <b>Pull requests: Read and write</b>。Metadata 自动带上不用管；<b>最容易漏的是 Pull requests</b>，漏了进清单就 403</li>
          <li>Generate 后把 <code>github_pat_…</code> 粘在下面。钥匙只存这台设备的浏览器，不经过任何服务器；权限配错不用重新生成——回 token 页改好点 Update，再回来存一次即可（字符串不变）</li>
        </ol>
        <input id="repo-input" ref=${repoRef} type="text" placeholder="owner/repo"
          autocomplete="off" spellcheck="false" defaultValue=${gh.getRepoSlug()}
          onInput=${(e) => setPreview(gh.parseRepoSlug(e.target.value) || '你上面填的那个仓库')}
          onKeyDown=${(e) => { if (e.key === 'Enter') tokenRef.current.focus(); }} />
        <input id="token-input" ref=${tokenRef} type="password" placeholder="github_pat_…"
          autocomplete="off" spellcheck="false"
          onKeyDown=${(e) => { if (e.key === 'Enter') submit(); }} />
        <div class="setup-actions">
          <button class="btn-primary" onClick=${submit}>存 钥</button>
          <span class=${'setup-msg' + (msg && msg !== '验钥中…' ? ' err' : '')}>${msg}</span>
        </div>
      </div>
    </section>`;
}

// ── 批注卡 ──
function DraftCard({ d, doc, editing, onEdit, onSave, onDrop }) {
  const taRef = useRef();
  useEffect(() => { if (editing) setTimeout(() => taRef.current?.focus(), 0); }, [editing]);
  const sec = doc ? A.sectionOf(doc, d.blockLine) : '';
  return html`
    <div class="anno-card" data-block-line=${d.blockLine} key=${d.id}>
      <div class="anno-quote">「${d.quote.length > 80 ? d.quote.slice(0, 80) + '…' : d.quote}」</div>
      <div class="anno-src">${sec ? sec + ' · ' : ''}第 ${d.line} 行</div>
      ${editing ? html`
        <textarea class="anno-input" ref=${taRef} placeholder="朱批……" defaultValue=${d.note}
          onKeyDown=${(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.stopPropagation(); onSave(d.id, taRef.current.value); }
          }}
          onBlur=${() => {
            // 打了一半没存批就点了别处（换卡/新划句）→ 自动存，别生吞长批注（评审阻断项）
            const v = taRef.current?.value.trim();
            if (v && v !== d.note) onSave(d.id, taRef.current.value);
          }}></textarea>
        <div class="anno-row">
          <button class="anno-ghost" onMouseDown=${(e) => e.preventDefault()} onClick=${() => onDrop(d.id)}>作罢</button>
          <button class="anno-save" onMouseDown=${(e) => e.preventDefault()} onClick=${() => onSave(d.id, taRef.current.value)}>存批</button>
        </div>` : html`
        <div class="anno-note" title="点击修改" onClick=${() => onEdit(d.id)}>${d.note}</div>`}
    </div>`;
}

// 已呈批注串（墨色安静系，视觉降一档；朱砂只留给草稿的活跃态）
// blockLine 用串的源文件行号（line ?? original_line）直接当锚，参与 layoutCards 对齐
function ShownThread({ t, blockLine, outdated }) {
  const { quote, body } = A.parseCommentBody(t.root.body);
  return html`
    <div class="anno-card anno-shown" data-block-line=${blockLine} key=${'c' + t.root.id}>
      ${quote && html`<div class="anno-quote-shown">「${quote}」</div>`}
      <div class="anno-src">
        <span class="anno-who">${t.root.user?.login || '?'}</span>
        ${outdated ? html`<span class="anno-outdated" title="此行已随新版漂移">旧</span>` : ''}
      </div>
      <div class="anno-shown-body">${body}</div>
      ${t.replies.map((r) => {
        const rp = A.parseCommentBody(r.body);
        return html`
          <div class="anno-reply" key=${'c' + r.id}>
            <div class="anno-reply-who">回话 · ${r.user?.login || '?'}</div>
            <div class="anno-shown-body">${rp.body}</div>
          </div>`;
      })}
    </div>`;
}

function ZongpiCard({ busy, onSend, onClose }) {
  const taRef = useRef();
  useEffect(() => { setTimeout(() => taRef.current?.focus(), 0); }, []);
  return html`
    <div class="anno-card zongpi-card">
      <div class="anno-src">总批 · 整折总评（呈出即达，不攒批）</div>
      <textarea class="anno-input" ref=${taRef} rows="4" placeholder="总批……可以按序号列意见"></textarea>
      <div class="anno-row">
        <button class="anno-ghost" onMouseDown=${(e) => e.preventDefault()} onClick=${onClose}>作罢</button>
        <button class="anno-save" onMouseDown=${(e) => e.preventDefault()} onClick=${() => onSend(taRef.current.value)}>${busy ? '呈递中…' : '呈总批'}</button>
      </div>
    </div>`;
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
  const [viewed, setViewed] = useState(null);    // 正在读的 rev sha；null=head
  const [otherOpen, setOtherOpen] = useState(false); // 「其他 N 串」折叠组展开态

  const docRef = useRef(null);
  // 全局监听器只绑一次，读最新状态走这面镜子
  const R = useRef({});
  // headSha / viewedRef 入镜：全局 mouseup 要据此判定「旧版只读 → 不出浮批」
  const headSha = cur?.pr?.head?.sha || null;
  const onHead = !viewed || viewed === headSha;
  R.current = { cur, drafts, editing, busy, float, docPath, viewed, headSha, onHead };

  const say = useCallback((t) => setNotice(t), []);

  // 草稿变更统一走这里：内存 + localStorage 同步写，没有 effect 时序问题
  const mutateDrafts = useCallback((prNumber, fn) => {
    setDrafts((ds) => {
      const nd = fn(ds);
      A.saveDrafts(prNumber, nd);
      return nd;
    });
  }, []);

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
      const list = await api.listOpenPRs();
      setPrs(list);
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
        else setDocPath(docs[0].filename);
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
      const cs = await api.listPRComments(prNumber);
      if (R.current.cur?.pr.number === prNumber) setComments(cs);
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
    if (DEMO && AUTO && docTick === 1) autoAnnotate(docRef.current);
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
      if (line) {
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
      if (!R.current.onHead) { if (R.current.float) setFloat(null); return; } // 旧版只读：不出浮批钮
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

  // ── 呈回 ──
  async function submitAll() {
    const c = R.current.cur;
    const ds = R.current.drafts;
    if (!c || !ds.length || R.current.busy) return;
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

  // ── 视图 ──
  if (phase === 'boot') return null;
  if (phase === 'setup') return html`<${Setup} msg=${setupMsg} onSave=${onSaveToken} />`;

  const docDrafts = drafts.filter((d) => d.path === docPath);
  const others = drafts.length - docDrafts.length;
  const timeAgo = (iso) => {
    const mins = Math.round((Date.now() - new Date(iso)) / 60000);
    if (mins < 60) return `${mins} 分钟前`;
    if (mins < 1440) return `${Math.round(mins / 60)} 小时前`;
    return `${Math.round(mins / 1440)} 天前`;
  };

  // 已呈批注串：串起来后按能否定位到当前文档分两组
  const threads = useMemo(() => A.threadComments(comments), [comments]);
  const docThreads = [], otherThreads = [];
  threads.forEach((t) => {
    const r = t.root;
    const anchorLine = r.line ?? r.original_line; // outdated（line=null）退回 original_line
    if (r.path === docPath && anchorLine != null) docThreads.push({ t, blockLine: anchorLine, outdated: r.line == null });
    else otherThreads.push(t);
  });
  docThreads.sort((a, b) => a.blockLine - b.blockLine);

  // rev 序列反序展示（新→旧），标 v 号；vN=head
  const revs = commits.map((c, i) => ({
    sha: c.sha,
    v: i + 1,
    isHead: c.sha === headSha,
    when: c.commit?.committer?.date || c.commit?.author?.date,
  }));
  const curRevSha = viewed || headSha;

  return html`
    <div id="app">
      <aside>
        <div class="brand-row"><span class="seal">朱</span><span class="brand">御笔朱批</span></div>
        <div class="sec-label">待批奏折 · ${prs.length}</div>
        <nav id="pr-list">
          ${prs.length ? prs.map((pr) => html`
            <button key=${pr.number} class=${'pr-item' + (cur?.pr.number === pr.number ? ' active' : '')}
              onClick=${() => openPR(pr)}>
              <h3>${pr.title}</h3>
              <div class="meta">#${pr.number} · 呈于 ${timeAgo(pr.updated_at)}</div>
            </button>`) : html`<p class="state">此刻无折可批。</p>`}
        </nav>
        ${!DEMO && html`<button class="settings" onClick=${() => { gh.clearToken(); setPhase('setup'); setSetupMsg(''); }}>设置 · 钥匙</button>`}
      </aside>
      <main>
        <div class="mainbar">
          <span class="crumb">待批 ${cur ? html`/ <b>${cur.pr.title}</b>` : ''}</span>
          <span class="actions">
            <button class="btn-ghost" onClick=${() => { setCur(null); setDocPath(null); loadPRs(); }}>刷新</button>
            ${cur && html`<button class="btn-ghost" onClick=${() => setZongpi((z) => !z)}>总批</button>`}
            ${cur && drafts.length > 0 && html`
              <button class="btn-primary btn-submit" disabled=${busy || !onHead}
                title=${onHead ? '' : '正在读旧版——先切回 head 再提交'} onClick=${submitAll}>
                ${busy ? '呈递中…' : `提交朱批 · ${drafts.length}`}
              </button>`}
            ${cur && html`<button class="btn-qinci" disabled=${busy || !onHead}
              title=${onHead ? '' : '正在读旧版——先切回 head 再钦此'} onClick=${qinci}>钦 此</button>`}
          </span>
        </div>
        ${notice && html`<p class="notice">${notice}</p>`}
        <div class="work">
          ${cur?.docs?.length > 1 && html`
            <div class="doc-tabs">
              ${cur.docs.map((f) => html`
                <button key=${f.filename} class=${'doc-tab' + (f.filename === docPath ? ' active' : '')}
                  title=${f.filename} onClick=${() => { setViewed(null); setDocPath(f.filename); }}>
                  ${f.filename.split('/').pop()}
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
          ${cur && !onHead && html`
            <p class="rev-notice">在读 v${revs.find((r) => r.sha === curRevSha)?.v ?? '?'}（旧版）· 批注请回最新版</p>`}
          <div class="read-row">
            ${docErr ? html`<article id="doc"><p class="state err">${docErr}</p></article>`
              : html`<article id="doc" key="doc-island" ref=${docRef}></article>`}
            <div id="margin-col" class="margin-col">
              ${zongpi && html`<${ZongpiCard} busy=${busy} onSend=${sendZongpi} onClose=${() => setZongpi(false)} />`}
              ${docDrafts.sort((a, b) => a.line - b.line).map((d) => html`
                <${DraftCard} key=${d.id} d=${d} doc=${docRef.current} editing=${editing === d.id}
                  onEdit=${(id) => setEditing(id)} onSave=${saveDraft} onDrop=${dropDraft} />`)}
              ${docThreads.map(({ t, blockLine, outdated }) => html`
                <${ShownThread} key=${'c' + t.root.id} t=${t} blockLine=${blockLine} outdated=${outdated} />`)}
              ${others > 0 && html`<p class="margin-note">另有 ${others} 条朱批在此折其他文档</p>`}
            </div>
          </div>
          ${otherThreads.length > 0 && html`
            <div class="other-threads">
              <button class="other-threads-toggle" onClick=${() => setOtherOpen((o) => !o)}>
                ${otherOpen ? '▾' : '▸'} 其他 ${otherThreads.length} 串（其他文档 / 无法定位）
              </button>
              ${otherOpen && html`
                <div class="other-threads-list">
                  ${otherThreads.map((t) => {
                    const { quote, body } = A.parseCommentBody(t.root.body);
                    return html`
                      <div class="anno-card anno-shown anno-static" key=${'o' + t.root.id}>
                        <div class="anno-src"><span class="anno-who">${t.root.user?.login || '?'}</span>
                          <span class="anno-path">${(t.root.path || '整折').split('/').pop()}</span></div>
                        ${quote && html`<div class="anno-quote-shown">「${quote}」</div>`}
                        <div class="anno-shown-body">${body}</div>
                        ${t.replies.map((r) => html`
                          <div class="anno-reply" key=${'o' + r.id}>
                            <div class="anno-reply-who">回话 · ${r.user?.login || '?'}</div>
                            <div class="anno-shown-body">${A.parseCommentBody(r.body).body}</div>
                          </div>`)}
                      </div>`;
                  })}
                </div>`}
            </div>`}
        </div>
      </main>
      ${float && html`
        <button class="zhupi-float" style=${{ left: `${Math.min(float.rect.left + 8, window.innerWidth - 76)}px`, top: `${float.rect.top + 6}px` }}
          onMouseDown=${(e) => e.preventDefault()} onClick=${addDraft}>朱批</button>`}
    </div>`;
}

render(html`<${App} />`, document.getElementById('root'));
