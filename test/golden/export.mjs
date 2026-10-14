// golden 导出：用**现行 web 代码**（src/render.js / anchor.js / toc.js / slug.js / offline.js 原函数，
// 一行逻辑不复制）跑语料与样例，产出原生端（menxia-ios）逐字比对用的期望值。
//
//   node test/golden/export.mjs     重写 test/golden/expected/**（web 规则有意变更后才跑，并在 PR 里标「原生需跟进」）
//   test/golden.test.js             不写盘，重新生成后与已提交的 expected/** 逐字节比对；不一致即红
//
// 规范见 docs/ANCHOR-SPEC.md。产物格式的任何变化都要同步那页。
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseHTML, installGlobals, offsetWithin, rangeOffsets } from './minidom.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// 与 test/render-safety.test.js 同法：先挂真 markdown-it 到 window，再动态 import render.js
globalThis.window = globalThis.window || {};
globalThis.window.markdownit = require('../../vendor/markdown-it.min.js');
const sel = installGlobals(globalThis.window);

const R = await import('../../src/render.js');
const A = await import('../../src/anchor.js');
const T = await import('../../src/toc.js');
const SL = await import('../../src/slug.js');
const O = await import('../../src/offline.js');

export const FORMAT_VERSION = 1;
const CORPUS = join(here, 'corpus');
const json = (x) => `${JSON.stringify(x, null, 2)}\n`;

// ── 块类型：由渲染出的标签反推 markdown-it token 类型 ──
function blockType(el) {
  const t = el.localName;
  if (t === 'p') return 'paragraph';
  if (/^h[1-6]$/.test(t)) return 'heading';
  if (t === 'li') return 'list_item';
  if (t === 'table') return 'table';
  if (t === 'tr') return 'table_row';
  if (t === 'blockquote') return 'blockquote';
  if (t === 'code') return 'fence';                       // 普通围栏：data-line 在 <code> 上
  if (t === 'pre') return el.getAttribute('class') === 'diff-block' ? 'fence' : 'code_block';
  return `unknown:${t}`;
}

function renderDoc(src) {
  // headingIds:true 与 ui.js 渲染「当前在读这篇」时一致（标题带 id，供 TOC slug）
  const root = parseHTML(R.renderMarkdown(src, { headingIds: true }));
  const els = root.querySelectorAll('[data-line]');
  const index = new Map(els.map((el, i) => [el, i]));
  const blocks = els.map((el, i) => {
    let parent = null;
    for (let n = el.parentNode; n; n = n.parentNode) if (index.has(n)) { parent = index.get(n); break; }
    const b = { i, type: blockType(el), tag: el.localName, line: +el.dataset.line, lineEnd: +el.dataset.lineEnd, parent };
    if (b.type === 'heading') b.level = +el.localName[1];
    if (b.type === 'fence') {
      const cls = el.getAttribute('class') || '';
      b.info = el.localName === 'pre' ? 'diff' : (cls.match(/(?:^|\s)language-(\S+)/)?.[1] ?? '');
    }
    b.text = el.textContent;
    return b;
  });
  return { root, els, index, blocks };
}

function tocOf(root) {
  const items = T.extractOutline(root).map((h) => {
    const el = root.querySelector(`[data-line="${h.line}"]`);
    return { line: h.line, level: h.level, text: h.text, slug: el?.id || '' };
  });
  const headings = root.querySelectorAll('h1,h2,h3,h4,h5,h6').map((h) => ({
    line: +h.dataset.line, level: +h.localName[1], text: h.textContent, slug: h.id,
  }));
  return { hasOutline: T.hasOutline(items), outline: items, headings };
}

