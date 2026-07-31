// 评论正文（涂归 / 回话 / 判）的唯一渲染口。
//
// 由来（#5）：renderMarkdown + dangerouslySetInnerHTML 此前在五处各写一遍，于是每加一条防御
// 都要抄五遍——#1 只给判补了 `|| ''`，回话那两处（cards.js / other-threads.js）漏掉，
// null body 照样把整个 app 渲染炸掉。收成一处之后，防御与图片 hydrate 都只有一个落点。
//
// 仍然不认识 api：hydrate 由 ui.js 组好（闭包里带 docPath / rev / fetchBlobUrl）传进来，
// 组件保持「纯展示，只吃 props」的约定。
import { html, useRef, useEffect } from '../../vendor/preact-standalone.mjs';
import { renderMarkdown } from '../render.js';

export function CommentBody({ text, hydrate, cls = 'anno-shown-body' }) {
  const ref = useRef();
  // 相对路径图片：私有仓取不到 raw 链接，必须用 token 走 Contents API 换 blob URL。
  // hydrateRelativeImages 只挑非 http/data/blob 的 src，所以重跑是幂等的。
  useEffect(() => {
    if (ref.current && hydrate) hydrate(ref.current);
  }, [text, hydrate]);
  // text 为 null/undefined 时给空串：markdown-it 对非字符串直接抛，抛在渲染里就是整个 #root 卸空
  return html`<div class=${cls} ref=${ref}
    dangerouslySetInnerHTML=${{ __html: renderMarkdown(text || '') }}></div>`;
}
