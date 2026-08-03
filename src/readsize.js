// 正文字号（2026-08-03 反馈：「字体能不能大一号？或者找个地方让我们自己设置」）。
//
// **纯逻辑，只管「第几档」**：怎么放大全交给 CSS 的 --read-scale，这里一个像素值都不算。
// 好处是档位数与倍率将来只在这一个数组里改，样式端不用跟着动；坏处是没有任意值，
// 这是故意的——阅读器要的是「大一号」，不是一个能拖出 17.3px 的滑杆。
//
// 存的是**索引不是倍率**：倍率改了（比如把 1.15 调成 1.2），老用户的存量值仍落在同一档，
// 不会因为存的数字对不上任何一档而被静默重置回默认。
//
// 隐私/无痕模式下 localStorage 直接抛 DOMException，而 getReadStep 被 useState 初值
// 同步调用——不兜住就是整站白屏（lang.js 踩过同一个坑，这里照抄它的兜法）。

export const READ_STEPS = [0.9, 1, 1.15, 1.3, 1.5];
export const DEFAULT_STEP = 1;   // READ_STEPS[1] === 1，即现行字号

const KEY = 'zhupi.readScale';

// ⚠️ 不能图省事写 Number(i)：Number(null) 和 Number('') 都是 0，于是空值会被当成
// 「第 0 档」——正文静默变小，还不报错。只认真数字与非空数字串，其余一律退回默认档。
export const clampStep = (i) => {
  const n = typeof i === 'number' ? i
    : (typeof i === 'string' && i.trim() !== '' ? Number(i) : NaN);
  if (!Number.isFinite(n)) return DEFAULT_STEP;
  return Math.min(READ_STEPS.length - 1, Math.max(0, Math.round(n)));
};

export const scaleOf = (i) => READ_STEPS[clampStep(i)];

/** 档位对应的百分比，只用于给人看的提示文案（100% = 现行字号）。 */
export const percentOf = (i) => Math.round(scaleOf(i) * 100);

export const getReadStep = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null ? DEFAULT_STEP : clampStep(raw);
  } catch { return DEFAULT_STEP; }
};

export const setReadStep = (i) => {
  try { localStorage.setItem(KEY, String(clampStep(i))); } catch { /* 存不下就只在本次会话生效 */ }
};
