// markdown 渲染 —— 块级元素带 data-line / data-line-end，M2 锚定以此为主锚
import { S } from './strings.js';
import { makeSlugger } from './slug.js';

const md = window.markdownit({ html: false, linkify: true, typographer: false });

// 打行号的规则。表格行（tr_open）与缩进代码块（code_block）实测带 map，一并覆盖：
// 少了 tr_open，批表格某一行只能锚到整表首行，而本项目文档重表格。
const LINE_RULES = [
  'paragraph_open', 'heading_open', 'list_item_open',
  'table_open', 'tr_open', 'blockquote_open', 'fence', 'code_block',
];

LINE_RULES.forEach((rule) => {
  const orig = md.renderer.rules[rule];
  md.renderer.rules[rule] = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token.map) {
      token.attrSet('data-line', String(token.map[0] + 1));
      token.attrSet('data-line-end', String(token.map[1]));
    }
    return orig ? orig(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
  };
});

// ── 标题 id —— 页内锚点 `[…](#slug)` 的落点 ────────────────────────────
// 再包一层而不是塞进 LINE_RULES：那一层管 `data-line`（**涂归**的锚，机器读），
// 这一层管 `id`（**读者**的锚，人点）。两种锚同名不同物，混在一个函数里迟早互相牵连。
//
// slugger 挂在 env 上、每次 render 现造，不用模块级变量：去重是「一次渲染之内」的账，
// 模块级会跨文档累计，读第二篇时同名标题白白变成 `-1`，链接当场失灵。
const headingOpen = md.renderer.rules.heading_open;   // 上面那层的产物，必定存在
md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
  const id = env?.slugger?.(headingText(tokens[idx + 1]));
  if (id) tokens[idx].attrSet('id', id);
  return headingOpen(tokens, idx, options, env, self);
};

// 标题文字：走 inline 的**子 token**，不用 `inline.content`（那是原始 markdown）。
// `## **粗** 标题` 两者结果相同（星号会被 slugify 当标点抹掉），但 `## [名](url)` 的
// content 连 URL 一起算进去，slug 就跟 GitHub 分家了——而 GitHub 只取可见文字。
//
// **没有「取不出就退回 content」的兜底**（2026-08-06 双查抓到）：`## ![封面](a.png)` 这种
// 图片独占的标题，children 里一个 text 都没有，兜底会把整段原始 markdown（含 URL）灌进 slug，
// 产出 `id="封面apng"`——正是上面那句注释声称要避免的事。取不出可见文字就不打 id，
// 与「纯标点标题」同路径。图片的 alt 也不计入：`<img alt>` 不贡献 textContent，
// GitHub 的锚同样不含它（`## 🚀 起步` → `-起步`）【alt 这条需核实】。
const headingText = (inline) => (inline?.children || [])
  .map((t) => {
    if (t.type === 'text' || t.type === 'code_inline') return t.content;
    return t.type === 'softbreak' || t.type === 'hardbreak' ? ' ' : '';
  })
  .join('');

