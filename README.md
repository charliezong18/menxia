<div align="center">

**English** · [中文](README.zh-CN.md)

# 御笔朱批 · zhupi

**A reading desk for AI-authored documents.**<br>
Your agent submits a long document as a pull request. You read it *rendered* — not as a raw diff — highlight any sentence to leave a comment, submit the batch, and the agent revises. Merge = final.

[**Live app**](https://charliezong18.github.io/zhupi) · [Spec](SPEC.md) · [Backlog](BACKLOG.md)

</div>

![Annotating a sentence](assets/shots/annotate.png)

*Real screenshot, demo data.*

---

## Why

Reviewing a 3,000-word doc your agent wrote is not a chat problem. You want to read it start to finish, mark the eight places that are wrong, hand them all back at once, and see how each one was handled in the next revision. GitHub's PR review does exactly that — except a markdown PR shows you `+` and `-` prefixed source, tables unreadable, and the comment gutter is invisible until you hover the right pixel.

zhupi is a lens over the same PR: same comments, same threads, same merge. It just renders the document like a document.

| PAIN | zhupi |
|---|---|
| markdown diff doesn't render | renders the document, only |
| comment entry isn't discoverable | select text → comment. The one main interaction |
| `approve` blocked by "author cannot approve" | ships its own 钦此 = squash merge |
| links drop you into a logged-out 404 | renders in place, never links out |

## How it works

No server, no build step, no dependency chain. The browser talks to `api.github.com` directly with your own fine-grained token, which never leaves your device. Your documents, versions and review threads all stay in GitHub — this app is a lens you can take off at any time.

```
your agent ──opens PR──▶  review repo (private)  ◀──comments──  you
                                │
                                └── merge = final = ship it
```

## Quick start

**1. Pick a review repo**

Any repo your agent can open PRs against. Private is recommended — the app never publishes anything, but your drafts probably shouldn't be public either.

```
your-review-repo/
└── docs/
    └── <slug>.md      ← one document = one branch + one PR
```

**2. Open the app and hand it a key**

Go to [charliezong18.github.io/zhupi](https://charliezong18.github.io/zhupi) (or your own fork's Pages URL). Fill in `owner/repo`, then paste a [fine-grained PAT](https://github.com/settings/personal-access-tokens/new) scoped to **that one repo** with exactly two permissions:

- **Contents: Read and write**
- **Pull requests: Read and write** ← the one everyone forgets; without it the list 403s

![Setup page](assets/shots/setup.png)

The token lives in this browser's localStorage only. Lost your laptop? Revoke it on GitHub; blast radius = one repo.

**3. Read, annotate, 钦此**

| Action | What it does |
|---|---|
| Select a sentence → **朱批** | inline review comment anchored to that line |
| **总批** | a conversation comment on the whole PR |
| **提交朱批 · n** | submits the whole batch as one review |
| **钦此** | squash merge = final |

Drafts are kept in localStorage until you submit, so a stray refresh costs nothing.

Want to see it move before wiring up a token? `?demo=1&auto=1` runs a tokenless smoke pass that annotates a demo document through real browser events.

<details>
<summary>Dark mode follows the system</summary>

![Dark mode](assets/shots/dark.png)

</details>

## Fork it

The app hardcodes nothing — no repo, no owner, no analytics. Forking is three steps:

1. **Fork this repo**, then Settings → Pages → Source: *Deploy from a branch* → `main` / root. Your app is live at `https://<you>.github.io/zhupi` within a minute. There is nothing to build.
2. **Create your review repo** (private) with a `docs/` folder.
3. **Open your Pages URL**, fill in `owner/repo` + token. Done.

Local development: `python3 -m http.server 4173`, then open http://127.0.0.1:4173 . That is the whole toolchain.

## SOP: the agent side

zhupi deliberately knows nothing about AI. It reads PRs; whoever opens them is your business. The loop below is the convention that makes it work — hand it to your agent (it fits in a CLAUDE.md / AGENTS.md / skill file as-is).

**Submitting**

```bash
git checkout main && git pull -q
git checkout -b <slug>
# write docs/<slug>.md — the artifact ONLY. Metadata goes in the PR body.
git add docs/<slug>.md && git commit -m "<slug>" && git push -u origin <slug>
gh pr create --title "<type>: <title>" --body "<template below>"
```

Two rules that matter:

- **The doc file holds the artifact and nothing else** — no status notes, no "here's what I did". Whatever ships at the end is what's in the file. Everything else goes in the PR body.
- **Don't use `--draft`.** Draft PRs can't be merged, and the REST API can't undraft them (that needs GraphQL). In a single-person repo, draft buys you nothing and breaks the 钦此 button.

PR body template:

```markdown
**Destination** — where this goes after merge
**TLDR** — three lines, what changed and why
**Decisions needed** — numbered, so comments can say "re: 2"
**Known weak spots** — where you want the reviewer to push
**How to review** — "annotate in zhupi, hit submit, then ping me"
```

**Collecting comments**

```bash
gh api repos/<owner>/<repo>/pulls/<n>/comments   # inline: id / path / line / body / in_reply_to_id
gh pr view <n> --comments                        # conversation comments
```

An inline comment with no reply from you = unhandled. Revise the doc, push, then **reply to every single comment** with how it was handled — accepted / partly accepted + why / declined + why. That reply thread is what the human reads on the next pass; skipping it is what makes review loops die.

```bash
gh api -X POST repos/<owner>/<repo>/pulls/<n>/comments/<id>/replies -f body="..."
```

**Merging**

The human presses 钦此 in the app (or you run `gh pr merge <n> --squash --delete-branch`). Merge = final = ship it to wherever the PR body said.

## Known limits

Honest list, so you know what you're forking:

- **Markdown documents only.** A code PR shows "no markdown here". Unified/split diff review is the north star, not shipped — see [SPEC §10](SPEC.md).
- **Anchoring is loose by design.** A comment is pinned via the rendered block's source line; the quoted sentence is always embedded in the comment body, so even a mis-pinned line never loses the meaning. Rationale in [SPEC §9](SPEC.md).
- **GitHub only allows comments on lines present in the PR diff.** New files are entirely in the diff, so documents always work; editing an existing file limits which lines you can pin. The app validates locally before submitting, because GitHub's review submit is atomic — one bad line number kills the whole batch.
- **Desktop first.** Mobile + PWA is v1 ([designs already drawn](SPEC.md)).
- **No notifications, no unread state, no feed.** Deliberately ([SPEC §3](SPEC.md) non-goals).

## Layout

```
index.html        entry (one root div; everything renders from ui.js)
src/ui.js         Preact view layer — one-way data flow; the markdown article is an
                  uncontrolled DOM island so Range-based highlights survive re-renders
src/anchor.js     pure logic: selection → line anchor, hunk parsing, draft persistence
src/github.js     GitHub API wrapper
src/render.js     markdown → HTML (blocks carry data-line for anchoring)
src/style.css     rice paper / ink / cinnabar
test/             unit + DOM + end-to-end, zero dependencies
vendor/           markdown-it + htm/preact standalone (13KB), vendored — no npm, no lockfile
```

## Tests

```bash
test/run.sh            # everything: 34 unit + 22 DOM + 13 end-to-end
test/run.sh unit       # pure logic only — Node's built-in runner, no npm install
test/run.sh browser    # DOM units + the tokenless end-to-end smoke, in real Chrome
```

No test framework, no `npm install`, no config file. Unit tests use `node --test`; the DOM
and end-to-end layers run in headless Chrome and fail the build on a non-zero exit. CI runs
both on every push ([workflow](.github/workflows/test.yml)).

**The gate is a pre-push hook; CI is the second opinion.** This is a single-person repo with no
branch protection — a push lands on `main` and Pages deploys it *in parallel* with the test run,
so CI alone would always report a bad commit after it was already live. So the real gate runs
before the push:

```bash
git config core.hooksPath .githooks   # once per clone
```

`.githooks/pre-push` runs the full suite when the push touches code, unit-only when it's
docs-only (a typo fix shouldn't cost 90 seconds), and refuses the push on red — printing which
assertion failed. `git push --no-verify` is the escape hatch when you mean it.

What's actually covered: the hunk validator (a wrong line number 422s the entire batch),
the anchoring line math (fence `+1`, indented block `+0`, per-table-row), comment threading,
API request assembly (`commit_id`, merge `sha`, 401-vs-403 triage), and an end-to-end pass
that annotates a demo document through real browser events and checks the old-rev read-only state.

Total app code is about 900 lines. Still **zero-build** — push is deploy — but no longer framework-less: the [architecture switch gate](MIGRATION-WATCH.md) tripped on 2026-07-26 (two indicators over threshold, both review-confirmed as event/async-timing bug factories), so the view layer moved to Preact in its no-build form. The gate said so, in numbers; we obeyed.

## License

[MIT](LICENSE) © Charlie Zong
