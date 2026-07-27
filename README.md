<div align="center">

# 御笔朱批 · zhupi

**A reading desk for AI-authored documents.**<br>
Your agent submits a long document as a pull request. You read it *rendered* — not as a raw diff — highlight any sentence to leave a comment, submit the batch, and the agent revises. Merge = final.

**AI 产出的阅读批注台。**<br>
agent 把长文档当「奏折」以 PR 呈上来，你在**渲染态**正文上划句落「朱批」，批完一键呈回，agent 逐条回话改出下一版；**钦此** = merge = 定稿。

[**Live app**](https://charliezong18.github.io/zhupi) · [Spec](SPEC.md) · [Backlog](BACKLOG.md)

</div>

![划句落朱批](assets/shots/annotate.png)

*Real screenshot, demo data. 真实截图，内容为演示数据。*

---

## Why · 为什么

Reviewing a 3,000-word doc your agent wrote is not a chat problem. You want to read it start to finish, mark the eight places that are wrong, hand them all back at once, and see how each one was handled in the next revision. GitHub's PR review does exactly that — except a markdown PR shows you `+` and `-` prefixed source, tables unreadable, and the comment gutter is invisible until you hover the right pixel.

zhupi is a lens over the same PR: same comments, same threads, same merge. It just renders the document like a document.

读 agent 写的三千字，不是聊天问题。你要从头读到尾、标出错的八处、一次性交回去、下一版逐条看怎么处理的——GitHub 的 PR review 正是这个形状，只是 markdown PR 给你的是带 `+`/`-` 前缀的源码：表格没法看，批注入口藏在悬停才出现的行号旁。

朱批是同一个 PR 的一片镜片：批注还是那些批注，线程还是那些线程，merge 还是那个 merge，只是把文档当文档渲染。

| PAIN | zhupi |
|---|---|
| markdown diff doesn't render · markdown diff 不渲染 | 只展示渲染态正文 |
| comment entry isn't discoverable · 批注入口不自发现 | 划选即批，唯一主交互 |
| `approve` blocked by "author cannot approve" · approve 被作者身份堵死 | 自带「钦此」= squash merge |
| links drop you into a logged-out 404 · 外链掉登录态 | 自带渲染，不跳外链 |

## How it works · 原理

No server, no build step, no dependency chain. The browser talks to `api.github.com` directly with your own fine-grained token, which never leaves your device. Your documents, versions and review threads all stay in GitHub — this app is a lens you can take off at any time.

无后端、无构建、无依赖链。浏览器用你自己的 fine-grained token 直连 `api.github.com`，钥匙只存在这台设备。文档、版本、批注循环全留在 GitHub，这个 app 只是一片随时可以摘掉的镜片。

```
你的 agent ──开 PR──▶  review repo (private)  ◀──朱批──  你
                              │
                              └── merge = 定稿 = 交付
```

## Quick start · 上手

**1. Pick a review repo · 准备一个奏折仓库**

Any repo your agent can open PRs against. Private is recommended — the app never publishes anything, but your drafts probably shouldn't be public either.
任何一个 agent 能往里开 PR 的仓库，建议私有。

```
your-review-repo/
└── docs/
    └── <slug>.md      ← 一篇奏折 = 一个分支 + 一个 PR
```

**2. Open the app and hand it a key · 开 app，给一把钥匙**

Go to [charliezong18.github.io/zhupi](https://charliezong18.github.io/zhupi) (or your own fork's Pages URL). Fill in `owner/repo`, then paste a [fine-grained PAT](https://github.com/settings/personal-access-tokens/new) scoped to **that one repo** with exactly two permissions:

- **Contents: Read and write**
- **Pull requests: Read and write** ← the one everyone forgets; without it the list 403s

![设置页](assets/shots/setup.png)

The token lives in this browser's localStorage only. Lost your laptop? Revoke it on GitHub, blast radius = one repo.
钥匙只存这个浏览器的 localStorage，不经过任何服务器；设备丢了去 GitHub 一键 revoke，爆炸半径 = 一个仓库。

**3. Read, annotate, 钦此**

| Action | What it does |
|---|---|
| Select a sentence → **朱批** | inline review comment anchored to that line |
| **总批** | a conversation comment on the whole PR |
| **提交朱批 · n** | submits the whole batch as one review |
| **钦此** | squash merge = final |

Drafts are kept in localStorage until you submit, so a stray refresh costs nothing.
攒着的批注存在本地，刷新丢不了。

<details>
<summary>Dark mode follows the system · 暗色跟随系统</summary>

![暗色](assets/shots/dark.png)

</details>

## Fork it · 自己开一台

The app hardcodes nothing — no repo, no owner, no analytics. Forking is three steps:

1. **Fork this repo**, then Settings → Pages → Source: *Deploy from a branch* → `main` / root. Your app is live at `https://<you>.github.io/zhupi` within a minute. There is nothing to build.
2. **Create your review repo** (private) with a `docs/` folder.
3. **Open your Pages URL**, fill in `owner/repo` + token. Done.

零写死：没有仓库名、没有 owner、没有埋点。fork → 开 Pages → 填仓库和钥匙，没有构建步骤。

Local development: `python3 -m http.server 4173`, then open http://127.0.0.1:4173 . That is the whole toolchain.

## SOP: the agent side · agent 那一侧的规矩

zhupi deliberately knows nothing about AI. It reads PRs; whoever opens them is your business. The loop below is the convention that makes it work — hand it to your agent (it fits in a CLAUDE.md / AGENTS.md / skill file as-is).

朱批刻意不知道 AI 的存在——它只读 PR，谁开的不管。下面这套惯例是让循环转起来的另一半，可以整段丢给你的 agent。

**Submitting · 呈递一篇**

```bash
git checkout main && git pull -q
git checkout -b <slug>
# write docs/<slug>.md — the artifact ONLY. Metadata goes in the PR body.
git add docs/<slug>.md && git commit -m "<slug>" && git push -u origin <slug>
gh pr create --title "<type>: <title>" --body "<template below>"
```

Two rules that matter:

- **The doc file holds the artifact and nothing else** — no status notes, no "here's what I did". Whatever ships at the end is what's in the file. Everything else goes in the PR body.
- **Don't use `--draft`.** Draft PRs can't be merged, and the REST API can't undraft them (that needs GraphQL). In a single-person repo draft buys you nothing and breaks the 钦此 button.

正文文件只放交付物本身，元数据一律进 PR body；**别用 `--draft`**（draft 不能 merge，转正只能走 GraphQL，私有单人仓里 draft 换不来任何东西）。

PR body template · PR body 五段模板:

```markdown
**目的地 Destination** — where this goes after merge
**TLDR** — three lines, what changed and why
**待你拍板 Decisions needed** — numbered, so comments can say "答 2"
**已知弱点 Known weak spots** — where you want the reviewer to push
**怎么用 How to review** — 「批完在朱批里点提交朱批，然后跟我说一声」
```

**Collecting comments · 收批注**

```bash
gh api repos/<owner>/<repo>/pulls/<n>/comments   # inline: id / path / line / body / in_reply_to_id
gh pr view <n> --comments                        # conversation comments (总批)
```

An inline comment with no reply from you = unhandled. Revise the doc, push, then **reply to every single comment** with how it was handled — 采纳 / 部分采纳+理由 / 不改+理由. That reply thread is what the human reads on the next pass; skipping it is what makes review loops die.

没有你回复的 inline 批注 = 未处理。改完**每条必回**一句处理方式（采纳／部分采纳＋理由／不改＋理由）——下一轮人读的就是这串回话，省掉它循环就断了。

```bash
gh api -X POST repos/<owner>/<repo>/pulls/<n>/comments/<id>/replies -f body="..."
```

**Merging · 钦此**

The human presses 钦此 in the app (or you run `gh pr merge <n> --squash --delete-branch`). Merge = final = ship it to wherever the PR body said.

## Known limits · 已知边界

Honest list, so you know what you're forking:

- **Markdown documents only.** A code PR shows "no markdown here". Unified/split diff review is the north star, not shipped — see [SPEC §10](SPEC.md).
- **Anchoring is loose by design.** A comment is pinned via the rendered block's source line; the quoted sentence is always embedded in the comment body, so even a mis-pinned line never loses the meaning. Rationale in [SPEC §9](SPEC.md).
- **GitHub only allows comments on lines present in the PR diff.** New files are entirely in the diff, so 奏折 always works; editing an existing file limits which lines you can pin. The app validates locally before submitting, because GitHub's review submit is atomic — one bad line number kills the whole batch.
- **Desktop first.** Mobile + PWA is v1 ([designs already drawn](SPEC.md#1-设计渲染图)).
- **No notifications, no unread state, no feed.** Deliberately ([SPEC §3](SPEC.md) non-goals).

## Layout · 结构

```
index.html        entry (setup page + app shell)
src/app.js        main flow: key / list / reading
src/github.js     GitHub API wrapper
src/annotate.js   selection → anchor → margin cards → submit
src/render.js     markdown → HTML (blocks carry data-line for anchoring)
src/style.css     宣纸 / 墨 / 朱砂
vendor/           markdown-it, vendored — no npm, no lockfile
```

Total app code is about 1,000 lines. The [architecture switch gate](MIGRATION-WATCH.md) says when zero-build stops being the right call, in numbers rather than vibes.

全部应用代码约 1000 行。什么时候零构建撑不住了，[量化闸门](MIGRATION-WATCH.md)说了算，不靠感觉。

## License

[MIT](LICENSE) © Charlie Zong
