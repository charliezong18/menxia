**English** · [中文](sys-00-overview.zh-CN.md)

# System Design 00 · Overview

> **v2 (2026-07-31)**: Absorbs cross-model review #44 (decision-independent parts) + the M0 spike verdict (#49). This doc: records M0 as "settled / conditional pass" and adds the M1 Day-1 live-rerun gate; adds the Docker/Podman hard deployment requirement; the transport is now settled (plain Bearer + Streamable HTTP); the push-channel cell is realigned to sys-06's Telegram-first (#44-15); folds the M1 must-carry four fixes into the "can clear to zero" acceptance criteria. The review desk platform is renamed to menxia (the reading desk); zhupi → menxia. The Contract 2 diagram is synced to the state rename and gains `stalled`/`source_gone` (v2 review patch).

> 中书门下 (Secretariat-Chancellery) —— The 中枢 (the central hub) built on a self-hosted [Happy (2)](https://github.com/slopus/happy2) for personal agent outputs. **Taking the plugin route, not forking upstream.**
> Previous context: [List of pending decisions](agent-hub-open-questions.md) · [Base feasibility and legal risks](happy2-as-base.md) · [Relationship with Happy (2)](zhengshitang-and-happy2.md) · [v1 design](zhengshitang-v1-design.md)

**Date**: 2026-07-30 · System Design v1 ｜ **Revised**: 2026-07-31 · v2

---

## I. What this system does

In one sentence: **Aggregate scattered agent outputs into a single inbox that can be cleared to zero, read and review them, and dispatch them for execution.**

Three-step closed loop: **收 (ingest) → 判 (decide) → 派 (dispatch)**. Upstream only lacks the first two steps; the third step uses its directly.

---

## II. Component list

| # | Component | Runs where | One-sentence duty | Design doc |
|---|---|---|---|---|
| 1 | **Ingester** | Each person's own machine | Scans local sources, POSTs new outputs to the core | [01](sys-01-ingester.md) |
| 2 | **Core** | Plugin container | The single source of truth for an item: storage, state machine, API | [02](sys-02-core.md) |
| 3 | **Inbox** | Browser (full-page App) | Read, layer, clear to zero | [03](sys-03-inbox-app.md) |
| 4 | **Review desk** | Browser (full-page App) | Sentence-level annotation, approve/reject | [04](sys-04-review-app.md) |
| 5 | **Ranking** | A module inside the core | Decides what ranks first | [05](sys-05-ranking.md) |
| 6 | **Notifier** | Background process inside the core | Calls the person over (two outlets) | [06](sys-06-notifier.md) |
| 7 | **Dispatch** | Upstream agent (Rig) | Execute after approval | [1-pager](dispatch-1pager.md) |
| 8 | **Runtime and 班子 (an installation / "team")** | Deployment layer | How many to install, who can see which installation | [07](sys-07-runtime-tenancy.md) |

**Not built ourselves**: Accounts and authentication, channels, projects, scheduled tasks and run logs, agent execution, desktop client —— all use upstream. **Push**: M1–M2 rides the local `tg-notify.sh` (Telegram-first); the notifier only **decides** core-side and a local worker pulls and **delivers**; happy2's built-in `pushRoutes` is a later "switch only if you'll actually read it" option, not the default (#44-15 · see [06](sys-06-notifier.md)).

---

## III. Architecture diagram

```
┌───────────────────────────────────────────────────────────────┐
│  happy2 server (self-hosted, rented server)                   │
│  accounts / channels / projects / automations / agent (Rig)   │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  中书门下 plugin (1 installation = 1 班子)                 │  │
│  │                                                          │  │
│  │   ┌────────────┐   ┌──────────┐   ┌──────────────────┐  │  │
│  │   │  Core API  │──▶│  SQLite  │◀──│  Background proc │  │  │
│  │   │  (MCP)     │   │          │   │  archive/poll/not│  │  │
│  │   └─────▲──────┘   └──────────┘   └────────┬─────────┘  │  │
│  │         │                                   │            │  │
│  │   ┌─────┴───────┐  ┌──────────────┐        │            │  │
│  │   │ Inbox App   │  │ Review Desk  │        │            │  │
│  │   └─────────────┘  └──────────────┘        │            │  │
│  └───────────▲─────────────────────────────────┼───────────┘  │
└──────────────┼─────────────────────────────────┼──────────────┘
               │ ① POST /items (new outputs)      │ ③ Notifier
               │ ② GET  /fetch (fetch back)       ▼
     ┌─────────┴─────────┐              Telegram / OB homepage
     │ Ingester + worker │
     │ (own machines)    │
     │ Local source/cred │
     └───────────────────┘
```

**Three data streams**, all initiated by the worker or pushed by the core, **the server never actively connects to your machine**:

1. **Ingest**: worker spots new output → `POST /items` (only sends metadata + pointer)
2. **Fetch back**: frontend wants to read body → core pulls from the owner worker of that item → does not hit disk
3. **Notifier**: background process only **decides** it's time to call the person over and exposes pending-notifications; **delivery is done by the local worker via long-poll pull, executed locally** (`tg-notify.sh` / writes OB homepage) —— the server never dials into your machine (#44-4 · see [06](sys-06-notifier.md))

**Ingress/egress path (verified by M0, #49)**: all three data streams ride happy2's plugin bridge `GET|POST /v0/pluginInstallations/:installationId/mcp`, auth = **plain Happy Bearer** (no plugin-specific token), MCP Streamable HTTP (GET+POST only). Installation not `ready` → 503. This settles the former sys-01 "what to use for the long-lived connection" open item.

---

## IV. Four contracts across components

These four are the only coupling points between components; modifying them requires touching multiple components. Otherwise, internal changes to each component are unrestricted.

### Contract 1 · The shape of an "item"

```
{ id, owner_user_id, source_id, external_key,
  title, summary, tier, state, priority, body_ref, timestamps }
```

- `external_key` is the **stable identifier on the source side** (PR number, file path+mtime, URL). The core uses `(source_id, external_key)` for idempotency; duplicate delivery is a no-op.
- `body_ref` is a **pointer, not the body** (see Contract 3).
- `tier` is **declared by the source**, not guessed by the core.

### Contract 2 · State machine

```
new ──▶ read ─────────────────────────────▶ closed
  │                                          ▲
  └──▶ awaiting_decision ──▶ approved ──▶ running
                    │                        │
                    └──▶ rejected ───────────┘
         source_gone ──▶ closed (source vanished; auto-close)
         running ──▶ stalled (timeout; alert-only, revertible)
                                    abandoned (enter from any state)
```

- Only the **core** can change the state. The frontend and ingester can only request; they cannot write directly.
- `running` **does not count as uncleared** —— it is waiting for an agent, not waiting for a person.
- `awaiting_decision` **never expires on a timer** — the only automatic close is source-side disappearance `source_gone` (#44-2); `fyi` is archived 7 days after entering `read`.

### Contract 3 · Body never hits the server disk (one exception)

- By default, only `body_ref` (`{worker_id, kind, locator}`) is stored. When the body needs to be read, the core fetches it from the worker; **the response does not hit the disk and does not enter logs**.
- **The only exception**: documents you explicitly send into the review desk will have a `doc.text` snapshot saved —— because annotation anchors must be anchored to an immutable text. This is an **explicit action**, not an automatic sync.

Reasoning see [Legal risk report](happy2-as-base.md) §4④: happy2 lacks end-to-end encryption, `messages.text` is a plaintext column.

### Contract 4 · External input never enters operation tier

Dispatching is split into two tiers. **Any string from external content (news headlines, webpages, RSS, emails) can never appear in the prompt of an operation tier task.** See [Dispatch 1-pager](dispatch-1pager.md) for details.

---

## V. Tech stack selection

| Layer | Selection | Reason |
|---|---|---|
| Plugin server | TypeScript + MCP SDK | Upstream plugin SDK is TS, `happy2-plugin-todos` is a ready-made template |
| Storage | `node:sqlite`'s `DatabaseSync` | Same as upstream todos plugin, zero extra dependencies, single file is easy to backup |
| Frontend | React, single file bundle | `registerHtmlAppResource` wants exactly a single file HTML |
| Ingester / worker | Go | Matches the stack of the new Snap team; perfect for long-running polling and local file scanning |

**Why the server doesn't use Go**: The plugin server must be an MCP server and must consume upstream SDK types; using TS saves an entire layer of glue. Go is placed on the **ingester and worker** —— those two are independent processes, free to choose their language, and exactly in the sweet spot of "long-running + polling + concurrent IO".

---

## VI. Milestones and corresponding components

| Milestone | Components involved | Completion criteria |
|---|---|---|
| **M0** | Topology spike (1–2 days, before everything) | ✅ **Settled · conditional pass** (#49): the bridge really exists, auth is a plain Bearer, the ingest / fetch-back / notification-pull three-stream architecture holds; the `egress-is-closed` assumption is falsified (see §III and the decision box below). **Only remaining**: happy2 has no non-container plugin runtime (providers hardcoded `docker \| podman`), and the local mini has neither → **M1 Day-1 gate: first rerun the spike kit live on the real server, all three criteria live-green, before writing any business code** |
| **M1** | Core + Inbox + Ingester (only `github_pr`) | Pending PRs appear in the inbox, clicking jumps to the menxia (the reading desk) deep link. **"Can clear to zero" requires all M1 must-carry four fixes** (note below) |
| **M2** | + 2 Obsidian sources + Ranking + Notifier | Called over once a day, finish reading in one sitting, able to clear to zero |
| **M3** | + Runtime and 班子 (install a second set) | Two installations each read their own, data directories are mutually invisible |
| **M4** | + menxia review desk | A document can have sentence-level 涂归 (inline comments), approve/reject |
| **M5** | + Dispatch | Can be dispatched after approval, can take over, verified that research tier cannot write |

**M1–M2 is the minimum closed loop to "use it comfortably yourself first".**

**M1 must-carry four fixes** (not new requirements —— they make the "can clear to zero" criterion true, #44-2/3/6/8): ① source-gone semantics `source_gone` + auto-close ([01](sys-01-ingester.md)/[02](sys-02-core.md)); ② the inbox's fourth section "approved-awaiting-dispatch" ([03](sys-03-inbox-app.md)); ③ ingest hard-codes the tier→state mapping + a two-way `set_tier` ([02](sys-02-core.md)); ④ dual-host backup (host-side cron + worker pulling a copy back to the mini, [02](sys-02-core.md)/[07](sys-07-runtime-tenancy.md)).

**Deployment hard requirement (M0 adds, #49)**: the host must have Docker or Podman (the happy2 sandbox provider recognizes only these two). Trivial on a rented Linux server; the local mini currently has neither —— this affects local dev and reruns only, not the production topology.

---

## VII. Global open items

| # | Open item | Blocked by |
|---|---|---|
| 1 | How exactly the two-tier permissions land on happy2 (Happy 1 passed `permissionMode` through directly, happy2 uses Rig, mechanism unverified) | M5 |
| 2 | How `chatId` gates app instance visibility | The third kind of 班子 in M3 (restricted to specific few people) |
| 3 | Whether the name is ultimately "中书门下" or something else (waiting for you to discuss with friends) | One-time rename of file slugs |
| 4 | prior inventions declaration text (suggest consulting a lawyer first) | Doesn't block tech, blocks ownership |
