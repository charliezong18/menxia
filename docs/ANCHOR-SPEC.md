# 门下锚定规范（原生实现对照页）

> English version: [ANCHOR-SPEC.en.md](ANCHOR-SPEC.en.md)
>
> 读者：menxia-ios（N1–N4）实现者。**只读这页 + `test/golden/` 就该能写对。**
> 期望值全部由现行 web 代码生成（`test/golden/export.mjs` 直接调 `src/` 原函数，不复制逻辑），
> `test/golden.test.js` 每次重生并逐字比对——web 规则一变 web 测试先红。行号以 2026-10-13 `origin/main`（6cd05e6）为准。
> 来源：review #182 N0。

## 0. golden 文件怎么用

| 路径 | 内容 |
|---|---|
| `test/golden/corpus/*.md` | 29 篇语料：`real-*` 16 篇真折（来源 `corpus-sources.json`），`edge-*` 13 篇构造边角 |
| `expected/<名>.blocks.json` | 每个带 `data-line` 的块，**文档序**：`{i, type, tag, line, lineEnd, parent, level?, info?, text}` |
| `expected/<名>.toc.json` | `outline`（h1–h3，= `extractOutline`）、`hasOutline`（≥3 条）、`headings`（h1–h6 全部 + slug） |
| `expected/<名>.anchors.json` | `anchors`：选区 → `computeAnchor` 输出 + `rangeForDraft` 回放；`reanchorByQuote`；`sectionOf` |
| `expected/functions/*.json` | 纯函数 `{input, output}` 表：stripFrontmatter / stripBareAnchors / slugify / makeSlugger / matchAnchor / validRightLines / parseCommentBody / fmtDraft / threadComments / buildReadStateBody / parseReadState / isReadStateComment / shouldPromptJump |
| `manifest.json` | 所有语料与期望文件的 sha256。**原生仓的拷贝方式 = 整目录复制 + 校验此清单**（XCTest 先验 sha 再比内容） |

- `type` ∈ `paragraph | heading | list_item | table | table_row | blockquote | fence | code_block`；`tag` 是承载 `data-line` 的 HTML 元素（`p h1-6 li table tr blockquote code pre`）。
- `parent` = 最近的带行号祖先块下标（嵌套：松散 li ⊃ p、table ⊃ tr、blockquote ⊃ p）。
- `text` = 该元素的 **DOM `textContent`，逐字、不做任何空白规范化**（含标签之间的 `\n`）。偏移全部以它为基准。
- anchors 用例：`{block, blockStart, length, docStart, expect, replay}`。`block`/`blockStart` = 选区起点所在块（最内层）及块内 UTF-16 偏移；`docStart` = 相对全文 textContent 的偏移；`expect` = `{blockLine, line, offset, quote, quoteRaw}` 或 `null`；`replay` = 用同一草稿走 `rangeForDraft` 命中的 `{block, start, length}` 或 `null`。

## 1. 预处理（解析前，按字节串做，**先 frontmatter 后裸锚**）

`renderMarkdown = md.render(stripBareAnchors(stripFrontmatter(text)))`（`src/render.js:154-155`）

1. **frontmatter** `src/render.js:130-135`：正则 `/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/`，只认文件**第一行**起；命中段替换为**等量 `\n`**（数原文里的 `\n` 个数），行号不动。
2. **裸锚** `src/render.js:145-147`：`/<a\s+(?:id|name)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)\s*>\s*<\/a>|<a\s+(?:id|name)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)\s*\/?>/gi` 每处换成**等长空格**。只剥「单个 id/name 属性、无可见内容」的 `<a>`；**代码块里的也剥**（预处理不认 markdown 结构，见 `edge-bare-anchors`）。
3. 之后 markdown-it 自己把 `\r\n` / `\r` 归一成 `\n`（所以 golden 的 `text` 里没有 `\r`，见 `edge-crlf`）。
4. 正则是 **JS 语义**：`\s` = JS 空白集（含 U+00A0、U+3000、U+FEFF、U+2028/9 等），`i` 标志只做 ASCII 大小写。Swift/ICU 的 `\s` 不完全相同，移植时显式写字符集。

## 2. 解析配置与块切分

