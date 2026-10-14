[English](happy-cli-two-fixes.md) · **中文**

# 两个 happy-cli 上游修复：双查把三个砍成两个

> 这两折的正文**将原样发到公开仓 `slopus/happy`**，署你的名。所以要的是终审，不是过目。

## 1. 起点：两个真·low hanging fruit

按你那份「给业余维护者投 PR 的打法」筛上游 open issue（**fix 收 feature 死 / 零决策成本 / 修完就完了不留维护面**），挑出两个：

| Issue | 报告人 | 症状 |
|---|---|---|
| **#1532** | `YesYouKenSpace` | `happy --version` 不打印版本，反而开一个会话 |
| **#1529** | `kaovilai` | `happy update` 报 `error: unknown option '--settings'` |

摸代码时**顺手捡到第三个**：`happy --help` 里那段「Claude Code Options」在**任何安装上都没打印过**——`claudeCliPath` 指向的 `claude_local_launcher.cjs` 没有 shebang、git 模式 `100644`，`execFileSync` 直接执行它必然失败，`catch` 把真相压成一句「Make sure claude is installed」。

于是本来是三个 PR。

## 2. 双查（Opus + agy 各一路，对抗性 prompt，互不透风）

**结论：三个都不能按原样发。**

### 我自己犯的两个错

**① 我往 stderr 引入了污染，而它就在我自己的实测输出里。**

我给 `--version` 加了「顺手也打印 claude 版本」。分流一看：

```
stdout:  happy version: 1.2.0
         2.1.185 (Claude Code)
stderr:  Using Claude Code v2.1.185 from Homebrew   ← 新增的
```

那行是 `getClaudeCliPath()` 每次都打的。我在终端里两个流混着看，**盯着它却没认出来是我引入的**。同一个文件 `claude_version_utils.cjs:518` 早就写对了（`stdio:['ignore','pipe','ignore']`）。

**② 我拿「单测 792/792 全绿」当证据，那个绿灯是空的。**

`src/index.ts` **零测试覆盖**——unit project 只 include `src/**/*.test.ts`，没有 `index.test.ts`，89 个测试文件里没有一条碰子命令分发。两路 review 独立指出同一件事。792 绿只证明「我没碰别人的东西」。

这是 2026-07-27 那次「我写了程序来验证 ≠ 验证过了」的同型复发：**尺子量不到的类别，量完宣布没问题，逻辑上是空的，但长得非常像证据。**

### review 抓到的其他硬伤

- **claude 没装时，`happy --version` 会变成一屏安装广告 + `exit(1)`。** happy 支持 codex/gemini/agy/acp/openclaw，**claude 不是必需依赖**。纯 codex 用户查个版本号会看到 12 行「Claude Code is not installed」。这个后果**完全来自我额外加的那半**。
- **`upgrade` 是 `update` 的别名**（`claude --help` 写的是 `update|upgrade`），我漏了，`happy upgrade` 会复现同一个错。
- **信号退出码**：子进程被 Ctrl+C 杀掉时 `status` 是 null，我一律报 1；应该报 `128 + signal`（SIGINT → 130）。
- **Windows 上是 `ENOENT` 不是 `EACCES`**——结论（从未打印过）成立，但理由只对 Unix。
- **CI 里真有消费者，我 grep 漏了**：`.github/workflows/cli-smoke-test.yml:79` 跑 `timeout 10s happy --version`，:231/:233 是 Windows 版；`scripts/install-local.cjs:49` 非零退出会 `process.exit`。**这反过来是 #1532 最强的论据**——CI runner 上没凭证，那一步多半正卡在登录界面靠 `timeout` 兜着。

### 两路矛盾的一处，我判了

`process.execPath` vs `claudeLocal.ts` 里硬编码的 `'node'`：agy 判「证伪，必须一致」，Opus 判「选择对、但你注释引错了参照对象」。

**我采 Opus**：`claude_version_utils.cjs:514` 本来就是 `isJsFile ? process.execPath : cliPath`，仓库里已有先例；而且绝对路径反而绕开了 Windows 的 PATH 解析问题（cross-spawn 那套是为解决 `node`→`node.exe`）。注释已改成引 `claude_version_utils.cjs`。

### agy 单独报的一条，我判为存疑

