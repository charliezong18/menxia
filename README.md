# 御笔朱批 · zhupi

A reading desk for AI-authored documents. Agents submit long documents ("奏折") as draft PRs to a private review repo; you read them rendered — not as raw diff — highlight any sentence to leave a comment ("朱批"), submit the batch, and the agent revises. **钦此** = merge = final.

Static single-page app on GitHub Pages. The browser talks to the GitHub API directly with your own fine-grained token; there is no server, no build step, no dependency chain. Data, versions and the review loop all stay in GitHub — this app is just a lens you can take off at any time.

AI 产出的阅读批注台。agent 把长文档当「奏折」以 draft PR 呈上来，你在**渲染态**正文上划句落「朱批」，批完一键呈回，agent 逐条回话改出下一版；**钦此** = merge = 定稿。

纯静态单页，托管在 GitHub Pages，浏览器用你自己的 fine-grained token 直连 GitHub API——无后端、无构建、无依赖链。数据、版本、批注循环全留在 GitHub，这个 app 只是一片随时可以摘掉的镜片。

## Status · 进度

- **M1 骨架** ✅ 钥匙设置 / 待批清单 / 渲染阅读
- **M2 朱批** ⏳ 划选 → 右缘批注栏攒批 → 一键呈回（含总批）
- **M3 闭环** ⏳ 批注串与回话展示、钦此
- v1：移动端 + PWA｜北极星：diff 奏折（代码 PR 同一入口）

Spec: [`SPEC.md`](SPEC.md)（含 §8.1 架构切换 breakpoint）· 迁移观察：[`MIGRATION-WATCH.md`](MIGRATION-WATCH.md)

## Setup · 用法

1. 打开 https://charliezong18.github.io/zhupi
2. 按页面指引生成 fine-grained PAT（只授权 `charliezong18/review` 一个仓库，权限 Contents: Read + Pull requests: Read and write），粘进去
3. 钥匙只存在这台设备的浏览器 localStorage，不经过任何服务器；手机丢了去 GitHub 一键 revoke 即可

## Layout · 结构

```
index.html        入口（设置页 + 主界面骨架）
src/app.js        主流程：钥匙 / 清单 / 阅读
src/github.js     GitHub API 封装
src/render.js     markdown 渲染（块级元素带 data-line，供锚定用）
src/style.css     宣纸 / 墨 / 朱砂
vendor/           markdown-it（vendored，无 npm 依赖）
```

本地开发：`python3 -m http.server 4173`，然后开 http://127.0.0.1:4173 。
