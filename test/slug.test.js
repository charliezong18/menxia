// 页内锚点：slug 生成（对齐 GitHub）+ 片段匹配的四级放宽。
// 纯逻辑层，不碰 DOM——matchAnchor 只认 `{ id, text }`，元素由调用方自己挂。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, makeSlugger, matchAnchor } from '../src/slug.js';

test('slugify: 小写、空格换连字符、去标点，保留 - 与 _', () => {
  assert.equal(slugify('Highline Day Module'), 'highline-day-module');
  assert.equal(slugify('Back-to_Top!'), 'back-to_top');
  assert.equal(slugify('  Trimmed  '), 'trimmed');
});

test('slugify: CJK 标点也算标点（〈〉（）、，。「」全去掉）', () => {
  assert.equal(slugify('〈Highline 日模块〉'), 'highline-日模块');
  assert.equal(slugify('加长段（冒烟用，别删）'), '加长段冒烟用别删');
  assert.equal(slugify('无票日选项：三条'), '无票日选项三条');
});

test('slugify: 只换半角空格，不折叠——折叠就和 GitHub 分家了', () => {
  assert.equal(slugify('a  b'), 'a--b');
});

// 2026-08-06 双查：不可见字符不清掉会产出**非法 id**（HTML 的 id 不得含 ASCII 空白），
// 且 NBSP/ZWSP 生成的 id 与正常 id 长得一样，手写的片段永远命不中。
test('slugify: TAB / NBSP / U+3000 / ZWSP / ZWJ / 软连字符全部删掉', () => {
  assert.equal(slugify('a\tb'), 'ab');
  assert.equal(slugify('a b'), 'ab');
  assert.equal(slugify('a　b'), 'ab');
  assert.equal(slugify('a​b'), 'ab');
  assert.equal(slugify('a­b'), 'ab');
  assert.equal(slugify('👨‍👩‍👧 family'), '-family');   // emoji 被 \p{S} 删，ZWJ 不许留下
});

test('slugify: 半角空格照旧换连字符，不被「清空白」那一步顺手吃掉', () => {
  assert.equal(slugify('回到 顶部'), '回到-顶部');
});

test('slugify: 空/纯标点得到空串（调用方据此不打 id）', () => {
  assert.equal(slugify(''), '');
  assert.equal(slugify(null), '');
  assert.equal(slugify('———'), '');   // 全角破折号是 Pd，被保留…
  assert.equal(slugify('。。。'), '');
});

test('makeSlugger: 同名标题依次追加 -1 / -2', () => {
  const s = makeSlugger();
  assert.equal(s('小结'), '小结');
  assert.equal(s('小结'), '小结-1');
  assert.equal(s('小结'), '小结-2');
});

test('makeSlugger: 文档里真有个叫 foo-1 的标题时不产出重复 id', () => {
  const s = makeSlugger();
  assert.equal(s('foo'), 'foo');
  assert.equal(s('foo 1'), 'foo-1');   // 先把 foo-1 占了
  assert.equal(s('foo'), 'foo-2');     // 第二个 foo 必须让开，不能也叫 foo-1
});

test('makeSlugger: 每次调用是独立计数（换文档不该继承上一篇的后缀）', () => {
  assert.equal(makeSlugger()('小结'), '小结');
  assert.equal(makeSlugger()('小结'), '小结');
});

const HEADS = [
  { id: 'highline-日模块', text: '〈Highline 日模块〉' },
  { id: '无票日选项', text: '无票日选项' },
  { id: 'back-to_top', text: 'Back-to_Top!' },
];

test('matchAnchor ①：id 逐字相等', () => {
  assert.equal(matchAnchor(HEADS, 'highline-日模块')?.id, 'highline-日模块');
});

// 2026-08-06 双查抓到的静默错跳：两个标题 slug 同底（后者被去重成 `-1`），
// 片段与**后者原文逐字相同**，可「再 slug 一遍」会先命中前者。逐字相等必须压在放宽规则之上。
test('matchAnchor ②：逐字相等的标题原文优先于「slug 后同底」的另一个标题', () => {
  const heads = [
    { id: '无票日选项', text: '无票日选项' },
    { id: '无票日选项-1', text: '无票日·选项' },
  ];
  assert.equal(matchAnchor(heads, '无票日·选项')?.id, '无票日选项-1');
  assert.equal(matchAnchor(heads, '无票日选项')?.id, '无票日选项');       // 前者照旧
  assert.equal(matchAnchor(heads, '无票日选项-1')?.id, '无票日选项-1');   // id 逐字仍最优先
});

test('matchAnchor ③：片段是标题原文时，再 slug 一遍命中', () => {
  assert.equal(matchAnchor(HEADS, '〈Highline 日模块〉')?.id, 'highline-日模块');
  assert.equal(matchAnchor(HEADS, 'Highline 日模块')?.id, 'highline-日模块');
});

test('matchAnchor ④：连字符/空格口径有出入时兜底', () => {
  assert.equal(matchAnchor(HEADS, 'Highline日模块')?.id, 'highline-日模块');
  assert.equal(matchAnchor(HEADS, 'backtotop')?.id, 'back-to_top');
});

test('matchAnchor：找不到返回 null（调用方据此出声，不静默）', () => {
  assert.equal(matchAnchor(HEADS, '不存在的一节'), null);
  assert.equal(matchAnchor(HEADS, ''), null);
  assert.equal(matchAnchor(HEADS, '   '), null);
  assert.equal(matchAnchor([], 'highline-日模块'), null);
  assert.equal(matchAnchor(null, 'x'), null);
});

test('matchAnchor：纯标点片段不该误命中「slug 后同为空」的标题', () => {
  assert.equal(matchAnchor([{ id: 'x', text: '。。。' }], '，，，'), null);
});