- markdown-it 14.1.0，`{html:false, linkify:true, typographer:false}`（`src/render.js:5`），默认 preset（含表格、`~~删除线~~`，**无**任务列表、脚注）。
- 打行号的 token：`paragraph_open heading_open list_item_open table_open tr_open blockquote_open fence code_block`（`src/render.js:40-55`）。`data-line = map[0]+1`（**1 起算**），`data-line-end = map[1]`（markdown-it 的 0 起「不含结束行」＝ 1 起算的**含**末行；列表项会把尾随空行吃进来，见 `edge-lists` #4 `lineEnd 8`）。`lineEnd` 目前 `src/` 无任何消费方，仅 golden 校验。
- **紧凑列表锚到 li**：紧凑列表的 paragraph token 是 hidden，不渲染 `<p>`，最内层带行号的是 `<li>`；松散列表才有 li ⊃ p（`edge-lists`）。
- **`html:false`**：原始 HTML（块级与行内、注释、`<br>`、`<img>`）一律**转义成可见文字**，块级 HTML 变成普通段落（`edge-raw-html`：`<div class="note">…</div>` 是一个 `paragraph`，text 含尖括号原文）。
- **表格**：table 一个块 + 每个 `tr` 一个块；分隔行（`|---|`）不产生块；**表头行的 tr 与 table 同一个 `line`**。`\|` 在单元格（含行内代码）里还原成 `|`。
- **tr 的 text** = `"\n" + 单元格文字逐个后接 "\n"`，例：`"\n普通\n粗\ncode\n"`；空单元格贡献空串（`"\n\n空首格\n\n"`）。table 的 text 还多出 thead/tbody 之间的 `\n`。
- **段落/标题/紧凑 li 的 text**：行内渲染结果的文字；softbreak 与 hardbreak 都贡献 `"\n"`（hardbreak 是 `<br>\n`）；**图片 alt 不贡献文字**（图片独占段 text 为 `""`）；双链显示名替代原文（§4）；linkify 不改文字。
- **松散 li 的 text** = `"\n" + 子块 text 以 "\n" 相接 + "\n"`；嵌套列表同理逐层包 `\n`——以 golden 为准，别自己推。
- **代码块**：`fence`（普通围栏）的 `data-line` 在 `<code>` 上，指向 ```` ``` ```` 那一行，text = 围栏内容（含末尾 `\n`）；`code_block`（缩进代码）在 `<pre>` 上，指向首行内容；**```diff 围栏**由 `diffFence` 渲染，`data-line` 在 `<pre class="diff-block">` 上，text = 各行以 `\n` 相接、**无末尾换行、空行变成一个空格**（`src/render.js:16-36`）。判 diff 只看 info 首词（`diff js` 也算，`patch` 不算）。未闭合围栏延伸到文末（`edge-unclosed-fence`）。

## 3. 选区 → 锚（`computeAnchor`，`src/anchor.js:10-44`）

