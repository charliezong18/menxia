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
export function slugify(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    // 回调而不是字符类取反：`\p{P}` 里含 `-`(Pd) 与 `_`(Pc)，而 GitHub 恰好保留这两个
    .replace(/[\p{P}\p{S}]/gu, (ch) => (ch === '-' || ch === '_' ? ch : ''))
    // 只换半角空格（GitHub 就是 `/ /g`）。`a  b` 因此得到 `a--b`，不折叠——折叠就和 GitHub 分家了
    .replace(/ /g, '-');
}

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

// 链接里的 `#片段` → 本篇的哪个标题。三级放宽，越往下越宽：
//   ① id 逐字相等          —— 链接照 GitHub 锚写的，正常路径
//   ② 把片段当标题文字再 slug 一遍 —— 写成 `#〈Highline 日模块〉` 或 `#Highline 日模块` 时命中
//   ③ 抹掉连字符与下划线再比 —— 两边空格/连字符口径有出入时的最后兜底
// headings：`[{ id, text, ... }]`，原样返回命中的那一项（调用方自己往里塞 DOM 元素）。
// 找不到返回 null——调用方必须**出声**，长折里静默失效＝读者以为链接坏了却无从判断。
export function matchAnchor(headings, frag) {
  const list = headings || [];
  const raw = String(frag ?? '').trim();
  if (!raw) return null;

  const exact = list.find((h) => h.id === raw);
  if (exact) return exact;

  const slug = slugify(raw);
  const bySlug = slug && list.find((h) => h.id === slug);
  if (bySlug) return bySlug;

  const bare = (s) => slugify(s).replace(/[-_]/g, '');
  const want = bare(raw);
  return want ? list.find((h) => bare(h.text) === want) || null : null;
}
