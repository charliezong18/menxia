// M2 划句朱批 —— 选区锚定 / 草稿攒批 / 右缘批注栏 / 一键呈回
// 锚定策略（SPEC §9.1）：主锚 = DOM 行号（data-line），引文永远进批注正文兜底。
import * as gh from './github.js';

const $ = (id) => document.getElementById(id);

// 单一状态 + 显式 render（迁移对冲，见 MIGRATION-WATCH 备忘）
const A = {
  ctx: null,        // { pr, files, path, ref, doc }
  drafts: [],       // 当前 PR 全部草稿（含其他文档的）
  editing: null,    // 正在编辑的草稿 id
  zongpiOpen: false,
  pendingAnchor: null,
  busy: false,
};

const draftsKey = (num) => `zhupi.drafts.${num}`;
const loadDrafts = (num) => {
  try { return JSON.parse(localStorage.getItem(draftsKey(num)))?.items || []; } catch { return []; }
};
const saveDrafts = () => {
  if (!A.ctx) return;
  localStorage.setItem(draftsKey(A.ctx.pr.number), JSON.stringify({ items: A.drafts }));
};
const draftsForDoc = () => A.drafts.filter((d) => d.path === A.ctx?.path);

// ── 生命周期 ──
export function init({ onNotice }) {
  A.notice = onNotice || (() => {});
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.zhupi-float')) hideFloat();
  });
  document.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.key !== 'Enter') return;
    // 阻断修复：卡内 ⌘Enter 的同一事件会冒泡到这里——存批瞬间 A.editing 已清，曾导致整批当场呈出
    if (e.target.closest('textarea, input')) return;
    if (!A.editing && A.drafts.length && !A.busy) submitAll();
  });
  // .work 内滚不产生 mousedown，浮批钮会残留原地——capture 才接得到不冒泡的滚动
  document.addEventListener('scroll', hideFloat, true);
  $('submit-btn').onclick = submitAll;
  $('zongpi-btn').onclick = () => { A.zongpiOpen = !A.zongpiOpen; render(); };
  window.addEventListener('resize', () => A.ctx && layoutCards());
}

let ro = null; // 图片/字体异步加载改变块高 → 重排批注卡（评审：图多的折子卡片系统性错位）

export function attach(ctx) {
  A.ctx = ctx;
  A.drafts = loadDrafts(ctx.pr.number);
  A.editing = null;
  A.zongpiOpen = false;
  hideFloat();
  if (typeof ResizeObserver !== 'undefined') {
    ro?.disconnect();
    ro = new ResizeObserver(() => layoutCards());
    ro.observe(ctx.doc);
  }
  render();
}

export function detach() {
  A.ctx = null;
  ro?.disconnect();
  ro = null;
  hideFloat();
  $('margin-col').replaceChildren();
  updateTopbar();
  if ('highlights' in CSS) CSS.highlights.delete('zhupi-draft');
}

// 给外部（钦此确认框）报某折还有几条未呈草稿
export const pendingCountFor = (num) => loadDrafts(num).length;

// ── 选区 → 锚 ──
function onMouseUp(e) {
  if (!A.ctx || e.target.closest('.zhupi-float, .anno-card, .zongpi-card')) return;
  setTimeout(() => {
    const anchor = computeAnchor();
    if (anchor) showFloat(anchor); else hideFloat();
  }, 0);
}

function closestLine(node) {
  const el = node.nodeType === 1 ? node : node.parentElement;
  return el ? el.closest('[data-line]') : null;
}

