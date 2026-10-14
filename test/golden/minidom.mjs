// 最小 DOM 桩：只够让 src/anchor.js / src/toc.js 的**原函数**在 node 里跑在 renderMarkdown 的产物上。
// 不是通用 HTML 解析器——输入只有 markdown-it（html:false）的输出：标签成对、属性带双引号、
// 文本只含 &amp; &lt; &gt; &quot; 这几种转义（另兼容数字实体以防万一）。
// 浏览器语义照搬：textContent = 后代文本节点按文档序拼接（标签之间的 "\n" 也是文本节点）。

const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr', 'source', 'col', 'area', 'base', 'embed', 'track']);
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return ENT[e] ?? m;
});

class Node {
  constructor(type) { this.nodeType = type; this.parentNode = null; this.childNodes = []; }
  get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }
  get textContent() {
    if (this.nodeType === 3) return this.data;
    let s = '';
    for (const c of this.childNodes) s += c.textContent;
    return s;
  }
  contains(other) {
    for (let n = other; n; n = n.parentNode) if (n === this) return true;
    return false;
  }
}

class Text extends Node {
  constructor(data) { super(3); this.data = data; }
}

class Element extends Node {
  constructor(tag, attrs) {
    super(1);
    this.localName = tag;
    this.tagName = tag.toUpperCase();
    this.attrs = attrs;
    const ds = {};
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('data-')) ds[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
    }
    this.dataset = ds;
  }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; }
  get id() { return this.attrs.id ?? ''; }
  matches(sel) { return parseSel(sel).some((s) => matchOne(this, s)); }
  closest(sel) {
    const list = parseSel(sel);
    for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (list.some((s) => matchOne(n, s))) return n;
    return null;
  }
  querySelectorAll(sel) {
    const list = parseSel(sel);
    const out = [];
    const walk = (n) => { for (const c of n.childNodes) if (c.nodeType === 1) { if (list.some((s) => matchOne(c, s))) out.push(c); walk(c); } };
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
}

// 选择器：逗号分隔的复合选择器，每个 = 可选标签名 + 若干 [attr] / [attr="v"]。够 anchor.js / toc.js 用。
function parseSel(sel) {
  return sel.split(',').map((part) => {
    const p = part.trim();
    const m = /^([a-z0-9]*)((?:\[[^\]]+\])*)$/i.exec(p);
    if (!m) throw new Error(`minidom 不支持的选择器：${p}`);
    const attrs = [...m[2].matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].map(([, k, v]) => [k, v]);
    return { tag: m[1].toLowerCase(), attrs };
  });
}
function matchOne(el, s) {
  if (s.tag && el.localName !== s.tag) return false;
  return s.attrs.every(([k, v]) => (v === undefined ? el.hasAttribute(k) : el.getAttribute(k) === v));
}

export function parseHTML(html) {
  const root = new Element('div', {});
  let cur = root;
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s=>]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)|(<)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[5] !== undefined || m[6] !== undefined) {
      const t = new Text(decode(m[5] ?? m[6]));
      t.parentNode = cur; cur.childNodes.push(t);
      continue;
    }
    const tag = m[2].toLowerCase();
    if (m[1]) {
      for (let n = cur; n !== root; n = n.parentNode) if (n.localName === tag) { cur = n.parentNode; break; }
      continue;
    }
    const attrs = {};
    for (const [, k, v] of m[3].matchAll(/([^\s=>]+)(?:="([^"]*)")?/g)) attrs[k] = v === undefined ? '' : decode(v);
    const el = new Element(tag, attrs);
    el.parentNode = cur; cur.childNodes.push(el);
    if (!VOID.has(tag) && !m[4]) cur = el;
  }
  return root;
}

// ── Range / Selection / TreeWalker：边界换算成「根下全部文本的线性字符位置」再切片 ──
function textNodes(root) {
  const out = [];
  const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) out.push(c); else walk(c); } };
  walk(root);
  return out;
}
const topOf = (n) => { while (n.parentNode) n = n.parentNode; return n; };

