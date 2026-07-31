// 设置页：填敕草仓库 + 粘钥匙；已有钥匙时可返回，也可显式清除。
// 从 ui.js 拆出（2026-07-28 还账：ui.js 破 800 行触发指标 #1）。纯展示，只吃 props。
import { html, useState, useRef } from '../../vendor/preact-standalone.mjs';
import * as gh from '../github.js';

export function Setup({ msg, onSave, canCancel, onCancel, onForget }) {
  const [preview, setPreview] = useState(gh.parseRepoSlug(gh.getRepoSlug()) || '你上面填的那个仓库');
  const repoRef = useRef();
  const tokenRef = useRef();
  const submit = () => onSave(repoRef.current.value, tokenRef.current.value);
  return html`
    <section id="setup">
      <div class="setup-card">
        <div class="brand-row"><span class="seal">可</span><span class="brand">门下</span></div>
        <p class="setup-lead">读 AI 呈上来的敕草，划句落涂归。先说清读哪个仓库，再给一把只开这个仓库的钥匙。</p>
        <ol class="setup-steps">
          <li>填<b>敕草仓库</b>：agent 往哪个仓库开 PR，就填哪个，格式 <code>owner/repo</code>（建议私有）</li>
          <li>去 <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">GitHub 生成 fine-grained token</a>（名字随意，Expiration 建议 90 days）</li>
          <li>Repository access：默认停在 Public repositories，<b>必须改成 Only select repositories</b> → 选 <code>${preview}</code>（不是 zhupi 本身）</li>
          <li>Permissions → Repository permissions 加<b>两</b>项：<b>Contents: Read and write</b> ＋ <b>Pull requests: Read and write</b>。Metadata 自动带上不用管；<b>最容易漏的是 Pull requests</b>，漏了进清单就 403</li>
          <li>Generate 后把 <code>github_pat_…</code> 粘在下面。钥匙只存这台设备的浏览器，不经过任何服务器；权限配错不用重新生成——回 token 页改好点 Update，再回来存一次即可（字符串不变）</li>
        </ol>
        <input id="repo-input" ref=${repoRef} type="text" placeholder="owner/repo"
          autocomplete="off" spellcheck="false" defaultValue=${gh.getRepoSlug()}
          onInput=${(e) => setPreview(gh.parseRepoSlug(e.target.value) || '你上面填的那个仓库')}
          onKeyDown=${(e) => { if (e.key === 'Enter') tokenRef.current.focus(); }} />
        <input id="token-input" ref=${tokenRef} type="password" placeholder="github_pat_…"
          autocomplete="off" spellcheck="false"
          onKeyDown=${(e) => { if (e.key === 'Enter') submit(); }} />
        <div class="setup-actions">
          <button class="btn-primary" onClick=${submit}>存 钥</button>
          ${canCancel && html`<button class="btn-ghost" onClick=${onCancel}>返回</button>`}
          ${canCancel && html`<button class="btn-ghost setup-forget" onClick=${onForget}>清除钥匙</button>`}
          <span class=${'setup-msg' + (msg && msg !== '验钥中…' ? ' err' : '')}>${msg}</span>
        </div>
      </div>
    </section>`;
}
