// search.js 纯函数单元测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findMatches, lineOfIndex, snippetAround, searchIndex } from '../src/search.js';

test('findMatches: 大小写不敏感、多命中、cap 生效', () => {
  const t = 'Alpha beta ALPHA gamma alpha';
  assert.equal(findMatches(t, 'alpha').length, 3);
  assert.equal(findMatches(t, 'ALPHA', 2).length, 2);
  assert.deepEqual(findMatches(t, '没有的词'), []);
  assert.deepEqual(findMatches(t, ''), []);
});

test('findMatches: 中文无分词也能中', () => {
  const t = '御笔朱批是阅读批注器。朱批落在行上。';
  assert.equal(findMatches(t, '朱批').length, 2);
});

test('lineOfIndex: 行号 1-based、跨行正确', () => {
  const t = '第一行\n第二行\n第三行';
  assert.equal(lineOfIndex(t, 0), 1);
  assert.equal(lineOfIndex(t, t.indexOf('第二行')), 2);
  assert.equal(lineOfIndex(t, t.indexOf('第三行')), 3);
});

test('snippetAround: 短行整行返回，长行开窗带省略号', () => {
  const short = '短句里找词';
  assert.equal(snippetAround(short, short.indexOf('找'), 1), '短句里找词');
  const long = '开头' + '填'.repeat(80) + '目标词' + '填'.repeat(80) + '结尾';
  const s = snippetAround(long, long.indexOf('目标词'), 3);
  assert.ok(s.includes('目标词'));
  assert.ok(s.startsWith('…') && s.endsWith('…'));
  assert.ok(s.length < 80);
});

test('searchIndex: 标题命中 + 正文命中分组返回；两字以下不搜', () => {
  const index = [
    { pr: { number: 1, title: '朱批 SPEC' }, files: { 'docs/a.md': '第一行\n有朱批的正文' } },
    { pr: { number: 2, title: '无关折子' }, files: { 'docs/b.md': '什么都没有' } },
  ];
  const g = searchIndex(index, '朱批');
  assert.equal(g.length, 1);
  assert.equal(g[0].pr.number, 1);
  assert.equal(g[0].hits.filter((h) => h.kind === 'title').length, 1);
  const doc = g[0].hits.find((h) => h.kind === 'doc');
  assert.equal(doc.line, 2);
  assert.deepEqual(searchIndex(index, '朱'), []);
});