// ── 每篇的锚样例：选区（块 + 块内 UTF-16 起点 + 长度）→ computeAnchor 原函数输出 ──
const MAX_ANCHOR = 80, MAX_REANCHOR = 40;
function anchorsOf(d) {
  const { root, els, index } = d;
  const cases = [];
  const seen = new Set();
  const push = (el, start, length) => {
    const bi = index.get(el);
    const key = `${bi}:${start}:${length}`;
    if (seen.has(key) || cases.length >= MAX_ANCHOR) return;
    seen.add(key);
    const docStart = offsetWithin(root, el) + start;
    sel.select(root, docStart, length);
    const a = A.computeAnchor(root);
    sel.clear();
    const expect = a && { blockLine: a.blockLine, line: a.line, offset: a.offset, quote: a.quote, quoteRaw: a.quoteRaw };
    // 回放：同一份草稿交给 rangeForDraft，记它定位到哪块、块内哪段
    let replay = null;
    if (a) {
      const r = A.rangeForDraft(root, { blockLine: a.blockLine, offset: a.offset, quoteRaw: a.quoteRaw });
      const hit = root.querySelector(`[data-line="${a.blockLine}"]`);
      replay = r ? { block: index.get(hit), ...(([s, l]) => ({ start: s, length: l }))(rangeOffsets(hit, r)) } : null;
    }
    cases.push({ block: bi, blockStart: start, length, docStart, expect, replay });
  };
  // 每个文本节点的第一个非空白字符起选 8 个 UTF-16 单元（不越出所属块）
  const walk = (n) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 1) { walk(c); continue; }
      const k = c.data.search(/\S/);
      if (k < 0) continue;
      const el = A.closestLine(c);
      if (!el) continue;
      const start = offsetWithin(el, c) + k;
      push(el, start, Math.min(8, el.textContent.length - start));
    }
  };
  walk(root);
  // 代码块：每一行行首各选一次（钉住块内精确行）
  els.forEach((el) => {
    if (!['fence', 'code_block'].includes(blockType(el))) return;
    const text = el.textContent;
    for (let p = text.indexOf('\n'); p >= 0 && p + 1 < text.length; p = text.indexOf('\n', p + 1)) {
      push(el, p + 1, Math.min(6, text.length - p - 1));
    }
  });
  // 负例：1 个字、纯空白
  const firstP = els.find((el) => el.textContent.trim().length > 3);
  if (firstP) {
    push(firstP, firstP.textContent.search(/\S/), 1);
  }
  const reanchor = [];
  els.slice(0, MAX_REANCHOR).forEach((el) => {
    const norm = el.textContent.replace(/\s+/g, ' ').trim();
    const q = norm.slice(0, 16);
    reanchor.push({ quote: q, expect: A.reanchorByQuote(root, q) });
  });
  ['', 'abc', '  a  b  ', '一定不在正文里的引文 zzz'].forEach((q) => reanchor.push({ quote: q, expect: A.reanchorByQuote(root, q) }));
  const lines = [...new Set(els.map((el) => +el.dataset.line))];
  const sectionOf = lines.map((l) => [l, A.sectionOf(root, l)]);
  return { anchors: cases, reanchorByQuote: reanchor, sectionOf };
}

// ── 纯函数样例 ──
function functionSamples() {
  const out = {};
  const io = (fn, inputs) => inputs.map((input) => ({ input, output: fn(input) }));

  out.stripFrontmatter = io(R.stripFrontmatter, [
    '---\ncreated_by: claude\ntags: [a]\n---\n# 标题\n正文',
    '---\r\na: 1\r\n---\r\n# CRLF',
    '---  \na: 1\n---\t\nbody',
    '---\na: 1\n---',
    '---\n---\nempty',
    '# 只有正文',
    '---\n没有闭合',
    '# 标题\n\n---\n\n分隔线不是 frontmatter',
    '\n---\na: 1\n---\n不在第一行',
    '----\na: 1\n----\n四个横线',
    '',
  ]);
  out.stripBareAnchors = io(R.stripBareAnchors, [
    '前文\n\n<a id="daily"></a>\n\n后文',
    "<a name='x'/>后",
    '<a id=bare>',
    '<A ID="Upper"></A>',
    '<a  id = "sp" >  </a>',
    '<a href="x">看得见的链接文字</a>',
    '<a id="x" class="y"></a>',
    '<a id="x">有字</a>',
    '一行里 <a id="a"></a> 两个 <a name="b"></a> 裸锚',
  ]);
  out.slugify = io(SL.slugify, [
    'Hello World', '🚀 起步', ' 介绍', '〈Highline 日模块〉', 'a  b', 'a\tb', 'foo-bar_baz', 'C++ & C#',
    '无票日·选项', 'x²', '½ 杯', 'Ｆｕｌｌ', 'a b', 'a​b', 'ÉCOLE', '', '!!!',
  ]);
  out.makeSlugger = [
    ['重名', '重名', '重名-1', '重名'],
    ['foo', 'foo-1', 'foo'],
    ['!!!', '', 'a'],
  ].map((input) => { const s = SL.makeSlugger(); return { input, output: input.map((t) => s(t)) }; });
  const heads = [{ id: '无票日选项', text: '无票日选项' }, { id: '无票日选项-1', text: '无票日·选项' }, { id: 'highline-日模块', text: '〈Highline 日模块〉' }];
  out.matchAnchor = ['无票日选项-1', '无票日·选项', '〈Highline 日模块〉', 'highline日模块', '不存在', ''].map((frag) => ({
    input: { headings: heads, frag }, output: SL.matchAnchor(heads, frag)?.id ?? null,
  }));
  out.validRightLines = io((p) => { const s = A.validRightLines(p); return s ? [...s].sort((a, b) => a - b) : null; }, [
    '@@ -1,3 +1,4 @@\n a\n-b\n+c\n+d\n e',
    '@@ -1,2 +1,2 @@\n a\n-b\n+c\n',
    '@@ -10,3 +12,4 @@ ctx\n x\n\n+y\n z\n@@ -40,1 +50,2 @@\n+p\n q',
    '@@ -0,0 +1,3 @@\n+一\n+二\n+三',
    '@@ -1 +1 @@\n-old\n+new\n\\ No newline at end of file',
    '',
    null,
  ]);
  out.parseCommentBody = io(A.parseCommentBody, [
    '> 引文\n\n批注',
    '> 第一行\n> 第二行\n\n\n正文\n\n第二段',
    '>没空格\n正文紧贴',
    '纯回话没有引文',
    '> 只有引文',
    '  > 前导空格不算引文',
    '> a\r\n\r\nCRLF',
    '',
    null,
  ]);
  out.fmtDraft = io(A.fmtDraft, [
    { quote: '引文', note: '批注' },
    { quote: 'multi word quote', note: '第一行\n第二行' },
    { quote: '', note: '' },
  ]);
  out.threadComments = io((cs) => A.threadComments(cs).map((t) => ({ root: t.root.id, replies: t.replies.map((r) => r.id) })), [
    [
      { id: 1, created_at: '2026-01-01T00:00:00Z' },
      { id: 2, in_reply_to_id: 1, created_at: '2026-01-01T00:02:00Z' },
      { id: 3, in_reply_to_id: 1, created_at: '2026-01-01T00:01:00Z' },
      { id: 4, created_at: '2026-01-01T00:00:30Z' },
      { id: 5, in_reply_to_id: 99, created_at: '2026-01-01T00:03:00Z' },
      { id: 6, in_reply_to_id: 4, created_at: '2026-01-01T00:04:00Z' },
    ],
    [],
  ]);
  const st = { device: 'iPhone', docPath: 'docs/a.zh-CN.md', anchor: 'L42', time: '2026-10-13T12:00:00.000Z' };
  out.buildReadStateBody = io(O.buildReadStateBody, [st, { device: '', docPath: 'docs/引号"与\\.md', anchor: 'L1', time: '2026-01-01T00:00:00Z' }]);
  out.parseReadState = io(O.parseReadState, [
    O.buildReadStateBody(st),
    '﻿  <!-- menxia-readstate {"device":"Mac","docPath":"d.md","anchor":"L7","time":"t","v":2} -->',
    '<!--menxia-readstate {"device":1,"docPath":"d.md"}-->',
    '<!-- menxia-readstate {坏 json} -->',
    '<!-- menxia-readstate null -->',
    '前面有字 <!-- menxia-readstate {"docPath":"d.md"} -->',
    '普通判',
    null,
  ]);
  out.isReadStateComment = io(O.isReadStateComment, [O.buildReadStateBody(st), '  <!-- menxia-readstate {} -->', '普通判', '']);
  const remote = O.parseReadState(O.buildReadStateBody(st));
  out.shouldPromptJump = [
    [remote, {}],
    [remote, { localTime: '2026-10-13T13:00:00.000Z' }],
    [remote, { localTime: '2026-10-13T11:00:00.000Z', current: { docPath: 'docs/a.md', anchor: 'L42' } }],
    [remote, { current: { docPath: 'docs/a.zh-CN.md', anchor: 'L42' } }],
    [null, {}],
    [{ ...remote, docPath: '' }, {}],
  ].map(([r, opts]) => ({ input: { remote: r, opts }, output: O.shouldPromptJump(r, opts) }));
  return out;
}