function computeAnchor() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const doc = A.ctx.doc;
  if (!doc.contains(range.commonAncestorContainer)) return null;
  const quoteRaw = sel.toString();
  const quote = quoteRaw.trim().replace(/\s+/g, ' ');
  if (quote.length < 2) return null;
  const el = closestLine(range.startContainer);
  if (!el) return null;
  const blockLine = +el.dataset.line;
  let line = blockLine;
  // 代码块内精确行：fence 的 data-line 在 <code> 上且指向 ``` 行（首行 +1）；
  // 缩进代码块的 data-line 在 <pre> 上、直接是首行（两者均已实测确认）。
  if (el.tagName === 'CODE' || el.tagName === 'PRE') {
    const container = el.tagName === 'CODE' ? el : (el.querySelector('code') || el);
    try {
      const r2 = document.createRange();
      r2.selectNodeContents(container);
      r2.setEnd(range.startContainer, range.startOffset);
      const newlines = r2.toString().split('\n').length - 1;
      line = blockLine + (el.tagName === 'CODE' ? 1 : 0) + newlines;
    } catch { /* 跨节点异常时退回块首行 */ }
  }
  // 块内字符偏移：同块撞重复短语时高亮按它定位，而不是永远亮第一处（双路评审均命中）
  let offset = 0;
  try {
    const r3 = document.createRange();
    r3.selectNodeContents(el);
    r3.setEnd(range.startContainer, range.startOffset);
    offset = r3.toString().length;
  } catch { /* 退化为 0，从头找 */ }
  const rect = range.getBoundingClientRect();
  return { blockLine, line, offset, quote: quote.slice(0, 300), quoteRaw: quoteRaw.trim().slice(0, 300), rect };
}

// ── 浮批按钮 ──
let floatEl = null;
function showFloat(anchor) {
  A.pendingAnchor = anchor;
  if (!floatEl) {
    floatEl = document.createElement('button');
    floatEl.className = 'zhupi-float';
    floatEl.textContent = '朱批';
    floatEl.onclick = () => { addDraft(A.pendingAnchor); hideFloat(); };
    document.body.appendChild(floatEl);
  }
  floatEl.style.left = `${Math.min(anchor.rect.right + 8, window.innerWidth - 76)}px`;
  floatEl.style.top = `${anchor.rect.bottom + window.scrollY + 6}px`;
  floatEl.hidden = false;
}
function hideFloat() { if (floatEl) floatEl.hidden = true; }

// ── 草稿 ──
function addDraft(anchor) {
  if (!anchor || !A.ctx) return;
  const d = {
    id: `d${Date.now()}${Math.floor(Math.random() * 1e4)}`,
    path: A.ctx.path,
    ref: A.ctx.ref, // 写于哪个版本：agent 推新版后旧草稿降级总批，绝不静默钉错行
    blockLine: anchor.blockLine,
    line: anchor.line,
    offset: anchor.offset || 0,
    quote: anchor.quote,
    quoteRaw: anchor.quoteRaw,
    note: '',
    ts: Date.now(),
  };
  A.drafts.push(d);
  A.editing = d.id;
  window.getSelection()?.removeAllRanges();
  saveDrafts();
  render();
}

function removeDraft(id) {
  A.drafts = A.drafts.filter((d) => d.id !== id);
  if (A.editing === id) A.editing = null;
  saveDrafts();
  render();
}

// ── 渲染 ──
export function render() {
  if (!A.ctx) return;
  renderMargin();
  updateTopbar();
  rebuildHighlights();
}

function sectionOf(blockLine) {
  let best = '';
  A.ctx.doc.querySelectorAll('h1[data-line],h2[data-line],h3[data-line]').forEach((h) => {
    if (+h.dataset.line <= blockLine) best = h.textContent;
  });
  return best;
}

function renderMargin() {
  const col = $('margin-col');
  col.replaceChildren();
  if (A.zongpiOpen) col.appendChild(buildZongpiCard());
  const ds = draftsForDoc().sort((a, b) => a.line - b.line);
  ds.forEach((d) => col.appendChild(buildCard(d)));
  const others = A.drafts.length - ds.length;
  if (others > 0) {
    const p = document.createElement('p');
    p.className = 'margin-note';
    p.textContent = `另有 ${others} 条朱批在此折其他文档`;
    col.appendChild(p);
  }
  layoutCards();
}

function layoutCards() {
  const col = $('margin-col');
  if (!col || !A.ctx) return;
  const colRect = col.getBoundingClientRect();
  let prevBottom = 0;
  [...col.children].forEach((card) => {
    let top = prevBottom + 12;
    const line = card.dataset.blockLine;
    if (line) {
      const block = A.ctx.doc.querySelector(`[data-line="${line}"]`);
      if (block) {
        const want = block.getBoundingClientRect().top - colRect.top + (col.scrollTop || 0);
        top = Math.max(want, prevBottom + 12);
      }
    }
    card.style.top = `${Math.max(top, 0)}px`;
    prevBottom = Math.max(top, 0) + card.offsetHeight;
  });
  col.style.minHeight = `${prevBottom + 20}px`;
}

