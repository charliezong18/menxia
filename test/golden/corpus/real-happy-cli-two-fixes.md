**English** · [中文](happy-cli-two-fixes.zh-CN.md)

# Two happy-cli upstream fixes: double review cut three down to two

> The bodies of these two folders **go out verbatim to the public repo `slopus/happy`**, under your name. So this needs a final sign-off, not a skim.

## 1. Starting point: two genuine low hanging fruit

Screened upstream open issues against your "how to pitch PRs to hobbyist maintainers" playbook (**fixes get taken, features die / zero decision cost / done is done, no maintenance surface left behind**) and picked two:

| Issue | Reporter | Symptom |
|---|---|---|
| **#1532** | `YesYouKenSpace` | `happy --version` doesn't print a version, it opens a session instead |
| **#1529** | `kaovilai` | `happy update` fails with `error: unknown option '--settings'` |

While reading the code I **picked up a third one along the way**: the "Claude Code Options" block in `happy --help` has **never printed on any installation** — the `claude_local_launcher.cjs` that `claudeCliPath` points at has no shebang and is mode `100644` in git, so `execFileSync` running it directly is guaranteed to fail, and the `catch` flattens the truth into a single "Make sure claude is installed".

So it started as three PRs.

## 2. Double review (Opus and agy, one pass each — two independent model reviews, adversarial prompts, no cross-talk)

**Verdict: none of the three could ship as written.**

### Two mistakes that were mine

**① I introduced stderr pollution, and it was sitting right there in my own test output.**

I had `--version` also print claude's version while it was at it. Split the streams and:

```
stdout:  happy version: 1.2.0
         2.1.185 (Claude Code)
stderr:  Using Claude Code v2.1.185 from Homebrew   ← the line I added
```

That line comes from `getClaudeCliPath()`, every single time. In the terminal the two streams were interleaved, and **I stared straight at it without recognizing it as mine**. The same file already gets this right at `claude_version_utils.cjs:518` (`stdio:['ignore','pipe','ignore']`).

**② I used "unit tests 792/792 green" as evidence. That green light is empty.**

`src/index.ts` has **zero test coverage** — the unit project only includes `src/**/*.test.ts`, there is no `index.test.ts`, and not one of the 89 test files touches subcommand dispatch. Both reviews flagged this independently. 792 green only proves "I didn't break anyone else's code".

Same failure mode as the 2026-07-27 "I wrote a program to verify it ≠ I verified it": **measure a category the ruler can't reach, then declare it clean — logically vacuous, but it looks an awful lot like evidence.**

### Other real problems the reviews caught

- **With claude not installed, `happy --version` turns into a screenful of install pitch plus `exit(1)`.** happy supports codex/gemini/agy/acp/openclaw — **claude is not a required dependency**. A codex-only user asking for a version number gets 12 lines of "Claude Code is not installed". That fallout comes **entirely from the half I added on top**.
- **`upgrade` is an alias for `update`** (`claude --help` spells it `update|upgrade`). I missed it, so `happy upgrade` reproduces the same failure.
- **Signal exit codes**: when the child is killed by Ctrl+C, `status` is null and I reported 1 across the board; it should be `128 + signal` (SIGINT → 130).
- **On Windows it's `ENOENT`, not `EACCES`** — the conclusion (it has never printed) holds, but the reasoning only holds on Unix.
- **There are real consumers in CI and my grep missed them**: `.github/workflows/cli-smoke-test.yml:79` runs `timeout 10s happy --version`, with :231/:233 as the Windows variants; `scripts/install-local.cjs:49` calls `process.exit` on a non-zero exit. **Which turns out to be the strongest argument for #1532** — CI runners have no credentials, so that step is most likely stuck at the login picker and being rescued by `timeout`.

### The one place the two reviews contradicted each other, and how I ruled

`process.execPath` vs. the hardcoded `'node'` in `claudeLocal.ts`: agy called it falsified — the two must match. Opus called the choice correct but said my comment cited the wrong precedent.

**I went with Opus**: `claude_version_utils.cjs:514` is already `isJsFile ? process.execPath : cliPath`, so the precedent exists in the repo; and an absolute path actually sidesteps Windows PATH resolution (the whole cross-spawn apparatus exists to solve `node`→`node.exe`). The comment now cites `claude_version_utils.cjs`.

### One finding only agy reported, which I'm marking unresolved

agy claimed that on the offline fallback path `hookSettingsPath` never gets set, so `happy update` would actually succeed with the network down. I checked `runClaude.ts:502`: `generateHookSettingsFile()` is called **unconditionally**, and I couldn't find the branch it described. **agy has a track record of making things up** (the 7/27 substring-match false positive), so I'm not accepting this one — but I couldn't fully falsify it either.

## 3. Root cause: I hit playbook ④(b) again

I packed two things into PR1:

- **(a) Don't open a session** — the actual bug fix, one line of `process.exit(0)`
- **(b) Print claude's version while we're at it** — added to "preserve existing behavior"

**Both blockers came out of (b).** Cut (b) and PR1 shrinks to one line, taking both blockers with it.

