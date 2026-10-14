**English** · [中文](zhupi-mcp-design.zh-CN.md)

# zhupi-mcp — the agent-side MCP server for zhupi, the annotation desk

Final design · 2026-07-28

Companion product: [`charliezong18/zhupi`](https://github.com/charliezong18/zhupi) (zhupi, the human side). This repo is the agent side.

---

## 1. Why do this

The agent side of the zhupi loop currently lives in `~/.claude/skills/review-loop/`: an 8KB SKILL.md plus four bash scripts. On 2026-07-28, a round of hardening was just done — moving the house style from prose reminders to script gates. The trigger was observing in practice that "3 of 8 folders missed the session backlink marker, and 11 documents lacked a bilingual pair", leading to the conclusion that **documentation reminders cannot cure missed executions**.

This round is to resolve the two things that were not resolved that time.

**MCP does not solve "bypassing".** After the gate was welded into the script, the remaining vulnerability is a routing issue — the model can just not take that route and manually type `gh pr create` directly. Switching to MCP can equally be bypassed. What truly blocks the route is the PreToolUse hook, see §7. These two things must be done separately and accounted for separately; MCP cannot be treated as a means to prevent bypassing.

**What MCP solves are the other three things:**

| Benefit | Current pain |
|---|---|
| **Saving context when reading comments** | "Reading comments" is currently a string of `gh api` calls plus the model manually parsing threads and inline positions, burning considerable window space every time. Returning structured JSON can compress this cost to near zero. **This cost is paid on every single use, which is why it is the headline reason** |
| **Blocking parallel collisions** | Tripped over this once on 2026-07-27 — multiple sessions touching `~/Developer/review` concurrently, checking out each other's branches, and rolling staged files into someone else's commit. The current countermeasure is a single sentence in CLAUDE.md saying "open separate worktrees when parallelizing", yet another prose reminder. See §4.2; the mechanism is a file lock, not a single process |
| **Typed input parameters** | The five-section body, slug, and bilingual pair can be made into schema required fields; missing parameters are rejected on the spot by the MCP layer for a retry, instead of the script erroring out halfway through. Real, but modest |

**Cross-harness used to rank first; it was demoted to speculative on 2026-07-29.** The original argument was that the skill only lives in Claude Code while agy, CCD, and Codex cannot open a folder at all — and that the heavy lifting was increasingly outsourced to agy. In review, Charlie dropped agy, chose to focus on Claude, and put Codex at "maybe next, no rush" — **so this benefit has no consumer today**. It did not become false; it moved from "cashed immediately" to "possibly cashed some day", and therefore no longer carries argumentative weight. The three above are enough to justify the project. If it ever comes down to this one alone, re-evaluate.

---

## 2. Scope

**In scope**: `open_folder` (open a folder), `lint_folder` (self-check), `audit_folders` (audit), `list_folders` (list folders), `read_comments` (read comments), `reply_comment` (reply).

**Out of scope**:

- **Final approval (squash merge) will not be made into a tool.** That is an action clicked by Charlie on zhupi; there is no reason for the agent side to possess this capability.
- **Post-delivery bookkeeping will not be made into a tool** (tracker numbers, STATUS.md in-flight tables) — those are scattered across different vault locations and are prose responsibilities belonging to the skill, unsuitable for solidifying into a schema.
- **Do not modify the zhupi frontend.** This repo and `charliezong18/zhupi` are only coupled through GitHub (PR body conventions, `<!-- happy-session: -->` marker format); they do not share code.

---

## 3. Tool surface

Universal convention: error returns from all tools must be **actionable for the model** — like "`docs/foo.md` is missing its Chinese pair `docs/foo.zh-CN.md`", so the model can read it, fix it directly itself, and retry, rather than returning a stack trace.

### 3.1 `open_folder` — open a folder

```
title:      string              folder title
body: {
  destination: string          where it goes (vault / issue in some repo / email …)
  directLink:  string?         direct link
  tldr:        string          TLDR
  decisions:   string          what needs your call
  howto:       string          how to use it
}
docs:       string[]           local absolute paths; give both halves of the bilingual pair
assets:     string[]?          local absolute paths; images referenced by the text
sessionId:  string?            override; if omitted the server detects it, and embeds nothing if it cannot
```

Returns: PR number, PR URL, deep link to zhupi `https://charliezong18.github.io/zhupi/?pr=<n>`, and the lint report.

**`docs` passes paths, not full text**, this is deliberate. Running on the same machine, the server itself copies the files into the worktree it manages; the agent never touches `~/Developer/review` at all — this is the only way to truly block stepping on each other's toes. Passing the full text via tool input not only wastes tokens, but also leaves the agent with the mental model of "I can write into that repo myself".

The copy-in location is fixed: `docs` land in `docs/<basename>`, `assets` land in `docs/assets/<basename>` — the text references them by relative paths beginning with `assets/`, consistent with the existing in-repo layout.

![open_folder and its failure branches](assets/open-folder.png)

The three amber boxes are deliberately non-blocking: a stale branch base only warns (blocking pushes people into bypassing the gate), an undetected session id embeds nothing (never fabricate one), and a failed body readback still returns (the PR exists either way; hiding that is worse). Only the two red boxes actually abort.

### 3.2 `lint_folder` — self-check before you open a folder

```
docs:    string[]     local absolute paths
assets:  string[]?
```

Returns: structured findings[], each containing `severity: error | warn`, `rule`, `message`, `file`. See §5.1 for the rule list.

**One less rule can be checked.** The existing `folder-lint.sh` runs inside the folder repo's worktree, getting this folder's documents via `git diff origin/main...HEAD`, so it can do the "branch base" check. `lint_folder` receives paths scattered across the local machine, not in any relevant git tree, so it only runs rules 1-4 (bilingual pair / cross-link header / `.payload` exception / broken image). **"branch base" is only run inside `open_folder`** — by then the server already has its own worktree, and the git context is complete. This discrepancy must be explicitly declared in the return of `lint_folder`, otherwise it will give a false sense of security that the "house style is compliant".

### 3.3 `audit_folders` — audit of folders already open

```
fix: boolean?    default false. When true, patches what is mechanically patchable
                 (session backlink marker, converting drafts to ready)
```

Returns: the house style gaps for each folder. Bilingual gaps are only reported, not filled (requires translation, machines cannot fill it).

### 3.4 `list_folders` — list folders / "has he reviewed it?"

```
state: "open" | "merged"    default open
```

Returns: folder number, title, branch, and **number of unanswered comments**.

### 3.5 `read_comments` — read comments

```
pr: number?    omit = sweep all open folders
```

Returns:

```
folders: [{
  number, title, headRefName,
  inline: [{ id, path, line, quote, body, inReplyToId, answered: boolean }],
  conversation: [{ id, body, author, answered: boolean }],
  unansweredCount: number
}]
```

**`answered` is calculated by the server, not returning the raw list for the model to judge by itself.** The judgment that "an inline comment without our reply = unhandled" currently relies on the model re-deducing it every time, which is the most easily missed step. Charlie listing opinions in the conversation area as a whole (without highlighting lines) also counts as comments, so `conversation` similarly carries `answered`.

### 3.6 `reply_comment` — reply

```
pr:        number
commentId: number?    omit = post an overall comment (PR conversation comment)
body:      string
```

Omitting `commentId` means posting an overall comment; no separate tool is added just for that. Giving `commentId` hits `POST /pulls/{n}/comments/{id}/replies`, appending to the comment thread instead of opening a new one.

---

## 4. Architecture

Node 20 + TypeScript, `@modelcontextprotocol/sdk`, stdio transport.

### 4.1 Installation method

Write the absolute path in the MCP config:

```json
{ "command": "node", "args": ["/Users/charliezong/Developer/zhupi-mcp/dist/index.js"] }
```

**Do not use `npm link`.** Tripped over this on 2026-07-24 — the global singleton pointer was hijacked, causing a production rollback and taking ages to clean up. Operations resembling a global singleton pointer absolutely do not enter this project.

The folder repo (default `charliezong18/review`) and the local checkout path (default `~/Developer/review`) are passed through environment variables `ZHUPI_REVIEW_REPO` / `ZHUPI_REVIEW_PATH`, not hardcoded — this repo is public.

### 4.2 Concurrency: file lock, not single process

**First, correct an assumption: a stdio-based MCP server spawns a separate process for each session, it is not a shared resident process**, so it naturally cannot queue across sessions. To prevent stepping on each other's toes, we must rely on:

- `flock` locking `~/Developer/review` (the lock file is placed outside the repo, e.g., `~/.zhupi-mcp/review.lock`)
- Every time `open_folder` opens a temporary worktree inside the lock, tearing it down immediately after use
- Lock wait timeout returns a readable error, letting the caller know another session is opening a folder, rather than hanging dead

`worktree.ts` is the **only** module that touches `~/Developer/review`.

![How two sessions get serialized by the lock](assets/concurrency.png)

### 4.3 GitHub integration

Octokit, token is fetched on the fly from `gh auth token`, without separately managing a PAT — `gh` on the machine is already authenticated, and an extra PAT means an extra source of expiration. On 401, re-fetch once and retry.

(The zhupi frontend uses a fine-grained PAT because it runs in the browser, where `gh` is not available. The two sides do not share credentials, nor should they.)

### 4.4 Detection of the "session backlink" marker

The principle of `happy-session-id.sh` is to crawl up the ppid from its own process, taking each level's pid to collide with the hostPid recorded for each session in `~/.happy/sessions.json`.

In stdio mode, the MCP server is a child process of Claude Code, and this chain **happens to still hold**. But it is brittle:

- A caller outside Claude Code has no happy session at all, so it will never be detected
- `sessions.json` only accumulates and does not clean up (tested 114 entries all marked running); the hostPid of stale records has long been recycled by the OS to other processes, and colliding with it will yield the **wrong** session id

The original script's handling of this is: after a hit, verify again that "this pid is indeed running happy right now". This must be preserved as-is.

**Strategy: if not detected, do not embed it; absolutely do not invent one.** The button simply won't appear; silently pointing to the wrong thing is worse than nothing. Separately leave the `sessionId` input parameter for the external caller to pass explicitly.

**This whole section was demoted on 2026-07-29.** Charlie's ruling: "reply to the session if you can, and if you can't, the document itself is enough for any agent to pick the discussion up" — **the real fallback is a self-contained document, not this button**. So ppid detection breaking in some future version is not an incident, and is not worth compensating machinery (see OPEN-QUESTIONS).

### 4.5 Module slicing

| Module | Responsibility | Dependencies |
|---|---|---|
| `lint.ts` | house style check, **pure function**: takes file list + git info, spits findings[]. No IO | None |
| `worktree.ts` | flock + temporary worktree lifecycle. The only place that touches the review repo | fs, child_process(git) |
| `body.ts` | Five-section body assembly, marker welding, **self-verified** readback | github.ts |
| `session.ts` | ppid crawling, returns null if not detected | fs, child_process(ps) |
| `github.ts` | Octokit wrapper | @octokit/rest |
| `index.ts` | tool registration and input validation, contains no business logic | All |

`lint.ts` having no IO is deliberate — it is the piece with the most rules and the most need for intensive unit testing; blocking IO on the outside is the only way to make it testable.

---

## 5. Porting acceptance

The number one risk in zhupi's own vanilla JS → Preact migration was "fixed things silently getting lost", for which three rounds of line-by-line survival verification were done. This rewrite is equally subject to the same.

### 5.1 Port according to implementation, not documentation

Having read the `folder-lint.sh` and `open-folder.sh` implementations, **three places of drift between documentation and implementation have been confirmed** — this is direct evidence for this rule. When porting, you must follow the "Implementation truth" in the table below; also see the decisions in §5.3.

| # | Rule | SKILL.md claims | Implementation truth |
|---|---|---|---|
| 1 | bilingual pair | "**First determine the original language then decide the direction** — the outbound draft is originally English anyway; if reversed, the translation is wasted" | **Only checks that both files exist**, does not check content language. A wrong direction is not blocked at all |
| 2 | cross-link header | English version first line `**English** · [中文](<slug>.zh-CN.md)`; Chinese version first line `[English](<slug>.md) · **中文**` | Consistent, character-by-character match (`grep -qxF` / anchored regex) |
| 3 | **`.payload` exception** | **Not present in the documentation** | The "outbound payload" registered in `docs/.payload` (or `.payload`) is exempt from the English version cross-link header (adding it would paste that line into the external issue as well); but its Chinese version **must** contain the "do not copy from this page" banner, erroring out if missing |
| 4 | Move images together | The `assets/**` referenced in the text must actually be in the repo | Consistent, but only matches markdown link syntax; **HTML `<img src>` is not checked**; and it **does not skip code blocks or inline code**, see below |
| 5 | branch base | "Warning + list documents already on main" | Consistent, deliberately not blocking (blocking would force people to bypass the gate, a lesson from that time with pre-push) |
| 6 | Five-section PR body | "**Block on missing sections too**" | **Only `echo ⚠` to stderr, opens regardless**. The comment on line 27 of the script also says "block on missing sections too", self-contradicting with the code on line 29 |
| 7 | No drafts allowed | `audit-folders.sh --fix` converts to ready | Consistent |

Three other implementation problems, retain or explicitly change them when porting:

- **The broken-image check does not skip code blocks or inline code — this very folder tripped on it.** The first attempt to open this spec was blocked by the lint, which reported two "broken images" that were in fact the literal examples used in the text to explain the rule itself (written inside inline code). A document about the lint rules cannot pass the lint, because the lint does not recognize code spans. **The TS version must strip fenced code blocks and inline code before scanning for image references** — this is the same stripping logic used by the language check in §5.3 #1, and the two should share one helper. The workaround at the time was to reword the text to avoid the literal, which is a stopgap.
- `git fetch -q origin ... || true`: **silently continues** on network failure; at this time `origin/main` is stale, and the base check derives its conclusion based on old data. The TS version should at least report "fetch failed, conclusion might be stale" as a warn.
- The five-section check uses `grep -q "$sec"`, meaning **the section name appearing anywhere in the body** counts as passing; it does not require it to be a heading. The TS version should match by heading.

### 5.2 Differential test

Take all existing open folders plus a batch of intentionally corrupted samples (at least one must-fail test case per rule), **run the old script and the new TS each once, and align the outputs item by item**.

There are only two outcomes for differences: if it is a bug, fix it; if it is a deliberate improvement, document it here to explain why. Two deliberate improvements are known so far: **#1 adding the language-direction ratio check** (§5.3), and **#4 having the image-reference check also cover HTML `<img src>`**. **Do not deploy if they do not align.**

By the way, a free benefit: pitfalls like macOS bash 3.2 lacking `mapfile` and associative arrays simply do not exist in TS (this is specifically commented at the top of `folder-lint.sh`). But this also means **the logical structure cannot be blindly copied** — those workaround patterns in the bash version where `while read` subshell variables do not propagate back (lines 74-77 writing FAIL to a temp file and grepping it back) are pure noise in TS. The logic must be reorganized when rewriting, hence relying even more on differential testing as a safety net.

### 5.3 Decided (Charlie's call, 2026-07-28)

- **#1 Language direction: check by ratio.** Strip fenced code blocks and inline code first, then compute the CJK character ratio of the remaining prose — error if the English version is >30%, error if the Chinese version is <30% (which also catches untranslated leftovers). Ratio rather than "error on any run of Chinese" because glossaries, proper nouns, and mixed-script lines do not reach the threshold, so false positives are largely avoided — while a whole document translated in the wrong direction is always caught. **This is a tightening relative to the current script**, and counts as a deliberate improvement in the differential test; see §5.2.

- **#6 Missing five sections: warn, do not block.** That is, the code is right and **the documentation is wrong** — row 5 of the SKILL.md house-style table and the comment on line 27 of `open-folder.sh` both state it as "block". Rationale: the body sections are for a human to read; missing one does not break zhupi's functionality the way a missing bilingual pair does, and blocking too hard pushes people into bypassing the gate (the lesson from that time with pre-push). **This is not porting work, it is an outstanding documentation debt**, paid off in §8 Phase 4.

---

## 6. Testing

- **`lint.ts` unit tests (vitest)**: At least one passing test case + one must-fail test case per rule in §5.1. This is the only module with mandatory coverage.
- **Differential test**: §5.2, kept in the repo as a one-time deployment gate, repeatable.
- **`body.ts` self-verification path**: `gh` has a track record of silently swallowing the body (lines 42-45 in `open-folder.sh` specifically wrote a readback verification for this); there must be a mocked test case for "created successfully but body is lost".
- **`session.ts`**: When a stale hostPid collides with another process, it must return null instead of that id.
- Do not pursue high coverage for `github.ts` / `worktree.ts` — they are thin and heavy on IO, relying on the three pieces above and one run against the real thing to stand their ground.

---

## 7. Hook (Phase 0, **shipped 2026-07-28**)

`~/.claude/skills/review-loop/guard-pr-create.sh`, wired to `PreToolUse(Bash)` in the global settings.json. Rejects on hit:

- `gh pr create` aimed at the folder repo
- `gh api -X POST .../pulls`, likewise

Two criteria: **① a command segment names the folder repo; ② it does not, but the directory it `cd`s into (or the session cwd) has the folder repo as its origin** — the second blocks the most likely bypass, `cd <worktree> && gh pr create`. Read operations (`pr view` / `pr list` / GET pulls) and every other repo pass untouched.

The rejection message points to the correct entrypoint at the time — currently `open-folder.sh`, after Phase 4 the MCP tool.

**Three false positives on the way in, all the same root cause — treating "the string appears" as "this command will run." All recorded here, because rewriting this logic for the MCP version will walk into them again:**

1. **Judge per command segment, not per whole string.** The first version scanned the entire command line, so `gh pr create -R some-other-repo && gh pr view -R <folder repo>` was falsely blocked — the two keywords sat in different segments. Now the command is split on `&& || ; |` and each segment judged on its own.
2. **The segment must actually start with a `gh` invocation.** The second version blocked the guard author's own `git commit` — the commit message named the command, and the cwd happened to be a folder-repo worktree, so both criteria were met. It now strips leading whitespace, env assignments, a `bash -c` wrapper, and any absolute-path prefix, then requires what remains to **begin with `gh`**. `git commit -m "...gh pr create..."`, `echo`, and `grep` all pass.
3. **The stripping sed must use `-E`.** BSD sed (shipped with macOS) does not support `\|` alternation in basic regex, so that rule was dead on arrival — the `bash -c '...'` wrapper bypass sailed straight through, **silently**. Only the test caught it. `folder-lint.sh` carries a comment warning about this exact class of trap, and it still happened.

The accompanying `guard-pr-create.test.sh` has 21 cases (10 must-block / 11 must-pass). Run it before touching the guard.

![The route guard's decision tree](assets/guard.png)

Every step marked (1)(2)(3) was forced by a real false positive — **not one node in this tree was designed; all of them were collided with.**

This rule is independent of MCP; deploying it first yields immediate effects. It is the real answer to "more locked down"; MCP is just changing the vehicle, not a means to prevent bypassing.

---

## 8. Rollout sequence

| Phase | Content | Why this sequence |
|---|---|---|
| **0** ✅ | Hook welds the route dead (shipped 2026-07-28, see §7) | Does not depend on MCP, yields immediate effects |
| **1** | server skeleton + `list_folders` + `read_comments` | **Read-only, zero risk**, the benefit of saving context is cashed in immediately |
| **2** | `lint_folder` + §5.2 differential test alignment | The check logic must stand firm first, before daring to let it manage writing |
| **3** | `open_folder` + `audit_folders` + `reply_comment` | Write side, including flock/worktree/marker self-verification |
| **4** | Script retirement; SKILL.md slims down to "glossary + pointer to tool"; hook is redirected to MCP; **pay off the documentation debt from §5.3 #6** ("block on missing sections too" is false in both row 5 of the SKILL.md house-style table and the comment on line 27 of `open-folder.sh` — change to "warn") | Wrap-up |

At the end of each phase, do a real-machine run (actually open a folder / actually read a comment once); do not rely on unit tests to assert "it works".

---

## 9. Risks

| Risk | Handling |
|---|---|
| Rewrite loses existing fixes | §5.1 item-by-item implementation checklist + §5.2 differential test |
| Cross-harness has no consumer today | Known and accepted (§1). The project stands on the other three benefits; if it ever comes down to this one alone, re-evaluate |
| ppid detection fails in future Happy versions | Do not embed if not detected (existing strategy); failure manifests as the button disappearing, it will not point to the wrong thing |
| Public repo leaks private info | This repo contains no document content; the `charliezong18/review` repo name is configurable, with the default value written in README instead of hardcoded |
