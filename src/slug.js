// 页内锚点的 slug（纯逻辑）——口径对齐 GitHub，不发明私有语法。
//
// 为什么必须对齐：敕草在门下和在 GitHub 上是同一份 markdown。agent 写
// `[〈Highline 日模块〉](#highline-日模块)` 时脑子里是 GitHub 的标题锚；两边算法一分家，
// 同一条链接就会「在一处能跳、在另一处什么也不发生」——而**静默**正是这类链接最坏的失败形态。
//
// 照抄 github-slugger 的语义（不照抄它那张巨大的字符表）：
//   小写 → 去标点与符号（`-` `_` 除外）→ 空格换 `-` → 同名追加 `-1`/`-2`
// 用 Unicode 属性类 `\p{P}\p{S}` 覆盖那张表：CJK 的 〈〉「」，。（）、 都在 `\p{P}` 里，
// emoji 在 `\p{S}` 里，取舍与 github-slugger 一致。
// **不 trim**（2026-08-06 拿 github-slugger@2 实测：带 trim 15 例差 4，去掉后差 0）。
// github-slugger 压根没有这一步，首尾空格会照直变成连字符——`## 🚀 起步` 的锚是 `-起步`
// 不是 `起步`，这是 GitHub 上带 emoji 标题的著名形态。图片独占开头的
// `## ![封面](a.png) 介绍` 同理得 `-介绍`。自作主张 trim 一下看着「更干净」，
// 代价是这两类标题的锚全部对不上——而它们恰恰是最常见的两类。
export function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    // 先清不可见字符：控制字符（含 TAB）、格式字符（ZWJ / ZWSP / 软连字符）、
    // 以及除半角空格外的所有空白（NBSP、U+3000）。**这一步不是为了对齐 GitHub，是为了 id 合法**：
    // HTML 的 id 不得含 ASCII 空白，而 `## a<TAB>b` 会直接产出 `id="a	b"`；
    // NBSP/ZWSP 更阴——生成的 id 与正常 id 长得一模一样，任何人手写的片段永远命不中。
    // 顺带也就跟 github-slugger 对上了（它同样把这些整类删掉）。
    .replace(/[\p{C}\p{Z}]/gu, (ch) => (ch === ' ' ? ' ' : ''))
    // 回调而不是字符类取反：`\p{P}` 里含 `-`(Pd) 与 `_`(Pc)，而 GitHub 恰好保留这两个
    .replace(/[\p{P}\p{S}]/gu, (ch) => (ch === '-' || ch === '_' ? ch : ''))
    // 只换半角空格（GitHub 就是 `/ /g`）。`a  b` 因此得到 `a--b`，不折叠——折叠就和 GitHub 分家了
    .replace(/ /g, '-');
}
// ⚠️ **已知残余分歧**（2026-08-06 拿 github-slugger@2 差分 69 例，修掉不可见字符后仍差这几类）：
// `½ 杯` → 我们 `½-杯` / 它 `-杯`；`x²` → `x²` / `x`（No 类数字它删我们留）；
// `a＿b`（全角下划线 Pc）与 `a﹏b` → 我们删它留；`ⓐ circled` → 我们删它留。
// 都是「锚点对不上 → matchAnchor 三级兜底 → 不中就出 notice」，是**出声**的失败，不是静默错跳，
// 故按已知偏差记档而不追平。真要逐字对齐只有一条路：vendor github-slugger 那张生成的字符表。

// 一次渲染之内的去重器。重名标题必须给出不同 id，否则第二个标题的锚永远跳到第一个。
// while 而不是「计数器直接拼」：文档里真写了一个字面叫 `foo-1` 的标题时，
// 单纯 `foo` + 计数会撞上它，再产出一个重复 id。
export function makeSlugger() {
  const used = new Set();
  const counts = new Map();
  return (text) => {
    const base = slugify(text);
    if (!base) return '';
    let n = counts.get(base) || 0;
    let out = base;
    while (used.has(out)) { n += 1; out = `${base}-${n}`; }
    counts.set(base, n);
    used.add(out);
    return out;
  };
}

// 链接里的 `#片段` → 本篇的哪个标题。四级放宽，越往下越宽：
//   ① id 逐字相等          —— 链接照 GitHub 锚写的，正常路径
//   ② 标题原文逐字相等      —— 写成 `#无票日·选项` 这种「照标题抄」的
//   ③ 把片段当标题文字再 slug 一遍 —— 写成 `#〈Highline 日模块〉` 时命中
//   ④ 抹掉连字符与下划线再比 —— 两边空格/连字符口径有出入时的最后兜底
//
// **②必须排在③前面**（2026-08-06 双查抓到的静默错跳）：文档里同时有「无票日选项」和
// 「无票日·选项」时，后者的 id 被去重成 `无票日选项-1`；片段写 `#无票日·选项` 与它**逐字相同**，
// 意图毫无歧义，可③会先把片段 slug 成 `无票日选项` 命中**第一个**标题。跳到错的标题比跳不动更糟：
// 读者不会发现。逐字相等是最强证据，就该压在所有「抹掉信息再比」的规则之上。
//
// headings：`[{ id, text, ... }]`，原样返回命中的那一项（调用方自己往里塞 DOM 元素）。
// 找不到返回 null——调用方必须**出声**，长折里静默失效＝读者以为链接坏了却无从判断。
export function matchAnchor(headings, frag) {
  const list = headings || [];
  const raw = String(frag ?? '').trim();
  if (!raw) return null;

  const exact = list.find((h) => h.id === raw);
  if (exact) return exact;

  const byText = list.find((h) => String(h.text ?? '').trim() === raw);
  if (byText) return byText;

  const slug = slugify(raw);
  const bySlug = slug && list.find((h) => h.id === slug);
  if (bySlug) return bySlug;

  const bare = (s) => slugify(s).replace(/[-_]/g, '');
  const want = bare(raw);
  return want ? list.find((h) => bare(h.text) === want) || null : null;
}
