// 左栏可拖宽度的纯逻辑。浏览器层（真拖一把）在 dom.test.html，这里只钉判据。
//
// 值得单独测的是**夹逼**：上限不是常数而是「窗宽 − 版心」，写错了不会报错，只会在某个
// 宽度区间横向溢出——正是 style.css 注释里 1660–1709 那次实伤的形状，人眼复查抓不到。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RAIL_MIN, RAIL_DEFAULT, RESIZABLE_MIN_WINDOW,
  isResizable, railMax, clampRail, railCeilLending, railLend,
} from '../src/rail.js';

test('窄窗不给拖：与 style.css 的 max-width:1279 同一个界', () => {
  assert.equal(isResizable(1279), false);
  assert.equal(isResizable(RESIZABLE_MIN_WINDOW), true);
  assert.equal(isResizable(2560), true);
  // 拿不到窗宽时按不可拖处理，宁可少个功能也不要把响应式规则废掉
  assert.equal(isResizable(undefined), false);
  assert.equal(isResizable(NaN), false);
});

test('上限＝窗宽 − 版心盒，复算 style.css 手算的两个断点', () => {
  // 默认档（≥1940）：stage = chap 200+34 + 正文摞 1040 + 大纲槽 294 = 1568，work-pad 36
  // style.css 注释：300 + 36×2 + 1568 = 1940 —— 即 1940 窗宽下最大恰好是默认的 300
  assert.equal(railMax(1940, 1568 + 36 * 2), 300);
  // 四栏档（≥1710）：stage = 1040 + 294 = 1334
  // 注释：300 + 72 + 1334 = 1706，所以 1706 窗宽下最大恰好 300
  assert.equal(railMax(1706, 1334 + 36 * 2), 300);
  // 笔记本档（1280–1709，<1500 无大纲槽）：stage = 962，work-pad 26
  // 注释：240 + 26×2 + 962 = 1254 —— 1254 窗宽下最大恰好是那一档的 240
  assert.equal(railMax(1254, 962 + 26 * 2), 240);
  // 宽屏才真有富余：2560 的屏上能给到 920
  assert.equal(railMax(2560, 1568 + 36 * 2), 920);
});

test('夹逼：拖不出版心能容忍的范围', () => {
  const max = railMax(2560, 1568 + 72);   // 920
  assert.equal(clampRail(500, max), 500);
  assert.equal(clampRail(9999, max), 920, '拖到极限就停住，不许再宽');
  assert.equal(clampRail(10, max), RAIL_MIN, '也不许窄到清单读不了');
});

test('窗口放不下版心时退回 RAIL_MIN，绝不返回负数', () => {
  // 1300 的窗口配默认档几何：1300 − 1640 = −340
  const max = railMax(1300, 1568 + 72);
  assert.ok(max < 0);
  assert.equal(clampRail(300, max), RAIL_MIN);
  assert.equal(clampRail(9999, max), RAIL_MIN);
});

test('空值不许被当成 0 宽（Number(null)===0 那个坑）', () => {
  const max = 920;
  assert.equal(clampRail(null, max), null);
  assert.equal(clampRail('', max), null);
  assert.equal(clampRail('   ', max), null);
  assert.equal(clampRail(undefined, max), null);
  assert.equal(clampRail('abc', max), null);
  assert.equal(clampRail(NaN, max), null);
  // 但真数字串要认——存量值是以字符串回来的
  assert.equal(clampRail('420', max), 420);
});

test('返回整数像素', () => {
  assert.equal(clampRail(387.6, 920), 388);
  assert.equal(Number.isInteger(clampRail(300.4, 920)), true);
});

// 2026-10-11 回归：「左边栏浏览器里不能拉」。断点刚过时版心塞满整窗，railMax ≈ 当前宽度。
test('断点刚过时：不借宽就几乎拉不动（复现原 bug 的形状）', () => {
  // 1280 窗宽、笔记本档、<1500 无大纲槽：版心盒 962 + 26×2 = 1014，实测线上上限 266
  assert.equal(railMax(1280, 1014), 266);
  // 1500 窗宽：大纲槽 26+200 加进来，版心盒 1240，上限 260——比 1499 时的 485 还小
  assert.equal(railMax(1500, 1240), 260);
});

test('版心让位：上限把正文与大纲能让出的都算进来', () => {
  const opts = { art: 620, artMin: 480, toc: 200, tocMin: 200 };
  // 1280：266 + 正文让 140 = 406
  assert.equal(railCeilLending(railMax(1280, 1014), opts), 406);
  // 1500：260 + 140（大纲已在 min，借不到）
  assert.equal(railCeilLending(railMax(1500, 1240), opts), 400);
  // 量不到 / 不显示的栏不借
  assert.equal(railCeilLending(300, { art: null, artMin: 480, toc: 0, tocMin: 200 }), 300);
  assert.equal(railCeilLending(300), 300);
});

test('借宽：先吃空隙，再借正文，正文到底再借大纲；借多少版心窄多少', () => {
  const opts = { art: 680, artMin: 480, toc: 260, tocMin: 200 };
  const free = 300;
  assert.deepEqual(railLend(280, free, opts), { art: null, toc: null }, '空隙内不动邻栏');
  assert.deepEqual(railLend(300, free, opts), { art: null, toc: null });
  assert.deepEqual(railLend(450, free, opts), { art: 530, toc: null });
  assert.deepEqual(railLend(520, free, opts), { art: 480, toc: 240 });
  assert.deepEqual(railLend(9999, free, opts), { art: 480, toc: 200 }, '两栏都到 min 就停');
  // 守住 rail.js 头注释的式子：左栏增量 == 版心减量（在上限内）
  for (const want of [320, 400, 500, 560]) {
    const lent = railLend(want, free, opts);
    const shrink = (opts.art - (lent.art ?? opts.art)) + (opts.toc - (lent.toc ?? opts.toc));
    assert.equal(want - free, shrink, `want=${want}`);
  }
});

test('默认值就是 style.css :root 里那个 300', () => {
  assert.equal(RAIL_DEFAULT, 300);
  assert.equal(RAIL_MIN, 240, '与笔记本档 --rail-w 同值：那是设计自己认的下限');
});
