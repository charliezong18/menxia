// F14 大纲 / 分级阅读：标题抽取、scroll spy、章列表（双语配对沿用 F8）。
// 纯逻辑层：extractOutline 只读 querySelectorAll + dataset/tagName/textContent，
// 用一个最小假 doc 喂它（与 components.test.js 桩 window.markdownit 同法，不引真 DOM）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractOutline, hasOutline, activeHeadingLine,
  chapterList, chapterName, shouldUseChapterList,
  OUTLINE_MIN_HEADINGS, CHAPTER_LIST_THRESHOLD,
} from '../src/toc.js';

// 造一个假标题节点：{ tagName, dataset:{line}, textContent }
const h = (tag, line, text) => ({ tagName: tag, dataset: { line: line == null ? '' : String(line) }, textContent: text });
// 假 doc：querySelectorAll 无视选择器，返回给定节点集（extractOutline 只查 h1/h2/h3，节点已是那批）
const fakeDoc = (nodes) => ({ querySelectorAll: () => nodes });

test('extractOutline: 抽出 line/level/text，层级映射 h1/h2/h3 → 1/2/3', () => {
  const doc = fakeDoc([h('H1', 1, '总纲'), h('H2', 5, '第一节'), h('H3', 9, '细目')]);
  assert.deepEqual(extractOutline(doc), [
    { line: 1, level: 1, text: '总纲', id: 1 },
    { line: 5, level: 2, text: '第一节', id: 5 },
    { line: 9, level: 3, text: '细目', id: 9 },
  ]);
});

test('extractOutline: 标题文字 trim；空标题与无 line 的畸形标题跳过', () => {
  const doc = fakeDoc([h('H2', 3, '  两边有空白  '), h('H2', 7, '   '), h('H1', null, '没行号')]);
  assert.deepEqual(extractOutline(doc), [{ line: 3, level: 2, text: '两边有空白', id: 3 }]);
});

test('extractOutline: 没有 doc 不炸，返回空', () => {
  assert.deepEqual(extractOutline(null), []);
  assert.deepEqual(extractOutline(undefined), []);
});

test('hasOutline: 少于阈值不显示（短折不加噪音）', () => {
  assert.equal(OUTLINE_MIN_HEADINGS, 3);
  assert.equal(hasOutline([{ line: 1 }, { line: 2 }]), false); // 2 个 < 3
  assert.equal(hasOutline([{ line: 1 }, { line: 2 }, { line: 3 }]), true); // 恰好 3 个
  assert.equal(hasOutline([]), false);
  assert.equal(hasOutline(undefined), false);
});

test('activeHeadingLine: 取最后一个已越过触发线的标题（scroll spy 核心）', () => {
  // top 是标题相对滚动容器顶端的偏移；触发线默认 96：top-96<=0 即算「已进入」
  const tops = [
    { line: 1, top: -200 }, // 早滚过头顶
    { line: 5, top: -40 },  // 也过了触发线（-40-96<0）
    { line: 9, top: 300 },  // 还在下方没到
  ];
  assert.equal(activeHeadingLine(tops), 5);
});

test('activeHeadingLine: 全在触发线之下时归第一个（读者在文首）', () => {
  const tops = [{ line: 1, top: 200 }, { line: 5, top: 500 }];
  assert.equal(activeHeadingLine(tops), 1);
});

test('activeHeadingLine: 空输入返回 null（大纲不显示时不会被叫到，但也不能炸）', () => {
  assert.equal(activeHeadingLine([]), null);
  assert.equal(activeHeadingLine(undefined), null);
});

test('activeHeadingLine: 自定义触发线', () => {
  const tops = [{ line: 1, top: -10 }, { line: 5, top: 20 }];
  // 触发线 0：只有 top<=0 的算进入 → line 1
  assert.equal(activeHeadingLine(tops, 0), 1);
  // 触发线 50：top 20 也满足 20-50<0 → line 5
  assert.equal(activeHeadingLine(tops, 50), 5);
});

// ── 章列表：必须沿用 F8 双语配对，别把中英列成两章 ──
const BOOK = [
  'book/00-intro.md', 'book/00-intro.zh-CN.md',
  'book/01-tang.md', 'book/01-tang.zh-CN.md',
  'book/02-song.md', // 只有英文，落单
];

test('chapterName: 去目录去 .zh-CN.md / .md 后缀', () => {
  assert.equal(chapterName('book/01-tang.zh-CN.md'), '01-tang');
  assert.equal(chapterName('book/01-tang.md'), '01-tang');
  assert.equal(chapterName('README.md'), 'README');
  assert.equal(chapterName(''), '');
});

test('chapterList: 成对的合成一章（不列两遍），单份保留，按偏好出语言', () => {
  const zh = chapterList(BOOK, 'book/01-tang.zh-CN.md', 'zh');
  assert.deepEqual(zh.map((c) => c.path),
    ['book/00-intro.zh-CN.md', 'book/01-tang.zh-CN.md', 'book/02-song.md']);
  assert.deepEqual(zh.map((c) => c.name), ['00-intro', '01-tang', '02-song']);
  // 中英合并：3 个文件对(intro)+2(tang)+1(song) = 5 个文件，但只 3 章
  assert.equal(zh.length, 3);
});

test('chapterList: 当前章高亮——切到配对篇（另一语言）仍算同一章', () => {
  // 在读中文版 tang，英文版 tang 也应判为 active（active 认 base，不认语言）
  const zh = chapterList(BOOK, 'book/01-tang.zh-CN.md', 'zh');
  assert.deepEqual(zh.map((c) => c.active), [false, true, false]);
  const en = chapterList(BOOK, 'book/01-tang.md', 'en');
  assert.deepEqual(en.map((c) => c.active), [false, true, false]);
  assert.deepEqual(en.map((c) => c.path),
    ['book/00-intro.md', 'book/01-tang.md', 'book/02-song.md']);
});

test('shouldUseChapterList: 双语合并后超阈值才换下拉（demo 的 2 章不触发）', () => {
  assert.equal(CHAPTER_LIST_THRESHOLD, 7);
  // demo：demo.md + guide 双语对 → 合并后 2 章，不触发
  assert.equal(shouldUseChapterList(['docs/demo.md', 'docs/guide.md', 'docs/guide.zh-CN.md'], 'zh'), false);
  // 7 章不触发（阈值是「超过」），8 章触发
  const seven = Array.from({ length: 7 }, (_, i) => `c${i}.md`);
  const eight = Array.from({ length: 8 }, (_, i) => `c${i}.md`);
  assert.equal(shouldUseChapterList(seven, 'zh'), false);
  assert.equal(shouldUseChapterList(eight, 'zh'), true);
});

test('shouldUseChapterList: 双语对不被重复计数（20 文件 = 10 章 → 触发，10 文件 = 10 章）', () => {
  // 10 个 base，每个都成中英对 = 20 文件，但只 10 章 > 7 → 触发
  const paired = [];
  for (let i = 0; i < 10; i++) { paired.push(`ch${i}.md`, `ch${i}.zh-CN.md`); }
  assert.equal(shouldUseChapterList(paired, 'zh'), true);
  // 反证：若按文件数(20)判会误触发，但按章数(10)判——把配对减到 4 章(8 文件)应不触发
  const four = [];
  for (let i = 0; i < 4; i++) { four.push(`ch${i}.md`, `ch${i}.zh-CN.md`); }
  assert.equal(shouldUseChapterList(four, 'zh'), false);
});