// ── Obsidian 双链 `[[目标]]` / `[[目标|显示名]]` ────────────────────────────
// vault 搬进来的文档满篇都是它（「下一章 → [[01 这是个什么东西]]」），markdown-it
// 不认，于是原样渲成一段**点不动的纯文本**（2026-08-03 实测）。
// 写成 inline rule 而不是渲染前正则替换：ruler 天然不进代码块/行内代码，
// 正则做不到这点——而这些文档正文里就有讲 wikilink 语法的代码示例。
// 产物是普通 `<a href="目标.md">`，直接落进 ui.js 已有的「同折内相对链接」那条路
// （`resolveRelativeDocLink` → 折里有就换文档，没有就开 GitHub），零新增跳转逻辑。
md.inline.ruler.before('link', 'wikilink', (state, silent) => {
  const { src, pos } = state;
  if (src.charCodeAt(pos) !== 0x5B || src.charCodeAt(pos + 1) !== 0x5B) return false;
  const end = src.indexOf(']]', pos + 2);
  if (end < 0) return false;
  const inner = src.slice(pos + 2, end);
  // 内层再出现 `[` 或换行的一律不认：那多半不是双链，宁可原样渲出去也不吞掉正文
  if (!inner.trim() || /[[\n]/.test(inner)) return false;
  const bar = inner.indexOf('|');
  const target = (bar < 0 ? inner : inner.slice(0, bar)).trim();
  const label = (bar < 0 ? inner : inner.slice(bar + 1)).trim() || target;
  const hash = target.indexOf('#');
  const file = (hash < 0 ? target : target.slice(0, hash)).trim();
  const frag = hash < 0 ? '' : target.slice(hash + 1).trim();
  // `[[#]]`：既没文件也没锚。放行会渲出 `<a href="">`，点了当场重载整页——不如原样当正文
  if (!file && !frag) return false;
  if (!silent) {
    // vault 里写的是笔记名（无扩展名）；已带扩展名的按原样，别拼成 a.md.md。
    // 只给锚不给文件（`[[#某节]]`）＝**本篇内**跳转，href 只留 `#片段`——
    // 照旧拼 `.md#片段` 会指向一个叫「.md」的文件，是条生下来就死的链接。
    const href = (file ? encodeURI(/\.[a-z0-9]+$/i.test(file) ? file : `${file}.md`) : '')
      + (frag ? `#${encodeURIComponent(frag)}` : '');
    const open = state.push('link_open', 'a', 1);
    open.attrs = [['href', href], ['class', 'wikilink']];
    state.push('text', '', 0).content = label;
    state.push('link_close', 'a', -1);
  }
  state.pos = end + 2;
  return true;
});

// YAML frontmatter：vault 的文档都带，markdown-it 不认，于是 `created_by: claude …`
// 那几行会当正文渲出来，还被大纲当成一个条目（2026-08-03 截图实证）。
//
// **换成等量空行，不是删掉。** 行号是这个阅读器的命脉——涂归锚在 `data-line` 上，
// 提交时还要跟 diff 的 hunk 行号对得上；删几行会让整篇的行号集体前移，
// 于是所有批注要么锚错行要么整批 422。空行不渲染任何东西，行号纹丝不动。
export const stripFrontmatter = (text) => {
  const s = String(text ?? '');
  const m = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/.exec(s);
  if (!m) return s;
  return '\n'.repeat((m[0].match(/\n/g) || []).length) + s.slice(m[0].length);
};

// headingIds **默认关**（2026-08-06 双查抓到）：id 是全文档唯一的资源，而这个渲染器同时喂
// 正文和六个批注面（折首说明 / 判 / 其他串 / 浮窗 / 卡片，全走 comment-body.js 那一个 sink）。
// 每次 render 各配一只 slugger，跨面就撞不上去重——正文和某条判里各写一个 `## 小结`，
// DOM 里就有两个 `id="小结"`，而折首在 DOM 序上还排在正文之前，原生 `#小结` 会滚到批注上去。
// 只有「当前在读的这一篇」才配打锚，所以由 ui.js 显式开，别改成默认开。
export const renderMarkdown = (text, { headingIds = false } = {}) =>
  md.render(stripFrontmatter(text), headingIds ? { slugger: makeSlugger() } : {});

// 文档内相对图片：私有仓取不到 raw 链接，必须用 token 走 Contents API 换 blob URL。
// base 用 md 文件自身所在目录（不是写死的 docs/），否则根目录或子目录的文档全解析错。
export async function hydrateRelativeImages(container, { docPath, ref, fetchBlobUrl }) {
  const baseDir = docPath.includes('/') ? docPath.slice(0, docPath.lastIndexOf('/') + 1) : '';
  const imgs = [...container.querySelectorAll('img[src]')].filter(
    (img) => !/^(https?:|data:|blob:)/.test(img.getAttribute('src'))
  );
  await Promise.all(imgs.map(async (img) => {
    const raw = img.getAttribute('src').replace(/^\.\//, '');
    const resolved = normalize(baseDir + raw);
    try {
      img.src = await fetchBlobUrl(resolved, ref);
    } catch {
      img.replaceWith(placeholder(resolved));
    }
  }));
}

// 处理 ../ 与 ./，避免拼出 a/b/../c 这种 API 认不出的路径
function normalize(p) {
  const out = [];
  p.split('/').forEach((seg) => {
    if (seg === '..') out.pop();
    else if (seg && seg !== '.') out.push(seg);
  });
  return out.join('/');
}

function placeholder(path) {
  const el = document.createElement('p');
  el.className = 'state err';
  el.textContent = S.doc.imageMissing(path);
  return el;
}
