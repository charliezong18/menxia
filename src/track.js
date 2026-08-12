// 折务追踪的**读侧**（词表由 review #61 批定 2026-07-31，写侧在 menxia-mcp/src/track.ts）：
// 从折上已有的 labels 与 body 解析出项目归属、等谁、主题签、折间关系，供总览、清单分组与
// 弘文馆分流用。
//
// **零新增请求**：`labels` 与 `body` 本来就在 `listOpenPRs` / `listMergedPRs` 的响应里
// （此前一直被扔掉）。这一层是纯函数，不碰 fetch、不碰 DOM。
//
// ── 与写入侧的契约 ──
// 词表由 `menxia-mcp/src/track.ts` 单点定义。**这边只认前缀，不认取值全集**——
// 改名的教训（review #54）：跨系统契约是裸字符串，两头都写死一份取值表，
// 写入侧加一个新 kind、这边就静默把那折漏掉，而且不报错。
// 所以：认不出的取值一律**照常显示、排到已知值后面**，绝不丢弃。
// 下面几张已知表只用来定**顺序与颜色**，不用来判「算不算数」；唯一自觉的例外是弘文馆
// 分流那三个字符串（见 isShelved），分组总得有个判据。

export const PROJ_PREFIX = 'proj:';
export const KIND_PREFIX = 'kind:';
export const WAIT_PREFIX = 'wait:';
// 签：按主题归堆，**跨状态**（在读的与已画可的同架）。前缀是协议常量，逐字对齐写侧
// menxia-mcp/src/track.ts，改一头必静默失效。取值全集不硬编码——签集以仓里实际出现的
// `签:*` label 为准（见 sidebar 的动态并集），初始那七个词（旅行/开发/身份/工作/健康/钱/文史）
// 只是写侧的种子，读侧一个都不写死。
export const QIAN_PREFIX = '签:';

/** 只定顺序：等你拍最急，闲最不急。表外的值排在最后，但照样显示。 */
const WAIT_ORDER = ['你拍', '你读', 'agent', '闲'];
/** 只定配色的 class 后缀（css 里 `.wait-you-decide` 等）。表外的落 `.wait-other`。 */
const WAIT_CLASS = { 你拍: 'you-decide', 你读: 'you-read', agent: 'agent', 闲: 'idle' };

const valuesWithPrefix = (pr, prefix) =>
  (pr?.labels || [])
    .map((l) => (typeof l === 'string' ? l : l?.name))
    .filter((n) => typeof n === 'string' && n.startsWith(prefix))
    .map((n) => n.slice(prefix.length));

/** 项目。多项目折按第一个分组（写入侧约定：第一个是主项目）。没有就是「未标注」。 */
export const projsOf = (pr) => valuesWithPrefix(pr, PROJ_PREFIX);

/** 主用途（拍板/评审/设计/读物/交付/参考）。没标返回 null——老折全是这种，不是错误。 */
export const kindOf = (pr) => valuesWithPrefix(pr, KIND_PREFIX)[0] || null;

/** 等谁（你拍/你读/agent/闲）。没标返回 null。 */
export const waitOf = (pr) => valuesWithPrefix(pr, WAIT_PREFIX)[0] || null;

/** 主题签（一折可多签）。没标返回空数组。 */
export const qianOf = (pr) => valuesWithPrefix(pr, QIAN_PREFIX);

export const waitRank = (w) => {
  const i = WAIT_ORDER.indexOf(w);
  return i < 0 ? WAIT_ORDER.length : i;      // 认不出的排最后，但**不丢**
};
export const waitClass = (w) => (w ? `wait-${WAIT_CLASS[w] || 'other'}` : '');

/**
 * 弘文馆的判据：**`kind:读物`，但等你的不藏**（review #69 批定 2026-08-05）。
 *
 * 呈折时提的推荐是 `wait:闲`，他选了 `kind:读物`——书架是按「这是什么」分的，
 * 不是按「等谁」。当时 20 折里两个判据 100% 重合，换过来零行为差异。
 *
 * 加 `NEEDS_YOU` 这道阀是因为 kind 单独用有个静默失效面：#7「读物：两份待发的
 * 对外草稿（发出去代表你，先过目）」这种折——kind 是读物，却卡着你签字才能发出去。
 * 纯按 kind 分，它会进书架再没人想起来。**宁可多催，不可静默隐藏**，所以
 * `wait:你拍` / `wait:你读` 一律留在待审，不管 kind 是什么。
 *
 * 这里硬编码取值（与文件顶上「只认前缀」的规矩相反）是自觉的例外：分组总得有个判据。
 * 写侧词表在 menxia-mcp/src/track.ts，改那边的取值要回来同步这三个字符串。
 */
