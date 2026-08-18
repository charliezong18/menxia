// store.js（存储 driver 门面，SPEC §8.3 V3）的对账与路由测试。
//
// 为什么要对账：store 的转发是一张手写清单，github.js 新增出口而 store 忘了转发，
// 消费方就拿不到——和 BUILD_FILES 漏登记同一类腐烂（那边 2026-08-06 栽过两次）。
// 清单式配置必须自己对账，别靠人记得。
import { test } from 'node:test';
import assert from 'node:assert/strict';

// github.js 模块级读 localStorage —— 先打桩再 import（与 github.test.js 同法）
const kv = new Map();
globalThis.localStorage = {
  getItem: (k) => (kv.has(k) ? kv.get(k) : null),
  setItem: (k, v) => kv.set(k, v),
  removeItem: (k) => kv.delete(k),
};

const gh = await import('../src/github.js');
const store = await import('../src/store.js');

test('出口对账：github.js 的每个出口 store 都转发（清单不许烂）', () => {
  const missing = Object.keys(gh).filter((k) => !(k in store));
  assert.deepEqual(missing, [], `github.js 有而 store.js 没转发：${missing}`);
});

test('setAdapter 真的换 driver：调用打到假 adapter 上', async () => {
  const calls = [];
  store.setAdapter({ listOpenPRs: (...a) => { calls.push(a); return Promise.resolve([{ number: 1 }]); } });
  try {
    const prs = await store.listOpenPRs();
    assert.deepEqual(prs, [{ number: 1 }]);
    assert.equal(calls.length, 1);
  } finally {
    store.setAdapter(gh);   // 别污染同进程里的其他测试
  }
});

test('默认 driver 是 github 模块本身', () => {
  assert.equal(store.getAdapter(), gh);
});

test('转发是晚绑定：换 adapter 后旧引用也跟着换（fwd 不缓存实现）', async () => {
  const ref = store.listPRComments;          // 换 adapter 之前拿到的函数引用
  store.setAdapter({ listPRComments: () => Promise.resolve(['fake']) });
  try {
    assert.deepEqual(await ref(1), ['fake']);
  } finally {
    store.setAdapter(gh);
  }
});
