// 顶栏：面包屑 + 动作区（刷新/引用/回奏/判/提交/画可）+ 新版横幅与提示条。
// 从 ui.js 拆出（2026-07-28 还账：ui.js 破 800 行触发指标 #1）。纯展示，只吃 props。
import { html } from '../../vendor/preact-standalone.mjs';

export function Topbar({
  cur, archived, onHead, busy, draftCount, happyUrl, stale, notice,
  onRefresh, onCopyRef, onZongpi, onSubmit, onQinci,
}) {
  // 多个顶层节点：htm 会返回数组，Preact 直接当 Fragment 渲染（这个 standalone 包没导出 Fragment）
  return html`
        <div class="mainbar">
          <span class="crumb">待批 ${cur ? html`/ <b>${cur.pr.title}</b>` : ''}</span>
          <span class="actions">
            <button class="btn-ghost" onClick=${() => { onRefresh(); }}>刷新</button>
            ${cur && html`<button class="btn-ghost" title="拷涂归直达链（按住 Alt 拷 GitHub 链接）" onClick=${onCopyRef}>引用此处</button>`}
            ${happyUrl && html`<button class="btn-ghost" title="回到呈这折的 Happy 奏对，说一句「读批注」（会话可能已散，那就只剩存档可看）"
              onClick=${() => { const w = window.open(happyUrl, '_blank'); if (w) w.opener = null; }}>回奏</button>`}
            ${cur && html`<button class="btn-ghost" title=${archived ? '归档折仍可留判（划句批注才需要活折）' : ''} onClick=${onZongpi}>判</button>`}
            ${cur && draftCount > 0 && html`
              <button class="btn-primary btn-submit" disabled=${busy || !onHead}
                title=${onHead ? '' : '正在读旧版——先切回 head 再提交'} onClick=${onSubmit}>
                ${busy ? '呈递中…' : `提交涂归 · ${draftCount}`}
              </button>`}
            ${cur && !archived && html`<button class="btn-qinci" disabled=${busy || !onHead}
              title=${onHead ? '' : '正在读旧版——先切回 head 再画可'} onClick=${onQinci}>画 可</button>`}
          </span>
        </div>
        ${stale && html`
          <p class="notice stale-banner">
            有新版已部署，你手上这份是旧的（Pages 缓存 10 分钟）
            <button class="btn-ghost stale-reload" onClick=${() => location.reload()}>刷新用新版</button>
          </p>`}
        ${notice && html`<p class="notice">${notice}</p>`}`;
}
