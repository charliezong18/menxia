// 御笔朱批 M1 —— 钥匙设置 / 待批清单 / 渲染阅读
import * as gh from './github.js';
import * as annotate from './annotate.js';
import { renderMarkdown, hydrateRelativeImages } from './render.js';

const $ = (id) => document.getElementById(id);
const state = { prs: [], current: null, docs: [], docPath: null };
let generation = 0; // 丢弃过期的异步响应，避免快速切折时正文与选中项错位

// ── 钥匙设置 ──
function showSetup(msg = '') {
  $('app').hidden = true;
  $('setup').hidden = false;
  if (!$('repo-input').value) $('repo-input').value = gh.getRepoSlug(); // 别冲掉用户刚敲一半的
  syncRepoName();
  const el = $('setup-msg');
  el.textContent = msg;
  el.classList.toggle('err', Boolean(msg));
}

// 第 3 步的仓库名跟着输入框走，省得对照
function syncRepoName() {
  const slug = gh.parseRepoSlug($('repo-input').value);
  $('repo-name').textContent = slug || '你上面填的那个仓库';
}

async function saveToken() {
  const slug = gh.parseRepoSlug($('repo-input').value);
  if (!slug) return showSetup('奏折仓库要填成 owner/repo（贴 GitHub 链接也行）。');
  const value = $('token-input').value.trim();
  if (!value) return showSetup('先粘一把钥匙。');
  const msg = $('setup-msg');
  msg.classList.remove('err');
  msg.textContent = '验钥中…';
  gh.setRepoSlug(slug);
  gh.setToken(value);
  try {
    const { canWrite, prAccess } = await gh.verifyToken();
    if (!prAccess) {
      gh.clearToken();
      return showSetup('钥匙差一项：Pull requests: Read and write。回 GitHub 的 token 页补上（不用重新生成，改完点 Update），再回来点存钥——输入框里这串还能用。');
    }
    $('token-input').value = '';
    await boot();
    if (!canWrite) {
      setNotice('提醒：这把钥匙没有 Contents 写权限，读批都行，但「钦此」（merge）会失败。');
    }
  } catch (err) {
    gh.clearToken();
    showSetup(`这把钥匙开不了 ${gh.repoSlug()}：${err.message}`);
  }
}

function setNotice(text) {
  const el = $('notice');
  el.textContent = text;
  el.hidden = !text;
}

// ── 待批清单 ──
function renderList() {
  $('list-count').textContent = `待批奏折 · ${state.prs.length}`;
  const nav = $('pr-list');
  nav.replaceChildren();
  if (!state.prs.length) {
    nav.appendChild(stateLine('此刻无折可批。'));
    return;
  }
  state.prs.forEach((pr) => {
    const btn = document.createElement('button');
    btn.className = 'pr-item' + (state.current?.number === pr.number ? ' active' : '');
    const h3 = document.createElement('h3');
    h3.textContent = pr.title;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `#${pr.number} · 呈于 ${timeAgo(pr.updated_at)}`;
    btn.append(h3, meta);
    btn.onclick = () => openPR(pr);
    nav.appendChild(btn);
  });
}

function stateLine(text, isErr = false) {
  const p = document.createElement('p');
  p.className = 'state' + (isErr ? ' err' : '');
  p.textContent = text;
  return p;
}

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 60) return `${mins} 分钟前`;
  if (mins < 1440) return `${Math.round(mins / 60)} 小时前`;
  return `${Math.round(mins / 1440)} 天前`;
}

// ── 阅读 ──
async function openPR(pr) {
  state.current = pr;
  renderList();
  annotate.detach();
  $('qinci-btn').hidden = false;
  $('crumb').replaceChildren('待批 / ', Object.assign(document.createElement('b'), { textContent: pr.title }));
  const mine = ++generation;
  const doc = $('doc');
  doc.replaceChildren(stateLine('展折中…'));
  $('doc-tabs').hidden = true;
  try {
    const files = await gh.listPRFiles(pr.number);
    if (mine !== generation) return;
    state.filesAll = files;
    state.docs = files.filter((f) => f.filename.endsWith('.md') && f.status !== 'removed');
    if (!state.docs.length) {
      doc.replaceChildren(stateLine('此折无 markdown 正文（代码 PR 的 diff 视图在北极星里）。'));
      return;
    }
    renderTabs();
    await openDoc(state.docs[0].filename, mine);
  } catch (err) {
    if (mine !== generation) return;
    doc.replaceChildren(stateLine(`展折失败：${err.message}`, true));
  }
}

