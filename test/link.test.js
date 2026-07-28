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

// ── F9 回奏对：从 PR body 里认出呈折的 Happy 会话 ──
import { parseHappySession } from '../src/link.js';

test('认注释标记 → 默认站点的会话链接', () => {
  assert.equal(
    parseHappySession('TLDR\n\n<!-- happy-session: cms3yv065k1oqyc0teh4a5why -->\n'),
    'https://charliezong18.github.io/happy/session/cms3yv065k1oqyc0teh4a5why');
});

test('标记里写整条 URL 则原样用（fork 的人自架 Happy 也能用）', () => {
  assert.equal(
    parseHappySession('<!-- happy-session: https://happy.example.com/session/abc123def456ghij -->'),
    'https://happy.example.com/session/abc123def456ghij');
});

test('body 里的可见 Happy 会话链接也认（agent 手写时更自然）', () => {
  assert.equal(
    parseHappySession('呈自 [这次奏对](https://charliezong18.github.io/happy/session/cms3yv065k1oqyc0teh4a5why)'),
    'https://charliezong18.github.io/happy/session/cms3yv065k1oqyc0teh4a5why');
});

test('没标记 / body 为空 / 乱写一律 null（按钮就不出现）', () => {
  ['', null, undefined, '普通 PR body', '<!-- happy-session: -->', '<!-- happy-session: 太短 -->',
   '<!-- happy-session: javascript:alert(1) -->',
   '<!-- happy-session: http://evil.com/session/aaaaaaaaaaaaaaaa -->'].forEach((b) =>
    assert.equal(parseHappySession(b), null, `应拒绝：${b}`));
});

test('标记优先于正文里的可见链接（正文可能在引用别的会话）', () => {
  const body = '参考上一折 https://charliezong18.github.io/happy/session/aaaaaaaaaaaaaaaaaaaaaaaaa\n'
    + '<!-- happy-session: bbbbbbbbbbbbbbbbbbbbbbbbb -->';
  assert.ok(parseHappySession(body).endsWith('/bbbbbbbbbbbbbbbbbbbbbbbbb'));
});

test('正文兜底只认默认站点：别站的 /session/ 路径不当会话（否则按钮指错地方）', () => {
  assert.equal(parseHappySession('见 https://example.com/session/aaaaaaaaaaaaaaaaa'), null);
  assert.equal(parseHappySession('见 https://charliezong18.github.io/happy/pull/7'), null);
});

test('id 长度边界：15 位拒、41 位拒（不截断成「合法但错」的链接）', () => {
  const id = (n) => 'a'.repeat(n);
  assert.equal(parseHappySession(`<!-- happy-session: ${id(15)} -->`), null);
  assert.equal(parseHappySession(`<!-- happy-session: ${id(41)} -->`), null);
  assert.ok(parseHappySession(`<!-- happy-session: ${id(16)} -->`));
  assert.ok(parseHappySession(`<!-- happy-session: ${id(40)} -->`));
  assert.equal(parseHappySession(`见 https://charliezong18.github.io/happy/session/${id(41)}`), null);
});

test('标记里的整条 URL：路径不是 /session/<id> 结尾则拒', () => {
  ['<!-- happy-session: https://evil.com/x -->',
   '<!-- happy-session: https://happy.example.com/session/abc123def456ghij/extra -->',
   '<!-- happy-session: https://happy.example.com/session/短 -->'].forEach((b) =>
    assert.equal(parseHappySession(b), null, `应拒绝：${b}`));
});

// ── 文档内相对链接（点「中文」404 那条）──
import { resolveRelativeDocLink } from '../src/link.js';

test('相对链接按当前文档所在目录解析', () => {
  assert.equal(resolveRelativeDocLink('README.zh-CN.md', 'README.md'), 'README.zh-CN.md');
  assert.equal(resolveRelativeDocLink('other.md', 'docs/a.md'), 'docs/other.md');
  assert.equal(resolveRelativeDocLink('./b.md', 'docs/a.md'), 'docs/b.md');
  assert.equal(resolveRelativeDocLink('../top.md', 'docs/sub/a.md'), 'docs/top.md');
  assert.equal(resolveRelativeDocLink('/abs.md', 'docs/a.md'), 'abs.md');
});

test('带锚点/查询串照样解析出路径', () => {
  assert.equal(resolveRelativeDocLink('spec.md#L3', 'docs/a.md'), 'docs/spec.md');
});

test('绝对链接 / 锚点 / mailto / 协议相对 一律不拦（返回 null）', () => {
  ['https://github.com/x/y', 'http://a.com', '#section', 'mailto:a@b.c',
   '//cdn.example.com/x.md', '', '   '].forEach((h) =>
    assert.equal(resolveRelativeDocLink(h, 'docs/a.md'), null, `不该拦：${h}`));
});

test('buildRef 必须带当前 ref：指向 main 对未 merge 的折是生下来就 404 的链', () => {
  const md = buildRef({ slug: SLUG, path: 'docs/a.md', line: 3, quote: 'x', ref: 'abc1234' });
  assert.ok(md.includes('/blob/abc1234/docs/a.md#L3'), md);
  // 不给 ref 才退回 main（兼容旧调用）
  assert.ok(buildRef({ slug: SLUG, path: 'docs/a.md', line: 3 }).includes('/blob/main/'));
});
