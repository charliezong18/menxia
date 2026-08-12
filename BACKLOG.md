**English** · [中文](BACKLOG.zh-CN.md)

# BACKLOG

Things that are thought through but not scheduled.

**Scheduling rule (updated 2026-07-27)**: all three v0 milestones (M1/M2/M3) are done, so the old premise — "close the loop before touching this file" — no longer applies. The rule is now **feature freeze until the 8/8 reckoning**: what gets looked at that day is real usage (how many documents were submitted, how many comments were written), not the feature table. During the freeze, only bugs and friction that's in the way get fixed. No new F items.

---

## F1 · Document summary (TL;DR)

**What**: auto-generate a summary at the top of every document — whatever it was fed in from (spec / issue / PR / daily report), you get "what this says, what it needs you to decide" before you start reading.

**Why**: the biggest friction with a long document isn't that it's hard to read, it's **not knowing whether it's worth reading**. A summary cuts the cost of deciding "do I read this now" down to ten seconds.

**How**: generated agent-side (the review-loop skill writes it when it opens the PR), stored in the PR body or the document's frontmatter. menxia only renders it as a summary card at the head of the document. **No LLM calls inside the app** (see the architectural boundary below).

**Undecided**: whether the summary should be two parts — "what this says" + "what it needs you to decide" (the latter is really the PR body's *Decisions needed* field, which could just be promoted to a structured field).

**✅ Decided (2026-07-31, eval folder #60)**: approved, first in line once the 8/8 freeze lifts. The eval confirmed the gap with numbers — the write side schema-enforces five body sections (tldr / decisions / howto / destination / directLink) and the reader renders **none** of them (`pr.body` is read exactly once, for the session marker). Scope pinned to the cheap form: **render the PR body's existing TLDR + Decisions-needed as the summary card** (list page and/or document head) — no frontmatter, no new data, no LLM. This also settles the old "Undecided": two parts, and they are exactly the structured fields that already exist. → 2026-07-31 built ahead of schedule and merged (Charlie called it — not waiting for 8/8).

**What was built (both surfaces)**: no new parser — the F1 work rides the `parseFolderBody` that issue #13 already built (one source of truth for splitting the body into `## sections`, already hardened against `null` / empty / prose-only / fenced-code bodies). It was extended to also expose the `TLDR` section, plus a tiny pure `folderSummary(body)` that returns `{ tldr, decisionCount }` or `null`. **List page**: each folder now carries a two-line TLDR gist (markdown flattened to plain text — the list has no `CommentBody` render sink and must not grow a second one) plus a `待你拍板 · n` chip; a folder with no TLDR and no decisions draws no summary row at all (graceful degradation, same "zero → occupies nothing" convention as the check badges). **Document head**: the existing `FolderBody` block gained an always-visible TLDR line (readable even while collapsed), so "what this says" no longer hides inside the click-to-expand body. The `待你拍板` string stays the shared cross-system contract constant `DECISIONS_TITLE` (never a UI string). Verified against all 13 live open folders: 0 threw, 12 rendered a card, 1 (the hand-opened prose folder #7) correctly rendered nothing. Additive only — no shared file was refactored, so the parallel F12/F13/F14 branches merge clean.

---

## F2 · Draft comments (the agent pre-screens against your background)

**What**: before the document is submitted, the agent reads it once through "Charlie's eyes" — he's a programmer, he's working on project X, he cares about Y — and pre-annotates the likely problems onto the corresponding sentences. When you open it, a column of grey draft comments is already waiting in the rail.

**Why**: this is **the one thing Google Docs, GitHub and Notion cannot do**. They can all give you a better comment UI, but none of them can read the document for you before you read it. Your time bottleneck was never "writing comments" — it's "spotting what to comment on."

**How**: when submitting, the agent also runs a background-aware review and posts the results as **ordinary inline comments** on the PR, with a `臣拟` (draft) marker in the body (e.g. a first line of `> 臣拟`). menxia recognizes the marker on render and shows them on a grey background, one visual tier below a real 涂归. **Still no LLM calls in the app.**

**Where the background comes from**: a `background.md` (profession, active projects, technical preferences, what he cares most about in review) that lives in the review repo and the agent reads every time. Most of this already exists in memory and can be exported directly.

**Risk to defend against**: pre-filled comments **anchor your judgment** — people who see a ready-made opinion tend to nod along and think less. Mitigation: draft comments collapse to a one-line title by default, and you expand them only after your own read-through; or offer a "blindfold first" toggle. Don't build F2 until this is solved.

**✅ Decided (2026-07-31, reading folder #15 annotations)**: the anchoring mitigation is the "blindfold first" toggle — draft comments stay covered as a column until you've done your own pass, then uncover. One added implementation requirement: **configurable review** — when submitting a folder, the draft review's type and model are configurable: type by document nature (code / design / etc., each with its own review lens), model selectable (Fable, GPT 5.6, Gemini, ...). Configuration and invocation live entirely on the agent side; the desk still renders by marker only — the architectural boundary stays put.

---

## F3 · One-tap accept / plus-one

**What**: buttons next to each draft comment — **准** (accept, converts it into a real 涂归 and submits it), **加一** (plus-one, adds your own sentence on top of it), **驳** (reject, discards it). No typing.

**Why**: F2's value only materializes when the **cost of adoption is ≈ 0**. If you have to retype it, it didn't help.

**How**: pure frontend + GitHub API — **准** = repost the draft comment's content as a real 涂归 (or add a 👍 reaction to the original comment and mark it adopted); **加一** = open the comment box pre-filled with the quote; **驳** = hide locally and log one negative signal (usable for improving F2's prompt).

**Undecided**: does **准** become a new comment under your name, or does it stamp an "approved" marker on the draft comment? The former is clearer for the agent (it only recognizes real 涂归), the latter is less work. Leaning toward the former.

**✅ Decided (2026-07-31, reading folder #15 annotations)**: the former — 准 converts the draft into a formal annotation under Charlie's name (the agent keeps recognizing only formal annotations; semantics unchanged). Folded into F2's implementation scope, not scheduled separately.

---

## Architectural boundary (a shared premise for F1–F3, settled up front)

SPEC §3's non-goals say "AI integration — the review-loop skill owns the agent side entirely; menxia doesn't know AI exists." F1–F3 look like a violation of that but don't have to be:

**All intelligence is computed offline on the agent side and arrives as ordinary GitHub data (PR body / inline comments); menxia only recognizes markers and renders them appropriately.**

That preserves three things: ① menxia stays a zero-backend static site with no API key in the browser; ② the agent can swap models or prompts without touching the frontend; ③ if menxia goes down, the draft comments are still visible on GitHub.

The cost: no "ask a question halfway through reading" style real-time interaction — that needs LLM calls inside the app, which is a different order of product (either a backend, or users bringing their own API key). When it's genuinely needed, evaluate it against the trigger conditions for option C in SPEC §8.1.

---

## F4 · Revision browsing and diff between revisions (raised verbally 2026-07-26, recorded for alignment)

**Record correction**: decision ② settled that v0 does **not** build a "v1→v2 comparison view"; the north-star diff document is about the old and new sides of a *code* PR, not a comparison between document versions. So "browse revs / diff between revs" is currently **not** in any scheduled milestone — but the foundation is already there: every revision round is a commit on the PR branch, and `getFileText(path, ref)` has always accepted an arbitrary commit SHA. All that's missing is the UI entry point.

Three tiers, cheapest to most expensive:

1. **Rev switching** (~hours): list historical versions via the PR commits API, add a version dropdown to the reading page, render any old version. Read-only, no comparison. — **✅ 2026-07-26, decided into M3**, no longer backlog.
2. **Source diff between revs** (~half a day): pick any two revs, reuse the north star's split-view component to show a diff of the markdown **source**. The component is free; the cost is that you're looking at source, not rendered text (one tier worse to read, but cheap).
3. **Rendered track-changes** (expensive): highlight changed paragraphs in the rendered view — this is option B from decision ②, and it needs a paragraph-level diff algorithm plus UI.

**Trigger for tiers 2/3**: after rev switching ships, if "I flipped through old revisions and still couldn't find the change" happens ≥ 3 times in real use, build tier 2. Tier 3 only if the first two are proven not to satisfy.

---

## F5 · Assign a reviewer and sign-off

**What**: assign a document to someone else (a colleague / 惠雪 / larry / a future team) to read and **sign off**, with 画可 blocked until they have. Grows from a single-person review desk into an accountable review process.

**Why record it and not build it**: every design premise in v0 is single-person (涂归 / 判 / 画可 are all "your own actions"), and assigning a reviewer touches the identity model, the permission model and the UI semantics at once — it's not a button. But it's the first door from "my tool" to "usable by someone else", which is worth holding a place for.

**The interesting reversal**: the entire 画可 button exists because **GitHub won't let an author approve their own PR** (hit on day one of the pilot; first line in PAIN.md). But **other people can approve** — so the moment F5 lands, GitHub's native review approval mechanism becomes available: a sign-off is a review with `event: 'APPROVE'`, and its state is natively queryable (`GET /pulls/{n}/reviews` with state=APPROVED). **No need to invent our own sign-off storage**, which keeps the "state lives in GitHub, menxia is just a lens" boundary intact.

**How (draft)**:
- Assigning: `POST /pulls/{n}/requested_reviewers` (the other person needs read access to the repo — for a private repo, either add them as a collaborator or route collaborative documents through a different repo). UI: a "request review from…" control in the document header.
- Signing: the assignee reads it in their own menxia → a 准奏 button = `event: 'APPROVE'`; rejection = `REQUEST_CHANGES`. submitReview already supports both event values; only the UI is missing.
- Status: the list page shows each document's signature state (awaiting your comments / awaiting so-and-so's signature / approved N/M); **on documents marked "signature required", 画可 is disabled until signed** (a soft gate, judged locally, not branch protection).
- Optional hard gate: if you truly want it un-bypassable, turn on GitHub branch protection's required approvals — that's a repo setting, not an app feature, and it needs zero code.

**To decide (only when actually building)**: ① identity — is it enough that someone opens the same menxia site with their own GitHub token (the app has no user system, so it's natively multi-user), or does it need to know "who is the current user" to decide which buttons to show? (The former is nearly free: `GET /user` for the login is enough.) ② how do outsiders get read access to a private review repo, or do collaborative documents get their own repo? ③ is signing mandatory — default optional, with only documents marked "signature required" gating 画可.

**Where it sits**: after v1 (mobile + PWA), near the north star (diff documents); not before the single-person flow has been worn smooth by real use.

---

## F6 · Cross-document links (2026-07-27 ✅ done)

**What was built**: **same-repo GitHub permalinks** inside documents and comments are intercepted by menxia and turned into in-app navigation (open the document + scroll to that block + flash it); external links open in a new window as usual. A "quote this" control in the top bar copies the current selection as `[「quote」](permalink)`, and pasting it into another comment makes it a link.

**Why native GitHub permalinks instead of inventing `[[wikilinks]]`**: a private syntax would render as garbage on GitHub and the agent would have to learn it — which severs the "data lives in GitHub, menxia is just a lens" root. With permalinks: normal links on GitHub, readable by the agent, and menxia merely **intercepts** them. The link graph isn't new data, it's an ordinary URL in markdown.

**Explicitly not built: inline previews** (hover/expand to see the target's content). The risks are recursion (A embeds B, B embeds A) and snapshot staleness (once the target is revised, is the embed the old one or the live one?). Revisit once links are actually being used.

**Known trade-off**: links drift as their target is revised — which is why "quote this" copies a **link with the quotation attached**, so even after drift you still know which sentence it originally pointed at (the same quoted-fallback philosophy as anchoring).

---

## F7 · External deep links (2026-07-27 ✅ done)

**What**: reach a specific document in one step from **outside** menxia — `.../menxia/?pr=13`, narrowing to document and line when needed.

**Why**: today an agent that has just submitted a document can only say "go find document 13 in the list" — there's no clickable link to give. Hit in real use on 2026-07-27: the agent finished submitting and handed over a GitHub link, Charlie opened it and found "this isn't zhupi" — **because outside the home list, zhupi had no shareable URL at all**. Once there are more documents, every hand-off means hunting by hand; and every scenario where you arrive from a phone notification / WeChat / email is broken too. (朱批/zhupi are legacy terms, changed 7/31)

**Why it's cheap**: F6 already did the hard part — `link.js`'s `parseZhupiLink()` already parses same-repo permalinks into `{prNumber, path, line}`, and `buildRef()` already generates them in reverse. What's missing is just **reading the URL parameters once at startup** and then walking the same navigation path. Two possible shapes (leaning toward taking both):

- `?pr=13`, `?pr=13&path=docs/a.md&line=42` — short, easy to say, easy for the agent to assemble
- `?ref=<GitHub permalink>` — feed in the three link shapes F6 already recognizes, zero new syntax

**Alongside**: the address bar should update with the current document/position (`history.replaceState`), which makes browser bookmarks and ⌘L "copy current address" work for free; "quote this" in the top bar can offer a "copy menxia deep link" shape as well.

**Undecided**: does a shared link point at "this document" or "this sentence in this document" — the latter means encoding anchor information into the URL, consistent with F6's quoted-fallback philosophy, but the URL gets long. Leaning toward: document by default, line number only when there's a selection.

**What was built (both shapes taken)**: `?pr=13`, `?pr=13&path=docs/a.md&line=42`, and `?ref=<GitHub permalink>` (reusing F6's parser, zero new syntax). It navigates on arrival, and an archived document automatically switches to the "已画可" (merged) tab; a link pointing at a nonexistent document says so instead of showing a blank page. The address bar follows the current document/file (`replaceState`, so it doesn't pollute the back button), which makes ⌘L and bookmarks work natively. "Quote this" now copies a **menxia deep link** by default (click it and you land in the app, on that block); hold Alt to copy the GitHub permalink instead.

**Scheduling postscript**: the entry originally read "M2/M3 loop comes first, only jump the queue if it really has to" — that sentence was already stale when written (all three v0 milestones finished that same day; there was no queue in front of it). It was built directly as suggested, in about an hour, matching the estimate.

---

## F8 · Language switching (中/EN tabs on bilingual documents) (2026-07-27 ✅ done)

**What**: when a document exists in both Chinese and English, put a `中 / EN` toggle at the top of it — one tap swaps language without leaving the document. Chinese by default, remembers your last choice.

**Why**: hit in real use on 2026-07-27 (PR #12 conversation comment, verbatim: "this bilingual thing gives me a headache, can it be like a GitHub readme where I can switch languages"). All of Charlie's project docs are bilingual (English for the outside world, Chinese for himself), but **bilingual serves "two kinds of reader", not "one reader reading it twice"** — when EN and Chinese alternate paragraph by paragraph, the Chinese reader spends the whole document filtering out half of it with their eyes. Pure noise. Filed as bug/friction, not a new feature during the freeze.

**How**: follow the GitHub README multi-language convention — within one document, `foo.md` (English) and `foo.zh-CN.md` (Chinese) are language variants of each other. menxia already has the full file list for a document, so detection is a single rule: "same basename + `.zh-CN` suffix". On a hit, render a switcher chip in the document header; on a miss, treat it as an ordinary multi-file document. This repo's own `README.md` / `README.zh-CN.md` is a ready-made example.

**Why not do "bilingual document language filtering" inside the app**: parsing interleaved bilingual prose means guessing (which paragraph is English, which is Chinese, how headings pair up) — fragile and guaranteed to misfire eventually. Leave the splitting on the **content side** (the agent writes two cross-linked files in the first place, now promoted to the default), and let menxia do **view switching** only — consistent with the "intelligence lives agent-side, menxia is just a lens" boundary.

**Which file a comment belongs to**: 涂归 anchors on path+line, so a comment made on the Chinese version lands on the Chinese file — which is correct, and comments do not need to sync across languages. But one thing to think through: **will the same point get commented once on each version?** Current judgment is no (he only reads the Chinese version); revisit if it actually happens.

**What was built**: detection is exactly one rule — same basename + `.zh-CN` suffix (`foo.md` ↔ `foo.zh-CN.md`). On a hit, a `中 / EN` chip appears in the document header; switching only swaps the language variant and never leaves the document. The preference is stored in localStorage, defaults to Chinese, and picks the first file by preference when the document opens. **Paired files are listed once in the document tabs** (otherwise having both side by side just moves the noise from the body into the tab bar) — the label drops the language suffix, and language is expressed by the chip. Single-language documents behave exactly as before, with no extra controls.

**How the open questions were resolved**: ① after switching you land at the top of the same file (no heading-index position alignment — that only works if both versions are structurally identical, and it isn't worth the complexity) ② the list page doesn't mark "has bilingual" (the chip already says so inside the document; marking it in the list is redundant) ③ the English version isn't hidden, it's just not selected by default.

**Original open questions, verbatim**: ① after switching, stay at the same paragraph or return to the top (ideally align by heading index, but that requires both versions to be structurally identical, which may not be worth the complexity) ② should the list page mark a document as "bilingual" ③ should the English version be hidden from Charlie by default and appear only when he switches to it.

## F9 · Back to the conversation (jump to the Happy session that submitted the document) (2026-07-27 ✅ done)

**What**: a persistent "back to conversation" button in the document's top bar; clicking it opens the Happy session that submitted this document.

**Why**: after commenting you have to go back and tell the agent "read the comments" — and the agent has dozens of sessions. Finding the right one by hand is slow and frequently wrong: comments written, then stuck on "who do I send this to."

**How**: two halves, neither requiring changes to Happy. When submitting, the agent embeds its own Happy session id into the PR body as an HTML comment line, `<!-- happy-session: <id> -->` (the id comes from `~/.claude/skills/review-loop/happy-session-id.sh`: walk up the ppid chain and match against the `hostPid` recorded for each session in `~/.happy/sessions.json`). menxia's `parseHappySession()` recognizes it in the body and renders a button pointing at `…/happy/session/<id>`. Happy's web deployment has a `404.html` SPA fallback, so the deep link goes straight into the session.

**Trade-offs**: ① **no auto-jump** — submitting comments doesn't hijack the page, it just leaves the button there (decided 2026-07-27: minimal change, and he often comments on several documents in a row) ② a comment rather than a visible link: takes no space on GitHub, and the agent only has to append one line ③ the marker can also hold a full URL, so anyone forking and self-hosting Happy doesn't need code changes.

**Known gap**: the session may have been reaped or exited long ago, in which case the link is archive-only and the conversation can't be resumed — menxia has no Happy API and can't tell whether it's alive, so it only says so in the tooltip. A real fix requires Happy to support resume deep links.

---

## F10 · Push one line when a document arrives (GitHub Actions, no backend)

**What**: the agent submits a document → a notification lands on the phone, instead of relying on you remembering to refresh the list.

**Why no backend**: add one workflow to the review repo (`on: pull_request: [opened]`) → `curl` to ntfy (Charlie already runs `charlie-claude-notify-*`). Zero frontend change, because the notification never passes through the app. Cost 0, maintenance surface = a 15-line yml.

**Trade-off**: Actions runs at minute scale — but "a document is waiting" was never a second-scale need. If that delay causes ≥3 real misses, that is trigger S3 in SPEC §8.2.

**Note**: this does not contradict the rejected attention inbox. What was rejected was "pile every AI output into a feed"; this pushes exactly one thing: a document is waiting for you. Only that class gets interrupt rights.

---

## F11 · Cross-device drafts: use GitHub's native pending review

**What**: comments you half-wrote on the desktop should be there when you open the phone.

**Finding** (the biggest surprise of the 2026-07-28 backend evaluation): **GitHub already has this and we weren't using it.** `POST /pulls/{n}/reviews` without an `event` creates a **pending review** — you can append comments later and submit at the end. That is a server-side draft: cross-device by nature, owned by the same PR, and visible to the agent side.

**Also kills**: the localStorage quota bomb (the blocking finding from round six). Drafts stop being the only local data that can't be regenerated.

**Cost**: merge semantics between local drafts and the server-side pending review (what if the same comment exists in both, what happens offline). Moderate complexity — but **no new infrastructure at all**.

**Open**: replace local drafts entirely, or keep local as an offline cache that syncs when online? Leaning towards the latter — being able to annotate offline is a real advantage today; don't lose it.

---

## Backend evaluation, 2026-07-28

**Verdict: don't build one.** Full evaluation lives in the review repo at `docs/zhupi-thin-backend-eval.md` (PR #16). Three of the four candidate capabilities are solvable in the pure-static tier: push → F10; cross-device drafts → F11; multi-person sign-off → already analysed in F5 (menxia has no user system, so it is multi-user by nature; sign-off uses GitHub's native APPROVE; the barrier is repo permissions, not a backend). The only one genuinely needing a hosted secret — in-app live Q&A — is an unvalidated need.

Triggers S1–S4 are recorded in SPEC §8.2; from here on, "should we add a backend" is closed by citing that section.

---

## F12 · 携卷 — carry-out context, one tap for any agent (2026-07-31, from eval folder #60)

**What**: a 携卷 button next to 回奏: one tap assembles the current folder into a self-contained markdown bundle — folder number + title + full document text + every annotation thread (quote, comment, replies) + decisions pending — and puts it on the clipboard, ready to paste into **any** agent to continue the work.

**Why**: 回奏 bets on "that session is still alive"; the 2026-07-29 verdict already said the real backstop is self-contained documents, and 携卷 turns that verdict into a product. The clipboard is the one integration every agent supports, so it also cashes the "cross-harness has zero consumers" benefit the MCP side downgraded — at zero integration cost. Proposed by Charlie on #60.

**How**: pure frontend assembly — pr / docs / threads are all in memory already; no new data, no extra API calls.

**Status**: approved on #60; recorded during the freeze per F10/F11 precedent, build after the 8/8 reckoning. → 2026-07-31 built ahead of schedule and merged (Charlie called it — not waiting for 8/8).

**What was built**: a `携卷` ghost button in the top bar, right after `回奏` (shown whenever a folder is open, archived folders included). Assembly lives in a standalone pure module `src/carry.js` (`assembleCarry`), unit-tested in `test/carry.test.js`. The bundle carries: a header (folder number / title / PR link / menxia deep link / assembly time / counts), the PR body verbatim (TL;DR, 待你拍板, …), every document's full text (all `.md` files, both variants of a bilingual pair, each labelled 中文/English), every annotation thread (quote + file/line + comment + all replies) sorted by document position then line — outdated (drifted) and orphan threads sink to the end — the 判 total-review comments (newest first), and a decisions-pending summary at the tail. Document bodies and the PR body are delimited by horizontal rules rather than wrapped in an outer fence, so a document's own ` ``` ` fences never break. `ui.js` `carryOut()` back-fills each document's text through the existing `getFileText` path (docs hold only metadata; text is lazy-loaded) at the currently-read revision — no new API surface. Clipboard write goes through `navigator.clipboard.writeText`; on failure (large 100 KB+ bundles, insecure context) it falls back to a selectable, auto-focused `<textarea>` overlay for manual ⌘A/⌘C. The button reports `已携卷 N 字` so the user sees the size for big folders.

---

## F13 · "Needs verification" marker rendering (2026-07-31, from eval folder #60)

**What**: agents mark unverified claims inline with a fixed token (e.g. 【需核实】); the reader recognizes it and renders a visible state (dashed underline + corner tag) plus a per-folder count on the list page; the write-side lint adds a warn so the count is known at submit time.

**Why**: unverified claims are the single most distinctive property of AI-authored text, and the reader currently does nothing with them (#60: "untrustworthiness and volume — both untouched"). The convention already half-exists — the outsourced-research house rules require the marker; the reader just can't see it.

**How**: same pattern as F2's 臣拟 marker — intelligence stays agent-side, menxia only recognizes a token and renders it. Fits the architectural boundary above.

**Status**: approved on #60, after F1; build after the 8/8 reckoning. → 2026-07-31 built ahead of schedule and merged (Charlie called it — not waiting for 8/8).

**What was built** (reader side only; write-side lint stays with menxia-mcp):

- New pure module `src/verify.js`. `countVerifyMarkers(text)` is the single source of truth for what counts; `decorateVerifyMarkers(root)` does the rendering.
- **Token recognition** (fixed token, no fuzzy matching — two accepted forms):
  - `【需核实】` — the bracket marker itself
  - `需核实：` / `需核实:` — the marker followed immediately by a full/half-width colon (the colon-explanation form) also counts as one hit
  - Nothing else counts. Bare `需核实` with no colon/brackets (e.g. a question "需核实吗") does not, to avoid diluting the signal.
  - **Fenced code blocks (``` / ~~~, 0–3 space indent) and inline code (`` `...` ``) are excluded** — a token there is an example, not a claim. Nailed down in unit tests.
- **Rendering stays in the pure-text layer — `render.js`'s `html:false` is untouched.** `decorateVerifyMarkers` walks text nodes with a `TreeWalker` (skipping `<code>`/`<pre>`) and wraps each match in `<span class="verify-marker" title=…>` + a `<sup class="verify-tag">?</sup>` corner tag, via `createTextNode`/`createElement` only — zero raw-HTML injection. Called right after `el.innerHTML = renderMarkdown(text)` in `ui.js`. CSS: dashed cinnabar underline + small superscript tag.
- **Reading page**: the topbar breadcrumb shows a "需核实 N" count for the open document (0 → hidden).
- **List page**: each folder card shows a "⚑ N" count badge (0 or not-yet-counted → hidden). The count reuses the **existing search fetch path** (`search.js` `buildIndex`, whose full-text index is already in memory after any search) — no new per-folder request is added. Bilingual pairs (`foo.md` ↔ `foo.zh-CN.md`) are grouped by base and counted once (max), so the same claims are not double-counted. **Tradeoff**: because that index is populated only when the user runs a search, list badges appear after the first search; folders never searched show no badge — the documented fallback (list badge is opportunistic; the reading page always shows the precise per-document count on open).
- **Tests**: `test/verify.test.js` (11 unit cases: bracket hit, colon variant, fuzzy-negative, no-marker, multi-marker, fenced-block excluded, `~~~`/indent, inline-code excluded, lone backtick). Demo doc carries one marker as a browser smoke target; 2 smoke assertions added (`verify-marker-rendered`, `verify-count-in-topbar`). Full suite green: 126 unit + 22 DOM + 65 smoke.

---

## F14 · TOC / tiered reading for long folders (2026-07-31 ✅ done)

**What**: a floating outline generated from headings on the reading page; multi-chapter folders (#31: 22 chapters) get a chapter list view.

**Why**: volume is the other half of the #60 gap — a 22-chapter book is unnavigable without an outline.

**How**: headings already carry `data-line` in the rendered DOM; pure frontend.

**Status**: approved on #60, after F1; build after the 8/8 reckoning. → 2026-07-31 built ahead of schedule and merged (Charlie called it — not waiting for 8/8).

**What was built** (both halves — volume and length):

*Floating outline (length).* A right-edge fixed rail extracts the document's `h1/h2/h3` (the same levels `anchor.js` already treats as sections) straight from the rendered DOM via `data-line` — no change to the render pipeline. Items are indented by level, clicking one jumps to that block, and a **scroll-spy** highlight follows the current reading position. It only appears when the document has **≥ 3 headings** (short documents stay quiet — no noise), and only on viewports **≥ 1500px** wide, where the rail at `right:0` provably clears the content block (sidebar 300 + content ~1040) and therefore never overlaps the right-margin annotation column; below that width it simply doesn't render (narrow screens aren't broken, just no rail). It's collapsible.

*Chapter list (volume).* When a folder has **more than 7 visible chapters**, the wrapping doc-tab strip is replaced by a compact chapter dropdown (native `details/summary`) that lists every chapter with its number and jumps on click. The count and the list reuse **F8's bilingual pairing** (`lang.js` `visibleDocs`/`langPairs`) verbatim, so `foo.md` ↔ `foo.zh-CN.md` collapse to one chapter and the current chapter stays highlighted across a language switch. The 7-chapter threshold is where the pill strip starts wrapping to a second row and loses its one-glance overview — below it, tabs are unchanged (the demo folder's 2 chapters keep the tabs, so the end-to-end smoke path is untouched).

*Coexistence.* Jumping reuses the existing search/deep-link scroll-to-line path (`data-line ≤ target`, flash), not a second locator. Scroll-spy only **reads** heading geometry (`getBoundingClientRect`), writes no layout, and the outline is `position: fixed` (out of flow), so `layoutCards`' block-top measurements and the annotation-card anchoring are untouched. New logic lives in two new files (`src/toc.js` pure logic + `src/components/outline.js` view); the touch on `ui.js` is additive (imports, two derived values, one memo, one jump helper, a conditional tab/dropdown swap, and one `<Outline>` render). Extraction, scroll-spy math, and bilingual chapter pairing are unit-tested in `test/toc.test.js` (13 cases).

---

## F15 · Check `mergeable` before the merge button (turn the 405 into a sentence) (2026-07-31, hit for real)

**What**: know whether a folder can still be merged *before* pressing the merge button. If it can't, say "this conflicts with main" and point at what collided — instead of surfacing GitHub's raw `405 Method Not Allowed`.

**Why**: hit for real on 2026-07-31 — merging #35 failed and the UI showed only "405 — Pull Request has merge conflicts". Technically accurate (the merge API returns 405 for any unmergeable PR), but it leaves "so what do I do now" entirely to the reader. The actual story: that PR was opened on 07-30, main then absorbed 31 commits — one batch of which **redid the same backfill** — and 20 files collided add/add, leaving half the PR redundant. None of that was on screen. **Conflicts are not an edge case**: the longer a folder stays open the more certain they get, and long-lived folders are exactly the ones that most need merging.

**How**: `mergeable` is **not returned by the list API**, so today's `listOpen`/`listArchived` never see it; it needs one `GET /pulls/{num}` when a folder is opened (**a genuinely new call, not a free ride** — `github.js` currently only fetches files/comments/commits for a single PR). Then: (1) grey out the merge button and mark "has conflicts" when `mergeable === false`; (2) show a plain-language line pointing at GitHub's conflict view.

**Trap**: GitHub computes `mergeable` **asynchronously** — right after a push it returns `null`, meaning "still computing". `null` must be treated as unknown (button stays live, failure still falls through to today's error path) and **never as false**, or the merge button locks up exactly when the agent has just pushed a new revision.

**Cost**: one extra API call per folder, plus a non-awkward way to render the `null` state.

**Status**: classified as **friction**, not a new feature (the user is blocked and can't tell what to do next), so the 08-08 feature freeze does not apply.

---

## F17 · 弘文馆 (Hongwenguan) — reading material stays out of the review queue (2026-08-02 ✅ built; criterion revised 2026-08-05 per #69)

**What**: reading-type folders (finished research, study material, long-form writing) still arrive in 门下, but they are not todos — no nagging, no counting — while rendering, inline comments, conversation comments and merge all work exactly as before.

**Why**: 门下's semantics were "open PR = review queue = you owe someone an action", which left reading material homeless: submit it and it masquerades as a chore; file it in the vault instead and you lose the whole annotate-by-sentence machine. On the day the criterion was settled, 10 of the 20 open folders were reading material — half the "queue" was stuff nobody should be nagged about.

**How**: read-side only. `labels` already ship in the list endpoint's response, so `src/track.js` merely reads them to group — not one extra byte over the wire.

**Status**: design folder #69 (submitted 08-02) → implementation ran ahead (shelf split 08-02, promoted to a third tab 08-03) → #69 merged 2026-08-05 with all four decisions settled.

**What got built**:

*Grouping.* `splitShelf` cuts the queue in two; 弘文馆 is the third sidebar tab alongside "queue" and "merged", carrying its own count and **staying out of the queue count**, with both tab and cards held at reduced opacity. Shelved cards get an extra kind chip. An empty shelf gets a sentence, not a blank panel.

*The position changed once.* The first version was a collapsible block at the bottom of the queue list. The bug report, verbatim: "there's a 弘文馆 in the bottom left, but there's nothing in it when I open it" — once the list is long, everything the block expands is below the fold. Promoting it to a tab also flipped one assertion: a tab is **navigation**, not decoration, so it stays put at a count of zero rather than blinking in and out with inventory.

*Criterion (settled in #69).* `kind:读物` — the shelf is organised by *what a thing is*, not by *who it waits on*. (The submission recommended `wait:闲`; he picked kind. Across all 20 folders at the time the two criteria coincided 100%, so the switch is behaviourally free.) **Plus one valve: `wait:你拍` / `wait:你读` always stay in the queue**, because kind on its own has a silent-failure surface — #7 "reading: two outbound drafts (they go out over your name, read them first)" is kind 读物 yet gated on his sign-off before it can be sent. For the same reason **unlabelled folders always stay in the queue**: hiding a folder because a label was missed is this feature's one genuinely dangerous move, and nobody goes looking for what got hidden. Better to over-nag than to hide silently.

*Destination.* Merging a reading folder means "finished reading": the final text is delivered to the vault under `Hang/读物/` and gets a line in that README's index. 门下 is the **currently-reading surface**, the vault is the **finished library** — any one piece lives in exactly one of them at a time, so there is no double-write and no drift.

**Not done**: zero write-side changes — `kind:读物` and the "reading defaults to `wait:闲`" rule already existed in menxia-mcp, and `trackAudit`'s drift check only ever watched `wait:你拍/你读`, so idle folders were never nagged in the first place. The UI string table is Chinese-only rather than i18n, which retires the design folder's "bilingual `strings.js` UI strings" line automatically.

---

## F18 · Tags v2 — apply/remove tags in the UI + tag management (2026-08-08, from #116; v1 shipped)

**v1 shipped (2026-08-08, 97ab86d)**: a fourth label family `签:`. Card chips (all three lists), the tag chip bar (union across open+merged, with counts), the by-tag view (**open and merged folders on one shelf**, `?qian=` deep link, clear restores the three tabs); smoke 101→106. All 116 existing folders processed: 65 backfilled via the proj→tag mapping, 51 pre-track folders classified by agy from titles alone (its two honest ?s adjudicated locally from bodies) and then labeled — the only untagged folder is #30. The write side (menxia-mcp) merged `track.qian` the same day; **going live is tracked on that repo's own books** (see the "criterion NOT met" row in its MILESTONES).

**v2 wants**: ① apply/remove a tag while reading — one tap on the list card or folder head, without visiting GitHub; ② tag management — rename/merge; an untagged-folder audit rides on `audit_folders`' trackNotes checks.

**Precondition (test before building)**: the current PAT has only Contents + Pull requests ticked (SPEC §5); whether `POST /repos/{o}/{r}/issues/{n}/labels` passes under a fine-grained PAT **needs a live test**. If not, re-issue the PAT with one more box — that touches the phone's localStorage, a "touches your device" change, which is exactly why this sits in v2.

**Boundary**: the app stays zero-backend and never calls an LLM; this is the single write endpoint, and on failure it degrades to a "do it on GitHub" notice — no retries, no queue.

---

## F16 · Overview: folders laid out by project, who waits on whom, what supersedes what (2026-07-31 ✅ done)

**What**: An "overview" view beside the list — open folders grouped by `proj:`, each with a "waiting on" dot (you-decide / you-read / agent / idle), and inter-folder relations drawn as clickable chips: `superseded by #N · skip it`, `waiting on #N`, `#N merged · unblocked`, `will be superseded by #N`, `merging unblocks: …`. (The sidebar's open list also grouping by project was **not** carried over in this port — the list has since grown the tag/弘文馆 view layers that compete with grouping; left for a follow-up.)

**Why**: Charlie, 2026-07-31, verbatim: "A pile of folders waiting for me to read. I don't know which one blocks which, or whether one from two days ago was already covered by something approved later." The list sorts by time, which answers neither question. That day's live case: #58's two pending decisions had already been covered by #59, with no trace on either folder — it sat in the review queue for a full day for nothing.

**How**: All data lives on native GitHub objects — the three label families `proj:/kind:/wait:` plus a trailing `<!-- menxia-rel: needs=…; supersedes=…; unblocks=… -->` in the PR body, welded in by the write side's `open_folder({ track })` (approved in review #61). **Zero added requests on the read side**: labels and body were already in the `listOpenPRs` / `listMergedPRs` responses and were being discarded. Parsing and relation analysis live in `src/track.js` (pure functions, unit-tested); the view is `src/components/dashboard.js`.

**Vocabulary contract**: this side **recognizes prefixes only, never the value set** — when the write side adds a new `kind:` or `wait:` value, this side still displays it, sorted after the known ones, and never silently drops a folder (the rename lesson, review #54: cross-system contracts are bare strings; hard-code both ends and they fail silently).

**Status**: after the F13/F14 batch Charlie waived the 8/8 freeze for this one; built and merged the same day, 2026-07-31. The audit side (zombie candidates / dependencies unlocked / wait drift / merge-ready candidates) lives in `menxia-mcp`'s `audit_folders`, sharing the same source and criteria.
