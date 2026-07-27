// markdown 渲染 —— 每个块级元素带 data-line，供 M2 锚定用
const md = window.markdownit({ html: false, linkify: true, typographer: false });

// 给块级 token 打上源文件行号
function lineNumberPlugin(mdIt) {
  const rules = ['paragraph_open', 'heading_open', 'list_item_open', 'table_open', 'blockquote_open', 'fence'];
  rules.forEach((rule) => {
    const orig = mdIt.renderer.rules[rule];
    mdIt.renderer.rules[rule] = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      if (token.map) token.attrSet('data-line', String(token.map[0] + 1));
      return orig ? orig(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
    };
  });
}
lineNumberPlugin(md);

export const renderMarkdown = (text) => md.render(text);

// 相对路径的图片/链接补成 raw.githubusercontent，否则 repo 内引用全裂
export function resolveRelativeAssets(html, { owner, name, ref }) {
  const base = `https://raw.githubusercontent.com/${owner}/${name}/${ref}/`;
  const el = document.createElement('div');
  el.innerHTML = html;
  el.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (!/^(https?:)?\/\//.test(src)) {
      img.setAttribute('src', new URL(src.replace(/^\.\//, ''), base + 'docs/').href);
    }
  });
  el.querySelectorAll('a[href^="http"]').forEach((a) => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noreferrer');
  });
  return el.innerHTML;
}