function buildCard(d) {
  const card = document.createElement('div');
  card.className = 'anno-card';
  card.dataset.blockLine = d.blockLine;

  const quote = document.createElement('div');
  quote.className = 'anno-quote';
  quote.textContent = `「${d.quote.length > 80 ? d.quote.slice(0, 80) + '…' : d.quote}」`;
  const src = document.createElement('div');
  src.className = 'anno-src';
  const sec = sectionOf(d.blockLine);
  src.textContent = `${sec ? sec + ' · ' : ''}第 ${d.line} 行`;
  card.append(quote, src);

  if (A.editing === d.id) {
    const ta = document.createElement('textarea');
    ta.className = 'anno-input';
    ta.placeholder = '朱批……';
    ta.value = d.note;
    ta.onkeydown = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.stopPropagation(); save.click(); } };
    const row = document.createElement('div');
    row.className = 'anno-row';
    const drop = document.createElement('button');
    drop.className = 'anno-ghost';
    drop.textContent = '作罢';
    drop.onclick = () => removeDraft(d.id);
    const save = document.createElement('button');
    save.className = 'anno-save';
    save.textContent = '存批';
    save.onclick = () => {
      const v = ta.value.trim();
      if (!v) return removeDraft(d.id);
      d.note = v;
      A.editing = null;
      saveDrafts();
      render();
    };
    row.append(drop, save);
    card.append(ta, row);
    setTimeout(() => ta.focus(), 0);
  } else {
    const note = document.createElement('div');
    note.className = 'anno-note';
    note.textContent = d.note;
    note.onclick = () => { A.editing = d.id; render(); };
    note.title = '点击修改';
    card.append(note);
  }
  return card;
}

function buildZongpiCard() {
  const card = document.createElement('div');
  card.className = 'anno-card zongpi-card';
  const label = document.createElement('div');
  label.className = 'anno-src';
  label.textContent = '总批 · 整折总评（呈出即达，不攒批）';
  const ta = document.createElement('textarea');
  ta.className = 'anno-input';
  ta.placeholder = '总批……可以按序号列意见';
  ta.rows = 4;
  const row = document.createElement('div');
  row.className = 'anno-row';
  const drop = document.createElement('button');
  drop.className = 'anno-ghost';
  drop.textContent = '作罢';
  drop.onclick = () => { A.zongpiOpen = false; render(); };
  const send = document.createElement('button');
  send.className = 'anno-save';
  send.textContent = '呈总批';
  send.onclick = async () => {
    const v = ta.value.trim();
    if (!v || A.busy) return;
    A.busy = true; send.textContent = '呈递中…';
    try {
      await gh.createIssueComment(A.ctx.pr.number, v);
      A.zongpiOpen = false;
      A.notice('总批已呈——回 Happy 说「读批注」。');
    } catch (err) {
      A.notice(`总批呈递失败：${err.message}`);
    } finally { A.busy = false; render(); }
  };
  row.append(drop, send);
  card.append(label, ta, row);
  setTimeout(() => ta.focus(), 0);
  return card;
}

function updateTopbar() {
  const btn = $('submit-btn');
  const n = A.drafts.length;
  btn.hidden = !A.ctx || n === 0;
  btn.textContent = `提交朱批 · ${n}`;
  $('zongpi-btn').hidden = !A.ctx;
}

// ── 高亮（CSS Custom Highlight API，不改 DOM）──
function rebuildHighlights() {
  if (!('highlights' in CSS)) return;
  const hl = new Highlight();
  draftsForDoc().forEach((d) => {
    const r = rangeForDraft(d);
    if (r) hl.add(r);
  });
  CSS.highlights.set('zhupi-draft', hl);
}

function rangeForDraft(d) {
  const block = A.ctx.doc.querySelector(`[data-line="${d.blockLine}"]`);
  if (!block) return null;
  const text = block.textContent;
  let idx = text.indexOf(d.quoteRaw, Math.max(0, (d.offset || 0) - 2));
  if (idx < 0) idx = text.indexOf(d.quoteRaw);
  if (idx < 0) return null;
  return rangeFromTextOffset(block, idx, d.quoteRaw.length);
}