export function buildGolden() {
  const files = new Map();
  const names = readdirSync(CORPUS).filter((f) => f.endsWith('.md')).sort();
  const corpusIndex = [];
  for (const name of names) {
    const src = readFileSync(join(CORPUS, name), 'utf8');
    const d = renderDoc(src);
    const base = name.replace(/\.md$/, '');
    const head = { format: FORMAT_VERSION, source: `corpus/${name}` };
    files.set(`expected/${base}.blocks.json`, json({ ...head, blocks: d.blocks }));
    files.set(`expected/${base}.toc.json`, json({ ...head, ...tocOf(d.root) }));
    files.set(`expected/${base}.anchors.json`, json({ ...head, ...anchorsOf(d) }));
    corpusIndex.push({ name, blocks: d.blocks.length, crlf: src.includes('\r\n') });
  }
  for (const [k, v] of Object.entries(functionSamples())) files.set(`expected/functions/${k}.json`, json({ format: FORMAT_VERSION, fn: k, cases: v }));
  // 校验和清单：原生仓「带校验和的复制」——拷过去后逐文件比 sha256，防手改/漏拷
  const sha = (s) => createHash('sha256').update(s).digest('hex');
  const manifest = { format: FORMAT_VERSION, corpus: {}, expected: {} };
  for (const name of names) manifest.corpus[`corpus/${name}`] = sha(readFileSync(join(CORPUS, name)));
  for (const [k, v] of [...files].sort(([a], [b]) => (a < b ? -1 : 1))) manifest.expected[k] = sha(v);
  manifest.docs = corpusIndex;
  files.set('manifest.json', json(manifest));
  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = buildGolden();
  for (const [rel, body] of files) {
    mkdirSync(dirname(join(here, rel)), { recursive: true });
    writeFileSync(join(here, rel), body);
  }
  console.log(`写出 ${files.size} 个 golden 文件到 test/golden/`);
}
