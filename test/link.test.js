// 折间链接：只认本仓的 GitHub permalink，其余一律当外链放行
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseZhupiLink, buildRef } from '../src/link.js';

const SLUG = 'charliezong18/review';

test('认 PR 链接 → 跳折', () => {
  assert.deepEqual(parseZhupiLink('https://github.com/charliezong18/review/pull/7', SLUG),
    { prNumber: 7, path: null, line: null });
});

test('认某条批注的 permalink（跳到折即可，批注串本来就在右缘）', () => {
  const r = parseZhupiLink('https://github.com/charliezong18/review/pull/7#discussion_r123', SLUG);
  assert.equal(r.prNumber, 7);
});

test('认文件行链接 → 文档 + 行号', () => {
  assert.deepEqual(
    parseZhupiLink('https://github.com/charliezong18/review/blob/main/docs/zhupi-spec.md#L42', SLUG),
    { prNumber: null, path: 'docs/zhupi-spec.md', line: 42 });
});

test('分支名带斜杠也能切出文档路径', () => {
  const r = parseZhupiLink('https://github.com/charliezong18/review/blob/feat/x/docs/a.md#L3', SLUG);
  assert.equal(r.path, 'docs/a.md');
  assert.equal(r.line, 3);
});

test('行区间取起始行', () => {
  const r = parseZhupiLink('https://github.com/charliezong18/review/blob/main/docs/a.md#L10-L20', SLUG);
  assert.equal(r.line, 10);
});

test('别的仓 / 别的站 / 垃圾输入 → null（当普通外链，别装懂）', () => {
  ['https://github.com/slopus/happy/pull/7',
   'https://example.com/charliezong18/review/pull/7',
   'https://github.com/charliezong18/review/issues/7',
   'https://github.com/charliezong18/review/blob/main/README.md#L1',
   'not a url', ''].forEach((h) => assert.equal(parseZhupiLink(h, SLUG), null, `应拒绝：${h}`));
  assert.equal(parseZhupiLink('https://github.com/charliezong18/review/pull/7', ''), null);
});

test('大小写不敏感（GitHub owner/repo 不区分大小写）', () => {
  assert.equal(parseZhupiLink('https://github.com/CharlieZong18/Review/pull/9', SLUG).prNumber, 9);
});

test('buildRef: 带引文的文件行引用可被自己解析回来（往返一致）', () => {
  const md = buildRef({ slug: SLUG, path: 'docs/a.md', line: 42, quote: '  镜片   随时可以摘掉  ' });
  assert.ok(md.startsWith('[「镜片 随时可以摘掉」]('), md);
  const url = md.slice(md.indexOf('(') + 1, -1);
  assert.deepEqual(parseZhupiLink(url, SLUG), { prNumber: null, path: 'docs/a.md', line: 42 });
});

test('buildRef: 无引文时退化成裸链接；折级引用不带路径', () => {
  assert.equal(buildRef({ slug: SLUG, prNumber: 7 }), 'https://github.com/charliezong18/review/pull/7');
});

test('buildRef: 超长引文截断（60 字）', () => {
  const md = buildRef({ slug: SLUG, path: 'docs/a.md', line: 1, quote: '很长'.repeat(50) });
  const q = md.slice(md.indexOf('「') + 1, md.indexOf('」'));
  assert.ok(q.length <= 60, `引文应截断，实际 ${q.length}`);
});

// ── F7 外部直达链接 ──
import { parseDeepLink, buildDeepLink } from '../src/link.js';

test('parseDeepLink: ?pr=13 及带 path/line', () => {
  assert.deepEqual(parseDeepLink('?pr=13', SLUG), { prNumber: 13, path: null, line: null });
  assert.deepEqual(parseDeepLink('?pr=13&path=docs/a.md&line=42', SLUG),
    { prNumber: 13, path: 'docs/a.md', line: 42 });
});

test('parseDeepLink: ?ref= 走 F6 那套解析（零新语法）', () => {
  assert.deepEqual(
    parseDeepLink('?ref=' + encodeURIComponent('https://github.com/charliezong18/review/blob/main/docs/a.md#L7'), SLUG),
    { prNumber: null, path: 'docs/a.md', line: 7 });
});

test('parseDeepLink: 垃圾输入一律 null（不能让烂链接把 app 带沟里）', () => {
  ['', '?', '?pr=', '?pr=abc', '?pr=0', '?pr=-3', '?foo=1',
   '?ref=' + encodeURIComponent('https://github.com/slopus/happy/pull/1')].forEach((s) =>
    assert.equal(parseDeepLink(s, SLUG), null, `应拒绝：${s}`));
});

test('parseDeepLink: 非法 line 退化成 null 而不是崩', () => {
  assert.equal(parseDeepLink('?pr=5&line=abc', SLUG).line, null);
  assert.equal(parseDeepLink('?pr=5&line=0', SLUG).line, null);
});

test('buildDeepLink ↔ parseDeepLink 往返一致', () => {
  const url = buildDeepLink('https://x.io/zhupi/', { prNumber: 13, path: 'docs/a.md', line: 42 });
  assert.equal(url, 'https://x.io/zhupi/?pr=13&path=docs%2Fa.md&line=42');
  assert.deepEqual(parseDeepLink(new URL(url).search, SLUG),
    { prNumber: 13, path: 'docs/a.md', line: 42 });
});

test('buildDeepLink: 无折号退化成首页', () => {
  assert.equal(buildDeepLink('https://x.io/zhupi/', {}), 'https://x.io/zhupi/');
});
