// 折务追踪的**读侧**（词表由 review #61 批定 2026-07-31，写侧在 menxia-mcp/src/track.ts）。
//
// **零新增请求**：`labels` 本来就在 `listOpenPRs` / `listMergedPRs` 的响应里，
// 这个文件只是把它读出来——不发一个字节。
//
// **只认前缀，不硬编码取值全集**（改名 #54 的教训：跨系统契约是裸字符串，
// 两头都写死枚举，改一头必静默失效）。唯一的例外是 `IDLE`——分组要有个判据，
// 见下面那条注释。
//
// ⚠️ 这是 F16 分支上同名文件的**子集**（同名同签名，故意的）：那条分支
// （`feat/f15-dashboard`，2026-07-31 建完未推）有更全的 `projsOf` / `analyze` /
// `groupByProject`。两边合流时直接取它那份超集即可，不用手工调和。

export const PROJ_PREFIX = 'proj:';
export const KIND_PREFIX = 'kind:';
export const WAIT_PREFIX = 'wait:';

const valuesWithPrefix = (pr, prefix) =>
  (pr?.labels || [])
    .map((l) => (typeof l === 'string' ? l : l?.name))
    .filter((n) => typeof n === 'string' && n.startsWith(prefix))
    .map((n) => n.slice(prefix.length));

/** 主用途（拍板/评审/设计/读物/交付/参考）。没标返回 null——老折全是这种，不是错误。 */
export const kindOf = (pr) => valuesWithPrefix(pr, KIND_PREFIX)[0] || null;

/** 等谁（你拍/你读/agent/闲）。没标返回 null。 */
export const waitOf = (pr) => valuesWithPrefix(pr, WAIT_PREFIX)[0] || null;

/**
 * 「闲」——弘文馆的判据。
 *
 * **用 wait 而不是 kind 分组**：wait 本来就是「等谁」的红绿灯，闲＝不等任何人＝书架。
 * 这样 `kind:参考` 之类以后的闲置类自动归位，也不用新造一个跨系统字符串。
 * kind 只决定卡上显示的分类名（读物 / 参考 / …）。
 */
export const IDLE = '闲';

export const isShelved = (pr) => waitOf(pr) === IDLE;

/**
 * 把清单劈成「待审」与「弘文馆」两摊。
 *
 * **没标 label 的折一律留在待审**（`waitOf` 返 null ≠ 闲）：漏标一次就把折藏进书架
 * 是这个功能唯一的危险动作——藏起来的东西没人会想起去找。宁可多催，不可静默隐藏。
 * 老折（#61 之前开的）全是没标的，所以这条同时保证了「上线当天清单不变样」。
 */
export function splitShelf(prs) {
  const desk = [], shelf = [];
  for (const pr of prs || []) (isShelved(pr) ? shelf : desk).push(pr);
  return { desk, shelf };
}
