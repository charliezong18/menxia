// 「已呈总批」折叠组：整折级的会话评论，落在折首（不锚任何行）。
// 由来（issue #1）：长评审历史下这块整个展开挡在正文前，PR #30 实测 9 条 / 8,132 字 ≈ 2–3 屏，
// 读者滚不到文档自己的 TL;DR。交互对齐「其他 N 串」：默认折叠 + 走 renderMarkdown，不新造一套。
import { html } from '../../vendor/preact-standalone.mjs';
import { renderMarkdown } from '../render.js';

// 折叠头的摘要：取最新一条的首行，剥掉 markdown 装饰。不调 LLM（守 BACKLOG 的架构边界）。
export function summarize(body, max = 30) {
  let inFence = false;
  for (const raw of String(body || '').split('\n')) {
    const s = raw.trim();
    if (/^(?:```|~~~)/.test(s)) { inFence = !inFence; continue; }  // 整块代码跳过，不只是围栏那一行
    if (inFence || !s || /^(?:-{3,}|={3,}|\|)/.test(s)) continue;  // 跳过分隔线 / 表格行
    const t = s.replace(/^(?:[#>*\-+]+\s*|\d+[.)]\s*)+/, '').replace(/[*_`~]/g, '').trim();
    if (t) return t.length > max ? t.slice(0, max) + '…' : t;
  }
  return '';
}

export function ZongpiShown({ zongpis, open, onToggle }) {
  if (!zongpis.length) return null;
  // 倒序：最新的在最上面。GitHub 返回的是时间正序，最旧的 changelog 沉在最前面，
  // 而还相关的往往只有最后一条——不靠 API 顺序，显式按 created_at 降序排。
  const newestFirst = [...zongpis].sort((a, b) =>
    String(b.created_at || '').localeCompare(String(a.created_at || '')) || (b.id - a.id));
  const gist = summarize(newestFirst[0].body);
  return html`
            <div class="zongpi-shown">
              <button class="zongpi-shown-toggle" onClick=${() => onToggle()}>
                ${open ? '▾' : '▸'} 已呈总批 · ${zongpis.length}${gist ? `（最新：${gist}）` : ''}
              </button>
              ${open && html`
                <div class="zongpi-shown-list">
                  ${newestFirst.map((z) => html`
                    <div class="zongpi-shown-item" key=${'z' + z.id}>
                      <div class="zongpi-shown-who"><span class="anno-who">${z.user?.login || '?'}</span></div>
                      <div class="anno-shown-body zongpi-shown-body"
                        dangerouslySetInnerHTML=${{ __html: renderMarkdown(z.body) }}></div>
                    </div>`)}
                </div>`}
            </div>`;
}
