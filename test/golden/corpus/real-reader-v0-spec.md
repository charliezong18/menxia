**English** · [中文](reader-v0-spec.zh-CN.md)

# zhupi v0 spec — 御笔朱批, the reading desk

In one line: the AI (the minister) submits a long document as a **folder**, you (the emperor) **annotate sentences** right on the rendered body, send the batch back in one tap, the agent replies to each one and produces the next version, and when you're satisfied you hit **钦此** (squash merge = final). Data, versions, and the whole annotation loop stay in GitHub; this app is just a lens you can take off whenever you want.

Revised per annotations (v2): added design mockups (§1), renamed to 朱批 (§2), the v1→v2 comparison view explained in plain terms (§7), a stack comparison table (§8), anchoring in plain terms (§9), a glossary (§12), references (§13). v2.2 (7/26, spoken input): switched to **desktop web first**, mobile pushed to v1 (§1 / §4 / §6 / §10). v2.3–2.4: diff-folder concept art + split view (§10 / §1).

**v2.5 (2026-07-26): all three open questions decided — ② no comparison view ③ stack A (zero-build) ④ loose anchoring accepted; added §8.1, a quantified gate for switching architecture. Spec is final; M1 starts.**

## Contents

- §1 Design mockups
- §2 Name and vocabulary
- §3 Goals / non-goals
- §4 Shape
- §5 Data and auth
- §6 Pages and interactions
- §7 Open question ②: the v1→v2 comparison view (in plain terms)
- §8 Open question ③: stack comparison
- §9 Open question ④: annotation anchoring (in plain terms)
- §10 Milestones
- §11 Risks and fallbacks
- §12 Glossary
- §13 References

## §1 Design mockups