// 一折可能含多篇 markdown，给出切换入口，否则后面的永远看不到
function renderTabs() {
  const bar = $('doc-tabs');
  bar.replaceChildren();
  bar.hidden = state.docs.length < 2;
  if (bar.hidden) return;
  state.docs.forEach((f) => {
    const btn = document.createElement('button');
    btn.className = 'doc-tab' + (f.filename === state.docPath ? ' active' : '');
    btn.textContent = f.filename.split('/').pop();
    btn.title = f.filename;
    btn.onclick = () => openDoc(f.filename, ++generation); // 每次切 tab 换代，快速连点不会旧响应盖新文档
    bar.appendChild(btn);
  });
}

async function openDoc(path, mine) {
  state.docPath = path;
  renderTabs();
  const doc = $('doc');
  const ref = state.current.head.sha;
  try {
    const text = await gh.getFileText(path, ref);
    if (mine !== generation) return;
    doc.innerHTML = renderMarkdown(text);
    doc.dataset.path = path;
    doc.dataset.ref = ref;
    await hydrateRelativeImages(doc, { docPath: path, ref, fetchBlobUrl: gh.getFileBlobUrl });
    if (mine !== generation) return;
    annotate.attach({ pr: state.current, files: state.filesAll, path, ref, doc });
  } catch (err) {
    if (mine !== generation) return;
    doc.replaceChildren(stateLine(`展折失败：${err.message}`, true));
  }
}

// ── 启动 ──
async function loadPRs() {
  state.prs = await gh.listOpenPRs();
  renderList();
  if (state.prs.length && !state.current) await openPR(state.prs[0]);
}

function handleError(err, where) {
  if (err instanceof gh.ApiError && err.tokenDead) {
    gh.clearToken();
    return showSetup('钥匙失效了，换一把。');
  }
  const hint = err.rateLimited ? '碰到 GitHub 限流，缓一会儿再刷新。' : err.message;
  where.replaceChildren(stateLine(hint, true));
}

async function boot() {
  if (!gh.getToken()) return showSetup();
  if (!gh.getRepoSlug()) return showSetup('这版起奏折仓库改成填的了（不再写死在代码里）——补一次 owner/repo，钥匙照旧粘一遍。');
  $('setup').hidden = true;
  $('app').hidden = false;
  setNotice('');
  try {
    await loadPRs();
  } catch (err) {
    handleError(err, $('pr-list'));
  }
}

$('qinci-btn').onclick = async () => {
  const pr = state.current;
  if (!pr) return;
  const pending = annotate.pendingCountFor(pr.number);
  const warn = pending ? `\n注意：还有 ${pending} 条朱批草稿没呈回，merge 之后就没处提交了。` : '';
  if (!confirm(`钦此定稿：squash merge #${pr.number}「${pr.title}」？${warn}`)) return;
  const btn = $('qinci-btn');
  btn.disabled = true;
  try {
    if (pr.draft) {
      await gh.markReady(pr.node_id); // 存量 draft 折先转 ready 才能 merge
      pr.draft = false; // 本地同步：否则 merge 失败后重试会再打一次 markReady 并卡在报错
    }
    await gh.mergePR(pr.number, pr.head.sha); // 带 sha：agent 中途推了新版则 409，所批即所合
    setNotice(`已钦此：#${pr.number} 定稿归档。对外交付回 Happy 说一声。`);
    state.current = null;
    annotate.detach();
    $('qinci-btn').hidden = true;
    await loadPRs();
  } catch (err) {
    setNotice(`钦此失败：${err.message}${pr.draft ? `（此折是 draft；若是 GraphQL 被钥匙拒了，回 Happy 说「钦此 #${pr.number}」我来执行）` : ''}`);
  } finally {
    btn.disabled = false;
  }
};

annotate.init({ onNotice: setNotice });
$('token-save').onclick = saveToken;
$('token-input').onkeydown = (e) => { if (e.key === 'Enter') saveToken(); };
$('repo-input').oninput = syncRepoName;
$('repo-input').onkeydown = (e) => { if (e.key === 'Enter') $('token-input').focus(); };
$('refresh-btn').onclick = async () => {
  state.current = null;
  $('qinci-btn').hidden = true;
  try {
    await loadPRs();
  } catch (err) {
    handleError(err, $('pr-list'));
  }
};
$('settings-btn').onclick = () => { gh.clearToken(); showSetup(); };

boot();
