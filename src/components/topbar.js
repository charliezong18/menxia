// 顶栏：面包屑 + 动作区（刷新/引用/回奏/判/提交/画可）+ 新版横幅与提示条。
// 从 ui.js 拆出（2026-07-28 还账：ui.js 破 800 行触发指标 #1）。纯展示，只吃 props。
import { html } from '../../vendor/preact-standalone.mjs';
import { S } from '../strings.js';

export function Topbar({
  cur, archived, onHead, busy, draftCount, happyUrl, stale, notice,
  onRefresh, onCopyRef, onZongpi, onSubmit, onQinci,
}) {
  // 多个顶层节点：htm 会返回数组，Preact 直接当 Fragment 渲染（这个 standalone 包没导出 Fragment）
  return html`
        <div class="mainbar">
          <span class="crumb">${S.topbar.crumbRoot} ${cur ? html`/ <b>${cur.pr.title}</b>` : ''}</span>
          <span class="actions">
            <button class="btn-ghost" onClick=${() => { onRefresh(); }}>${S.action.refresh}</button>
            ${cur && html`<button class="btn-ghost" title=${S.action.copyRefTitle} onClick=${onCopyRef}>${S.action.copyRef}</button>`}
            ${happyUrl && html`<button class="btn-ghost" title=${S.action.happyTitle}
              onClick=${() => { const w = window.open(happyUrl, '_blank'); if (w) w.opener = null; }}>${S.action.happy}</button>`}
            ${cur && html`<button class="btn-ghost" title=${archived ? S.action.zongpiArchivedTitle : ''} onClick=${onZongpi}>${S.action.zongpi}</button>`}
            ${cur && draftCount > 0 && html`
              <button class="btn-primary btn-submit" disabled=${busy || !onHead}
                title=${onHead ? '' : S.action.submitOldRevTitle} onClick=${onSubmit}>
                ${busy ? S.action.sending : S.action.submit(draftCount)}
              </button>`}
            ${cur && !archived && html`<button class="btn-qinci" disabled=${busy || !onHead}
              title=${onHead ? '' : S.action.mergeOldRevTitle} onClick=${onQinci}>${S.action.merge}</button>`}
          </span>
        </div>
        ${stale && html`
          <p class="notice stale-banner">
            ${S.stale.banner}
            <button class="btn-ghost stale-reload" onClick=${() => location.reload()}>${S.stale.reload}</button>
          </p>`}
        ${notice && html`<p class="notice">${notice}</p>`}`;
}