export const READING = '读物';
const NEEDS_YOU = new Set(['你拍', '你读']);

export const isShelved = (pr) => kindOf(pr) === READING && !NEEDS_YOU.has(waitOf(pr));

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

// ── 关系标记 `<!-- menxia-rel: needs=#49; supersedes=#48,#50; unblocks=… -->` ──
// 形状照抄写入侧 `menxia-mcp/src/track.ts` 的 REL_MARKER_RE，与 `happy-session` 同族。
const REL_RE = /<!--\s*menxia-rel:\s*([^>]*?)\s*-->/i;

/**
 * 解析要**宽容**：这行会被人手写、会被从旧折模板复制。认不出的键跳过，
 * 整行认不出就返回空集——总览的职责是把存量说清楚，不是拒收存量。
 */
export function parseRel(body) {
  const out = { needs: [], supersedes: [], unblocks: null };
  const m = REL_RE.exec(String(body ?? ''));
  if (!m) return out;
  for (const part of (m[1] || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key === 'needs' || key === 'supersedes') {
      out[key] = [...new Set([...val.matchAll(/\d+/g)].map((x) => Number(x[0])))];
    } else if (key === 'unblocks' && val) {
      out.unblocks = val;
    }
  }
  return out;
}

/**
 * 全局关系分析。**这是他那两个问题的正面答案**：
 *   「这个 block 哪个」    → blockedBy（还在等哪折先定）/ unblocks（画可后解锁什么）
 *   「有没有被后来的盖了」 → coveredBy（已画可折声明盖掉它 = 僵尸折，不用读了）
 *
 * 入参是**已经在手的**两份清单，不发任何请求。
 * 返回 `Map(折号 → { blockedBy, unlocked, coveredBy, willCover, covers, unblocks })`。
 */
export function analyze(openPrs, mergedPrs) {
  const rel = new Map();
  const openNums = new Set(openPrs.map((p) => p.number));
  const mergedNums = new Set(mergedPrs.map((p) => p.number));
  const noteOf = (n) => {
    if (!rel.has(n)) rel.set(n, { blockedBy: [], unlocked: [], coveredBy: [], willCover: [], covers: [], unblocks: null });
    return rel.get(n);
  };

  // 已画可折声明盖掉的、却还开着 —— 僵尸折。#58 就是这么被埋了一整天的。
  for (const m of mergedPrs) {
    for (const t of parseRel(m.body).supersedes) {
      if (openNums.has(t)) noteOf(t).coveredBy.push(m.number);
    }
  }

  for (const p of openPrs) {
    const r = parseRel(p.body);
    const me = noteOf(p.number);
    me.unblocks = r.unblocks;
    for (const dep of r.needs) {
      if (mergedNums.has(dep)) me.unlocked.push(dep);       // 依赖已画可 → 可动手
      else if (openNums.has(dep)) me.blockedBy.push(dep);   // 依赖还开着 → 它先定
    }
    for (const t of r.supersedes) {
      me.covers.push(t);
      if (openNums.has(t)) noteOf(t).willCover.push(p.number);
    }
  }
  return rel;
}

/** 僵尸 = 已被画可折盖掉。单独拎出来：这类折**不用读**，是清单里最该先摘掉的噪音。 */
export const isZombie = (note) => Boolean(note && note.coveredBy.length);

/**
 * 按项目分组，组内按「等谁」的急迫度排，同级按折号倒序（新的在前）。
 * 未标注 `proj:` 的折落进一个尾部分组——**不隐藏**，否则漏标一次就等于把折藏了。
 */
export function groupByProject(prs, { unlabeled = '未标注' } = {}) {
  const groups = new Map();
  for (const pr of prs) {
    const key = projsOf(pr)[0] || unlabeled;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(pr);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => waitRank(waitOf(a)) - waitRank(waitOf(b)) || b.number - a.number);
  }
  // 组间也按「最急的那折有多急」排；未标注组恒在最后（它是待办不是项目）。
  return [...groups.entries()]
    .map(([proj, list]) => ({ proj, list }))
    .sort((a, b) => {
      if (a.proj === unlabeled) return 1;
      if (b.proj === unlabeled) return -1;
      return waitRank(waitOf(a.list[0])) - waitRank(waitOf(b.list[0])) || a.proj.localeCompare(b.proj);
    });
}

/** 全局「等谁」计数，顺序同 WAIT_ORDER；认不出的取值也各占一格排在后面。 */
export function waitTally(prs) {
  const counts = new Map();
  for (const pr of prs) {
    const w = waitOf(pr);
    if (!w) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([wait, n]) => ({ wait, n }))
    .sort((a, b) => waitRank(a.wait) - waitRank(b.wait));
}
