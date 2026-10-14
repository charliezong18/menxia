---
created_by: claude
created: 2026-07-24
updated: 2026-07-25
title: Happy 贡献 Tracker
tags: [happy, oss, tracker]
---

# Happy 贡献 Tracker

上游 = [slopus/happy](https://github.com/slopus/happy)　fork = charliezong18/happy　我 = @charliezong18

**这份是贡献状态的 SSOT。** 流程规矩看 [[Happy 贡献流程 Playbook]]，本地环境/自建版看 [[Happy 自建版说明书]]。
一条 PR 从右往左走：💡 点子 → 🔨 在开发 → 📦 待发 → 👀 待 review → ✅ merged。

---

## 👀 待 review（已发，等上游）

| PR | 标题 | 发出 | CI | 状态 |
|---|---|---|---|---|
| [#1596](https://github.com/slopus/happy/pull/1596) | fix: keep the picked model and effort across an abort | 07-26 | 单测 red→green ✅ + codex 单测 118 ✅ + typecheck ✅ + e2e before/after 日志 | OPEN；Fixes #1595；分支 fix/preserve-model-on-abort（worktree happy-wt-model-abort）；Charlie 亲历 bug（abort 后 Fable→Opus4.8）；证据 EVIDENCE-model-abort.md（未提交）；双 review：/code-review 无 blocker + agy APPROVE；等 Codex auto-review |
| [#1567](https://github.com/slopus/happy/pull/1567) | fix(app): keep unread badges when saving a draft or removing a machine | 07-24 21:55Z | typecheck ✅ | OPEN，非 draft，MERGEABLE，0 评论，未 review |
| [#1568](https://github.com/slopus/happy/pull/1568) | fix(app): keep new-session mode selections per agent | 07-25 01:35Z | 784/784 ✅ + typecheck ✅ | OPEN；分支 feat/per-agent-draft-modes（worktree happy-wt-draft-modes）；⏳ 待补截图 |
| [#1569](https://github.com/slopus/happy/pull/1569) | fix(app): clear stale draft selections when agent defaults change | 07-25 03:05Z | 787/787 ✅ + typecheck ✅ | OPEN；**叠在 #1568 上**（分支 feat/clear-stale-draft-on-default-change），#1568 合并后需 rebase；这才是「设了默认还是 4.8」的对症修 |
| [#1570](https://github.com/slopus/happy/pull/1570) | feat(cli,app): support image attachments in agy sessions | 07-25 06:30Z 前后 | typecheck ✅，smoke×4 跑着（本地 792+779 全绿） | OPEN，MERGEABLE；截图已贴 ✅；干净分支 feat/agy-image-attachments（cherry-pick `2066e102`→`7d08759b`）；Fixes #1559；等 Codex auto-review → resolve 后请人 review |
| [#1571](https://github.com/slopus/happy/pull/1571) | feat(cli,app): surface Antigravity (agy) quota in the session status bar | 07-25 07:00Z 前后 | 本地 CLI 800/800 + app 780/780 + 双 typecheck ✅ | OPEN；分支 feat/agy-usage-quota-chips（`771b7018`）；截图复用 #1570 附件（右下角 agy 100% chip）；body 如实披露 OAuth client 从 agy 二进制扫取，reviewer 问了由我答 |
| [#1572](https://github.com/slopus/happy/pull/1572) | docs(cli): disclose that the agy backend never prompts for tool approval | 07-25 | docs-only，typecheck ✅ | OPEN；分支 docs/agy-print-disclosure（`94ecd533`）；Opus 实现→Fable review→措辞精修流水线产物 |
| [#1573](https://github.com/slopus/happy/pull/1573) | feat(app): use the real Antigravity icon for agy sessions | 07-25 | app 779/779 + typecheck ✅ | OPEN；分支 feat/agy-icon（`40f77bf5`）；3 PNG 提自官方 icns + Avatar.tsx 补 `agy` 键（原头像 fallback 到 claude）；视觉证据=GitHub 二进制 rich diff 自带 |
| [#1574](https://github.com/slopus/happy/pull/1574) | feat(cli): resume agy conversations across session restarts | 07-25 | CLI 785/785 + typecheck ✅ | OPEN；分支 feat/agy-session-resume（`4ae74854`）；Part of #1558（CLI 侧全通；app 侧 4 处 follow-up + reconnect-in-place 是后续）；review 抓到的一跳即断 bug 已修 |
| [#1575](https://github.com/slopus/happy/pull/1575) | chore(app,cli): finish deprecating the remaining gemini surfaces | 07-25 | app 779/779 + 双 typecheck ✅ | OPEN；分支 chore/gemini-deprecate-remaining-surfaces（`1501e8c6`，origin/main 重切零冲突）；Part of #1540；截图✅（raw 链接挂 fork `assets/pr-screenshots` 分支——Chrome 没登 GitHub 走不了 web 上传，API 建 orphan 分支绕的） |
| [#1576](https://github.com/slopus/happy/pull/1576) | feat(cli,app): per-model effort levels and current model slugs for agy | 07-25 | cli agy 22/22 + app 780/780 + 双 typecheck ✅ | OPEN；分支 feat/agy-effort-and-model-slugs（`b92f2183`，重解掉 #1570 的 add-dirs 测试冲突）；截图✅×2；body 写明不接 `--mode`（print 模式不 enforce，实测） |
| [#1577](https://github.com/slopus/happy/pull/1577) | feat(app): optional purple unread indicator + fix unread masking running state | 07-25 | app settings 34/34 + typecheck ✅ | OPEN；分支 feat/unread-purple-indicator（worktree happy-wt-unread-upstream，2 commits：fix 遮盖 + 开关默认关）；fork 版默认开已上线自用（fork PR #4/#6）；**截图✅×2（07-25 已补）** |
| [#1578](https://github.com/slopus/happy/pull/1578) | fix(cli): surface the real launch error instead of a bare notice | 07-25 08:16Z | smoke×4 ✅ | OPEN，MERGEABLE；Claude launcher 失败只报固定文案 "Process exited unexpectedly"，真错误只躺 CLI log；实战踩到（切 model 触发 relaunch 失败 → session 假死无提示）；新增 `launchFailureMessage` helper + 测试，local/remote 两个 launcher 都接上；纯 CLI，与其他 open PR 零文件重叠 |
| [#1579](https://github.com/slopus/happy/pull/1579) | fix(app): keep live thinking state across a full session refetch | 07-25 | app 793/793 + typecheck ✅ | OPEN；分支 fix/preserve-thinking-on-session-refetch（worktree happy-wt-thinking-refetch，+9/−2 单文件 sync.ts）；**这是紫点闪烁的根因**：`fetchSessions()` 写死 `thinking: false`，新建会话触发全量 refetch → 所有正在跑的会话呼吸灯冻住 + 被误判「刚跑完」打上未读。#1577 只是把症状压住；**无截图**（症状是动画停顿，静帧拍不出，body 里已写明）；fork 侧已修并上线（`5a0e5550`，Charlie 已实机验证） |

### 📊 批次总览（07-26 更新：14 个 open，共 +2500 / −207，含 review 修订增量）

评分口径：**重要**＝对用户/上游价值；**紧急**＝不合会持续掉东西吗；**易合**＝体量 × 冲突面 × 需不需要 maintainer 拍板。

| PR | 重要 | 紧急 | 易合 | 体量 | 冲突面 |
|---|---|---|---|---|---|
| #1567 unread badge 修 | 🔴高 | 🔴高 | 🟢极易 | +7/−4，1 文件 | 无 |
| #1579 thinking 状态修 | 🔴高 | 🔴高 | 🟢极易 | +20/−3，1 文件 | 无（sync.ts，与 #1567 的 storage.ts 不重叠） |
| #1596 abort 后丢 model/effort | 🔴高 | 🔴高 | 🟢极易 | +37/−5，3 文件 | 无（runClaude/runCodex，零重叠）；Fixes #1595，带 red→green 测试 + e2e 日志 |
| #1573 agy 真图标 | 🟡中 | 🟡中 | 🟢极易 | +1，4 文件 | 无 |
| #1572 agy 放行披露 | 🟡中 | 🟡中 | 🟢极易 | +9，README | 无 |
| #1578 launch 错误透传 | 🟠中高 | 🟡中 | 🟢易 | +127/−2，5 文件 | 无（纯 CLI launcher，零重叠） |
| #1575 gemini 退役收尾 | 🟡中 | 🟢低 | 🟢易 | +11/−7 | HomeDock(#1568/69)、agents.tsx(#1569)、machine(#1576)、cli index(#1574) |
| #1568 per-agent draft | 🔴高 | 🔴高 | 🟡中 | +230/−63 | #1569 叠在其上 |
| #1569 清 stale draft | 🔴高 | 🔴高 | 🟡中 | +311/−64 | 必须 #1568 先合再 rebase |
| #1574 agy resume | 🟠中高 | 🟡中 | 🟡中 | +179/−4 | runAgy/AgyBackend（#1570/71/76） |
| #1570 agy 图片 | 🟠中高 | 🟡中 | 🟡中 | +335/−11 | runAgy/AgyBackend |
| #1576 agy effort+slugs | 🟠中高 | 🟠中高 | 🟡中 | +152/−26 | runAgy/AgyBackend、machine |
| #1577 紫色未读 | 🟡中 | 🟢低 | 🟠中偏难 | +59/−10，16 文件 | 无，但一个 PR 两件事 + 新增设置项要拍板 |
| #1571 agy 配额 chips | 🟠中高 | 🟡中 | 🔴难 | +754，9 文件 | runAgy；**OAuth client 扫二进制需 maintainer 拍政策** |

**建议合并顺序**（给 maintainer 的）：
1. 秒合组（零冲突、零风险）：**#1567 → #1579 → #1596 → #1573 → #1572**（#1579 是 #1577 症状的根因修，先合）
2. draft 线：**#1568 → #1569**（严格顺序，#1569 合前需 rebase）
3. agy 线（共享 `runAgy.ts`/`AgyBackend.ts`，先合谁后面谁 rebase）：**#1574 → #1570 → #1576**
4. 独立随时可合：**#1578**（纯 CLI，零重叠）；**#1575** 排在 #1569/#1576 之后省一次 rebase
5. 需要讨论后再动：**#1571**（OAuth 政策）、**#1577**（要不要加这个设置项；截图已补）

**Charlie 待办**：#1568 补截图（铁律：PR 必须有端到端视觉证据）。#1577 已补✅；#1579 无静帧可拍，body 已说明。

### 🔍 07-25 Fable double-review（7 个并行 review agent 全覆盖 13 PR）

结论：**2 真 BLOCKER + 1 准 BLOCKER + 4 组 SHOULD-FIX，5 个干净**（#1568/#1569/#1572/#1573/#1575 代码零改动，只有 body 措辞项）。修复已全部落地，**07-25 Charlie 放行后已全部 commit+push**（`293f1df1`/`65e9c173`/`f45dbe2b`/`a6119cc5`/`eaef9d03`/`35a010d6`/`f6fbe1d8`），7 条修订说明评论 + #1568 sequencing + #1569 局限说明已发，#1570/#1572 body 已修订。各自 targeted tests + typecheck 全绿：

| PR | 修了什么 | 验证 |
|---|---|---|
| #1576 | **BLOCKER**：`MessageMetaSchema` 缺 `effort`，zod 剥掉 → Effort 控件纯装饰。补字段 + runAgy 去 cast + 新 `types.test.ts` 3 测试（顺带解锁 codex 中途改 effort） | 23/23 ✅ |
| #1567 | **BLOCKER**：`applyMachines` 第三处漏传 unread set（触发最频繁）；并把参数改必填绝后患 | typecheck ✅（storage.ts 不可单测） |
| #1574 | **准 BLOCKER**：stale seeded id 静默失忆永不自愈 → close handler 加「turn 中 cache 变化且≠pin 才收养」自愈（比 reviewer 原方案多 `≠preTurnCacheId` guard，保住 cross-resume 防线）+ 新测试；daemon resume 的 `--model`/`--permission-mode` 透传 | 24/24 ✅ |
| #1579 | thinking 保留改为 gate on `active`（死 session 不保留）+ 挪到 apply 时同步解析（关 TOCTOU 窗口） | typecheck ✅ |
| #1570 | SIGTERM/SIGINT 清理 + 启动时 7 天龄期 sweep + `--add-dir` latch 跨 turn + offlineSessionStub 补 `sendSessionProtocolMessage` + 2 测试 | 12/12 ✅ |
| #1571 | creds 缓存 0600 + 缓存写失败不丢 token（+测试）+ 双 fetch 10s 超时 + `execFileSync` 平台化查找 | 20/20 ✅ |
| #1578 | ANSI/C0 控制字符剥离 + 2 测试 | 12/12 ✅ |

✅ push 后收尾已全做完（07-25）：#1570 body 测试数改口 + 评论记录与 #1574 的 resume 交互；#1569 局限说明评论；#1568 sequencing 评论；#1572 body 措辞。**剩余唯一待办＝Charlie 给 #1568 补截图**；CI 由 push 自动重跑，绿了无需动作。

**给 @bra1nDump 的 Discord 消息**：07-26 已按「先发 free-to-merge fixes」策略重构成两条（第一条=六个零决策 fix：#1567/#1579/#1596/#1573/#1572/#1578；第二条=其余八个压缩版），⏳ 待 Charlie 发出。**07-27 定策略：循序渐进——权限请求（triage/write）和 rig proposal 都等 Kirill 回复、first batch 合掉之后再提**，proposal 存档在 [[rig Antigravity proposal 草稿]]。

---

## 📦 待发 PR（代码好了，还没开）

### `fix/distrust-impossible-context-window`（happy-wt-ctx-guard，基座 origin/main）

`0cb4290d`，app 侧 +67/−8，app 796/796 + typecheck ✅，**已 merge 进 charlie-main 自用上线**（`23abc680`，纯 app 改动无需 relink CLI/daemon）。

上游 SDK 少报 context window：`claude-opus-5` / `claude-fable-5` 被报成 `200000`，实际走的是 1M 档。于是 `contextSize`（实测单次 prompt 到 355,199）超过分母，百分比 clamp 成 100%，指示器**永久钉死在「0% left」再也回不来**——连"这次真的快满了"的告警一起废掉。修法沿用 #1561 立的规矩「分母不诚实就别画」：新增 `isContextWindowUsable()`（写成 type predicate，两处守卫共用），判据是 `contextSize > contextWindow` 在物理上不可能（超窗口的请求会被 API 先拒），出现即说明分母不可信 → 圈和 "0% left" 都不显示。

⚠️ 发 upstream 前想清楚：根因在 Anthropic 的 SDK，不在 Happy，这只是防御。上游 bug = [anthropics/claude-code#63447](https://github.com/anthropics/claude-code/issues/63447)（同一 bug 已被报 6 次，#35214 已定位到 `has1mContext()` 仍被 closed NOT_PLANNED）。07-25 我已补评论：**同一 model id 会在同一 session 内报出两个不同值**（opus-5/fable-5 都观察到 `[200000, 1000000]`），是现有报告都没有的线索——说明不是"名单漏了一项"，而是解析本身不稳定。

（quota chips 已于 07-25 作为 [#1571](https://github.com/slopus/happy/pull/1571) 发出，见上。）

> ⚠️ 收敛留档（已完成，坑位记录）：#1571 的分支是从 `feat/agy-usage-chip`（happy-wt-agy-chip，基座是 charlie-main）收敛出来的干净分支。**别再直接拿原分支发 PR。** 收敛时踩的三个坑：
> 1. `agyQuotaClient.ts` 里 dedup key 的分隔符写成了**字面 NUL 字节**而不是 `\0` 转义 → 运行时无害，但 git 把 .ts 当二进制、GitHub 渲染不出 diff。
> 2. **载体选错**：charlie-main 那版挂 `metadata.usageLimits`，上游 #1556 最终合的是挂 **`agentState.usageLimits`**（`session.updateAgentState`）。
> 3. app 侧直接 diff 会**回退 #1561**（把 190K 硬编码和 fallback chip 逻辑改回来），只能挑 `agy: 'agy'` 那一条 label + 新测试。

---

## 🔨 在开发 / 待收拾

| 东西 | 状态 | 下一步 |
|---|---|---|
| `chore/gemini-deprecation-agy-refresh`（happy-wt-gemini-agy） | ✅ 07-24 两 commit 齐、双包测试全绿（app 793 / cli 827）：`a8d2ebbf` 补完 gemini deprecation（HomeDock 入口、设置页 section、机器页/dev composer 标注、CLI 子命令警告上移）+ `37becc0b` AGY section 升级（model slugs 含 gemini-3.6-flash、per-model Effort 接 `--effort`、runAgy 接 meta.effort、机器页 Agy 行）；**实测 agy `--mode plan/accept-edits` 在 print 模式不 enforce（plan 照写文件）→ Permission 故意保持 2 档** | ✅ **07-25 全链路部署完成**：merge `b1e4b266` →与远端 #4/#5 汇合 push `795c3017` → Pages 部署 success → happy-integration 归位 charlie-main → rebuild（dist 已验证含 gemini-3.6-flash/setEffort/弃用警告）→ daemon 重启（PID 14748）；**上游 PR 已拆出：#1575 + #1576（见待 review 节）**，worktree 留到 PR 合并后清 |
| `feat/agy-agentapi-spike`（happy-wt-agy-agentapi） | ✅ 调研定案（`5b86a479`）：**agentapi 是 gRPC/mTLS 客户端不是 HTTP 服务**；无流式、无权限事件；env 三件套只注入 sidecar 不落盘→外部进程无受支持发现路径；model 还降级三档粗选→**结论：缓**。stub+17 测试留档 | ✅ findings 已评论到 #1430（07-25，引 #1574）；stub 留 fork 不上游；重启条件=agy 出流式/权限事件 RPC |
| `feat/agy-image-input`（happy-wt-agy-image） | ✅ 07-24 全链路完结：commit `2066e102` → merge charlie-main → push → rebuild → daemon 重启 → e2e 验证成功（agy 识图 OK）→ **上游 PR #1570 已发**（干净分支 feat/agy-image-attachments） | 等 #1570 review；worktree 留到 PR 合并后再清 |
| `charlie-main`（happy-integration） | 个人集成分支，同时是 Pages 部署源；07-25 已 merge #1568+#1569 内容（`92cd79e1`）+ **settings 自愈补丁 `db094d91`**（防 agentDefaultOverrides 被 stale 客户端全量写抹掉；fork-only，已部署）自用，纯 app 侧改动无需 relink CLI/daemon | 五个 PR 合了之后可以 rebase 掉重复提交（动之前找 Charlie 确认）；自愈补丁对应的上游 issue（settings lost-update）还没开 |
| `charlie-main-stale`（`~/Developer/happy`） | 旧 clone，ahead 18 + dirty 3，疑似残留 | 删前按 [[feedback-check-unpushed-commits-before-rm]] 查未 push 的东西 |
| `feat/agy-limit-status-bar`（happy-wt-usage-l1） | 已被 `feat/agy-usage-quota-chips` 取代 | 确认无遗漏后清掉 worktree |
| happy-wt-opus5 | 未提交改动已于 07-24 丢弃（是 #1566 的重复劳动） | 可 `git worktree remove` |

---

## 💡 Backlog 点子

**唯一 Backlog SSOT 是 vault 根 [[📋 Backlog]]**；这里只放 Happy 专属的、还没承诺时间的。有了时间就往上面几节挪。

### 📝 待发 issue（草稿好了，等 Charlie 点头）

- **happy doctor 诊断提案**（`happy doctor` CLI + app 机器页诊断面板）：草稿全文＝`op/outputs/happy-doctor-upstream-issue-draft.md`（07-25 起草）。查重✅无同类提案；引用支撑 issue #989/#1464/#1035/#1123/#1318/#820；待定＝是否保留 Phase 2（app 面板），Charlie 二选一还没答。本地 PoC＝`~/.local/bin/happy-doctor`（私有版，含 fork 专属检查，上游只提通用内核）。发出后编号记到「我提的 issue」表。

### 我提的 issue，还开着（可自己接手）

| Issue | 标题 | 备注 |
|---|---|---|
| [#1565](https://github.com/slopus/happy/issues/1565) | Model picker keys 原样转发给 `claude --model`，没人校验是否合法 alias | #1566 的通用版；#1498 的 fable 是同一失败模式。修法＝加 alias 校验或改成透传全 model ID |
| [#1559](https://github.com/slopus/happy/issues/1559) | agy provider 丢掉 UI 拖拽的图片/多模态 payload | agy 本身有本地识图能力，是 Happy 侧没传 |
| [#1558](https://github.com/slopus/happy/issues/1558) | agy 模式不支持 session resume | 对应 agy backend 的 cross-restart resume-id 打通 |
| [#1540](https://github.com/slopus/happy/issues/1540) | gemini 退役三步走提案 | 第 1 步 #1541 已 merge；**第 2 步（删 spawn 路径）+ 第 3 步（删 backend 代码）还没做** |
| [#1442](https://github.com/slopus/happy/issues/1442) | 暴露 Claude plan usage | PR1（#1556）已 merge。**PR2 = on-demand 详情面板（app→CLI RPC 触发 get_usage）还没写** |

### 别人的 issue，可以捡（reliability 线，对 NIW 有用）

| Issue | 标题 | 为什么是我 |
|---|---|---|
| [#1229](https://github.com/slopus/happy/issues/1229) | Daemon 在 WebSocket 断开后不重连（合盖） | 旗舰级 reliability 修复，无人认领、0 评论，Charlie 自己踩过（"机器离线但 session 还答"） |
| [#1266](https://github.com/slopus/happy/issues/1266) | 补齐缺失的 Claude Code CLI 子命令（agents/mcp/plugin/project…） | 体量大但机械，可拆 |

### agy backend 的遗留（#1430 里明确说了没做）→ 07-25 全部清掉

- ~~真正的 agy 图标~~ → **#1573**
- ~~`agentapi` HTTP 集成~~ → 调研定案「缓」，findings 已评论 #1430，stub 留 fork
- ~~README 披露 `agy --print` 放行~~ → **#1572**
- （顺带：#1558 resume → **#1574**，CLI 侧全通）

---

## ✅ 已 merged（10 个）

| PR | 标题 | merged |
|---|---|---|
| [#1566](https://github.com/slopus/happy/pull/1566) | fix(app): use full model ID for Opus 5 in the Claude model picker | 2026-07-24 21:19:50Z |
| [#1564](https://github.com/slopus/happy/pull/1564) | fix(cli): don't let rate_limit_event wipe a window's utilization | 2026-07-24 21:19:53Z |
| [#1561](https://github.com/slopus/happy/pull/1561) | fix: report the real context window instead of assuming 190K | 2026-07-24 21:22:00Z |
| [#1556](https://github.com/slopus/happy/pull/1556) | feat(cli,app): surface Claude plan rate limits in the session status bar | 2026-07-24 08:57:49Z |
| [#1553](https://github.com/slopus/happy/pull/1553) | fix(cli): keep the session alive when the API rejects a turn | 2026-07-24 07:24:02Z |
| [#1541](https://github.com/slopus/happy/pull/1541) | chore(app): remove gemini from the new-session agent picker | 2026-07-24 07:23:30Z |
| [#1476](https://github.com/slopus/happy/pull/1476) | fix(app): stop session list jumping during multi-session streaming | 2026-07-24 07:55:19Z |
| [#1470](https://github.com/slopus/happy/pull/1470) | feat(app): add Fable 5 to the Claude model picker | 2026-07-03 00:11:12Z |
| [#1440](https://github.com/slopus/happy/pull/1440) | fix(app): sort session list by last activity instead of creation time | 2026-07-03 05:29:09Z |
| [#1430](https://github.com/slopus/happy/pull/1430) | feat(cli): add agy (Antigravity CLI) as an agent backend | 2026-07-11 05:14:44Z |

**7/24 是大丰收日：7 个 PR 当天合掉**（#1541/#1553/#1476 早上，#1556 上午，#1561/#1564/#1566 晚上 21:19–21:22 一口气连点）。
没有 closed-但未合 的 PR —— 发出去的 10 个全进去了。

已关闭的 issue：#1552（被 #1553 修掉）、#1469（→#1470）、#1441（上游自己做了状态栏）、#1429（→#1430）、#1454（daemon start-sync 死锁，已被别人关掉）。

---

## 铁律（别再踩）

- **上游 PR 从 `origin/main` 拉分支，绝不用 `charlie-main`** —— 否则 diff 会夹带个人 fork 的东西、还会回退上游已合的改动。
- **PR 必须有端到端视觉证据**（截图/录屏/真实日志），单测通过不算数；"before" 可以用文字，"after" 必须看得见。
- **先 resolve Codex auto-review 的评论**，再请人 review。
- 一个 PR 一件事，不夹带 drive-by 重构。
- 动 core（sync engine / RPC wire / 加密 / server）**先开 issue 讨论**再写代码。
- commit/push/PR 内容**发出去之前先给 Charlie 过全文**。
- **别在 `happy-integration` 跑 `pnpm install`（或任何会重建 `node_modules` 的命令），除非当时没有活跃 session。** 它会给所有正在跑的 session 埋雷：Node 的 `Module._pathCache` 缓存了 SDK native binary 的 resolve 路径，install 重建 `node_modules/@anthropic-ai/` 后旧路径失效，`existsSync` 返回 false，SDK 把它报成 "Native CLI binary not found"。**不会立刻死**，而是潜伏到下次触发 relaunch（切模型最常见）才暴毙，且不自愈——只能重启 session。细节见 [[fix-happy-pnpm-install-poisons-sessions]]。
- 开新 issue 前先 `gh search issues` 查重。anthropics/claude-code 有 bot 自动判重 + 3 天自动关，重复 issue 基本等于白写。

## 相关

- memory: `project-happy-cli-pr`、`project-happy-selfbuilt-fork`、`feedback-happy-integration-canonical`、`project-happy-agy-integration`
- vault: [[Happy 贡献流程 Playbook]]、[[Happy 自建版说明书]]、[[Happy agy 本地测试 SOP]]、[[Happy 改进 — Issue 草稿]]
- Dashboard 卡片：[[Happy CLI 贡献线]]
