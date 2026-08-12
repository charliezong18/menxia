// 总览（F16，review #61 批定 2026-07-31）：把待审的一堆折按**项目**摊开，
// 每折标出「等谁」，并把折间关系画出来。
//
// 由来是 Charlie 2026-07-31 的原话：「一堆折子等着我读。我也不知道这个是 block 哪个的，
// 或者两天前的有没有被之后的哪个提前批了的 cover 了。」——清单按时间倒序排，
// 恰好把这两个问题都答不了：时间序里看不出项目，更看不出谁盖了谁。
//
// **零新增请求**：吃的是 `listOpenPRs` / `listMergedPRs` 已经取回来的 labels 与 body
// （此前一直被扔掉），解析在 `track.js`。
//
// 渲染只用纯文本节点——这里没有 `CommentBody` 那道 sink，也不该有第二个（#4）。
import { html } from '../../vendor/preact-standalone.mjs';
import { S } from '../strings.js';
import { analyze, groupByProject, isZombie, kindOf, waitClass, waitOf, waitTally } from '../track.js';

/** 关系条：只在**有关系可说**时出现。没关系的折一行不多占——清单是扫的。 */
function relLine(note, onOpenNum) {
  if (!note) return null;
  const chips = [];
  const push = (cls, text, num) => chips.push(
    num
      ? html`<button class=${'rel-chip ' + cls} key=${cls + num} onClick=${(e) => { e.stopPropagation(); onOpenNum(num); }}>${text}</button>`
      : html`<span class=${'rel-chip ' + cls} key=${cls + text}>${text}</span>`,
  );
  for (const n of note.coveredBy) push('rel-covered', S.dash.coveredBy(n), n);
  for (const n of note.blockedBy) push('rel-blocked', S.dash.blockedBy(n), n);
  for (const n of note.unlocked) push('rel-unlocked', S.dash.unlocked(n), n);
  for (const n of note.willCover) push('rel-willcover', S.dash.willCover(n), n);
  for (const n of note.covers) push('rel-covers', S.dash.covers(n), n);
  if (note.unblocks) push('rel-unblocks', S.dash.unblocks(note.unblocks), null);
  return chips.length ? html`<div class="rel-row">${chips}</div>` : null;
}

function FolderRow({ pr, note, active, timeAgo, onOpen, onOpenNum }) {
  const w = waitOf(pr);
  const k = kindOf(pr);
  return html`
    <button class=${'dash-row' + (active ? ' active' : '') + (isZombie(note) ? ' zombie' : '')}
      onClick=${() => onOpen(pr)}>
      <div class="dash-row-head">
        ${w ? html`<span class=${'wait-dot ' + waitClass(w)} title=${S.dash.waitTitle(w)}></span>` : html`<span class="wait-dot wait-none" title=${S.dash.waitNone}></span>`}
        <span class="dash-num">#${pr.number}</span>
        <span class="dash-title">${pr.title}</span>
        ${k && html`<span class="kind-chip">${k}</span>`}
        <span class="dash-ago">${timeAgo(pr.updated_at)}</span>
      </div>
      ${relLine(note, onOpenNum)}
    </button>`;
}

export function Dashboard({ prs, donePrs, cur, timeAgo, onOpen, onOpenNum, onClose }) {
  const rel = analyze(prs, donePrs);
  const groups = groupByProject(prs, { unlabeled: S.dash.unlabeled });
  const tally = waitTally(prs);
  // 僵尸单独报一个数：这类折**不用读**，是清单里最该先摘掉的噪音（#58 埋了一整天）。
  const zombies = prs.filter((p) => isZombie(rel.get(p.number)));

  return html`
    <div class="dash">
      <div class="dash-top">
        <h2 class="dash-h">${S.dash.title(prs.length)}</h2>
        <button class="btn-ghost" onClick=${onClose}>${S.dash.close}</button>
      </div>
      <div class="dash-tally">
        ${tally.length
          ? tally.map(({ wait, n }) => html`
              <span class="tally-item" key=${wait}>
                <span class=${'wait-dot ' + waitClass(wait)}></span>${S.dash.tally(wait, n)}
              </span>`)
          : html`<span class="tally-empty">${S.dash.noLabels}</span>`}
        ${zombies.length ? html`<span class="tally-item tally-zombie">${S.dash.zombieCount(zombies.length)}</span>` : ''}
      </div>

      ${groups.map(({ proj, list }) => html`
        <section class="dash-group" key=${proj}>
          <h3 class="dash-proj">${proj}<span class="dash-proj-n">${list.length}</span></h3>
          ${list.map((pr) => html`
            <${FolderRow} key=${pr.number} pr=${pr} note=${rel.get(pr.number)}
              active=${cur?.pr?.number === pr.number} timeAgo=${timeAgo}
              onOpen=${onOpen} onOpenNum=${onOpenNum} />`)}
        </section>`)}

      ${!prs.length && html`<p class="state">${S.nav.emptyOpen}</p>`}
    </div>`;
}
