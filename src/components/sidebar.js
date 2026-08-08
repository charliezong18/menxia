// 侧栏：搜索框 / 搜索结果 / 待审·已画可两栏 / 设置入口。
// 从 ui.js 拆出（2026-07-28 还账：ui.js 破 800 行触发指标 #1）。纯展示，只吃 props。
import { html } from '../../vendor/preact-standalone.mjs';
import { S } from '../strings.js';
import { folderSummary, DECISIONS_TITLE } from './folder-body.js';
import { splitShelf, kindOf, qianOf } from '../track.js';

/**
 * 清单卡的摘要行（F1，2026-07-31）：一句 TLDR gist + 「待你拍板 · n 条」角标。
 * **只在有话说时出现**（同 checkBadge 的克制）：body 没 TLDR 也没拍板点就整行不画，
 * 手开折 / 老折 / body 为空都优雅退回原样，不添噪音、不撑爆清单。
 * gist 单行截断，长了省略号——清单是扫的，不是读的。
 */
function summaryLine(pr) {
  const s = folderSummary(pr.body);
  if (!s) return null;
  return html`
                <div class="pr-summary">
                  ${s.tldr && html`<div class="pr-tldr">${s.tldr}</div>`}
                  ${s.decisionCount ? html`<span class="pr-decisions">${S.folderBody.decisionsBadge(DECISIONS_TITLE, s.decisionCount)}</span>` : ''}
                </div>`;
}

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

// F13「需核实」总数角标。0（或还没数过）不画——空着比一排「0」干净，与体例角标同理。
// 计数只来自已有取文路径（搜索建过索引的折才有数），没数过的折这里就是没有，不误报。
function verifyBadge(n) {
  if (!n) return null;
  return html`<span class="verify-badge" title=${S.verify.badgeTitle(n)}>${S.verify.badge(n)}</span>`;
}

/**
 * 一张折卡。从内联的 map 里提出来，好让待审与弘文馆两条路共用同一张卡
 * ——两份卡渲染迟早分叉，而「清单里少个角标」这种分叉极难发现。
 *
 * **是普通函数、直接调用，不是 `<${FolderCard}>` 组件**：`components.test.js` 靠静态遍历
 * vdom 找 `.pr-summary` / `.chk` 这些类名断言角标画没画，而组件 vnode 要跑过才有子树
 * ——写成组件会让那两条断言看见空树。
 */
function folderCard({ pr, cur, timeAgo, checks, verifyCounts, onOpenPR, shelf = false }) {
  const kind = shelf ? kindOf(pr) : null;
  // 签 chip 三处（待审 / 弘文馆 / 已画可）都出，与卡面 meta 同一套视觉语言，小、不抢戏。
  const qians = qianOf(pr);
  return html`
              <button key=${pr.number} class=${'pr-item' + (cur?.pr.number === pr.number ? ' active' : '') + (pr.merged_at ? ' pr-done' : '')}
                onClick=${() => onOpenPR(pr)}>
                <h3>${pr.title}</h3>
                <div class="meta">#${pr.number} · ${pr.merged_at ? S.folder.mergedAt(timeAgo(pr.merged_at)) : S.folder.submittedAt(timeAgo(pr.updated_at))}${
                  pr.merged_at ? null : checkBadge(checks[pr.number])}${verifyBadge(verifyCounts[pr.number])}${
                  kind ? html`<span class="kind-chip">${kind}</span>` : null}${
                  qians.map((w) => html`<span class="qian-chip" key=${'q' + w}>${w}</span>`)}</div>
                ${summaryLine(pr)}
              </button>`;
}

// 签集：open + merged 两份清单里出现过的所有 `签:*` 的并集，各带计数（跨状态归堆的口径）。
// 不写死那七个初始词——以仓里实际出现的为准；出现序稳定（首见即入，供 chip 条按发现顺序排）。
function qianCounts(prs, donePrs) {
  const seen = new Map();
  for (const pr of [...(prs || []), ...(donePrs || [])]) {
    for (const w of qianOf(pr)) seen.set(w, (seen.get(w) || 0) + 1);
  }
  return [...seen.entries()].map(([word, n]) => ({ word, n }));
}