And Opus produced a counter that kills the premise behind (b) outright: **the matching `-h/--help` pass-through has been dead code all along** (the help branch just `exit(0)`s). help never printed anything from claude — so "version shouldn't print it either" is the consistent behavior.

## 4. Where it landed

| | Decision | Why |
|---|---|---|
| **PR1** #1532 | **Ship**, cut to one line | Drop (b) and both blockers disappear |
| **PR2** #1529 | **Ship**, four fixes applied | Add `upgrade`, fix the signal code, correct the comment's citation, **spawn the real claude binary instead of going through the launcher** (v2) |
| **PR3** `--help` | **Don't ship** | Fixing it would dump another 225 lines / 15.6KB and drown happy's own help; upstream more likely wants that block **deleted** than wants a never-shipped behavior lit up — **that's a product decision, which by the criteria lands on the "will die" side**. Worktree already cleaned up |

### Two things I couldn't verify

> **v2 update (2026-07-30)**: item 1 below **no longer exists**. The original shape had PR2 go through `claude_local_launcher.cjs`, which is where the open question "does `DISABLE_AUTOUPDATER=1` block `claude update`" came from.
> You said you'd verify it yourself. I priced that out first: claude isn't a brew formula, it's npm-installed into the Homebrew prefix — **2.1.185 installed, 2.1.220 latest on npm, so the update is genuinely live**, and running it would swap the binary out from under 10 active sessions.
> So instead of answering the question I **removed it**: `findGlobalClaudeCliPath()` in `claude_version_utils.cjs` is quiet (stderr measured empty) and hands back the real binary path. PR2 now bypasses the launcher and spawns claude directly — **no `DISABLE_AUTOUPDATER`, no fetch hijack, no banner line, and nothing to run on your machine**.
> The `createRequire` idiom already has precedent in this package (`src/commands/server.ts:5,14`). The §5 diff and the §6 PR2 body are both updated to the new shape.

1. ~~**Whether `DISABLE_AUTOUPDATER=1` blocks `claude update`.**~~ See above — moot now.
2. **The `--settings` error was never reproduced end to end** (it would trigger a real update) — only a static chain of reasoning.

## 5. The two diffs

**PR1** — `fix/version-flag-should-not-start-session`, touching only `packages/happy-cli/src/index.ts`:

```diff
     if (showVersion) {
       console.log(`happy version: ${packageJson.version}`)
-      // Don't exit - continue to pass --version to Claude Code
+      // Exit here, the same way the --help branch above does. Falling through runs
+      // auth, starts the daemon and opens a session just to answer a version query.
+      process.exit(0)
     }
```

**PR2** — `fix/update-subcommand-passthrough`, again a single file:

```diff
@@ -29,7 +29,11 @@ import { handleSandboxCommand } from './commands/sandbox'
 import { handleServerCommand } from './commands/server'
 import { spawnHappyCLI } from './utils/spawnHappyCLI'
 import { claudeCliPath } from './claude/claudeLocal'
-import { execFileSync } from 'node:child_process'
+import { execFileSync, spawnSync } from 'node:child_process'
+import os from 'node:os'
+import { join } from 'node:path'
+import { createRequire } from 'node:module'
+import { projectPath } from '@/projectPath'
 import { extractNoSandboxFlag } from './utils/sandboxFlags'
 import { handleResumeCommand } from '@/resume/handleResumeCommand'
 import { ensureDaemonRunning } from './daemon/ensureDaemonRunning'
@@ -125,6 +129,40 @@ Conversation history is preserved on the server, but in-flight tool calls are in
   } else if (subcommand === 'bye') {
     console.log('Bye!');
     process.exit(0);
+  } else if (subcommand === 'update' || subcommand === 'upgrade') {
+    // Delegate straight to claude. Without this branch it falls through to the
+    // session launcher, which appends Happy's hook `--settings` — an option
+    // claude's update command doesn't accept, so it always fails.
+    //
+    // This resolves the claude binary rather than going through
+    // claude_local_launcher.cjs: the launcher sets DISABLE_AUTOUPDATER=1 and
+    // replaces global.fetch to report progress over fd 3, and neither belongs in
+    // a one-shot update that isn't part of a session.
+    const require_ = createRequire(import.meta.url)
+    const { findGlobalClaudeCliPath } = require_(join(projectPath(), 'scripts', 'claude_version_utils.cjs'))
+    const found = findGlobalClaudeCliPath()
+    if (!found?.path) {
+      console.error(chalk.red('Error:'), 'Could not find the claude CLI. Install it with: npm install -g @anthropic-ai/claude-code')
+      process.exit(1)
+    }
+    // A JS entrypoint has to go to node; a native binary runs on its own.
+    const isJsFile = found.path.endsWith('.js') || found.path.endsWith('.cjs')
+    const rest = [subcommand, ...args.slice(1)]
+    const result = spawnSync(
+      isJsFile ? process.execPath : found.path,
+      isJsFile ? [found.path, ...rest] : rest,
+      { stdio: 'inherit', windowsHide: true }
+    )
+    if (result.error) {
+      console.error(chalk.red('Error:'), result.error.message)
+      process.exit(1)
+    }
+    if (result.signal) {
+      // Report the signal the way a shell would, so Ctrl+C stays distinguishable
+      // from claude exiting 1 on its own.
+      process.exit(128 + (os.constants.signals[result.signal] ?? 0))
+    }
+    process.exit(result.status ?? 1)
   } else if (subcommand === 'resume') {
     try {
       await handleResumeCommand(args.slice(1));
```

