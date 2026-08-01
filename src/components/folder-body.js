// 「折子说明」折叠块：PR body 的五段结构化正文（目的地 / 直达链 / TLDR / 待你拍板 / 怎么用）。
//
// 由来（issue #13）：门下此前只从 body 里抠一个会话标记（`ui.js` 的 parseHappySession），
// 正文一个字都不渲染。而 `open_folder` 每次呈折都往 body 里写那五段，其中**「待你拍板」是
// 明确要 Charlie 拍板的问题清单** —— 它在门下彻底不可见，唯一的看见途径是跳去 github.com，
// 而门下存在的全部理由就是「不外跳」。该被看见的东西静默消失，是本生态的头号大罪。
//
// 交互对齐「已呈判」/「其他 N 串」：折首折叠块 + 走 CommentBody，不新造第二个渲染 sink
// （#4：`markdownit({ html:false })` 是没测过却承重的那道防线，只准有一个落点）。
// 条件展开（issue #13 的取舍）：有「待你拍板」就默认展开——漏拍板的代价 > 多占几行的代价；
// 没有就默认收起，把常态成本压回一行标题。
import { html } from '../../vendor/preact-standalone.mjs';
import { CommentBody } from './comment-body.js';
import { S } from '../strings.js';

// 「回奏对」标记。**必须剥掉**：`html:false` 下 markdown-it 不是丢弃 HTML 注释，而是把它
// **转义成可见文本**（实测 `<!-- happy-session: … -->` 渲成 `<p>&lt;!-- happy-session: … --&gt;</p>`），
// 于是每折正文尾巴上都挂一行乱码。形状照抄写入侧 `menxia-mcp/src/body.ts:46` 与
// 本仓 `link.js:84` 的 MARKER_RE，只多一个 `g`：body 从旧折模板复制粘贴时可能带进不止一条。
// **只剥这一种注释**，不做通用 HTML 注释清洗——那会连正文里当资料引用的注释一起吃掉。
// 2026-07-31 补上 `menxia-rel`（折务追踪 #61 的关系标记，写入侧 `track.ts` 焊的）：
// 它与 `happy-session` 同族、同样是给机器读的，不剥同样会被转义成一行可见乱码。
// 新标记落地那天就得连这条一起改——不然每折正文尾巴上挂一行 `<!-- menxia-rel: … -->`。
const MARKER_RE = /<!--\s*(?:happy-session|menxia-rel):[\s\S]*?-->/gi;

// 段名与写入侧 `body.ts:27-31` 的 SECTIONS 逐字一致（那是唯一的事实源）。
// 这里只用来认「待你拍板」在不在，不用来重排正文——正文原样交给 markdown 渲染，
// 段序、层级、措辞都是写折那方的决定，读的这方不改写。
//
// **故意不进 `strings.js`**（#14）：它是跨系统契约不是界面文案——写入侧改了段名，这边不报错、
// 只是静默认不出拍板点。词表是「可以随便改的字」，把契约放进去等于给它盖了张可改的章。
// 徽章上顺带显示它，那是复用同一个事实源，不是它变成了文案。
export const DECISIONS_TITLE = '待你拍板';

// 「这折说了什么」那一段。同 `DECISIONS_TITLE`，是跨系统契约、逐字对齐写入侧，故意不进 strings.js。
// F1（2026-07-31 定）把它当摘要：折首块常显一行、清单里每折带一句 gist，让「这折要不要现在读」
// 十秒内看得出。取自 `parseFolderBody` 已切好的 sections，不新加任何解析。
export const TLDR_TITLE = 'TLDR';

// `## <段名>` 的识别。写入侧拼的是 `## ${title}\n\n${v}`，所以只可能是列 0 的 ATX 二级标题；
// 判定仍容 0–3 空格缩进（CommonMark 的块级起手规则），手写折不至于因为一个空格就整段认不出。
const H2_RE = /^ {0,3}##\s+(.+?)\s*#*\s*$/;
const FENCE_RE = /^ {0,3}(?:```|~~~)/;

/**
 * 把 body 切成 `Map(段名 → 段正文)`。
 *
 * **认围栏**：代码块里的 `## 待你拍板` 不是标题。守它的理由不是洁癖——认错一次的后果是
 * 「这折有拍板点」判反，块默认展开态就错了，而错了没有任何提示。
 * （同样的两遍扫法在 `zongpi-shown.js` 的摘要里有先例，那边守的是同一类问题。）
 */
function splitSections(text) {
  const out = new Map();
  let title = null;
  let buf = [];
  let inFence = false;
  const flush = () => { if (title !== null) out.set(title, buf.join('\n').trim()); };
  for (const line of text.split('\n')) {
    if (FENCE_RE.test(line)) inFence = !inFence;
    const m = inFence ? null : H2_RE.exec(line);
    if (m) {
      flush();
      title = m[1];
      buf = [];
      continue;
    }
    if (title !== null) buf.push(line);
  }
  flush();
  return out;
}

// 「待你拍板」里有几条。写入侧的 tool schema 写的是「编号列出」，实际折子里编号与 `-` 都有，
// 两种都数；数不出来（散文式）就不显示条数，**绝不编一个**——标题上写「3 条」而正文只有一条，
// 比不写条数糟得多。围栏内的行不算（代码示例里的 `- foo` 不是拍板点）。
function countItems(text) {
  if (!text) return 0;
  let inFence = false;
  let n = 0;
  for (const raw of text.split('\n')) {
    if (FENCE_RE.test(raw)) { inFence = !inFence; continue; }
    if (!inFence && /^ {0,3}(?:\d+[.)]|[-*+])\s+\S/.test(raw)) n++;
  }
  return n;
}