export function Sidebar({
  q, hits, searching, prs, donePrs, tab, cur, demo, timeAgo, checks = {}, verifyCounts = {},
  qian = null, onQian = () => {},
  onQuery, onSearch, onClearSearch, onJumpToHit, onTab, onOpenPR, onSettings,
}) {
  const match = (p) => !q.trim() || p.title.toLowerCase().includes(q.trim().toLowerCase());
  // 签集与「按签」跨状态清单。qian 非空 = 处在「按签」视图：把 open+merged 里挂该签的折
  // 一屏同列（在读的走朱脊/呈于、已画可的走方印/画可于，状态视觉全由 folderCard 现成表达）。
  const qCounts = qianCounts(prs, donePrs);
  const qActive = qian && qCounts.some((c) => c.word === qian);   // 选中的签在仓里真存在才当激活
  const qianList = qActive
    ? [...prs, ...donePrs].filter((p) => qianOf(p).includes(qian)).filter(match)
    : [];
  // 弘文馆只从待审里分（已画可栏是归档，本来就没人催，再分一次纯属噪音）。
  // 2026-08-03：从「待审列表底部的折叠区」升为第三个 tab。原先那版功能正确、数也对，
  // 但折叠区在 #pr-list 的最底下——清单一长，展开出来的卡全在可视区外，点了像没反应。
  // 反馈原话：「左下角是有个弘文馆，但点开之后里面都没有」。位置错了，不是逻辑错了。
  const split = splitShelf(prs.filter(match));   // 受搜索词过滤，喂列表
  const counts = splitShelf(prs);                // 不受过滤，喂 tab 上的数字
  const list = tab === 'done' ? donePrs.filter(match) : tab === 'shelf' ? split.shelf : split.desk;
  const emptyMsg = tab === 'done' ? S.nav.emptyDone : tab === 'shelf' ? S.nav.emptyShelf : S.nav.emptyOpen;
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
        ${!hits && qCounts.length ? html`
        <div class="qian-bar">
          ${qCounts.map((c) => html`
            <button class=${'qian-filter' + (qActive && c.word === qian ? ' active' : '')} data-qian=${c.word}
              key=${'qf' + c.word} onClick=${() => onQian(qActive && c.word === qian ? null : c.word)}>${S.qian.chip(c.word, c.n)}</button>`)}
          ${qActive && html`<button class="qian-clear" title=${S.qian.clearTitle} onClick=${() => onQian(null)}>${S.qian.clear}</button>`}
        </div>` : ''}
        ${!hits && qActive && html`
        <nav id="pr-list" class="qian-list">
          <p class="qian-crumb">${S.qian.crumb(qian)}</p>
          ${qianList.length
            ? qianList.map((pr) => folderCard({ pr, cur, timeAgo, checks, verifyCounts, onOpenPR, shelf: false }))
            : html`<p class="state">${q.trim() ? S.search.noTitleMatch(q.trim()) : S.qian.empty(qian)}</p>`}
        </nav>`}
        ${!hits && !qActive && html`
        <div class="list-tabs">
          <button data-tab="open" class=${'list-tab' + (tab === 'open' ? ' active' : '')} onClick=${() => onTab('open')}>${S.nav.tabOpen(counts.desk.length)}</button>
          <button data-tab="done" class=${'list-tab' + (tab === 'done' ? ' active' : '')} onClick=${() => onTab('done')}>${S.nav.tabDone(donePrs.length)}</button>
          <button data-tab="shelf" class=${'list-tab list-tab-shelf' + (tab === 'shelf' ? ' active' : '')} onClick=${() => onTab('shelf')}>${S.nav.tabShelf(counts.shelf.length)}</button>
        </div>
        <nav id="pr-list" class=${tab === 'shelf' ? 'shelf-list' : ''}>
          ${tab === 'shelf' && list.length ? html`<p class="shelf-hint">${S.shelf.hint}</p>` : ''}
          ${list.length
            ? list.map((pr) => folderCard({ pr, cur, timeAgo, checks, verifyCounts, onOpenPR, shelf: tab === 'shelf' }))
            : html`<p class="state">${q.trim() ? S.search.noTitleMatch(q.trim()) : emptyMsg}</p>`}
        </nav>`}
        ${!demo && html`<button class="settings" onClick=${onSettings}>${S.nav.settings}</button>`}
      </aside>`;
}
