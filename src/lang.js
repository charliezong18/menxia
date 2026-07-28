// F8 语言切页（纯逻辑）——沿用 GitHub README 的多语言惯例：
//   docs/foo.md（英文/默认） ↔ docs/foo.zh-CN.md（中文）
// 检测只认「同 basename + .zh-CN 后缀」这一条规则，不去猜正文语言（猜必误判）。
// 拆分留在内容侧（agent 写文档时就写两份互链文件），朱批只做视图切换。

const ZH_SUFFIX = /\.zh-CN\.md$/i;

// 'docs/a.zh-CN.md' → { base: 'docs/a.md', lang: 'zh' }
export function variantOf(path) {
  const p = String(path || '');
  if (!p.endsWith('.md')) return null;
  return ZH_SUFFIX.test(p)
    ? { base: p.replace(ZH_SUFFIX, '.md'), lang: 'zh' }
    : { base: p, lang: 'en' };
}

// 文件名数组 → Map(base → { en?, zh? })；只含真成对的（单份文档不进来）
export function langPairs(paths) {
  const groups = new Map();
  (paths || []).forEach((p) => {
    const v = variantOf(p);
    if (!v) return;
    const g = groups.get(v.base) || {};
    g[v.lang] = p;
    groups.set(v.base, g);
  });
  const pairs = new Map();
  groups.forEach((g, base) => { if (g.en && g.zh) pairs.set(base, g); });
  return pairs;
}

// 当前文档在另一语言的对应文件（没有配对则 null）
export function siblingFor(path, paths) {
  const v = variantOf(path);
  if (!v) return null;
  const g = langPairs(paths).get(v.base);
  if (!g) return null;
  return v.lang === 'zh' ? g.en : g.zh;
}

// 清单里该显示哪些文档：成对的只出一个（按偏好语言，缺则退到另一版），单份原样保留。
// 否则 tab 栏会同时列出中英两份，等于把噪音搬到了另一个地方。
export function visibleDocs(paths, lang = 'zh') {
  const pairs = langPairs(paths);
  const covered = new Set();
  pairs.forEach((g) => { covered.add(g.en); covered.add(g.zh); });
  const out = [];
  const seenBase = new Set();
  (paths || []).forEach((p) => {
    if (!covered.has(p)) { out.push(p); return; }
    const base = variantOf(p).base;
    if (seenBase.has(base)) return;
    seenBase.add(base);
    const g = pairs.get(base);
    out.push((lang === 'en' ? g.en : g.zh) || g.en || g.zh);
  });
  return out;
}

const LANG_KEY = 'zhupi.lang';
export const getLang = () => (localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'zh'); // 默认中文
export const setLang = (l) => localStorage.setItem(LANG_KEY, l === 'en' ? 'en' : 'zh');
