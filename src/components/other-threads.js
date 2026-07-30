// 「其他 N 串」折叠组：锚不到当前文档的已呈批注串（别的文档 / 无法定位）。
// 从 ui.js 拆出（2026-07-28 还账：ui.js 破 800 行触发指标 #1）。纯展示，只吃 props。
import { html } from '../../vendor/preact-standalone.mjs';
import * as A from '../anchor.js';
import { CommentBody } from './comment-body.js';

export function OtherThreads({ threads, open, onToggle, hydrate }) {
  if (!threads.length) return null;
  return html`
            <div class="other-threads">
              <button class="other-threads-toggle" aria-expanded=${open} onClick=${() => onToggle()}>
                ${open ? '▾' : '▸'} 其他 ${threads.length} 串（其他文档 / 无法定位）
              </button>
              ${open && html`
                <div class="other-threads-list">
                  ${threads.map((t) => {
                    const { quote, body } = A.parseCommentBody(t.root.body);
                    return html`
                      <div class="anno-card anno-shown anno-static" key=${'o' + t.root.id}>
                        <div class="anno-src"><span class="anno-who">${t.root.user?.login || '?'}</span>
                          <span class="anno-path">${(t.root.path || '整折').split('/').pop()}</span></div>
                        ${quote && html`<div class="anno-quote-shown">「${quote}」</div>`}
                        <${CommentBody} text=${body} hydrate=${hydrate} />
                        ${t.replies.map((r) => html`
                          <div class="anno-reply" key=${'o' + r.id}>
                            <div class="anno-reply-who">回话 · ${r.user?.login || '?'}</div>
                            <${CommentBody} text=${r.body} hydrate=${hydrate} />
                          </div>`)}
                      </div>`;
                  })}
                </div>`}
            </div>`;
}
