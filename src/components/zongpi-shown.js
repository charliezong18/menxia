// 「已呈判」折叠组：整折级的会话评论，落在折首（不锚任何行）。
// 由来（issue #1）：长评审历史下这块整个展开挡在正文前，PR #30 实测 9 条 / 8,132 字 ≈ 2–3 屏，
// 读者滚不到文档自己的 TL;DR。交互对齐「其他 N 串」：默认折叠 + 走 CommentBody，不新造一套。
import { html } from '../../vendor/preact-standalone.mjs';
import { CommentBody } from './comment-body.js';

// 折叠头的摘要：取最新一条的首行，剥掉 markdown 装饰。不调 LLM（守 BACKLOG 的架构边界）。
export function summarize(body, max = 30) {
  const lines = String(body ?? '').split('\n');
  // 扫两遍：未闭合 / 嵌套围栏会让「跳过整块代码」吃掉全文，摘要退化成空——那正好回到 issue #1
  // 要解决的场景（折叠头没信息量，用户被迫展开）。第一遍守围栏，空了就无视围栏再来一遍。
  return pickLine(lines, true, max) || pickLine(lines, false, max);
}

function pickLine(lines, honorFence, max) {
  let inFence = false;
  for (const raw of lines) {
    const s = raw.trim();
    const isFence = /^(?:```|~~~)/.test(s);
    if (honorFence && isFence) { inFence = !inFence; continue; }
    if (inFence || isFence || !s || /^(?:-{3,}|={3,}|\|)/.test(s)) continue;  // 跳过分隔线 / 表格行
    const t = s.replace(/^(?:[#>*\-+]+\s*|\d+[.)]\s*)+/, '')
      .replace(/[*_`~]/g, '')
      .replace(/[\p{Cc}\p{Cf}]/gu, '')   // 控制符 / bidi 覆写：U+202E 能把后面整行的显示方向翻过来
      .trim();
    if (!t) continue;
    const cps = [...t];                  // 按 code point 切：slice() 会把 emoji 的代理对劈成半个
    return cps.length > max ? cps.slice(0, max).join('') + '…' : t;
  }
  return '';
}

// GitHub 返的是时间正序，最旧的 changelog 沉在最前面，而还相关的往往只有最后一条。
// 用毫秒数排而不是比字符串：字符串序只在「定宽 + 恒 Z 后缀」时才等价于时间序，
// 带时区偏移（+09:00）或毫秒的时间戳会静默排反，且排反了没人报错。
const at = (z) => { const t = Date.parse(z?.created_at); return Number.isNaN(t) ? 0 : t; };

export function ZongpiShown({ zongpis, open, onToggle, hydrate }) {
  if (!zongpis.length) return null;
  const newestFirst = [...zongpis].sort((a, b) => (at(b) - at(a)) || ((b.id || 0) - (a.id || 0)));
  const gist = summarize(newestFirst[0].body);
  return html`
            <div class="zongpi-shown">
              <button class="zongpi-shown-toggle" aria-expanded=${open} onClick=${() => onToggle()}>
                ${open ? '▾' : '▸'} 已呈判 · ${zongpis.length}${gist ? `（最新：${gist}）` : ''}
              </button>
              ${open && html`
                <div class="zongpi-shown-list">
                  ${newestFirst.map((z, i) => html`
                    <div class="zongpi-shown-item" key=${'z' + (z.id ?? 'i' + i)}>
                      <div class="zongpi-shown-who"><span class="anno-who">${z.user?.login || '?'}</span></div>
                      <${CommentBody} text=${z.body} hydrate=${hydrate}
                        cls="anno-shown-body zongpi-shown-body" />
                    </div>`)}
                </div>`}
            </div>`;
}
