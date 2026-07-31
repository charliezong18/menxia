// markdown 渲染 —— 块级元素带 data-line / data-line-end，M2 锚定以此为主锚
import { S } from './strings.js';

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

export const renderMarkdown = (text) => md.render(text);

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