agy 说「离线降级路径下 `hookSettingsPath` 不会被设，所以断网时 `happy update` 反而能成功」。我去查 `runClaude.ts:502`，`generateHookSettingsFile()` 是**无条件调用**的，没找到它说的那个分支。**agy 有编造前科**（7/27 那次子串匹配假阳性），这条不采信，但也没能彻底证伪。

## 3. 病根：我又犯了 playbook ④(b)

PR1 里我塞了两件事：

- **(a) 别开会话** —— 真 bug fix，一行 `process.exit(0)`
- **(b) 顺手打印 claude 版本** —— 为「保住原有行为」加的

**两个 blocker 全部来自 (b)。** 砍掉 (b)，PR1 缩成一行，两个 blocker 一起消失。

而且 Opus 给了个反驳，说明 (b) 那个顾虑本身就不成立：**`-h/--help` 的同款 pass-through 早就是死代码**（help 分支直接 `exit(0)`）。help 那边根本就没打印 claude 的东西——所以「version 也不该打印」才是一致的。

## 4. 最终形态

| | 决定 | 理由 |
|---|---|---|
| **PR1** #1532 | **发**，砍成一行 | 去掉 (b)，两个 blocker 消失 |
| **PR2** #1529 | **发**，修完四处 | 补 `upgrade`、修信号码、改正注释引用、**改成直接起真实 claude 二进制而不是走 launcher**（v2） |
| **PR3** `--help` | **不发** | 修好会多吐 225 行 / 15.6KB 淹没 happy 自己的帮助；上游更可能想**删掉**那段而不是点亮一个从未交付过的行为——**那是产品决策，按判据属于「会死」那侧**。worktree 已清 |

### 两处我没能验证

> **v2 更新（2026-07-30）**：下面第 1 条**已经不存在了**。原方案让 PR2 走 `claude_local_launcher.cjs`，于是有了「`DISABLE_AUTOUPDATER=1` 会不会挡住 `claude update`」这个悬案。
> 你说要自己验，我先摸了下代价：claude 不是 brew formula 而是 npm 装进 Homebrew 前缀的，**装的 2.1.185、npm 上最新 2.1.220 —— 更新是真的可用**，跑下去会在 10 个活跃 session 底下换掉二进制。
> 所以改成**把问题消掉而不是回答它**：`claude_version_utils.cjs` 里的 `findGlobalClaudeCliPath()` 是安静的（stderr 实测为空），直接返回真实二进制路径。PR2 现在绕开 launcher 直接起 claude ——**没有 `DISABLE_AUTOUPDATER`、没有 fetch 劫持、没有那行横幅，也不用动你的机器**。
> `createRequire` 这个引法在本包里有先例（`src/commands/server.ts:5,14`）。§5 的 diff 和 §6 的 PR2 正文都已按新形态更新。

1. ~~**`DISABLE_AUTOUPDATER=1` 会不会挡住 `claude update`。**~~ 见上，已消解。
2. **`--settings` 报错没端到端复现过**（怕真触发更新），只有静态推理链。

## 5. 两个 diff

**PR1** —— `fix/version-flag-should-not-start-session`，只动 `packages/happy-cli/src/index.ts`：

```diff
     if (showVersion) {
       console.log(`happy version: ${packageJson.version}`)
-      // Don't exit - continue to pass --version to Claude Code
+      // Exit here, the same way the --help branch above does. Falling through runs
+      // auth, starts the daemon and opens a session just to answer a version query.
+      process.exit(0)
     }
```

**PR2** —— `fix/update-subcommand-passthrough`，同样只动一个文件：

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

## 6. 两份 PR 正文（要发出去的原文，请逐句看）

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

## 7. 验证环境的一处交代

本机 10 个活跃 session 全都从 canonical 树 `~/Developer/happy-integration` 的 `dist` 跑，所以**不能在那儿跑 `pnpm install`**（会毒死它们，见既有记录）。我的做法是从一棵闲置 worktree **符号链接** `node_modules` 和 `tools/unpacked` 过来。

Opus 帮我查证了这个环境**碰巧是安全的**（那棵 worktree 对 `origin/main` 的 `git diff --name-only` 为空）——但它同时指出，我当时的理由是「lockfile sha256 一致」，**那推不出树一致**。理由错了、结论对了，这次是运气。
