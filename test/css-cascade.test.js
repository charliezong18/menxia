// CSS 层叠顺序守卫：**响应式互斥的元素，display 开关不能被后写的基础规则压死。**
//
// 由来（2026-08-09 实测）：`.chapter-rail` 的显示写在文件顶部第 47 行的
// `@media (min-width:1940px)` 里（`display:flex`），而它的基础规则在 800 行之后
// 又写了一次 `display:none`。两条选择器同为 `.chapter-rail`，特异度都是 (0,1,0)，
// **媒体查询不增加特异度** —— 于是后写的 `none` 赢，章栏从来没显示过一次。
// 更糟的是同一个 @media 里还把兜底的 `.chapters` 关掉了，所以 ≥1940px 的窗口
// 两个入口一起消失：一本 22 章的书打开只看得见一篇，而 DOM 里两个节点都在。
//
// 这类 bug 没有报错、不进控制台、只在某个宽度区间现形，靠人眼复查基本抓不到。
// 判据写成可执行的：**对每个受管选择器，所有「裸规则」里的 display 声明
// 必须排在所有「媒体查询里」的 display 声明之前**，否则媒体查询根本不起作用。
//
// 读 CSS 文本而不是跑浏览器：这条判据是纯静态的层叠顺序问题，不需要渲染。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CSS = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'style.css'),
  'utf8',
);

// 受管选择器：靠断点二选一显示的那些。加新的互斥版式时往这儿添一行。
const WATCHED = ['.chapter-rail', '.chapters'];

/**
 * 把 CSS 扫成规则列表：{ selector, inMedia, index, hasDisplay }。
 * 只需要够用的粒度——认 `{`/`}` 配对与 `@media` 嵌套，不做完整 CSS 解析。
 */
function parseRules(css) {
  // 注释里常写 display，必须先剥。**用等长空白替换而不是删掉**：删了索引就整体前移，
  // 报错行号会指到不相干的地方（实测原版 bug 会报成第 681 行，真身在第 867 行）。
  const src = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const rules = [];
  const stack = [];
  let buf = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '{') {
      const prelude = buf.trim();
      buf = '';
      if (prelude.startsWith('@media')) { stack.push('media'); i += 1; continue; }
      if (prelude.startsWith('@')) { stack.push('at'); i += 1; continue; }
      let depth = 1;
      let j = i + 1;
      while (j < src.length && depth > 0) {
        if (src[j] === '{') depth += 1;
        else if (src[j] === '}') depth -= 1;
        j += 1;
      }
      rules.push({
        selector: prelude,
        inMedia: stack.includes('media'),
        index: i,
        hasDisplay: /(^|[;{\s])display\s*:/.test(src.slice(i + 1, j - 1)),
      });
      i = j;
      continue;
    }
    if (c === '}') { stack.pop(); buf = ''; i += 1; continue; }
    buf += c;
    i += 1;
  }
  return rules;
}

const RULES = parseRules(CSS);

// 选择器整体相等才算（`.chapters` 不该匹配到 `.chapters-summary`）
const declaringDisplay = (sel) => RULES.filter(
  (r) => r.hasDisplay && r.selector.split(',').map((s) => s.trim()).includes(sel),
);

for (const sel of WATCHED) {
  test(`层叠守卫：${sel} 的媒体查询 display 不被裸规则覆盖`, () => {
    const hits = declaringDisplay(sel);
    assert.ok(hits.length > 0, `${sel} 一条 display 都没有——受管清单过期了？`);

    const bare = hits.filter((r) => !r.inMedia);
    const inMedia = hits.filter((r) => r.inMedia);
    if (!bare.length || !inMedia.length) return;   // 只有一种，无从覆盖

    const lastBare = Math.max(...bare.map((r) => r.index));
    const firstMedia = Math.min(...inMedia.map((r) => r.index));
    const lineOf = (idx) => CSS.slice(0, idx).split('\n').length;

    assert.ok(
      lastBare < firstMedia,
      `${sel}: 裸规则的 display（第 ${lineOf(lastBare)} 行）写在媒体查询的 display`
      + `（第 ${lineOf(firstMedia)} 行）之后。同特异度后来居上，媒体查询会失效——`
      + `把 display 开关挪到组件规则之后（见 style.css 里「章栏/章下拉 二选一」那段）。`,
    );
  });
}

// 二选一的两条断点必须真互补，否则会留出「两个都不显示」的宽度死区 ——
// 原病正是 ≥1940 时 .chapter-rail 被压死、.chapters 又被关掉。
test('章栏与章下拉的断点互补，不留死区', () => {
  const rail = /@media\s*\(max-width:\s*1939\.98px\)\s*\{\s*\.chapter-rail\s*\{\s*display:\s*none/;
  const drop = /@media\s*\(min-width:\s*1940px\)\s*\{\s*\.chapters\s*\{\s*display:\s*none/;
  assert.match(CSS, rail, '缺「<1940 关掉章栏」——宽度低于断点时会两个一起出现');
  assert.match(CSS, drop, '缺「≥1940 关掉章下拉」——宽度高于断点时会两个一起出现');
});