1. 选区为空/折叠或不在正文内 → `null`。`quote = toString().trim().replace(/\s+/g,' ')`，**长度 < 2 → `null`**；`quoteRaw = toString().trim()`；两者都截前 300 个 **UTF-16 单元**（JS `slice`，可能切开代理对——照做）。
2. 锚块 = **选区起点**所在的最内层带行号元素（`closest('[data-line]')`）。跨块划选只锚起点块。`blockLine = 该块 line`。
3. `offset` = 块 text 开头到选区起点的 **UTF-16 单元数**（TextKit 的 NSRange 同单位）。
4. `line`：普通块 = `blockLine`；块内精确行只对 `tag` 为 `code`/`pre` 的块算：`line = blockLine + (tag==='code' ? 1 : 0) + 起点之前的 "\n" 个数`。
   - ⚠️ **web 现行缺陷（照抄进 golden，未修）**：```diff 块的 tag 是 `pre`，于是**不 +1**，块内行号比源码**少 1**（`edge-diff.anchors.json`：选中 `@@ -1,4` 行得 `line 3`，源码在第 4 行）。这会让 diff 块里的涂归呈到上一行。已报给 Hermes 定夺；**原生先与 golden 保持一致**，web 修了会重生 golden。
5. 起点恰在两个文本节点交界：归后一个节点开头（与 `rangeFromTextOffset` 同口径）。
6. golden 的 `quote/quoteRaw` 由 Range 语义生成（＝块 text 的子串）；浏览器的 `Selection.toString()` 对跨块/折叠空白可能不同【未核】。原生以「块 text 子串」为准——`rangeForDraft` 本来就在 textContent 里找 `quoteRaw`。

## 4. Obsidian 双链（`src/render.js:93-122`）

inline rule（不进代码块/行内代码）：`[[` 起、找第一个 `]]`；内层为空白、含 `[` 或换行 → 不认，原样当文字。`|` 前为目标、后为显示名（都 trim；显示名空则用目标）；目标里 `#` 分文件与锚；文件与锚都空（`[[#]]`）不认。文字 = 显示名。href：文件无扩展名补 `.md`，`encodeURI`；锚 `encodeURIComponent`。

## 5. 高亮回放与漂移重锚

- **回放** `rangeForDraft`（`src/anchor.js:47-55`）：取**文档序第一个** `data-line == blockLine` 的元素（表头行会命中 table 而非 tr；松散 li 会命中 li 而非 p——golden `replay.block` 已体现），在其 text 里从 `max(0, offset-2)` 起 `indexOf(quoteRaw)`，找不到再从头找，仍无 → 不画。
- **重锚** `reanchorByQuote`（`src/anchor.js:86-98`）：只用于 GitHub 把 `line` 置 null 的漂移串（`src/ui.js:1263-1271`，顺序 `line ?? 重锚 ?? original_line`）。needle = 引文 `trim` 后 `\s+→' '`，**< 4 字符不认**；遍历所有带行号块，块 text 同样压空白后 `includes(needle)`，取 **text 最短**的那块（并列取文档序先出现者）。
- **sectionOf**（`src/anchor.js:74-80`）：`line ≤ blockLine` 的最后一个 h1–h3 的 textContent。

## 6. 草稿、呈出、hunk 校验与降级

- 草稿对象（`src/ui.js:797-808`）：`{id, path, ref(写时的 head sha), blockLine, line, offset, quote, quoteRaw, note, ts}`；web 存 `localStorage['zhupi.drafts.<PR号>'] = {"items":[…]}`（`src/anchor.js:121-136`）。原生自有存储即可，字段语义不变。
- 正文格式 `fmtDraft = "> " + quote + "\n\n" + note`（`src/anchor.js:138`）；解析 `parseCommentBody`：开头连续 `>` 行为引文（去 `>` 与一个空格），跳过空行后余下为正文（`src/anchor.js:143-155`）。
- `validRightLines(patch)`（`src/anchor.js:101-118`）：去掉末尾假空行；`@@` 行取 `+N` 为起点；`+` 行、` ` 行、裸空行各占一个 RIGHT 行号；`-` 行与 `\ No newline` 不占。patch 为空/null → `null`。
- 呈出（`src/ui.js:1147-1160`）：`stale = d.ref !== 当前 head sha`；**`!stale` 且该文件 valid 集合含 `d.line`** → inline comment `{path, line: d.line, side:'RIGHT', body: fmtDraft(d)}`；否则降级。降级的拼成 review body：`"以下涂归锚定不到可批注行（或写于旧版本），并入判：\n\n" + 各条 fmtDraft 以 "\n\n---\n\n" 相接`；全部 inline 时 body = `"门下 · N 条"`（`src/strings.js:401-402`）。一次 `POST /pulls/{n}/reviews`，`commit_id` = head sha。注意用的是 `line`（块内精确行），不是 `blockLine`。

## 7. 续读 readstate（`src/offline.js:24-63`，写侧 `src/ui.js:475-505`）

- 正文：`<!-- menxia-readstate {"device","docPath","anchor","time","v":1} -->\n_门下续读位置（自动维护，勿手改）：<device> · <docPath>_`，JSON 键序固定如上（`JSON.stringify`）。
- 识别：`/^\s*<!--\s*menxia-readstate\s+([\s\S]*?)\s*-->/`（前导空白/BOM 可有，前面有正文字不算）。解析宽容：坏 JSON/非对象 → null；字段非字符串 → `''`，`v` 非数字 → 1。
- `anchor = "L<行号>"`，行号 = 视口顶部已越过的最后一个带行号块的 `line`；写入节流：≥4s 且行号变化。提示判据见 `shouldPromptJump` golden（远端更新且落点不同才提示，绝不自动跳）。

## 8. slug / TOC

- `slugify`（`src/slug.js:16-29`）：小写 → 删 `\p{C}\p{Z}`（半角空格除外）→ 删 `\p{P}\p{S}`（`-` `_` 除外）→ 半角空格换 `-`；**不 trim、不折叠**。去重 `makeSlugger`（`:39-52`）：重名追加 `-1`、`-2`…，跳过已占用。标题文字只取 inline 子 token 的 text/code_inline，break 计空格，图片不计（`src/render.js:79-84`）。取不出文字的标题不打 id（`slug: ""`）。
- 大纲 = h1–h3、text `trim` 后非空，≥3 条才显示（`src/toc.js:26-41`）。

## 9. 原生注意：markdown-it vs cmark-gfm（swift-markdown）分歧

「实测」= golden 已钉住 web 侧行为；cmark 侧一律【未核】，N2 用 golden 跑出来再补。

1. **原始 HTML**：cmark 产出 `HTMLBlock`/`InlineHTML`，必须按源码原文当纯文字渲染，块级 HTML 当段落（web 侧实测 `edge-raw-html`）。
2. **紧凑列表**：cmark 的 ListItem 下总有 Paragraph；紧凑列表（cmark `isTight`）要把锚放在 ListItem、不单独出段落块（实测 `edge-lists`）。
3. **lineEnd**：cmark `SourceRange` 末端是含末字符的行列，不含尾随空行；markdown-it 列表项会吃进尾随空行。要么按 markdown-it 规则重算，要么与 golden 对齐后确认差异集合【未核】。
4. **任务列表 / 脚注 / 单波浪线删除线**：markdown-it 默认都不认（文字原样保留），cmark-gfm 扩展会认——**会改变 text 与 offset**。只开 table / strikethrough / autolink，并确认单 `~` 行为【未核】。
5. **linkify vs autolink 扩展**：网址边界（句末标点、紧贴中文、括号、`www.`、邮箱）可能不同；只影响是否成链接，不影响 text（实测 `edge-linkify` 的 text 即原文）【cmark 未核】。
6. **双链**：cmark 不认，`[[x|y]]` 会以字面文字出现（或误配链接引用定义）；原生必须在行内层自实现 §4 规则并跳过代码，否则 text/offset 全错（实测 `edge-wikilinks`）。
7. **图片 alt**：cmark 的 Image 有 alt 子文本，原生块 text 必须**排除**（实测 `edge-images-headings`）。
8. **softbreak/hardbreak** 都映射为 `"\n"`；**表格/松散列表/引用的容器 text 里的 `\n`** 是 HTML 序列化产物，cmark 没有，必须按 §2 规则拼（实测）。
9. **表格打断段落**：markdown-it 允许无空行的表格紧跟段落（`edge-tables` 第 10/11 行）；cmark-gfm 行为【未核】。
10. **CRLF / NUL**：markdown-it 归一 `\r\n`、`\r` → `\n`，NUL → U+FFFD；预处理在归一之前、正则自带 `\r?`（实测 `edge-crlf`）。cmark 文本节点是否保留 `\r`【未核】。
11. **```diff 渲染**与块内行号（§3.4 缺陷）、空行 → 空格：是 web 自定义，cmark 无对应，按 §2 自实现（实测 `edge-diff`）。
12. **JS 字符串语义**：`trim`/`\s`/`slice`/`indexOf` 都按 UTF-16 与 JS 空白集；Swift `String` 默认按字素簇，务必在 `utf16` 视图上算（实测 `edge-mixed` 含 emoji、代理对、组合字符、U+3000）。

## 10. 规则变更流程

web 侧改了渲染/锚定 → `node test/golden/export.mjs` → 更新本页 → PR 标「原生需跟进」→ 原生仓复制 `test/golden/` 并验 `manifest.json` → XCTest 变红处逐一跟上。
