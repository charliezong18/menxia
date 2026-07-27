// 御笔朱批 M1 —— 钥匙设置 / 待批清单 / 渲染阅读
import * as gh from './github.js';
import { renderMarkdown, resolveRelativeAssets } from './render.js';

const $ = (id) => document.getElementById(id);
const state = { prs: [], current: null };

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
  $('setup-msg').classList.remove('err');
  $('setup-msg').textContent = '验钥中…';
  gh.setToken(value);
  try {
    await gh.verifyToken();
    $('token-input').value = '';
    await boot();
  } catch (err) {
    gh.clearToken();
    showSetup(`这把钥匙开不了 ${gh.repoSlug()}：${err.message}`);
  }
}

// ── 待批清单 ──
function renderList() {
  $('list-count').textContent = `待批奏折 · ${state.prs.length}`;
  const nav = $('pr-list');
  nav.replaceChildren();
  if (!state.prs.length) {
    nav.innerHTML = '<p class="state">此刻无折可批。</p>';
    return;
  }
  state.prs.forEach((pr) => {
    const btn = document.createElement('button');
    btn.className = 'pr-item' + (state.current?.number === pr.number ? ' active' : '');
    btn.innerHTML = `<h3></h3><div class="meta"></div>`;
    btn.querySelector('h3').textContent = pr.title;
    btn.querySelector('.meta').textContent = `#${pr.number} · 呈于 ${timeAgo(pr.updated_at)}`;
    btn.onclick = () => openPR(pr);
    nav.appendChild(btn);
  });
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
  $('crumb').innerHTML = `待批 / <b></b>`;
  $('crumb').querySelector('b').textContent = pr.title;
  const doc = $('doc');
  doc.innerHTML = '<p class="state">展折中…</p>';
  try {
    const files = await gh.listPRFiles(pr.number);
    const target = files.find((f) => f.filename.endsWith('.md') && f.status !== 'removed');
    if (!target) {
      doc.innerHTML = '<p class="state">此折无 markdown 正文（代码 PR 的 diff 视图在北极星里）。</p>';
      return;
    }
    const ref = pr.head.sha;
    const text = await gh.getFileText(target.filename, ref);
    doc.innerHTML = resolveRelativeAssets(renderMarkdown(text), {
      owner: gh.REPO.owner, name: gh.REPO.name, ref,
    });
    doc.dataset.path = target.filename;
    doc.dataset.ref = ref;
  } catch (err) {
    doc.innerHTML = `<p class="state err">展折失败：${err.message}</p>`;
  }
}

// ── 启动 ──
async function loadPRs() {
  state.prs = await gh.listOpenPRs();
  renderList();
  if (state.prs.length && !state.current) await openPR(state.prs[0]);
}

async function boot() {
  if (!gh.getToken()) return showSetup();
  $('setup').hidden = true;
  $('app').hidden = false;
  try {
    await loadPRs();
  } catch (err) {
    if (/401|403/.test(err.message)) {
      gh.clearToken();
      return showSetup('钥匙失效了，换一把。');
    }
    $('pr-list').innerHTML = `<p class="state err">${err.message}</p>`;
  }
}

$('token-save').onclick = saveToken;
$('token-input').onkeydown = (e) => { if (e.key === 'Enter') saveToken(); };
$('refresh-btn').onclick = () => { state.current = null; loadPRs(); };
$('settings-btn').onclick = () => { gh.clearToken(); showSetup(); };

boot();
