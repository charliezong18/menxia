**English** · [中文](zhupi-migration-reviews.zh-CN.md)

> **This is an archive, not the current state.** It records what was understood during the review
> rounds of 2026-07-27 / 07-28, and has not been updated since.
>
> zhupi and zhupi-mcp went through two phases afterwards: **Phase 1** turned the agent side of the desk
> into an MCP server ([#22](https://github.com/charliezong18/review/pull/22)), and **Phase 2** moved the
> folder format checks out of shell and into TS ([#34](https://github.com/charliezong18/review/pull/34)).
> Each phase ran three adversarial review rounds, and several judgements recorded here were overturned.
> **For the current state, read those two folders.**

> **What is the purpose of reading this memorial**: Rewrite fidelity audit. 19 historical fixes verified item by item with zero loss, double-blind each caught a blocking finding missed by the other (long document unscrollable / switching cards during editing loses words) - this round best explains why "implementer ≠ reviewer" is valuable.

# zhupi A→B Migration Dual-track Review Full Text (2026-07-26 · 3rd Round · Rewrite Fidelity Audit)

Review object: The whole rewrite from vanilla JS → Preact (htm/preact standalone build-free form). The particularity of the third round: **The number one risk of rewrite-type changes is "things fixed quietly get lost"**, the primary task of both reviewers is to take the 19-item historical fix checklist and verify their survival one by one (Fable uses `git show HEAD~3:` to pull old code for word-by-word comparison; agy independently verifies 13 items).

**Cross-validation points**:
- **None of the 19 fixes were lost** - independently confirmed by two tracks (Fable fully checked 19 items + anchor.js extracted fidelity word-by-word level; agy independently confirmed 13 items). 2.5 places "weakened" (floating button put-away surface narrowed, 钦此 (so ordered) draft fallback text deleted, ⑥ text endnote) have been restored with fixes.
- Double-track collision: demo mode "Settings·Key" clears real token.
- **Each caught a blocking finding missed by the other**: Fable caught `#root` height broken chain (long document unscrollable, headless tested pinned dead, demo short document smoke test couldn't catch it); agy caught switching cards during editing loses words (textarea unmount swallows unsaved annotations). The value of double-blind is most completely reflected in this round.
- Fable's correction of my one false claim: style.css is not "untouched" (.zhupi-float absolute→fixed one line, change is correct but the statement does not hold).
- Actions: 9 items fixed and deployed that night; demo document lengthened + `[smoke] work-scrollable` assertion into permanent smoke target (actual test scrollH 1902 > clientH 744 ✅).

---

# I. Fable 5 Review (Fidelity Audit + Preact-ification New Defects)

## Overall Comment

19 fixes **none lost** (2.5 places weakened), anchor.js extraction fidelity is word-by-word level. But the migration introduced a **blocking-level layout defect that demo short documents cannot test out** (long documents cannot scroll), plus a family of "switch memorial window" degradation. Seam claims have one falsehood: **style.css touched one line** (`.zhupi-float` absolute→fixed, the change itself is self-consistent with the new fixed+viewport coordinate scheme, and is correct, but the "untouched" statement does not hold); github.js / render.js zero diff is true.

## Checklist 1: 19 Items Survival Judgment

| # | Item | Judgment | Location and Basis |
|---|---|---|---|
| ① | ⌘Enter bubbling guard | Survived | ui.js global `closest('textarea, input')` exclusion + stopPropagation inside card, double insurance both present |
| ② | commit_id | Survived | ui.js → github.js (zero diff) |
| ③ | Draft saves ref + stale downgrade | Survived | `ref: c.pr.head.sha`; `stale = d.ref !== ref` → fallback conversation comment |
| ④ | Completion callback entry snapshot | Survived | Snapshot prNumber/ref; clear corresponding key; only touch memory if world hasn't changed. Note: newly added drafts while submission is in transit will be cleared together - old version has same disease word for word, not introduced by migration |
| ⑤ | body constantly non-empty | Survived | — |
| ⑥ | Forbid submission during editing | Survived | Inside submitAll + global keydown guard dual paths both there; text is missing half a sentence of old version endnote, mechanism complete |
| ⑦ | Floating annotation button scroll capture hide | Survived (weakened) | capture path is there; but old version had another global mousedown to collect button, new version lost it, and mouseup exclusion list expanded to aside/.mainbar → N6 |
| ⑧ | Switch tab race condition | Survived (true equivalent) | Old ++generation synchronous check; new = island effect `dead` flag + cleanup. Double click two tabs old response must be discarded; residual ~1 frame window first injected then immediately overwritten - self-heals harmlessly |
| ⑨ | Word collision in-block offset | Survived | anchor.js word for word identical with old version |
| ⑩ | 钦此 (so ordered) three pieces | Survived (one place weakened) | confirm reports unpresented count (data source localStorage→memory, equivalent under dual write); merge passes sha; draft=false after markReady. Weakened: draft memorial exclusive fallback text was deleted to generic "钦此 (so ordered) failed" |
| ⑪ | ResizeObserver reflow | Survived | `[docTick === 0]` boolean dependency behavior see new defect analysis for details (self-healing holds) |
| ⑫ | 401/403 shunting | Survived | ApiError zero diff; tokenDead clears key, rateLimited only prompts |
| ⑬ | Error not into innerHTML | Survived, no bypass | htm interpolation goes through TextNode (architecture guaranteed); island error path textContent; only innerHTML is renderMarkdown and html:false |
| ⑭ | Multiple md document tabs | Survived | — |
| ⑮ | Private repo image goes blob | Survived | Zero diff + wiring correct |
| ⑯ | listPRFiles pagination | Survived | Zero diff |
| ⑰ | Key verification layering | Survived | Three layers of probing + exclusive on-the-spot error reporting when lacking Pull requests |
| ⑱ | CSP including img https: | Survived | Byte for byte identical to old version; markdown-it (classic sync) executes before deferred module, window.markdownit timing correct |
| ⑲ | Path segment encoding | Survived | Zero diff |

**anchor.js extraction fidelity**: closestLine / computeAnchor / rangeForDraft / rangeFromTextOffset / sectionOf / validRightLines (including trailing empty line pop and naked empty string two patches) / loadDrafts / saveDrafts / fmtDraft are word for word identical to old version, only did pure parameterization from "implicit read A.ctx → explicit parameter", plus an extra !doc null guard. Corresponds item by item with SPEC §9.1 four items. **Fidelity full marks.**

## Checklist 2: Preact-ification New Defects

**N1 【Blocking】 `#root` height chain broken → long document cannot scroll (headless tested pinned dead).** index.html newly added unstyled `<div id="root">` intermediate layer; `#app`'s percentage height references auto height's #root → resolves to auto → aside/main/.work full chain loses height, `.work` (only scrolling container) clientHeight==scrollHeight never scrollable, body overflow:hidden clips off-viewport content. Actual test: `innerH:469, appH:5018, workScrollable:false` —— memorials exceeding one screen can only read the first screen. Demo document is within one screen, smoke test cannot catch it. Concurrently #setup vertical centering fails for same reason. Fix one line: `#root { height: 100% }`.

**N2 【Must Fix】 Switching PR has no clear screen no loading, old memorial content visible whole time (clear degradation compared to old version).** Deterioration surface: highlighting and adding annotations on old content within the window will produce path:null, line number belonging to old document dirty drafts - submitting downgrades to conversation comment catching it without bombing, but the card falls into "Another N items in other documents" black hole. Interesting comparison: switching tabs in the same memorial new version actually newly added clear screen + expanding memorial... - loading was moved from switching memorials to switching tabs by migration.

**N3 【Must Fix】 loadPRs lost `!state.current` guard.** While refresh is in transit, user manually clicks a certain memorial → response comes back and bumps off the memorial the user is looking at and jumps back to the first memorial.

**N4 【Must Fix】 demo mode "Settings · Key" clears real token.** demoApi only takes over data paths, settings button directly connects to real gh. Anyone opening ?demo=1 link and clicking it → real PAT gets deleted.

**N5 【Must Fix】 Ghost "Submit annotation" button.** Rendering conditions only look at drafts.length and not cur; 钦此 (so ordered) the last memorial carrying unpresented drafts → cur=null but button shows, clicking it silently returns. Same root: successful 钦此 (so ordered) doesn't clear docErr.

**Optional**: N6 Floating button residue (clicking conversation comment etc buttons doesn't retract it); N7 List loading period shows "No memorials to be annotated at this moment" + boot one frame white screen; N8 Switching memorial window DraftCard uses old DOM to calculate section name for one frame (disappears once N2 is fixed); N9 ZongpiCard button text eats global busy (reverse credit: old version conversation comment failure would lose text, new version uncontrolled no remount conveniently fixed it); N10 demo drafts roll over into real localStorage key 999.

## Investigation Conclusions on Named Suspects (Not Becoming Defects)

R.current mirror has no expiration window (vendored preact empirically proves enqueueRender goes through microtask, when any network callback lands mirror is definitely latest; double clicking two PRs old response is correctly discarded by number criterion). Island effect dependency `[cur?.pr?.number, docPath]` relies on openPR first setDocPath(null) transiting in "refreshing same number PR new head" scenario - currently correct but is an implicit contract, suggest commenting to pin it. `[docTick === 0]` self-healing holds, belongs to clever but convoluted. Uncontrolled inputs do not lose words (defaultValue only assigned during diff; DraftCard has no remount path; layoutCards writing style.top has no conflict with vdom). No performance red lines (preact shouldComponentUpdate bailout empirically proved; typing zero rerender). demo patch self-consistent; autoAnnotate indeed takes real event path. Highlight cleanup order correct.

## Only Fix Three Things

1. **N1** (one line, without fixing the product is fundamentally unusable on real long memorials, current smoke will never test it out);
2. **N4** (one line guard, preventing data loss of "sharing demo link deletes own real key");
3. **N2 bringing along N3** (bringing back the first step of the old version + one line guard, eliminating dirty draft source and jumping memorials).

Need to verify 2 items (defaultValue assertion, ⑧ inter-frame window self-healing), both low risk, verification methods are in original text.

---

# II. agy / Gemini 3.1 Pro Review

(Opening judgment: Very high quality refactoring, pure logic layer decoupling is beautiful, original guards almost all survived.)

## Checklist A: 13 Items Survival Verification

All 13 items **survived**, gave ui.js / anchor.js / github.js / index.html locations item by item (consistent with Fable's conclusion, independent work corroborating each other). Among them ⑧ switch tab race condition judged as "equivalent solution": effect cleanup closure variable dead naturally realized the race condition block of original ++generation.

## Checklist B: Migration New Defects

1. **【Blocking】 DraftCard uncontrolled switching loses words**: While user is typing in A annotation box (unsaved annotation) and clicks B card "Modify" or highlights a new sentence → A's textarea directly unmounts degrading to div, with no onBlur save mechanism, **unsaved typing permanently lost**. Note: drafts sorting itself doesn't lose words (filter new array + key guarantees DOM reuse), only switching editing target loses.
2. **【Must Fix】 demo mode clears real token** (collided with Fable).
3. **【Must Fix】 ResizeObserver dependency `[docTick === 0]` extremely fragile**: When switching tabs the boolean doesn't flip, effect doesn't rerun, "happened to not break" solely relies on vdom reusing keyed article node - suggest changing to `[docPath]` to solidly remount.
4. Setup error branch doesn't lose inputs (judgment no hidden danger: component tree shape unchanged, uncontrolled input is reused).
5. Others confirmed no hidden dangers: demo events can penetrate to onMouseUp; no new XSS surfaces.

## Only Fix Three Things

① Annotation card blur/unmount auto saves (don't swallow long annotations) ② demo mistakenly deletes token ③ ResizeObserver dependency change to be solid.

---

# III. Action Log (All implemented on the night of 2026-07-26)

| finding | Source | Action |
|---|---|---|
| #root height chain broken, long document unscrollable (Blocking) | Fable (actual test) | ✅ `html,body,#root` uniform height:100%; demo document lengthened + `[smoke] work-scrollable` assertion into permanent smoke (retest 1902>744 ✅) |
| Switch card during editing loses words (Blocking) | agy | ✅ textarea onBlur non-empty auto saves; button inside card onMouseDown preventDefault preserves "Discard" explicit semantics |
| demo clears real token | Fable + agy | ✅ demo mode hides "Settings·Key" |
| Switch memorial no clear screen→dirty draft window | Fable | ✅ openPR immediately clears island+"Expanding memorial..." |
| loadPRs bumps the memorial user clicked by hand | Fable | ✅ `!R.current.cur` guard |
| ResizeObserver boolean dependency fragile | Fable (self-healing) + agy (Must Fix) | ✅ Dependency changed to `[docPath, docErr]` to solidly remount |
| Ghost submit button / 钦此 (so ordered) doesn't clear docErr | Fable | ✅ Added cur condition; success path clears docErr |
| 钦此 (so ordered) draft fallback text weakened (⑩) | Fable | ✅ Restored original text |
| Floating button clicking buttons doesn't retract (⑦ weakened/N6) | Fable | ✅ aside/.mainbar clicks also retract floating button |
| style.css "untouched" statement false | Fable | ✅ Record corrected (change itself correct: float absolute→fixed self-consistent with new coordinate scheme) |
| N7/N8/N9/N10 (Optional level) | Fable | ⏸ Recorded not fixing: N8 disappears with N2; N9 net gain positive (conveniently fixed old version conversation comment failure losing words); N7/N10 minute |
| "Refreshing same number PR" implicit contract relying on setDocPath(null) transit | Fable | ⏸ Add comment when M3 touches openPR |

**Three rounds of review cumulative**: M1 round 8 items fixed + M2 round 11 items fixed 1 item rejected + Migration round 9 items fixed (including 2 blockings) —— the blocking items of every round are not of the same category (403 mistakenly deletes key → ⌘Enter mistakenly sends → layout chain broken/loses words), the complementarity of the detection surface of double-blind double-track holds across all three rounds.
