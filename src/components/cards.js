// 批注卡三件套：草稿卡 / 已呈批注串 / 判卡。
// 从 ui.js 拆出（2026-07-28 还账：ui.js 破 800 行触发指标 #1）。纯展示，只吃 props。
import { html, useEffect, useRef } from '../../vendor/preact-standalone.mjs';
import * as A from '../anchor.js';
import { CommentBody } from './comment-body.js';
import { S } from '../strings.js';

export function DraftCard({ d, doc, editing, onEdit, onSave, onDrop }) {
  const taRef = useRef();
  useEffect(() => { if (editing) setTimeout(() => taRef.current?.focus(), 0); }, [editing]);
  const sec = doc ? A.sectionOf(doc, d.blockLine) : '';
  return html`
    <div class="anno-card" data-block-line=${d.blockLine} key=${d.id}>
      <div class="anno-quote">${S.card.quote(d.quote.length > 80 ? d.quote.slice(0, 80) + '…' : d.quote)}</div>
      <div class="anno-src">${S.card.srcLine(sec, d.line)}</div>
      ${editing ? html`
        <textarea class="anno-input" ref=${taRef} placeholder=${S.card.draftPlaceholder} defaultValue=${d.note}
          onKeyDown=${(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.stopPropagation(); onSave(d.id, taRef.current.value); }
          }}
          onBlur=${() => {
            // 打了一半没存批就点了别处（换卡/新划句）→ 自动存，别生吞长批注（评审阻断项）
            const v = taRef.current?.value.trim();
            if (v && v !== d.note) onSave(d.id, taRef.current.value);
          }}></textarea>
        <div class="anno-row">
          <button class="anno-ghost" onMouseDown=${(e) => e.preventDefault()} onClick=${() => onDrop(d.id)}>${S.action.discard}</button>
          <button class="anno-save" onMouseDown=${(e) => e.preventDefault()} onClick=${() => onSave(d.id, taRef.current.value)}>${S.action.saveDraft}</button>
        </div>` : html`
        <div class="anno-note" title=${S.card.editTitle} onClick=${() => onEdit(d.id)}>${d.note}</div>`}
    </div>`;
}

// 已呈批注串（墨色安静系，视觉降一档；朱砂只留给草稿的活跃态）
// blockLine 用串的源文件行号（line ?? original_line）直接当锚，参与 layoutCards 对齐
export function ShownThread({ t, blockLine, outdated, hydrate, onExpand }) {
  const { quote, body } = A.parseCommentBody(t.root.body);
  return html`
    <div class="anno-card anno-shown" data-block-line=${blockLine} key=${'c' + t.root.id}>
      ${quote && html`<div class="anno-quote-shown">${S.card.quote(quote)}</div>`}
      <div class="anno-src anno-src-row">
        <span class="anno-who">${t.root.user?.login || '?'}</span>
        ${outdated ? html`<span class="anno-outdated" title=${S.card.outdatedTitle}>${S.card.outdatedBadge}</span>` : ''}
        ${onExpand && html`
          <button class="anno-expand" title=${S.action.expandTitle} aria-label=${S.action.expandTitle}
            onClick=${() => onExpand(t.root.id)}>${S.action.expand}</button>`}
      </div>
      <${CommentBody} text=${body} hydrate=${hydrate} />
      ${t.replies.map((r) => html`
        <div class="anno-reply" key=${'c' + r.id}>
          <div class="anno-reply-who">${S.card.replyWho(r.user?.login || '?')}</div>
          <${CommentBody} text=${r.body} hydrate=${hydrate} />
        </div>`)}
    </div>`;
}

export function ZongpiCard({ busy, onSend, onClose }) {
  const taRef = useRef();
  // **先滚到它，再 focus**（2026-08-02 实测「判不了」）：窄屏（≤900px）批注列不在右缘，
  // 而是整列落到正文**下方**——长折按下「判」，卡片开在四五屏之外，看上去就是没反应。
  // 顺序不能反：iOS Safari 会吞掉非用户手势里的 focus()（键盘不弹，也不带滚动），
  // 而 scrollIntoView 不受这条限制，所以滚动必须自己走，不能指望 focus 顺带把它带上来。
  useEffect(() => {
    setTimeout(() => {
      taRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      taRef.current?.focus();
    }, 0);
  }, []);
  return html`
    <div class="anno-card zongpi-card">
      <div class="anno-src">${S.card.zongpiHeader}</div>
      <textarea class="anno-input" ref=${taRef} rows="4" placeholder=${S.card.zongpiPlaceholder}></textarea>
      <div class="anno-row">
        <button class="anno-ghost" onMouseDown=${(e) => e.preventDefault()} onClick=${onClose}>${S.action.discard}</button>
        <button class="anno-save" onMouseDown=${(e) => e.preventDefault()} onClick=${() => onSend(taRef.current.value)}>${busy ? S.action.sending : S.action.sendZongpi}</button>
      </div>
    </div>`;
}