// 边界 (node, offset) 之前的文本总长。文本节点：offset 是字符；元素：offset 是子节点下标
// （= 第 offset 个子节点开头；等于子数 → 元素末尾）。按文档序走一遍累加即可。
function linearPos(node, offset) {
  let pos = 0, found = null;
  const walk = (n) => {
    if (n === node) {
      if (n.nodeType === 3) { found = pos + offset; return; }
      for (let i = 0; i < n.childNodes.length; i++) {
        if (i === offset) { found = pos; return; }
        walk(n.childNodes[i]);
      }
      found = pos;
      return;
    }
    if (n.nodeType === 3) { pos += n.data.length; return; }
    for (const c of n.childNodes) { walk(c); if (found !== null) return; }
  };
  walk(topOf(node));
  return found ?? pos;
}

class Range {
  constructor() { this.startContainer = null; this.startOffset = 0; this.endContainer = null; this.endOffset = 0; }
  setStart(n, o) { this.startContainer = n; this.startOffset = o; }
  setEnd(n, o) { this.endContainer = n; this.endOffset = o; }
  selectNodeContents(n) {
    this.setStart(n, 0);
    this.setEnd(n, n.nodeType === 3 ? n.data.length : n.childNodes.length);
  }
  get collapsed() { return this.startContainer === this.endContainer && this.startOffset === this.endOffset; }
  get commonAncestorContainer() {
    for (let n = this.startContainer; n; n = n.parentNode) if (n.contains(this.endContainer)) return n;
    return null;
  }
  toString() {
    const top = topOf(this.startContainer);
    const all = textNodes(top).map((t) => t.data).join('');
    const a = linearPos(this.startContainer, this.startOffset);
    const b = linearPos(this.endContainer, this.endOffset);
    return b > a ? all.slice(a, b) : '';
  }
  getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
}

export function makeSelection(range) {
  return {
    get isCollapsed() { return !range || range.collapsed; },
    get rangeCount() { return range ? 1 : 0; },
    getRangeAt() { return range; },
    toString() { return range ? range.toString() : ''; },
  };
}

// 块内 UTF-16 偏移 → (文本节点, 节点内偏移)。规则与 anchor.js rangeFromTextOffset 同：
// 起点落在「start < 节点末」的第一个节点（恰在边界时归后一个节点的开头）；
// 终点落在「end <= 节点末」的第一个节点（恰在边界时归前一个节点的末尾）。
export function pointAt(root, offset, isEnd = false) {
  let pos = 0;
  const nodes = textNodes(root);
  for (const t of nodes) {
    const next = pos + t.data.length;
    if (isEnd ? offset <= next : offset < next) return [t, offset - pos];
    pos = next;
  }
  const last = nodes[nodes.length - 1];
  return last ? [last, last.data.length] : [root, 0];
}

export function installGlobals(win) {
  const state = { range: null };
  win.getSelection = () => makeSelection(state.range);
  globalThis.document = {
    createRange: () => new Range(),
    createTreeWalker(root) {
      const list = textNodes(root);
      let i = -1;
      return { nextNode: () => (++i < list.length ? list[i] : null) };
    },
  };
  globalThis.NodeFilter = { SHOW_TEXT: 4 };
  return {
    select(root, start, len) {
      const r = new Range();
      const [sn, so] = pointAt(root, start, false);
      const [en, eo] = pointAt(root, start + len, true);
      r.setStart(sn, so); r.setEnd(en, eo);
      state.range = r;
    },
    clear() { state.range = null; },
  };
}

// 供导出：node 内 offset 处相对 root 文本开头的 UTF-16 偏移
export const offsetWithin = (root, node, o = 0) => linearPos(node, o) - linearPos(root, 0);

// 供导出：某 Range 相对 root 文本的 [起, 长]
export function rangeOffsets(root, r) {
  const base = linearPos(root, 0);
  const a = linearPos(r.startContainer, r.startOffset) - base;
  const b = linearPos(r.endContainer, r.endOffset) - base;
  return [a, b - a];
}
