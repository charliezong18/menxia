// 批注卡三件套：草稿卡 / 已呈批注串 / 总批卡。
// 从 ui.js 拆出（2026-07-28 还账：ui.js 破 800 行触发指标 #1）。纯展示，只吃 props。
import { html, useEffect, useRef } from '../../vendor/preact-standalone.mjs';
import * as A from '../anchor.js';

export function DraftCard({ d, doc, editing, onEdit, onSave, onDrop }) {
  const taRef = useRef();
  useEffect(() => { if (editing) setTimeout(() => taRef.current?.focus(), 0); }, [editing]);
  const sec = doc ? A.sectionOf(doc, d.blockLine) : '';
  return html`
    <div class="anno-card" data-block-line=${d.blockLine} key=${d.id}>
      <div class="anno-quote">「${d.quote.length > 80 ? d.quote.slice(0, 80) + '…' : d.quote}」</div>
      <div class="anno-src">${sec ? sec + ' · ' : ''}第 ${d.line} 行</div>
      ${editing ? html`
        <textarea class="anno-input" ref=${taRef} placeholder="朱批……" defaultValue=${d.note}
          onKeyDown=${(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.stopPropagation(); onSave(d.id, taRef.current.value); }
          }}
          onBlur=${() => {
            // 打了一半没存批就点了别处（换卡/新划句）→ 自动存，别生吞长批注（评审阻断项）
            const v = taRef.current?.value.trim();
            if (v && v !== d.note) onSave(d.id, taRef.current.value);
          }}></textarea>
        <div class="anno-row">
          <button class="anno-ghost" onMouseDown=${(e) => e.preventDefault()} onClick=${() => onDrop(d.id)}>作罢</button>
          <button class="anno-save" onMouseDown=${(e) => e.preventDefault()} onClick=${() => onSave(d.id, taRef.current.value)}>存批</button>
        </div>` : html`
        <div class="anno-note" title="点击修改" onClick=${() => onEdit(d.id)}>${d.note}</div>`}
    </div>`;
}

// 已呈批注串（墨色安静系，视觉降一档；朱砂只留给草稿的活跃态）
// blockLine 用串的源文件行号（line ?? original_line）直接当锚，参与 layoutCards 对齐
export function ShownThread({ t, blockLine, outdated }) {
  const { quote, body } = A.parseCommentBody(t.root.body);
  return html`
    <div class="anno-card anno-shown" data-block-line=${blockLine} key=${'c' + t.root.id}>
      ${quote && html`<div class="anno-quote-shown">「${quote}」</div>`}
      <div class="anno-src">
        <span class="anno-who">${t.root.user?.login || '?'}</span>
        ${outdated ? html`<span class="anno-outdated" title="此行已随新版漂移">旧</span>` : ''}
      </div>
      <div class="anno-shown-body">${body}</div>
      ${t.replies.map((r) => html`
        <div class="anno-reply" key=${'c' + r.id}>
          <div class="anno-reply-who">回话 · ${r.user?.login || '?'}</div>
          <div class="anno-shown-body">${r.body}</div>
        </div>`)}
    </div>`;
}

export function ZongpiCard({ busy, onSend, onClose }) {
  const taRef = useRef();
  useEffect(() => { setTimeout(() => taRef.current?.focus(), 0); }, []);
  return html`
    <div class="anno-card zongpi-card">
      <div class="anno-src">总批 · 整折总评（呈出即达，不攒批）</div>
      <textarea class="anno-input" ref=${taRef} rows="4" placeholder="总批……可以按序号列意见"></textarea>
      <div class="anno-row">
        <button class="anno-ghost" onMouseDown=${(e) => e.preventDefault()} onClick=${onClose}>作罢</button>
        <button class="anno-save" onMouseDown=${(e) => e.preventDefault()} onClick=${() => onSend(taRef.current.value)}>${busy ? '呈递中…' : '呈总批'}</button>
      </div>
    </div>`;
}
