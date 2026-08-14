// 门下 SW 注册 —— 从 ui.js 启动时调一次。
//
// 职责：装 sw.js；开机先探 kill-switch，拨了就**不装**并把已装的拆掉（壳侧那一半闸）。
// 注册路径用相对 './sw.js'，scope 自然是站点部署目录（/menxia/），不写死。
//
// 与红线的关系：SW 本体是 network-first，这里再加一道壳侧总闸——即便 SW 逻辑将来出 bug 把站钉死，
// 只要在 Pages 上把 menxia-sw-kill.json 的 kill 拨成 true，下一次任何人打开页面时这段就把 SW 拆了。

import { KILL_SWITCH_URL } from './sw-register-const.js';

/** 读 kill-switch。拉不到（含离线）当没拨——绝不因为一次网络抖动就自毁离线能力。 */
async function killSwitchOn() {
  try {
    const res = await fetch(KILL_SWITCH_URL, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    return data && data.kill === true;
  } catch { return false; }
}

/** 拆掉所有已注册的 SW + 清壳缓存。kill-switch 命中或需要硬复位时用。 */
export async function unregisterAll() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    if (typeof caches !== 'undefined') {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('menxia-shell-')).map((n) => caches.delete(n)));
    }
  } catch { /* 拆不动就算了，下次再来 */ }
}

/**
 * 注册入口。返回 registration 或 null。
 * 步骤：① 不支持 SW（老浏览器/非安全上下文）→ 直接返回，一切照旧网络请求；
 *      ② kill-switch 拨了 → unregisterAll 并返回 null（站退回裸状态）；
 *      ③ 否则 register('./sw.js')。失败只 warn，不打断 app。
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  if (await killSwitchOn()) { await unregisterAll(); return null; }
  try {
    // 模块 worker：sw.js 用 export 暴露纯策略函数给 test/sw.test.js 单测——classic worker 里 export
    // 会「script evaluation failed」（2026-08-13 在线实测栽过），必须 type:'module'。
    // 模块 SW：Chrome 91+ / Safari 16.4+（含现代 WKWebView，iOS 壳指向线上站即可用）。
    return await navigator.serviceWorker.register('./sw.js', { type: 'module' });
  } catch (err) {
    console.warn('[menxia] SW 注册失败（不影响在线使用）：', err && err.message);
    return null;
  }
}
