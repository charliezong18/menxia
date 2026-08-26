// 版心内两栏的宽度（可拖）。2026-08-26 Charlie：「三栏都能拉，正文也给」。
//
// rail.js 已经把「一栏可拖」整套判据做完了——无级不分档、存的是**想要的宽度**而不是
// 夹逼后的生效值、窄窗一律不给拖、上限从 CSS 实测而不在 JS 里复制算术。这份文件不重写
// 那套东西，只把它推广到正文列与大纲栏，差别只有四个常数：min / 默认 / storage key /
// 最窄可拖窗宽。
//
// ── ⚠️ 上限的算法与 rail **不一样**，别照抄过来 ──
//
// 左栏在版心**之外**：`.work` 的 100% 就是「窗宽 − 左栏宽」，所以版心多宽、左栏就少多宽，
// 上限是「窗宽 − 版心盒」。
//
// 正文与大纲在版心**之内**（`--stage = --chap-slot + --main-w + --toc-slot`，而
// `--main-w` 里就含 `--art-w`）——撑大它们等于撑大版心本身。所以上限是
//
//     这一栏当前实宽 + 版心之外还剩的空隙
//     空隙 = 窗宽 − 左栏实宽 − 版心盒
//
// 三个数**全部实测**（左栏量 aside、版心盒量 .geom-probe、栏宽量它自己），一个都不重算。
// 这条是有来由的：style.css 的 1709 / 1940 两个断点是手算的，注释自己写着「改任一栏宽
// 都要重算」——那句话只对 CSS 成立，JS 这边一旦也抄一份，改版式就必然有一处忘了跟。
//
// 另一个后果值得写下来：几何探针的宽度是 `calc(var(--stage) + var(--work-pad) * 2)`，
// 而 `--art-w` / `--toc-w` 本来就在 `--stage` 的算式里。把它们写进 `#app` 行内之后，
// 探针量出来的值**自动**跟着变，于是「拉宽正文 → 左栏可用上限自动缩小」不需要任何联动
// 代码，rail 那边一行都不用改。

export const ART_MIN = 480;      // ≈29 中文字/行；比 style.css 笔记本档的 620 还窄一档
export const ART_DEFAULT = 680;  // 与 style.css :root 的 --art-w 同值（16.5px 下 ≈41 字/行）
export const TOC_MIN = 200;      // 与 style.css 笔记本档的 --toc-w 同值
export const TOC_DEFAULT = 260;  // 与 style.css :root 的 --toc-w 同值

// 正文：与 style.css 的 `@media (max-width: 1279px)` 同一个界。那一档正文是 `width:100%`
// 的单列，行内 `--art-w` 根本不生效，给了手柄只会让人以为坏了。
export const ART_MIN_WINDOW = 1280;
// 大纲：与 style.css 的 `@media (min-width: 1500px)` 同一个界——低于它 .toc 压根不渲染。
export const TOC_MIN_WINDOW = 1500;

export const ART_KEY = 'zhupi.artWidth';
export const TOC_KEY = 'zhupi.tocWidth';

export const isColResizable = (windowWidth, minWindow) =>
  Number.isFinite(windowWidth) && Number.isFinite(minWindow) && windowWidth >= minWindow;

/**
 * 版心之外还剩多少空隙可以拿来撑宽版心内的栏。
 * 三个入参都由调用方从 DOM 实测，见文件头。负数（窗口已经放不下）一律归 0。
 */
export const colSlack = (windowWidth, railWidth, stageBox) => {
  if (![windowWidth, railWidth, stageBox].every(Number.isFinite)) return null;
  return Math.max(0, windowWidth - railWidth - stageBox);
};

/**
 * 这一栏能拉到多宽 = 当前实宽 + 空隙。量不到当前实宽就没有可信的基准，返回 null 让调用方
 * 退回 CSS 默认——宁可没这个功能，也不要拿猜出来的上限把版心拖到横向溢出。
 */
export const colMax = (current, slack, min) => {
  if (!Number.isFinite(current) || !Number.isFinite(slack)) return null;
  return Math.max(min, current + slack);
};

/**
 * 夹到 `[min, max]`。空值判据照抄 rail.js 的 clampRail，理由也一样：
 * `Number(null)` 与 `Number('')` 都是 0，图省事写 `Number(want)` 会让空值变成「0 像素宽」
 * ——栏静默塌成一条缝，还不报错（readsize.js 与 rail.js 都踩过）。
 * 只认真数字与非空数字串，其余返回 null 交给调用方退回 CSS 默认。
 */
export const clampCol = (want, min, max) => {
  const n = typeof want === 'number' ? want
    : (typeof want === 'string' && want.trim() !== '' ? Number(want) : NaN);
  if (!Number.isFinite(n)) return null;
  const hi = Math.max(min, Number.isFinite(max) ? max : min);
  return Math.round(Math.min(Math.max(n, min), hi));
};

// 隐私/无痕模式下 localStorage 直接抛 DOMException，而这些 getter 被 useState 初值同步
// 调用——不兜住就是整站白屏（lang.js / readsize.js / rail.js 都照这个兜法）。

/** 从没拖过、或存量值坏了，一律返回 null＝「别管我，用 CSS 默认」。 */
export const getColWidth = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const n = raw.trim() === '' ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
};

export const setColWidth = (key, px) => {
  try { localStorage.setItem(key, String(Math.round(px))); } catch { /* 存不下就只在本次会话生效 */ }
};

/** 双击手柄归位：删掉存量值，回到 CSS 的响应式默认。 */
export const clearColWidth = (key) => {
  try { localStorage.removeItem(key); } catch { /* 同上 */ }
};
