// 侧栏：搜索框 / 搜索结果 / 待批·已钦此两栏 / 设置入口。
// 从 ui.js 拆出（2026-07-28 还账：ui.js 破 800 行触发指标 #1）。纯展示，只吃 props。
import { html } from '../../vendor/preact-standalone.mjs';

export function Sidebar({
  q, hits, searching, prs, donePrs, tab, cur, demo, timeAgo,
  onQuery, onSearch, onClearSearch, onJumpToHit, onTab, onOpenPR, onSettings,
}) {
  return html`
      <aside>
        <div class="brand-row"><span class="seal">朱</span><span class="brand">御笔朱批</span></div>
        
        <div class="search-row">
          <input class="search-input" placeholder="搜标题 / 回车搜全文" value=${q}
            onInput=${(e) => { onQuery(e.target.value); }}
            onKeyDown=${(e) => { if (e.key === 'Enter') onSearch(); if (e.key === 'Escape') clearSearch(); }} />
          ${(q || hits) && html`<button class="btn-ghost search-clear" onClick=${onClearSearch}>清</button>`}
        </div>
        ${searching && html`<p class="state">${searching}</p>`}
        ${hits && html`
          <nav id="pr-list" class="search-results">
            ${hits.length ? hits.map(({ pr, hits: hs }) => html`
              <div class="search-group" key=${'s' + pr.number}>
                <div class="search-group-title">#${pr.number} ${pr.title}${pr.merged_at ? ' · 已钦此' : ''}</div>
                ${hs.map((h, i) => html`
                  <button class="search-hit" key=${'h' + pr.number + '-' + i} onClick=${() => onJumpToHit(pr, h)}>
                    ${h.kind === 'title' ? html`<span class="search-hit-meta">标题命中</span>`
                      : html`<span class="search-hit-meta">${h.path.split('/').pop()} · 第 ${h.line} 行</span>`}
                    <span class="search-hit-snippet">${h.snippet}</span>
                  </button>`)}
              </div>`) : html`<p class="state">没搜到「${q}」。</p>`}
          </nav>`}
        ${!hits && html`
        <div class="list-tabs">
          <button class=${'list-tab' + (tab === 'open' ? ' active' : '')} onClick=${() => onTab('open')}>待批 ${prs.length}</button>
          <button class=${'list-tab' + (tab === 'done' ? ' active' : '')} onClick=${() => onTab('done')}>已钦此 ${donePrs.length}</button>
        </div>
        <nav id="pr-list">
          ${(tab === 'open' ? prs : donePrs).filter((p) => !q.trim() || p.title.toLowerCase().includes(q.trim().toLowerCase())).length
            ? (tab === 'open' ? prs : donePrs).filter((p) => !q.trim() || p.title.toLowerCase().includes(q.trim().toLowerCase())).map((pr) => html`
              <button key=${pr.number} class=${'pr-item' + (cur?.pr.number === pr.number ? ' active' : '') + (pr.merged_at ? ' pr-done' : '')}
                onClick=${() => onOpenPR(pr)}>
                <h3>${pr.title}</h3>
                <div class="meta">#${pr.number} · ${pr.merged_at ? `钦此于 ${timeAgo(pr.merged_at)}` : `呈于 ${timeAgo(pr.updated_at)}`}</div>
              </button>`)
            : html`<p class="state">${q.trim() ? `标题没有「${q.trim()}」——回车搜全文。` : (tab === 'open' ? '此刻无折可批。' : '还没有钦此过的折子。')}</p>`}
        </nav>`}
        ${!demo && html`<button class="settings" onClick=${onSettings}>设置 · 钥匙</button>`}
      </aside>`;
}