function rangeFromTextOffset(root, start, len) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let pos = 0, startNode = null, startOff = 0, node;
  while ((node = walker.nextNode())) {
    const next = pos + node.data.length;
    if (!startNode && start < next) { startNode = node; startOff = start - pos; }
    if (startNode && start + len <= next) {
      const r = document.createRange();
      r.setStart(startNode, startOff);
      r.setEnd(node, start + len - pos);
      return r;
    }
    pos = next;
  }
  return null;
}

// ── 呈回 ──
// 解析 unified diff hunk，得出新文件侧可批注的行号集合（不在 diff 里的行提交必 422，
// 且整批原子失败——所以提交前本地校验，非法的降级并入总批。SPEC §9.1）
export function validRightLines(patch) {
  if (!patch) return null;
  const valid = new Set();
  let n = 0;
  const lines = patch.split('\n');
  if (lines[lines.length - 1] === '') lines.pop(); // 尾部换行的假空行会把 hunk 外一行误判成可批 → 422 整批全灭
  for (const raw of lines) {
    if (raw.startsWith('@@')) {
      const m = /\+(\d+)/.exec(raw);
      if (m) n = parseInt(m[1], 10);
    } else if (raw.startsWith('+') || raw.startsWith(' ')) {
      valid.add(n++);
    } else if (raw === '') {
      valid.add(n++); // 空上下文行在 API patch 里偶见裸空串
    }
  }
  return valid;
}

const fmt = (d) => `> ${d.quote}\n\n${d.note}`;

async function submitAll() {
  if (!A.ctx || !A.drafts.length || A.busy) return;
  if (A.editing) {
    A.notice('有一条朱批还在编辑：先「存批」或「作罢」它，再呈回（否则发出去的是旧文案）。');
    return;
  }
  const noteless = A.drafts.filter((d) => !d.note.trim());
  if (noteless.length) {
    A.notice(`还有 ${noteless.length} 条朱批没写内容（空批注不呈）——写完或作罢它们再提交。`);
    return;
  }
  // 提交在途中世界可能变（切折/刷新会重置 A.ctx）——入口处捕获，完成回调只认这份快照
  const prNumber = A.ctx.pr.number;
  const ref = A.ctx.ref;
  const hunks = new Map();
  (A.ctx.files || []).forEach((f) => hunks.set(f.filename, validRightLines(f.patch)));
  const inline = [], fallback = [];
  A.drafts.forEach((d) => {
    const stale = d.ref !== ref; // 旧版本写的草稿：行号可能已漂移，宁降总批不静默钉错行
    const set = hunks.get(d.path);
    if (!stale && set && set.has(d.line)) {
      inline.push({ path: d.path, line: d.line, side: 'RIGHT', body: fmt(d) });
    } else {
      fallback.push(d);
    }
  });
  // body 恒非空：API 文档把 body 标为 COMMENT 必填，空串是否放行没有承诺——不赌
  const body = fallback.length
    ? `以下朱批锚定不到可批注行（或写于旧版本），并入总批：\n\n${fallback.map(fmt).join('\n\n---\n\n')}`
    : `御笔朱批 · ${inline.length} 条`;
  const btn = $('submit-btn');
  A.busy = true;
  btn.disabled = true;
  btn.textContent = '呈递中…';
  try {
    // commit_id 钉死「按用户读的版本校验与锚定」，不让 GitHub 默认最新 head（评审两路重合项）
    await gh.submitReview(prNumber, { body, comments: inline, commitId: ref });
    localStorage.setItem(draftsKey(prNumber), JSON.stringify({ items: [] }));
    if (A.ctx?.pr.number === prNumber) A.drafts = [];
    A.notice(`已呈回 ${inline.length} 条朱批${fallback.length ? `（${fallback.length} 条并入总批）` : ''}——回 Happy 说「读批注」。`);
  } catch (err) {
    A.notice(`呈递失败（草稿都还在）：${err.message}`);
  } finally {
    A.busy = false;
    btn.disabled = false;
    if (A.ctx) render();
  }
}
