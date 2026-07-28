// F8 语言切页：只认「同 basename + .zh-CN」，不猜正文语言
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { variantOf, langPairs, siblingFor, visibleDocs } from '../src/lang.js';

const FILES = ['docs/spec.md', 'docs/spec.zh-CN.md', 'docs/solo.md', 'README.md', 'README.zh-CN.md'];

test('variantOf: 认出语言与归一化 base', () => {
  assert.deepEqual(variantOf('docs/a.zh-CN.md'), { base: 'docs/a.md', lang: 'zh' });
  assert.deepEqual(variantOf('docs/a.md'), { base: 'docs/a.md', lang: 'en' });
  assert.equal(variantOf('docs/a.png'), null);
  assert.equal(variantOf(''), null);
});

test('langPairs: 只收真成对的，落单的不算', () => {
  const p = langPairs(FILES);
  assert.equal(p.size, 2);
  assert.deepEqual(p.get('docs/spec.md'), { en: 'docs/spec.md', zh: 'docs/spec.zh-CN.md' });
  assert.ok(!p.has('docs/solo.md'), '单份文档不该被当成配对');
});

test('siblingFor: 中↔英互查；无配对返回 null', () => {
  assert.equal(siblingFor('docs/spec.md', FILES), 'docs/spec.zh-CN.md');
  assert.equal(siblingFor('docs/spec.zh-CN.md', FILES), 'docs/spec.md');
  assert.equal(siblingFor('docs/solo.md', FILES), null);
});

test('visibleDocs: 成对的只出一个（按偏好），单份保留，顺序不乱', () => {
  assert.deepEqual(visibleDocs(FILES, 'zh'),
    ['docs/spec.zh-CN.md', 'docs/solo.md', 'README.zh-CN.md']);
  assert.deepEqual(visibleDocs(FILES, 'en'),
    ['docs/spec.md', 'docs/solo.md', 'README.md']);
});

test('visibleDocs: 只有一种语言时不该凭空消失', () => {
  assert.deepEqual(visibleDocs(['docs/only-zh.zh-CN.md'], 'en'), ['docs/only-zh.zh-CN.md']);
  assert.deepEqual(visibleDocs(['docs/only-en.md'], 'zh'), ['docs/only-en.md']);
});

test('visibleDocs: 空输入不炸', () => {
  assert.deepEqual(visibleDocs([], 'zh'), []);
  assert.deepEqual(visibleDocs(undefined, 'zh'), []);
});
