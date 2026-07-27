// 御笔朱批 —— Preact 视图层（B 方案，2026-07-26 闸门触发后迁移）
// 免构建形态：htm/preact standalone vendored，push 即部署的性质不变。
// 纯逻辑（锚定/hunk/草稿）在 anchor.js，API 在 github.js，渲染在 render.js——迁移零改动。
import {
  html, render, useState, useEffect, useLayoutEffect, useRef, useCallback,
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
          }}></textarea>
        <div class="anno-row">
          <button class="anno-ghost" onClick=${() => onDrop(d.id)}>作罢</button>
          <button class="anno-save" onClick=${() => onSave(d.id, taRef.current.value)}>存批</button>
        </div>` : html`
        <div class="anno-note" title="点击修改" onClick=${() => onEdit(d.id)}>${d.note}</div>`}
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
        <button class="anno-ghost" onClick=${onClose}>作罢</button>
        <button class="anno-save" onClick=${() => onSend(taRef.current.value)}>${busy ? '呈递中…' : '呈总批'}</button>
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

  const docRef = useRef(null);
  // 全局监听器只绑一次，读最新状态走这面镜子
  const R = useRef({});
  R.current = { cur, drafts, editing, busy, float, docPath };

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
      if (list.length) openPR(list[0]);
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
    setCur({ pr, files: null, docs: null });
    setDrafts(A.loadDrafts(pr.number));
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
  }

  // ── 文档岛屿：内容不归 vdom 管，effect 负责取文与注入；cleanup 即世代守卫 ──
  useEffect(() => {
    const el = docRef.current;
    if (!el || !cur?.pr || !docPath) return;
    let dead = false;
    el.replaceChildren();
    const p = document.createElement('p');
    p.className = 'state';
    p.textContent = '展折中…';
    el.appendChild(p);
    (async () => {
      try {
        const text = await api.getFileText(docPath, cur.pr.head.sha);
        if (dead) return;
        el.innerHTML = renderMarkdown(text);
        await hydrateRelativeImages(el, { docPath, ref: cur.pr.head.sha, fetchBlobUrl: api.getFileBlobUrl });
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
  }, [cur?.pr?.number, docPath]);

  // demo 自动划批（真实事件路径的冒烟）
  useEffect(() => {
    if (DEMO && AUTO && docTick === 1) autoAnnotate(docRef.current);
  }, [docTick]);

  // ── 高亮 ──
  useEffect(() => {
    if (!('highlights' in CSS)) return;
    const doc = docRef.current;
    const hl = new Highlight();
    if (doc && docTick > 0) {
      drafts.filter((d) => d.path === docPath).forEach((d) => {
        const r = A.rangeForDraft(doc, d);
        if (r) hl.add(r);
      });
    }
    CSS.highlights.set('zhupi-draft', hl);
    return () => CSS.highlights.delete('zhupi-draft');
  }, [drafts, docTick, docPath]);

  // ── 批注卡对齐（图片/字体异步加载改块高 → ResizeObserver 重排）──
  const layoutCards = useCallback(() => {
    const col = document.getElementById('margin-col');
    const doc = docRef.current;
    if (!col || !doc) return;
    const colRect = col.getBoundingClientRect();
    let prevBottom = 0;
    [...col.children].forEach((card) => {
      let top = prevBottom + 12;
      const line = card.dataset.blockLine;
      if (line) {
        const block = doc.querySelector(`[data-line="${line}"]`);
        if (block) top = Math.max(block.getBoundingClientRect().top - colRect.top, prevBottom + 12);
      }
      card.style.top = `${Math.max(top, 0)}px`;
      prevBottom = Math.max(top, 0) + card.offsetHeight;
    });
    col.style.minHeight = `${prevBottom + 20}px`;
  }, []);

  useLayoutEffect(() => { layoutCards(); }, [drafts, editing, zongpi, docTick]);
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !docRef.current) return;
    const ro = new ResizeObserver(() => layoutCards());
    ro.observe(docRef.current);
    return () => ro.disconnect();
  }, [docTick === 0]);
  useEffect(() => {
    const onResize = () => layoutCards();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── 全局监听：划选 / ⌘Enter / 滚动收浮钮 ──
  const submitRef = useRef();
  useEffect(() => {
    const onMouseUp = (e) => {
      if (e.target.closest('.zhupi-float, .anno-card, .zongpi-card, aside, .mainbar')) return;
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
      await loadPRs();
    } catch (err) {
      say(`钦此失败：${err.message}`);
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
        <button class="settings" onClick=${() => { gh.clearToken(); setPhase('setup'); setSetupMsg(''); }}>设置 · 钥匙</button>
      </aside>
      <main>
        <div class="mainbar">
          <span class="crumb">待批 ${cur ? html`/ <b>${cur.pr.title}</b>` : ''}</span>
          <span class="actions">
            <button class="btn-ghost" onClick=${() => { setCur(null); setDocPath(null); loadPRs(); }}>刷新</button>
            ${cur && html`<button class="btn-ghost" onClick=${() => setZongpi((z) => !z)}>总批</button>`}
            ${drafts.length > 0 && html`
              <button class="btn-primary btn-submit" disabled=${busy} onClick=${submitAll}>
                ${busy ? '呈递中…' : `提交朱批 · ${drafts.length}`}
              </button>`}
            ${cur && html`<button class="btn-qinci" disabled=${busy} onClick=${qinci}>钦 此</button>`}
          </span>
        </div>
        ${notice && html`<p class="notice">${notice}</p>`}
        <div class="work">
          ${cur?.docs?.length > 1 && html`
            <div class="doc-tabs">
              ${cur.docs.map((f) => html`
                <button key=${f.filename} class=${'doc-tab' + (f.filename === docPath ? ' active' : '')}
                  title=${f.filename} onClick=${() => setDocPath(f.filename)}>
                  ${f.filename.split('/').pop()}
                </button>`)}
            </div>`}
          <div class="read-row">
            ${docErr ? html`<article id="doc"><p class="state err">${docErr}</p></article>`
              : html`<article id="doc" key="doc-island" ref=${docRef}></article>`}
            <div id="margin-col" class="margin-col">
              ${zongpi && html`<${ZongpiCard} busy=${busy} onSend=${sendZongpi} onClose=${() => setZongpi(false)} />`}
              ${docDrafts.sort((a, b) => a.line - b.line).map((d) => html`
                <${DraftCard} key=${d.id} d=${d} doc=${docRef.current} editing=${editing === d.id}
                  onEdit=${(id) => setEditing(id)} onSave=${saveDraft} onDrop=${dropDraft} />`)}
              ${others > 0 && html`<p class="margin-note">另有 ${others} 条朱批在此折其他文档</p>`}
            </div>
          </div>
        </div>
      </main>
      ${float && html`
        <button class="zhupi-float" style=${{ left: `${Math.min(float.rect.left + 8, window.innerWidth - 76)}px`, top: `${float.rect.top + 6}px` }}
          onMouseDown=${(e) => e.preventDefault()} onClick=${addDraft}>朱批</button>`}
    </div>`;
}

render(html`<${App} />`, document.getElementById('root'));