## 6. The two PR bodies (the text that ships — please read it line by line)

### PR1 · `fix(cli): exit after printing the version instead of opening a session`

> Fixes #1532
>
> ## Problem
>
> `--version` prints the Happy version and then deliberately keeps going:
>
> ```ts
> console.log(`happy version: ${packageJson.version}`)
> // Don't exit - continue to pass --version to Claude Code
> ```
>
> That reaches `authAndSetupMachineIfNeeded()`, `ensureDaemonRunning()` and `runClaude()`. Without stored credentials, asking for a version number drops into the interactive login picker:
>
> ```
> happy version: 1.2.0
>
> How would you like to authenticate?
> › 1. Mobile App
>   2. Web Browser
>
>   ERROR Raw mode is not supported on the current process.stdin, which Ink uses
> ```
>
> The `--help` branch above already exits, and its own `-h/--help` pass-through into `unknownArgs` has been dead ever since — so `--version` not exiting reads as an oversight rather than a design choice.
>
> `.github/workflows/cli-smoke-test.yml` runs `timeout 10s happy --version` on Linux and Windows; CI runners have no credentials, so that step is likely surviving on the timeout rather than on the command succeeding.
>
> ## What changed
>
> One line: `process.exit(0)` after printing.
>
> This drops Claude's version from the output. I'd rather add that back as its own change if you want it — doing it here means either swallowing the launcher's `Using Claude Code … from …` banner on stderr, or turning `happy --version` into a 12-line "Claude Code is not installed" wall for people running codex/gemini/agy without claude.
>
> The now-unreachable `unknownArgs.push(arg)` for `--version` is left alone, since the `-h/--help` one next to it is already in the same state.
>
> ## Test plan
>
> - `tsc --noEmit` clean
> - Built and run: `happy --version` prints one line on stdout, nothing on stderr, exits 0, and never touches auth, the daemon or the session list
> - The unit suite passes 792/792, but that says nothing here — `src/index.ts` has no test coverage, so nothing in the suite exercises this path

### PR2 · `fix(cli): delegate happy update/upgrade to claude`

> Fixes #1529
>
> ## Problem
>
> Neither `update` nor its `upgrade` alias is in the subcommand chain, so both fall through to the session launcher. That path appends Happy's hook settings (`claudeLocal.ts`: `args.push('--settings', opts.hookSettingsPath)`, and `runClaude.ts` generates the file unconditionally), and claude rejects the flag:
>
> ```
> error: unknown option '--settings'
> ```
>
> ## What changed
>
> An `update` / `upgrade` branch that delegates straight to claude with the remaining args — no session wrapper, no hooks, no `--settings`. Exit status is forwarded, and a signal-terminated child reports `128 + signal` so Ctrl+C stays distinguishable from claude exiting 1.
>
> It resolves the binary through `findGlobalClaudeCliPath()` rather than going through `claude_local_launcher.cjs`. The launcher sets `DISABLE_AUTOUPDATER=1` on its first line and replaces `global.fetch` to report progress over fd 3 — neither has any business in a one-shot update that isn't part of a session, and under `stdio: 'inherit'` there is no fd 3 to write to anyway.
>
> Scope note: the issue also mentions `install`. Left out — it isn't reported broken.
>
> ## Test plan
>
> - `tsc --noEmit` clean
> - Built and run: `happy update --help` and `happy upgrade --help` both reach claude and print its usage on stdout, nothing on stderr, exit 0
> - I did not reproduce the original `--settings` failure end to end, since that performs a real install; the mechanism is confirmed statically (`update` absent from the chain → `unknownArgs` → `claudeArgs` → `--settings` appended unconditionally)
> - Unit suite 792/792, but `src/index.ts` has no test coverage, so that isn't evidence for this change
>
> ## Known limitation
>
> Like every other branch in this chain, the match is on `args[0]`, so `happy --yolo update` still falls through. Consistent with the existing 15 branches; worth fixing separately if you want it.

## 7. A note on the verification environment

All 10 live sessions on this machine run from the `dist` of the canonical tree `~/Developer/happy-integration`, so **`pnpm install` is off-limits there** (it would poison them — see the existing writeup). What I did instead was **symlink** `node_modules` and `tools/unpacked` in from an idle worktree.

Opus verified that this setup **happened to be safe** (that worktree's `git diff --name-only` against `origin/main` is empty) — but it also pointed out that my reasoning at the time was "the lockfile sha256 matches", and **that doesn't get you to identical trees**. Wrong reasoning, right conclusion. Luck, this time.
