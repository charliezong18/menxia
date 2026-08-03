// 正文字号档位（2026-08-03）。纯逻辑：只测「档位怎么钳、怎么存、坏值怎么退」。
// 倍率具体是多少不测——那是可调的口味参数，钉死它只会让以后调档位时红一片假警报。
import { test } from 'node:test';
import assert from 'node:assert/strict';

// localStorage 桩：node 里没有这个全局，且要能模拟隐私模式下的抛异常。
// 装在 import 之前——readsize.js 的读写是调用时才碰 localStorage，但保险起见先摆好。
let store = {};
let boom = false;
globalThis.localStorage = {
  getItem: (k) => { if (boom) throw new Error('SecurityError'); return k in store ? store[k] : null; },
  setItem: (k, v) => { if (boom) throw new Error('SecurityError'); store[k] = String(v); },
};

const {
  READ_STEPS, DEFAULT_STEP, clampStep, scaleOf, percentOf, getReadStep, setReadStep,
} = await import('../src/readsize.js');

const reset = () => { store = {}; boom = false; };

test('档位表：默认档的倍率必须正好是 1（= 现行字号，不许上线就变样）', () => {
  assert.equal(READ_STEPS[DEFAULT_STEP], 1);
  assert.equal(percentOf(DEFAULT_STEP), 100);
  assert.ok(READ_STEPS.length >= 3, '至少要有小/常/大三档才配叫「设置」');
  const sorted = [...READ_STEPS].sort((a, b) => a - b);
  assert.deepEqual(READ_STEPS, sorted, '档位必须单调递增，否则 A⁺ 会把字调小');
});

test('clampStep：越界钳到两端，坏值退回默认（不是退回 0）', () => {
  assert.equal(clampStep(-5), 0);
  assert.equal(clampStep(999), READ_STEPS.length - 1);
  assert.equal(clampStep('2'), 2, '从 localStorage 读回来的是字符串');
  assert.equal(clampStep(1.4), 1, '小数取整，不产生档位之间的中间态');
  for (const bad of [undefined, null, NaN, 'abc', {}]) {
    assert.equal(clampStep(bad), DEFAULT_STEP, `坏值 ${String(bad)} 该退回默认档`);
  }
});

test('存取往返：存进去什么档，读回来还是什么档', () => {
  reset();
  setReadStep(3);
  assert.equal(getReadStep(), 3);
  assert.equal(scaleOf(getReadStep()), READ_STEPS[3]);
});

test('没存过 → 默认档；存了脏值 → 也退回默认档而不是炸', () => {
  reset();
  assert.equal(getReadStep(), DEFAULT_STEP, '首次进站用现行字号');
  store['zhupi.readScale'] = 'garbage';
  assert.equal(getReadStep(), DEFAULT_STEP);
  store['zhupi.readScale'] = '9999';
  assert.equal(getReadStep(), READ_STEPS.length - 1, '越界的存量值钳到最大档，不重置');
});

// lang.js 踩过的坑：getLang 被 useState 初值同步调用，隐私模式下 localStorage 直接抛
// DOMException → 整站白屏。getReadStep 是同一个用法，必须同样兜住。
test('隐私模式：localStorage 抛异常时不许把异常冒出去', () => {
  reset();
  boom = true;
  assert.doesNotThrow(() => getReadStep(), '读失败要静默退回默认档');
  assert.equal(getReadStep(), DEFAULT_STEP);
  assert.doesNotThrow(() => setReadStep(2), '写失败只该让设置不持久，不该炸');
});

test('setReadStep 也钳：越界值不会被原样写进存储污染下次启动', () => {
  reset();
  setReadStep(999);
  assert.equal(store['zhupi.readScale'], String(READ_STEPS.length - 1));
  setReadStep(-3);
  assert.equal(store['zhupi.readScale'], '0');
});
