// 存钥页回显末 4 位（2026-10-13：密码框不回显已存钥匙，被当成「钥匙就在框里」拷错了值）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskToken } from '../src/github.js';
import { S } from '../src/strings.js';

test('maskToken：只露末 4 位', () => {
  assert.equal(maskToken('github_pat_11ABCDEFG_xyz0a1b2'), '••••a1b2');
  assert.equal(maskToken('  ghp_abcd1234  '), '••••1234', '先 trim，与 setToken 一致');
});

test('maskToken：没钥匙返回空串（不渲染「已存」行）；不足 5 位全遮', () => {
  assert.equal(maskToken(''), '');
  assert.equal(maskToken(null), '');
  assert.equal(maskToken(undefined), '');
  assert.equal(maskToken('abcd'), '••••');
});

test('存钥页文案：已存行 + 不回显说明', () => {
  assert.equal(S.setup.stored('••••a1b2'), '已存：••••a1b2（末 4 位）');
  assert.match(S.setup.storedNote, /不回显已存钥匙/);
  assert.match(S.setup.storedNote, /保存 token 的地方/);
});
