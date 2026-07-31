// F14 大纲／分级阅读（纯逻辑）——长折的两半：篇多（章列表）与篇长（篇内大纲）。
//
// 两件事都只读已渲染 DOM 里的 `data-line`，不碰渲染管线（BACKLOG F14：headings 已带 data-line）。
// 章列表沿用 F8 的双语配对（`lang.js` 的 visibleDocs）——`foo.md` ↔ `foo.zh-CN.md` 合成一章，
// 绝不把中英列成两章。这里只做「阈值判定 + 章名派生」，配对本身仍归 lang.js（唯一事实源）。

import { visibleDocs, variantOf } from './lang.js';

// 篇内大纲的层级：与 anchor.js `sectionOf` 同口径（h1/h2/h3）。更深的标题在窄栏里只会拥挤，
// 而本项目文档极少用到 h4 以下；真用到了也退到最近的 h3 语义，不丢导航能力。
const HEADING_SEL = 'h1[data-line],h2[data-line],h3[data-line]';

// 短折不出大纲的阈值：少于这么多标题时，大纲是噪音不是导航（任务：「<3 个标题不显示」）。
export const OUTLINE_MIN_HEADINGS = 3;

// 章列表取代 tab 条的阈值：可见章数超过它就从「一排 pill」换成下拉。
// 定 7：doc-tabs 是 flex-wrap 的 pill，6 章以内一行放得下、扫一眼就有全貌；
// 到 7+ 就开始折行、失去「一览」——这正是 #31（22 章）不堪用的那个点。demo 只有 2 章，
// 不触发（tab 保持原样，冒烟路径不受影响）。
export const CHAPTER_LIST_THRESHOLD = 7;

// 从当前文档的渲染结果里抽标题 → 扁平大纲项。
// 每项：{ line（跳转锚，对齐 data-line）, level（1/2/3）, text（标题文字，已 trim）, id }。
// text 空的标题跳过（`#` 后什么都没有的畸形标题不该在大纲里留空行）。
// id 用 line —— data-line 在一篇文档里唯一，正好当 Preact key 和高亮标识。
export function extractOutline(doc) {
  if (!doc) return [];
  const out = [];
  doc.querySelectorAll(HEADING_SEL).forEach((h) => {
    const line = +h.dataset.line;
    if (!line) return;
    const text = (h.textContent || '').trim();
    if (!text) return;
    const level = h.tagName === 'H1' ? 1 : h.tagName === 'H2' ? 2 : 3;
    out.push({ line, level, text, id: line });
  });
  return out;
}

// 大纲够不够格显示。少于阈值就返回 false —— 调用方据此整块不渲染（与 folder-body 零内容不占位一致）。
export const hasOutline = (items) => (items?.length || 0) >= OUTLINE_MIN_HEADINGS;

// scroll spy：给定各标题的视口内 top（相对滚动容器）与当前滚动位置，返回「当前所在标题」的 line。
// 规则＝最后一个 top 已越过阈值线的标题（阈值线取容器视口顶端稍下一点，让标题滚到接近顶部就算「进入」）。
// 一个都没越过（还在首个标题之上）时，归到第一个标题——读者在文首，高亮文首那条最不突兀。
// 输入 tops：[{ line, top }]，top 是标题相对滚动容器可视区顶端的偏移（getBoundingClientRect().top - containerTop）。
export function activeHeadingLine(tops, triggerOffset = 96) {
  if (!tops || !tops.length) return null;
  let active = tops[0].line;
  for (const { line, top } of tops) {
    if (top - triggerOffset <= 0) active = line;
    else break;
  }
  return active;
}

// 章列表（F14 第二半）。沿用 F8 双语配对：成对的只出一章，单份保留，顺序不乱。
// 每章：{ path（该章在偏好语言下的文件名，即 tab/跳转用的那个）, name（章名，去目录去 .zh-CN.md）,
//        active（是不是当前在读的这篇；配对篇也算命中，切语言不改变「在第几章」）}。
// curPath 传当前 docPath；lang 传语言偏好（决定成对章出中还是英）。
export function chapterList(paths, curPath, lang = 'zh') {
  const visible = visibleDocs(paths, lang);
  const curBase = variantOf(curPath)?.base || curPath;
  return visible.map((path) => ({
    path,
    name: chapterName(path),
    active: (variantOf(path)?.base || path) === curBase,
  }));
}

// 章名：取文件名末段，去掉 .zh-CN.md / .md 后缀。与 doc-tab 现有显示口径一致
// （ui.js: `f.filename.split('/').pop().replace(/\.zh-CN\.md$/i, '.md')`），只是连 `.md` 也去掉，
// 下拉里排一长列时后缀是纯噪音。
export function chapterName(path) {
  return String(path || '').split('/').pop().replace(/\.zh-CN\.md$/i, '').replace(/\.md$/i, '');
}

// 要不要用章列表取代 tab 条。可见章数（双语已合并）超阈值才换。
export const shouldUseChapterList = (paths, lang = 'zh') => visibleDocs(paths, lang).length > CHAPTER_LIST_THRESHOLD;
