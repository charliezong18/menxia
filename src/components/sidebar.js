// 侧栏：搜索框 / 搜索结果 / 待批·已画可两栏 / 设置入口。
// 从 ui.js 拆出（2026-07-28 还账：ui.js 破 800 行触发指标 #1）。纯展示，只吃 props。
import { html } from '../../vendor/preact-standalone.mjs';
import { S } from '../strings.js';

/**
 * 体例检查的角标。**只在有话说的时候出现**：
 * 老折（CI 装上之前的）没有检查，什么都不画 —— 空着比一排灰点干净。
 * `unreadable` 也不画：那是一次性的钥匙配置问题，ui.js 出一条通知就够了，
 * 19 张卡同时打问号是噪音不是信息。
 */
function checkBadge(v) {
  if (!v) return null;
  if (v.state === 'fail') return html`<span class="chk chk-bad" title=${S.check.failTitle(v.name || S.check.defaultName)}>${S.check.failBadge}</span>`;
  if (v.state === 'running') return html`<span class="chk chk-run" title=${S.check.runningTitle}>${S.check.runningBadge}</span>`;
  if (v.state === 'pass') return html`<span class="chk chk-ok" title=${S.check.passTitle}>${S.check.passBadge}</span>`;
  return null;   // none / unreadable
}

export function Sidebar({
  q, hits, searching, prs, donePrs, tab, cur, demo, timeAgo, checks = {},
  onQuery, onSearch, onClearSearch, onJumpToHit, onTab, onOpenPR, onSettings,
}) {
  return html`
      <aside>
        <div class="brand-row"><span class="seal">${S.brand.seal}</span><span class="brand">${S.brand.name}</span></div>
        
        <div class="search-row">
          <input class="search-input" placeholder=${S.search.placeholder} value=${q}
            onInput=${(e) => { onQuery(e.target.value); }}
            onKeyDown=${(e) => { if (e.key === 'Enter') onSearch(); if (e.key === 'Escape') onClearSearch(); }} />
          ${(q || hits) && html`<button class="btn-ghost search-clear" onClick=${onClearSearch}>${S.search.clear}</button>`}
        </div>
        ${searching && html`<p class="state">${searching}</p>`}
        ${hits && html`
          <nav id="pr-list" class="search-results">
            ${hits.length ? hits.map(({ pr, hits: hs }) => html`
              <div class="search-group" key=${'s' + pr.number}>
                <div class="search-group-title">#${pr.number} ${pr.title}${pr.merged_at ? S.search.mergedSuffix : ''}</div>
                ${hs.map((h, i) => html`
                  <button class="search-hit" key=${'h' + pr.number + '-' + i} onClick=${() => onJumpToHit(pr, h)}>
                    ${h.kind === 'title' ? html`<span class="search-hit-meta">${S.search.titleHit}</span>`
                      : html`<span class="search-hit-meta">${S.search.lineHit(h.path.split('/').pop(), h.line)}</span>`}
                    <span class="search-hit-snippet">${h.snippet}</span>
                  </button>`)}
              </div>`) : html`<p class="state">${S.search.noResults(q)}</p>`}
          </nav>`}
        ${!hits && html`
        <div class="list-tabs">
          <button class=${'list-tab' + (tab === 'open' ? ' active' : '')} onClick=${() => onTab('open')}>${S.nav.tabOpen(prs.length)}</button>
          <button class=${'list-tab' + (tab === 'done' ? ' active' : '')} onClick=${() => onTab('done')}>${S.nav.tabDone(donePrs.length)}</button>
        </div>
        <nav id="pr-list">
          ${(tab === 'open' ? prs : donePrs).filter((p) => !q.trim() || p.title.toLowerCase().includes(q.trim().toLowerCase())).length
            ? (tab === 'open' ? prs : donePrs).filter((p) => !q.trim() || p.title.toLowerCase().includes(q.trim().toLowerCase())).map((pr) => html`
              <button key=${pr.number} class=${'pr-item' + (cur?.pr.number === pr.number ? ' active' : '') + (pr.merged_at ? ' pr-done' : '')}
                onClick=${() => onOpenPR(pr)}>
                <h3>${pr.title}</h3>
                <div class="meta">#${pr.number} · ${pr.merged_at ? S.folder.mergedAt(timeAgo(pr.merged_at)) : S.folder.submittedAt(timeAgo(pr.updated_at))}${
                  pr.merged_at ? null : checkBadge(checks[pr.number])}</div>
              </button>`)
            : html`<p class="state">${q.trim() ? S.search.noTitleMatch(q.trim()) : (tab === 'open' ? S.nav.emptyOpen : S.nav.emptyDone)}</p>`}
        </nav>`}
        ${!demo && html`<button class="settings" onClick=${onSettings}>${S.nav.settings}</button>`}
      </aside>`;
}
