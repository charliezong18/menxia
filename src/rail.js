// 左栏宽度（可拖）。2026-08-26 Charlie：「左边那个目录栏能不能弄成可以拖拉的？
// 有时候我希望左边的目录栏能调得大一点」。
//
// 与 readsize.js 同一层：纯逻辑落这儿，怎么变宽全交给 CSS 变量 `--rail-w`，这里一个
// 像素值都不往样式里写。但和字号**不同的是这里是无级的**——readsize 的注释立过
// 「阅读器要的是『大一号』，不是一个能拖出 17.3px 的滑杆」，那条判据对字号成立
// （字号有天然档位，行宽是排版结果），对侧栏不成立：侧栏要的是「刚好放得下最长的
// 那个折名」，而那取决于他这一阵在读什么，没有能预先定死的档。
//
// ── 上限为什么不是常数 ──
//
// style.css 的版心是居中的：
//
//     .work { padding-inline: max(var(--work-pad), calc((100% - var(--stage)) / 2)) }
//
// 而 `.work` 的 100% 就是「窗宽 − 左栏宽」。padding 一旦被 max() 夹到 `--work-pad`，
// 版心就再也放不下、开始横向溢出（style.css 记过 1660–1709 那次实伤）。所以硬上限是
//
//     railW ≤ 窗宽 − stage − 2 × work-pad
//
// 正是 style.css 里手算 1709 与 1940 两个断点用的**同一条式子**。
//
// **JS 绝不复制那套算术。** stage 与 work-pad 由调用方从 CSS 实测后传进来（ui.js 拿一个
// 宽度写成 `calc(var(--stage) + var(--work-pad) * 2)` 的探针元素量 offsetWidth）。于是
// style.css 那句「改任一栏宽都要重算」只对 CSS 成立，改版式时这个文件一行都不用跟着动。

export const RAIL_MIN = 240;
export const RAIL_DEFAULT = 300;

// 与 style.css 的 `@media (max-width: 1279px)` 同一个界。那一档 CSS 自己要把 `--rail-w`
// 压到 240 走单列版式，而用户拖出来的值是写在 #app 行内的、特异度压过 :root 的媒体查询
// —— 窄窗还认存量宽度就等于把响应式规则废掉。所以窄窗一律不给拖，也不施加存量值。
export const RESIZABLE_MIN_WINDOW = 1280;

const KEY = 'zhupi.railWidth';

export const isResizable = (windowWidth) =>
  Number.isFinite(windowWidth) && windowWidth >= RESIZABLE_MIN_WINDOW;

/**
 * 版心（含左右最小留白）占掉之后还剩多少能给左栏。
 * `stageBox` = `--stage` + 2×`--work-pad`，由调用方实测，见文件头。
 */
export const railMax = (windowWidth, stageBox) => {
  if (!Number.isFinite(windowWidth) || !Number.isFinite(stageBox)) return RAIL_DEFAULT;
  return windowWidth - stageBox;
};

/**
 * 夹到 `[RAIL_MIN, max]`。
 *
 * ⚠️ 不能图省事写 `Number(want)`：`Number(null)` 与 `Number('')` 都是 0，于是空值会被
 * 当成「0 像素宽」——侧栏静默塌成一条缝，还不报错（readsize.js 踩过同一个坑）。
 * 只认真数字与非空数字串，其余一律返回 null 交给调用方退回 CSS 默认。
 *
 * `max` 比 `RAIL_MIN` 还小（窗口本来就放不下版心）时取 `RAIL_MIN`，绝不返回负数——
 * 那种窗口下版式已经在溢出了，再把侧栏压成 0 只会让清单也读不了。
 */
export const clampRail = (want, max) => {
  const n = typeof want === 'number' ? want
    : (typeof want === 'string' && want.trim() !== '' ? Number(want) : NaN);
  if (!Number.isFinite(n)) return null;
  const hi = Math.max(RAIL_MIN, Number.isFinite(max) ? max : RAIL_MIN);
  return Math.round(Math.min(Math.max(n, RAIL_MIN), hi));
};

// 隐私/无痕模式下 localStorage 直接抛 DOMException，而 getRailWidth 被 useState 初值
// 同步调用——不兜住就是整站白屏（lang.js / readsize.js 踩过同一个坑，这里照抄兜法）。

/** 从没拖过、或存量值坏了，一律返回 null＝「别管我，用 CSS 默认」。 */
export const getRailWidth = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    const n = raw.trim() === '' ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
};

export const setRailWidth = (px) => {
  try { localStorage.setItem(KEY, String(Math.round(px))); } catch { /* 存不下就只在本次会话生效 */ }
};

/** 双击手柄归位：删掉存量值，回到 CSS 的响应式默认（宽窗 300 / 笔记本档 240）。 */
export const clearRailWidth = () => {
  try { localStorage.removeItem(KEY); } catch { /* 同上 */ }
};