Design language: xuan-paper ground + ink type + vermilion reserved strictly for the act of annotating; the background carries a very faint 朱丝栏 texture (the vertical ruling on memorial paper); headings and buttons in a Song serif (the emperor's voice), body text in PingFang (modern reading).

**① Desktop main view (where v0 lives)** — folder list on the left, rendered body in the middle, annotation rail along the right edge: annotations sit permanently alongside the source text (Docs-style margin comments), and each card shows the full loop, your annotation then the agent's reply; 钦此 sits top right:

![Desktop main view](../assets/mockups/4-desktop.png)

The next three are the mobile designs (v1 work — keeping the drafts on file):

**② List page, the reading queue** — one card per folder, vermilion spine on the left = waiting on you; a square seal marks status:

![List page](../assets/mockups/1-list.png)

**③ Reading page** — rendered body, annotated sentences carry a vermilion brush stroke, "submit annotations · n" pinned to the bottom:

![Reading page](../assets/mockups/2-read.png)

**④ Annotation input (mobile)** — selecting text pops a sheet up from the bottom: the quoted line (with its source line number) + a text field + save/discard:

![Annotation input](../assets/mockups/3-annotate.png)

(Mockup sources are in `assets/mockups/src/`; real development tunes from there.)

## §2 Name and vocabulary

Going with your direction, the name is **朱批 / zhupi** (full product name 御笔朱批): repo `zhupi`, site `charliezong18.github.io/zhupi`, PWA home-screen name 朱批. Alternates considered: 批红 (in the Ming system the eunuch bureau annotated on the emperor's behalf — dropped, wrong joke), 奏对, 御览 — 朱批 is the most exact: the name is literally the thing you do.

UI vocabulary mapped to what it is underneath (one vocabulary across the whole app — learn it once):

| UI term | What it is underneath |
|---|---|
| folder (奏折) | a document on an open PR in the review repo |
| inline annotation (朱批) | inline review comment (anchored to one sentence of the source) |
| conversation comment (总批) | conversation comment (a verdict on the whole folder — e.g. your numbered answers) |
| submit annotations (提交朱批) | submit the batched annotations as a single review |
| 钦此 | squash merge, final |
| discard (作罢) | throw away this half-written annotation |

The conversation comment is a first-class citizen new in v2: in both real runs you spontaneously wrote numbered-list verdicts, so that habit goes straight into the product instead of staying a fallback.

## §3 Goals / non-goals

Goals (all of v0):

- Read AI-produced markdown comfortably on a phone — rendered, not diff source
- Annotate sentences as you read + write a conversation comment any time, then send the batch back in one tap
- A 钦此 button you can actually press
- Kill the known PAINs one by one:

| PAIN (from the pilot runs) | How zhupi fixes it |
|---|---|
| approve blocked because you're the author | built-in 钦此 = merge |
| the annotation entry point isn't discoverable | select text and you're annotating; it's the only primary interaction |
| markdown diffs don't render | rendered view only |
| external links 404 once the session drops | renders in-app + PWA, never jumps to an external link |

Non-goals (frozen for v0 — bring them up and they still won't happen): feed ranking / unread management / push notifications (the attention inbox that got voted down); multi-repo browsing and code diffs (not in v0, but already the v1 north star, see §10); AI integration (the agent side is entirely the review-loop skill's job; zhupi doesn't know AI exists); editing documents (read + annotate only).

## §4 Shape

- Pure static single-page app hosted on GitHub Pages: new public repo `zhupi`
- Public code, private content: the page ships no data and no secrets; documents are pulled live by the browser with your token
- **Desktop web first** (v0): wide two-column layout (folder list + reading area) + annotation rail on the right edge; keyboard shortcuts like ⌘Enter to send back
- Mobile + PWA move to v1 (the phone designs are ready, see §1 figures ②③④)

## §5 Data and auth

- Single data source: `charliezong18/review` (private); the browser talks straight to `api.github.com` (CORS is officially enabled)
- Auth in plain terms: generate a key in GitHub's settings that is **valid for the review repo and nothing else** (a fine-grained PAT, with only Contents and Pull requests checked), paste it once the first time you open the app, and it lives locally in the phone's browser (localStorage). The key touches no server and goes to nobody; lose the phone and one click in GitHub revokes it
- No backend, no third-party requests, no analytics

## §6 Pages and interactions

**List page**: the open PR list (title / time submitted / annotation count / status seal); manual pull-to-refresh (no backend, no push — acceptable for v0).

**Reading page**: pull `docs/*.md` from the PR head branch, render with markdown-it (tables, code blocks, task lists all supported); reading typography = 17px body, capped line width, 1.8 line height, dark mode follows the system; 钦此 at the top, "submit annotations · n" at the bottom.

**Annotating**: select text → a card drops into the right-edge rail (§1 figure ①, alongside the source; mobile v1 uses the bottom sheet, figure ④); annotations pile up as local drafts first (localStorage, so a half-written one survives), annotated sentences get a pale vermilion highlight; "submit annotations" writes them all back as inline comments on that PR in one shot; the conversation comment entry point stays in the top bar.

**Closing the loop**: the reading page shows the existing annotation threads plus the agent's per-item replies (when v2 comes back you read each one against how it was handled); 钦此 asks for one confirmation, then squash merges, and the folder drops out of the queue.

## §7 Open question ②: the v1→v2 comparison view (in plain terms)

Scenario: you leave 10 annotations on v1, I revise and send v2 back. Re-reading v2, there are two postures —

- **A. No comparison view (v0's plan)**: you just re-read the rendered version; under each annotation is my reply ("fixed, §3 rewritten"), and you use the annotation threads to find the changes. Cost = you re-read, or you skim by jumping through the replies.
- **B. Build the comparison view**: paragraphs in v2 that changed relative to v1 highlight automatically (like Word's track changes). Nice, but it needs a paragraph-level diff algorithm plus UI on top of the rendered view — the most expensive thing in v0.

The question to decide: **is A enough for you?** My recommendation: A for v0, and if it really feels short, add B in v0.5 — by then there's real usage data showing how you actually hunt for changes on a re-read.

**✅ Decided (2026-07-26): v0 goes with A (no comparison view)**; B waits for real usage and gets added on demand.

## §8 Open question ③: stack comparison

| | A. Zero-build: vanilla JS + markdown-it (recommended) | B. Preact + Vite | C. React + Next |
|---|---|---|---|
| What it is | No framework, a handful of hand-written JS files, render library vendored straight into the repo | Mini React (3KB) + a modern bundler | The full stack |
| Dev speed | Medium (interactions are hand-written, but v0 has very little state) | Fast (components come naturally) | Fast, but a sledgehammer for a nut |
| Maintenance | **Lowest: zero dependency chain, still runs when you open it two years from now** | Medium: dependencies need version chasing | High |
| Deploy | push and it's live (Pages serves the source files directly) | needs a build step (run in Actions) | needs a build + heavy bundle |
| Fit for this project | v0 is three pages with almost no state — exactly right | if v1 grows complex interactions, migrating then is fine | rejected |

The core reason for A: this is a small tool **you personally use for ten years**, not an engineering project recruiting collaborators — the fewer dependencies, the less chance of the "npm install won't install two years later" graveyard. The cost: interaction code reads a bit more verbose than components, and the extra time is mine, not yours.

**✅ Decided (2026-07-26): A. B/C stay as future options, triggered by the breakpoints below.**

### §8.1 Architecture-switch breakpoints (quantified gates)

Zero-build fails with clear symptoms. **Any two** triggering means A has topped out: pause feature work and do the A→B (Preact + Vite) migration first; a single trigger just gets logged and watched, no architecture change. Run through the list at the end of each dev session and write anything over the line into `MIGRATION-WATCH.md`.

| # | Metric | Threshold (trigger line) | Why this number |
|---|---|---|---|
| 1 | Lines in a single JS file | any file > 800 lines | past that, the branching in hand-written DOM updates stops being containable |
| 2 | Total app code | > 2500 lines (vendored libs excluded) | three pages at that size means state complexity has crossed the line |
| 3 | Hand-written DOM update sites | > 25 per page of `innerHTML` / `appendChild` / attribute syncing | the most direct signal that a reactive framework is due |
| 4 | Number of state sources | more than 6 independent states needing cross-page sync | hand-written subscriptions start costing more thought than a framework |
| 5 | Same class of render bug recurring | fixing the same "UI didn't follow the data" bug ≥ 3 times | a symptom-level signal, harder evidence than line count |
| 6 | Blast radius per change | adding one small feature touches ≥ 4 files | means component boundaries are missing |
| 7 | First paint | > 1.5s (local network, cold cache) | no build = no tree-shaking or minification; the signal that size has topped out |

**Migration cost estimate once triggered**: the anchoring algorithm, the GitHub API wrapper, and the styles all move over as-is (those three are the bulk of the code); only the view layer gets rewritten — half a day to a day. So A isn't a dead end, it's the start of a path with a controlled exit.

**C (React + Next) gets its own separate trigger line**: only consider it when zhupi needs a **server** (push notifications, multi-person collaboration, a non-GitHub data source) — at that point the product has changed shape, the architecture hasn't buckled. Not evaluated within v0/v1.

## §9 Open question ④: annotation anchoring (in plain terms)

First, a follow-on from §8: **can A (zero-build) do sentence-level annotation?** It can — everything sentence annotation needs (select text, get the selection's position, inject a highlight, position the card in the rail) comes from the browser's **native** Selection API and DOM manipulation; frameworks don't supply that layer at all. Hypothesis, the benchmark product, implements its annotation layer with native DOM injection. What a framework buys you is "the UI refreshes itself under complex state," and zhupi's state is one draft list. The genuinely hard part is the anchoring algorithm below — and that code is word-for-word identical under A or B.

"Anchoring" = you select a sentence on the rendered page, and the system has to work out **which line** of the source markdown file it maps to before it can be written as a GitHub inline comment (GitHub pins comments to line numbers).

Worked example: you select 「镜片随时可以摘掉」→ the system searches the source file for that string → the only match is on line 3 → the annotation pins to line 3.

Two failure modes and their fallbacks:

1. The sentence appears twice in the document → pin to whichever occurrence is nearest your reading position;
2. No match at all (e.g. the selection spans several elements) → pin to the nearest heading line above that paragraph.

**However well it pins, the annotation body always carries "> the sentence you selected"** — even with the line number off, you and the agent both see which sentence was annotated, so the meaning never gets lost. That's "loose anchoring + quote fallback." The question to decide: **is that precision acceptable?** (Pixel-exact accuracy costs far more; not worth it in v0.)

**✅ Decided (2026-07-26): accepted.**

## §10 Milestones (each step ships a link you can play with)

1. **M1 skeleton**: token setup page + desktop two-column layout (folder list + reading area) + rendered reading — make "read" comfortable first
2. **M2 annotations**: select → batch up in the right-edge rail → send back in one tap (conversation comments included)
3. **M3 closing the loop**: annotation threads and replies on screen, plus 钦此

**v1: mobile + PWA** (2026-07-26 input: reviewing mostly happens on the computer, so desktop goes first; the phone designs in §1 figures ②③④ stay as drafts).

**North star (scheduled after v1): diff folders** — real code PRs land in the same queue, with the same annotation / conversation comment / 钦此 semantics. This is the full form of "one entry point and one format for design and diff alike" (the main ask added in the spoken conversation comment on 2026-07-26); get the markdown-document half solid first. Concept art (the same right-edge rail landing on code lines; color rule: **vermilion belongs to annotations only**, added lines use tea-green, deleted lines get an ink strike-through, nothing competes for the red):

![diff folder · unified view (north star concept art)](../assets/mockups/5-diff.png)

**Split view is the desktop default**, with a one-click toggle in the top bar between unified and split (2026-07-26 input: Charlie prefers side-by-side when reading diffs). Old on the left, new on the right; deleted lines struck in ink, added lines in tea-green, placeholder blocks hatched to say "no corresponding line on this side"; annotations still land on lines of the **new side** (GitHub's inline comments only recognize new-file line numbers), and the right-edge rail is unchanged:

![diff folder · split view](../assets/mockups/6-diff-split.png)

Narrow screens (<1280px) fall back to unified automatically — two code columns plus the annotation rail squeezes the code past readability; this is why mobile in v1 naturally has only the unified view.

## §11 Risks and fallbacks

- Anchoring precision is the biggest technical risk → loose anchoring + quote fallback, §9
- PAT in localStorage → lose the phone, revoke it in GitHub with one click; blast radius = one private repo
- API quota: 5000/hour once authenticated, nowhere near a problem at personal reading volume
- zhupi itself goes down → fall back to the GitHub web UI, zero data loss

## §12 Glossary

| Term | Meaning |
|---|---|
| PAT | Personal Access Token, GitHub's personal key; fine-grained = the version scoped to a single repo |
| CORS | the browser's cross-origin permission mechanism; the GitHub API enables it, which is what lets page JS connect directly |
| localStorage | the browser's own little local store; data stays in this browser on this device |
| PWA | a web page you can "add to home screen" and use like an app |
| markdown-it | the JS library that renders markdown text into HTML, compatible with GitHub's flavor (GFM) |
| vanilla JS | "plain JS" — no framework at all |
| Preact / Vite | mini React / a modern front-end bundler |
| squash merge | squashing all of a PR's commits into one and merging into main |
| inline comment | a GitHub comment pinned to one specific line |
| anchoring (锚定) | converting the sentence you selected into a source-file line number (§9) |

## §13 References

- GitHub REST API: [PR comments](https://docs.github.com/en/rest/pulls/comments) / [PR review](https://docs.github.com/en/rest/pulls/reviews)
- [GitHub Pages docs](https://docs.github.com/en/pages)
- [markdown-it](https://github.com/markdown-it/markdown-it) (the render library)
- [Hypothesis: Fuzzy Anchoring](https://web.hypothes.is/blog/fuzzy-anchoring/) — the classic precedent for web annotation anchoring, and where §9's approach comes from
- [W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/) — the standard shape for annotation data; v0 borrows the concept without copying it
- [MDN Selection API](https://developer.mozilla.org/en-US/docs/Web/API/Selection) — the native browser capability behind "select text"
- [Preact](https://preactjs.com) / [Vite](https://vitejs.dev) (option B in §8)