/**
 * 解析 PR body。**这一层必须吃得下任何输入**：body 可能是 `null`（GitHub 就是这么返的）、
 * 空串、只有一行标记、或者一整篇没有任何 `##` 的散文（手开的折，如 review #7）。
 * 白屏事故（#5）就出在「假设 body 是字符串」上，所以这里统一 `String(raw ?? '')`。
 *
 * 没有可显示内容时返回 `null`，调用方据此整块不渲染——与 ZongpiShown 的零条不占位一致。
 */
export function parseFolderBody(raw) {
  const text = String(raw ?? '').replace(MARKER_RE, '').trim();
  if (!text) return null;
  const sections = splitSections(text);
  const decisions = sections.get(DECISIONS_TITLE) || null;
  const tldr = sections.get(TLDR_TITLE) || null;
  return { text, sections, decisions, tldr, decisionCount: countItems(decisions) };
}

/** 有没有拍板点——决定这折的说明块默认展开还是收起（`ui.js` 开折时算一次）。 */
export const hasDecisions = (raw) => Boolean(parseFolderBody(raw)?.decisions);

// 摘要的纯文本 gist：markdown 抽成单行给清单用。**只做减法**——去掉 `##` 标题、`>`、列表符、
// 强调星号、链接壳，把换行压成空格，够短就成。不渲染 HTML（清单里没有那道 CommentBody sink，
// 也不该有第二个），所以这里必须自己保证输出是纯文本。围栏原样留着，不深究——gist 只取前一句。
function gistText(md) {
  return String(md ?? '')
    .replace(/`{1,3}/g, '')                       // 反引号
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')           // ATX 标题记号
    .replace(/^\s{0,3}>\s?/gm, '')                // 引用
    .replace(/^\s{0,3}(?:\d+[.)]|[-*+])\s+/gm, '') // 列表符
    .replace(/\*\*|__|\*|_/g, '')                 // 强调
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')      // 链接留文字
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 清单卡要的最小摘要：一句 gist + 拍板条数。没有 TLDR 也没有拍板点就返回 `null`，
 * 调用方据此整块不渲染（与折首块「无内容不占位」同一约定，优雅降级不白屏）。
 * F1（2026-07-31）：清单此前只有标题 + 折号，看不出这折干了什么、要不要你拍板。
 */
export function folderSummary(raw) {
  const parsed = parseFolderBody(raw);
  if (!parsed) return null;
  const tldr = gistText(parsed.tldr) || '';
  const decisionCount = parsed.decisionCount;
  if (!tldr && !decisionCount) return null;
  return { tldr, decisionCount };
}

export function FolderBody({ body, open, onToggle, hydrate }) {
  const parsed = parseFolderBody(body);
  if (!parsed) return null;
  const n = parsed.decisionCount;
  const badge = parsed.decisions ? S.folderBody.decisionsBadge(DECISIONS_TITLE, n) : '';
  // F1：TLDR 那句常显（收起态也在），别把「这折说了什么」埋进要点一下才展开的正文里。
  const tldr = gistText(parsed.tldr);
  return html`
            <div class=${'folder-body' + (parsed.decisions ? ' has-decisions' : '')}>
              <button class=${'folder-body-toggle' + (parsed.decisions ? ' has-decisions' : '')}
                aria-expanded=${open} onClick=${() => onToggle()}>
                ${open ? '▾' : '▸'} ${S.folderBody.toggle(badge)}
              </button>
              ${tldr && html`<p class="folder-body-tldr">${tldr}</p>`}
              ${open && html`
                <${CommentBody} text=${parsed.text} hydrate=${hydrate}
                  cls="anno-shown-body folder-body-text" />`}
            </div>`;
}
