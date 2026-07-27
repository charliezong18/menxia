// 锚定与草稿的纯逻辑层（无 UI、无框架）——迁移时原样搬运的资产
// 锚定策略见 SPEC §9.1：主锚 = DOM 行号，引文永远进批注正文兜底。

// ── 选区 → 锚 ──
export function closestLine(node) {
  const el = node.nodeType === 1 ? node : node.parentElement;
  return el ? el.closest('[data-line]') : null;
}

export function computeAnchor(doc) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!doc || !doc.contains(range.commonAncestorContainer)) return null;
  const quoteRaw = sel.toString();
  const quote = quoteRaw.trim().replace(/\s+/g, ' ');
  if (quote.length < 2) return null;
  const el = closestLine(range.startContainer);
  if (!el) return null;
  const blockLine = +el.dataset.line;
  let line = blockLine;
  // 代码块内精确行：fence 的 data-line 在 <code> 上且指向 ``` 行（首行 +1）；
  // 缩进代码块的 data-line 在 <pre> 上、直接是首行（均实测确认）。
  if (el.tagName === 'CODE' || el.tagName === 'PRE') {
    const container = el.tagName === 'CODE' ? el : (el.querySelector('code') || el);
    try {
      const r2 = document.createRange();
      r2.selectNodeContents(container);
      r2.setEnd(range.startContainer, range.startOffset);
      const newlines = r2.toString().split('\n').length - 1;
      line = blockLine + (el.tagName === 'CODE' ? 1 : 0) + newlines;
    } catch { /* 退回块首行 */ }
  }
  // 块内字符偏移：同块撞重复短语时高亮按它定位（双路评审均命中）
  let offset = 0;
  try {
    const r3 = document.createRange();
    r3.selectNodeContents(el);
    r3.setEnd(range.startContainer, range.startOffset);
    offset = r3.toString().length;
  } catch { /* 从头找 */ }
  const rect = range.getBoundingClientRect();
  return { blockLine, line, offset, quote: quote.slice(0, 300), quoteRaw: quoteRaw.trim().slice(0, 300), rect };
}

// ── 高亮定位 ──
export function rangeForDraft(doc, d) {
  const block = doc.querySelector(`[data-line="${d.blockLine}"]`);
  if (!block) return null;
  const text = block.textContent;
  let idx = text.indexOf(d.quoteRaw, Math.max(0, (d.offset || 0) - 2));
  if (idx < 0) idx = text.indexOf(d.quoteRaw);
  if (idx < 0) return null;
  return rangeFromTextOffset(block, idx, d.quoteRaw.length);
}

export function rangeFromTextOffset(root, start, len) {
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

export function sectionOf(doc, blockLine) {
  let best = '';
  doc.querySelectorAll('h1[data-line],h2[data-line],h3[data-line]').forEach((h) => {
    if (+h.dataset.line <= blockLine) best = h.textContent;
  });
  return best;
}

// ── hunk 校验：不在 diff 里的行提交必 422 且整批原子失败，提交前本地校验（SPEC §9.1）──
export function validRightLines(patch) {
  if (!patch) return null;
  const valid = new Set();
  let n = 0;
  const lines = patch.split('\n');
  if (lines[lines.length - 1] === '') lines.pop(); // 尾部换行的假空行会把 hunk 外一行误判成可批 → 422 全灭
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

// ── 草稿持久化（localStorage，按 PR 号）──
const draftsKey = (num) => `zhupi.drafts.${num}`;

export function loadDrafts(num) {
  try { return JSON.parse(localStorage.getItem(draftsKey(num)))?.items || []; } catch { return []; }
}
export function saveDrafts(num, items) {
  localStorage.setItem(draftsKey(num), JSON.stringify({ items }));
}
export const pendingCountFor = (num) => loadDrafts(num).length;

export const fmtDraft = (d) => `> ${d.quote}\n\n${d.note}`;
