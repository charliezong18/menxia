# Menxia anchoring spec (reference for native implementations)

> 中文版（正本）: [ANCHOR-SPEC.md](ANCHOR-SPEC.md). If the two disagree, the Chinese page and the golden files win.
>
> Audience: menxia-ios implementers (N1–N4). **This page + `test/golden/` should be enough to get it right.**
> Every expected value is produced by the current web code (`test/golden/export.mjs` calls the original `src/` functions — no logic is copied);
> `test/golden.test.js` regenerates and byte-compares on every run, so a web rule change turns the web suite red first. Line refs: branch `feat/native-golden` (on `origin/main` 6cd05e6, includes the diff-fence line fix), 2026-10-13. Origin: review #182 N0.

## 0. Golden files

| Path | Content |
|---|---|
| `test/golden/corpus/*.md` | 29 docs: 16 `real-*` approved folders (provenance in `corpus-sources.json`), 13 constructed `edge-*` |
| `expected/<name>.blocks.json` | Every element carrying `data-line`, **document order**: `{i, type, tag, line, lineEnd, parent, level?, info?, text}` |
| `expected/<name>.toc.json` | `outline` (h1–h3, = `extractOutline`), `hasOutline` (≥3), `headings` (all h1–h6 + slug) |
| `expected/<name>.anchors.json` | `anchors`: selection → `computeAnchor` output + `rangeForDraft` replay; `reanchorByQuote`; `sectionOf` |
| `expected/functions/*.json` | `{input, output}` tables for the pure functions |
| `manifest.json` | sha256 of every corpus and expected file. **Native copy method: copy the whole directory and verify this manifest** (XCTest checks hashes, then content) |

- `text` is the element's **DOM `textContent`, verbatim, no whitespace normalization** (including the `\n` between tags). All offsets are measured against it.
- Anchor case: `{block, blockStart, length, docStart, expect, replay}` — selection starts in innermost block `block` at UTF-16 offset `blockStart`.

## 1. Preprocessing (on the raw string, frontmatter first, then bare anchors) — `src/render.js:130-155`

1. Frontmatter at the very first line → replaced by the **same number of `\n`**.
2. Bare `<a id|name=…></a>` / `<a … />` → replaced by **the same number of spaces**, even inside code blocks.
3. markdown-it then normalizes `\r\n`/`\r` to `\n` (no `\r` in golden text).
4. Regexes use **JS semantics** (`\s` = JS whitespace set incl. U+00A0, U+3000, U+FEFF). Spell the set out in Swift.

## 2. Parser and block splitting — `src/render.js:5,16-55`

- markdown-it 14.1.0, `{html:false, linkify:true, typographer:false}`, default preset (tables, `~~strike~~`; no task lists, no footnotes).
- Anchored tokens: paragraph, heading, list_item, table, tr, blockquote, fence, code_block. `line = map[0]+1` (1-based); `lineEnd = map[1]` (= 1-based inclusive last line; list items swallow trailing blank lines). `lineEnd` has no consumer in `src/` today.
- **Tight lists anchor on `li`** (hidden paragraphs). Loose lists: li ⊃ p.
- **`html:false`**: raw HTML is escaped into visible text; HTML blocks become plain paragraphs.
- **Tables**: one block for the table + one per `tr`; no block for the delimiter row; **the header `tr` shares the table's `line`**. `\|` → `|` (also inside code spans). `tr` text = `"\n" + each cell + "\n"`.
- Inline text: soft and hard breaks both contribute `"\n"`; **image alt contributes nothing**; wikilinks contribute the label; linkify doesn't change text.
- Code: plain `fence` → `data-line` on `<code>`, pointing at the opening fence line, text = content incl. trailing `\n`. `code_block` → on `<pre>`, pointing at the first content line. **```diff** (first info word) → `<pre class="diff-block">`, lines joined by `\n`, no trailing newline, empty lines become a single space.

## 3. Selection → anchor — `computeAnchor`, `src/anchor.js:10-47`

1. `quote = toString().trim().replace(/\s+/g,' ')`, **< 2 chars → null**; `quoteRaw = toString().trim()`; both cut to 300 **UTF-16 units**.
2. Anchor block = innermost `[data-line]` ancestor of the **selection start**; cross-block selections anchor on the start block.
3. `offset` = UTF-16 units from block-text start to selection start.
4. For code blocks `line = blockLine + (type==='fence' ? 1 : 0) + count("\n" before start)`; otherwise `line = blockLine`. **Every fence** (plain and ```diff) is +1 because `data-line` points at the opening fence; indented code is +0. Web checks `tag==='code'` or `pre.diff-block` (`src/anchor.js:22-34`); native can just switch on block type. Example: `edge-diff`, selecting the `@@ -1,4` line yields `line 4`, the true source line.
   - **Historical data (before the 2026-10-13 fix):** diff fences were treated as indented code (+0), so diff annotations carry a `line` **one less** than the source. (1) Submitted inline comments sit one line too high on GitHub (the `> quote` is still right). (2) Replay in Menxia is unaffected: threads are placed on the last block with `data-line ≤ line` (`src/ui.js:686-689`), which is still the same diff block. (3) If the off-by-one line was outside the hunk, the note was folded into a 判 — unaffected. (4) Unsubmitted diff drafts saved before the fix keep their stored (old) `line`. No data is rewritten.
