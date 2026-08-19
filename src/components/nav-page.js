// 目录页 —— 手机三层导航的中间那层（2026-08-19）。
//   一级＝折清单（aside）｜二级＝这里（篇 / 节）｜三级＝阅读页（正文）
//
// 为什么是「一页」而不是底栏加一颗「大纲」钮：375px（iPhone SE/mini）上底栏塞到第五颗时
// 「涂归 · N」实测会换成两行（Range.getClientRects 数出来的，不是估的）。这一页零新增控件——
// 底栏那颗「‹ 目录」改成开它就行，底栏保持四颗不变。
//
// 节只列**当前篇**的：extractOutline 读的是已渲染的 DOM，非当前篇的标题根本拿不到。
// 所以「篇→节两层」的实现是手风琴——点篇＝切 docPath（正文在背后重渲）→ 它的节就地换掉。
//
// 纯展示，只吃 props（与 sidebar/topbar 同一约定）。scroll spy 刻意不做：那是给常驻右栏
// 「跟随阅读位置」设计的，独立页里没有「跟随」可言，留着只是每帧白算一遍几何。
import { html } from '../../vendor/preact-standalone.mjs';
import { S } from '../strings.js';

export function NavPage({ chapters = [], outline = [], onFolders, onChapter, onSection }) {
  const multi = chapters.length > 1;
  return html`
    <nav class="nav-page" aria-label=${S.navPage.aria}>
      ${/* 往上一层。放在最顶上而不是底栏，是因为底栏在这一页只留「‹ 正文」一颗——
           「回正文」和「回折清单」是两个方向，挤在同一条栏里必然有一个被认错。 */ ''}
      <button class="nav-up" onClick=${onFolders}>${S.navPage.upToFolders}</button>

      ${multi && html`
        <div class="nav-sec">
          <h2 class="nav-sec-h">${S.navPage.chapters}</h2>
          <ol class="nav-list">
            ${chapters.map((c) => html`
              <li key=${c.path}>
                <button class=${'nav-item nav-chapter' + (c.active ? ' active' : '')}
                  onClick=${() => onChapter(c.path)}>${c.name}</button>
              </li>`)}
          </ol>
        </div>`}

      ${outline.length > 0 && html`
        <div class="nav-sec">
          ${/* 多篇时标一句「当前篇的节」，免得以为这里列的是全书——手风琴换篇后这一栏会整个换掉 */ ''}
          <h2 class="nav-sec-h">${multi ? S.navPage.sectionsOfCurrent : S.navPage.sections}</h2>
          <ol class="nav-list">
            ${outline.map((it) => html`
              <li key=${it.id}>
                <button class=${`nav-item nav-l${it.level}`} title=${it.text}
                  onClick=${() => onSection(it.line)}>${it.text}</button>
              </li>`)}
          </ol>
        </div>`}
    </nav>`;
}
