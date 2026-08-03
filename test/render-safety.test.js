// 渲染安全 —— 钉住 src/render.js:2 的 `html: false`（+ markdown-it 内建 validateLink）。
// 由来：那一个布尔值是整个项目里唯一拦住「评论正文里的裸 HTML 被当 HTML 执行」的东西，
// 下游 ui.js / cards.js / other-threads.js / zongpi-shown.js 全是 innerHTML / dangerouslySetInnerHTML
// 注入点。把它改成 true，三层测试原本全绿，而每条评论同时变成 XSS sink——没有任何反馈。
// 这一组断言就是那条防线的锚：翻 true 或换掉不拦协议的渲染器，这里必须红。
//
// 关键：必须跑在**真** markdown-it 上，不能补个宽容的桩（桩成 t => '<p>'+t+'</p>' 就等于没测，
// 这个坑在 #1 已经踩过一次）。因此这里加载 vendored 的真引擎，且在 import render.js **之前**
// 把它挂到 window.markdownit——render.js 模块顶层就要读它，只能走「先设 window，再动态 import」。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// vendored markdown-it 是 UMD，node 里 require 直接拿到工厂函数（和浏览器 window.markdownit 同一份）。
const markdownit = require('../vendor/markdown-it.min.js');
globalThis.window = { markdownit };

const { renderMarkdown } = await import('../src/render.js');

test('裸 <img> 被转义成惰性文本，不成活 DOM', () => {
  const out = renderMarkdown('<img src=x onerror=alert(1)>');
  assert.doesNotMatch(out, /<img/i, '出现了活 <img> —— html:false 防线破了');
  assert.match(out, /&lt;img/i, '应转义成 &lt;img');
});

test('裸 <script> 被转义，不成活 DOM', () => {
  const out = renderMarkdown('<script>alert(1)</scr' + 'ipt>');
  assert.doesNotMatch(out, /<script/i, '出现了活 <script> —— html:false 防线破了');
  assert.match(out, /&lt;script/i);
});

test('javascript: 链接不渲染成活 href', () => {
  const out = renderMarkdown('[a](javascript:alert(1))');
  assert.doesNotMatch(out, /href="javascript:/i, 'validateLink 没拦住 javascript: 协议');
});

test('大小写混淆的 JaVaScRiPt: 同样不成活 href', () => {
  const out = renderMarkdown('[a](JaVaScRiPt:alert(1))');
  assert.doesNotMatch(out, /href="javascript:/i);
});

test('vbscript: 链接不成活 href', () => {
  const out = renderMarkdown('[a](vbscript:msgbox(1))');
  assert.doesNotMatch(out, /href="vbscript:/i);
});

test('data: 图片 URL 不成活 src（连 SVG 夹带也拦）', () => {
  const out = renderMarkdown('![i](data:image/svg+xml;base64,AAAA)');
  assert.doesNotMatch(out, /src="data:/i);
});

test('正常 markdown 仍照常渲染（防「一刀切全转义」把功能也误伤）', () => {
  const out = renderMarkdown('**粗** 和 [外链](https://example.com)');
  assert.match(out, /<strong>/);
  assert.match(out, /href="https:\/\/example\.com"/);
});

// ── frontmatter 与双链（2026-08-03，vault 文档搬进弘文馆后暴露）──────────
const { stripFrontmatter: sfm } = await import('../src/render.js');

test('frontmatter 换成等量空行——行号必须纹丝不动', () => {
  const src = '---\ncreated_by: claude\ntags: [a]\n---\n# 标题\n正文';
  const out = sfm(src);
  assert.doesNotMatch(out, /created_by/, 'frontmatter 不该渲染出来');
  assert.equal(out.split('\n').length, src.split('\n').length, '总行数不变（涂归锚在行号上）');
  assert.equal(out.split('\n')[4], '# 标题', '标题仍在第 5 行');
});

test('frontmatter：没有 / 不完整 / 正文里的 --- 一律不动', () => {
  assert.equal(sfm('# 只有正文'), '# 只有正文');
  assert.equal(sfm('---\n没有闭合'), '---\n没有闭合');
  const mid = '# 标题\n\n---\n\n分隔线不是 frontmatter';
  assert.equal(sfm(mid), mid, '只认文件开头那一段');
  assert.equal(sfm(null), '');
});

test('双链 [[目标]] 渲成同折内相对链接，交给 resolveRelativeDocLink 那条路', () => {
  const h = renderMarkdown('下一章 → [[01 这是个什么东西]]');
  assert.match(h, /<a href="01%20%E8%BF%99%E6%98%AF%E4%B8%AA%E4%BB%80%E4%B9%88%E4%B8%9C%E8%A5%BF\.md"/);
  assert.match(h, /class="wikilink"/);
  assert.match(h, />01 这是个什么东西</, '显示名保持原样');
});

test('双链：别名 / 锚点 / 已带扩展名', () => {
  assert.match(renderMarkdown('[[foo|叫我别名]]'), /href="foo\.md"[^>]*>.*叫我别名/s);
  assert.match(renderMarkdown('[[foo#某节]]'), /href="foo\.md#%E6%9F%90%E8%8A%82"/);
  assert.match(renderMarkdown('[[a.md]]'), /href="a\.md"/, '别拼成 a.md.md');
});

test('双链：代码块里的不认（inline rule 天然不进代码）', () => {
  assert.match(renderMarkdown('`[[foo]]`'), /<code>\[\[foo\]\]<\/code>/);
  assert.doesNotMatch(renderMarkdown('```\n[[foo]]\n```'), /<a /);
  assert.doesNotMatch(renderMarkdown('[[]]'), /<a /, '空目标原样留着');
});

test('双链不劫持普通链接与脚注式写法', () => {
  assert.match(renderMarkdown('[普通](x.md)'), /href="x\.md"/);
  assert.doesNotMatch(renderMarkdown('[[嵌套[方括号]]]'), /class="wikilink"/);
});