5. A start exactly on a text-node boundary belongs to the start of the following node.
6. Golden quotes use Range semantics (substring of block text); browser `Selection.toString()` may differ across blocks [unverified]. Native should use the block-text substring.

## 4. Wikilinks — `src/render.js:93-122`

Inline rule, never inside code. `[[` up to the first `]]`; empty/whitespace, containing `[` or newline → literal text. `target|label` (trimmed; empty label → target); `#` splits file and fragment; `[[#]]` → literal. Text = label.

## 5. Replay and re-anchoring — `src/anchor.js:50-101`, `src/ui.js:1263-1271`

- Replay: **first element in document order** with `data-line == blockLine` (header row → table; loose li → li), `indexOf(quoteRaw)` from `max(0, offset-2)`, then from 0, else nothing.
- Re-anchor (only for threads whose GitHub `line` is null; order `line ?? reanchor ?? original_line`): needle whitespace-collapsed, **< 4 chars rejected**; among all anchored blocks whose collapsed text contains it, take the **shortest**.
- `sectionOf`: textContent of the last h1–h3 with `line ≤ blockLine`.

## 6. Drafts, submission, hunk check, fallback — `src/ui.js:797-808,1147-1160`, `src/anchor.js:104-158`

- Draft `{id, path, ref, blockLine, line, offset, quote, quoteRaw, note, ts}`. Body `"> " + quote + "\n\n" + note`.
- `validRightLines`: `+`, ` ` and bare empty lines each take one RIGHT line; `-` and `\ No newline` don't; trailing empty element dropped.
- Inline iff `d.ref === head sha` **and** `d.line` ∈ valid set → `{path, line, side:'RIGHT', body}`; otherwise folded into the review body `"以下涂归锚定不到可批注行（或写于旧版本），并入判：\n\n" + bodies joined by "\n\n---\n\n"`; all-inline body = `"门下 · N 条"`. One `POST /pulls/{n}/reviews` with `commit_id`.

## 7. Read state — `src/offline.js:24-63`, `src/ui.js:475-505`

`<!-- menxia-readstate {"device","docPath","anchor","time","v":1} -->\n_门下续读位置（自动维护，勿手改）：<device> · <docPath>_`; `anchor = "L<line>"`; tolerant parsing (see golden). Write throttle ≥4 s and changed line; prompt only (never auto-jump).

## 8. Slug / TOC — `src/slug.js`, `src/toc.js:26-41`

Lowercase → drop `\p{C}\p{Z}` except ASCII space → drop `\p{P}\p{S}` except `-` `_` → space to `-`; no trim, no collapsing; dedupe `-1`, `-2`… Outline = h1–h3 with non-empty trimmed text, shown when ≥3.

## 9. Native notes: markdown-it vs cmark-gfm

(Web side pinned by golden; cmark side all [unverified] until N2 runs the golden.)
1. Raw HTML → cmark `HTMLBlock`/`InlineHTML`: render the source as text. 2. Tight lists: anchor on ListItem. 3. `lineEnd` range semantics differ. 4. Task lists / footnotes / single-tilde strike would change text — keep extensions to table/strikethrough/autolink. 5. Autolink vs linkify boundaries (display only). 6. Wikilinks must be implemented natively. 7. Exclude image alt from text. 8. Container `\n`s are an HTML-serialization artifact — reproduce per §2. 9. Table interrupting a paragraph. 10. CRLF/NUL normalization. 11. Custom diff rendering (`data-line` on `<pre>`, but +1 like any fence, §3.4). 12. Do all string math on UTF-16 with JS whitespace semantics.
