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
  $('repo-name').textContent = gh.repoSlug();
  const el = $('setup-msg');
  el.textContent = msg;
  el.classList.toggle('err', Boolean(msg));
}

async function saveToken() {
  const value = $('token-input').value.trim();
  if (!value) return showSetup('先粘一把钥匙。');
  const msg = $('setup-msg');
  msg.classList.remove('err');
  msg.textContent = '验钥中…';
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
    btn.onclick = () => openDoc(f.filename, generation);
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
  $('setup').hidden = true;
  $('app').hidden = false;
  setNotice('');
  try {
    await loadPRs();
  } catch (err) {
    handleError(err, $('pr-list'));
  }
}

annotate.init({ onNotice: setNotice });
$('token-save').onclick = saveToken;
$('token-input').onkeydown = (e) => { if (e.key === 'Enter') saveToken(); };
$('refresh-btn').onclick = async () => {
  state.current = null;
  try {
    await loadPRs();
  } catch (err) {
    handleError(err, $('pr-list'));
  }
};
$('settings-btn').onclick = () => { gh.clearToken(); showSetup(); };

boot();
