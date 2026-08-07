#!/usr/bin/env python3
"""唐制改名：整套、可重跑、幂等。用法：python3 tang-rename.py <repo> --apply

为什么是脚本：zhupi 仓常有并发分支动同一批文件（src/ui.js 尤其）。别人的活落地后
重跑一次即可，冲突不用手工调和。第 3 步（skill / memory / CLAUDE.md）也复用它。

分三段：
  A 专名全局替换
  A' 带装饰空格的漏网（「钦 此」这类字距写法躲得过 A —— 栽过一次，全站最显眼的
     按钮一路没改到）
  B 精确点位（交互动词只有这几处真在界面上，其余要么不存在、要么只活在注释里）
"""
import sys, pathlib, re

# 长的在前：御笔朱批 先于 朱批；朱批台=平台名(门下)，不是「涂归台」
MAPPING = [
    ("御笔朱批", "门下"),
    ("朱批台",   "门下"),
    ("待批清单", "待审"),
    ("待批奏折", "待审敕草"),
    ("已钦此",   "已画可"),
    ("回奏对",   "回奏"),   # 2026-07-31 定：它是顶栏真按钮，「印缝」只说明比喻、不说明动作
    ("骑缝",     "回奏"),
    ("朱批",     "涂归"),
    ("奏折",     "敕草"),
    ("总批",     "判"),
    ("钦此",     "画可"),
]

# 带字距空格的写法，A 段的 replace 匹配不到
SPACED = [("钦 此", "画 可")]

# B 段：只有这几处交互动词真出现在界面字符串里
PRECISE = [
    ("src/components/sidebar.js", '<span class="seal">朱</span>', '<span class="seal">可</span>',
     "印章字：朱=朱批简称，改名后与品牌「门下」并列不成立；用画可之「可」"),
    ("src/components/setup.js",   '<span class="seal">朱</span>', '<span class="seal">可</span>',
     "同上（设置页）"),
    ("src/components/sidebar.js", 'placeholder="搜标题 / 回车搜全文"', 'placeholder="检题 / 回车检全文"',
     "搜→检、标题→题"),
    ("src/ui.js", '<span class="rev-label">版本</span>', '<span class="rev-label">本</span>',
     "版本→本（写本通语）"),
    # fixture 按原意重写：这条考「中文无分词，长词内部也要命中」，原文靠「朱批」嵌在
    # 「御笔朱批」里凑够 2 次；改名后两词分家、嵌套消失。改断言数字会让这条测试失去意义。
    ("test/search.test.js", "const t = '门下是阅读批注器。涂归落在行上。';",
     "const t = '涂归栏是阅读批注器。涂归落在行上。';",
     "search fixture 恢复原意（嵌套一次 + 独立一次）"),
]

# 活的界面与测试。档案文档（SPEC/BACKLOG/PAIN/OPEN-QUESTIONS/MIGRATION-WATCH）不在这里改。
# 规矩 2026-08-06 细化 —— 原文写的是「档案不追改，历史该留着旧称」，实际被读成整份文档都别动，
# 结果这些文件带着 134 处旧词活到 8/6，Charlie 在 GitHub 上读 PAIN.md 当场看懵。
# 留旧称的只是**历史叙述**：当时屏幕上是哪几个字、当天拍了什么板、某批 commit 叫什么名。
# 文档的**自述与现役规格**照样跟新词 —— PAIN 开头那句「这是什么」、SPEC 的词表与 §2、
# BACKLOG 的方案正文，都是 agent 每次开工要读的活文件，留旧词等于教下一个 agent 说旧话
# （这正是 PAIN #66 记的病根：agent 的词汇与屏幕上的字不一致）。
# 该批已于 2026-08-06 手工清过一轮，历史叙述处一律原样保留并加脚注注明「旧词，7/31 已改」。
INCLUDE_DIRS = ("src", "test")
INCLUDE_FILES = ("index.html", "README.zh-CN.md", "README.md")


def targets(root):
    for d in INCLUDE_DIRS:
        for p in (root / d).rglob("*"):
            if p.is_file() and p.suffix in (".js", ".html", ".css", ".json", ".md"):
                yield p
    for f in INCLUDE_FILES:
        p = root / f
        if p.is_file():
            yield p


def main():
    root = pathlib.Path(sys.argv[1]).resolve()
    apply = "--apply" in sys.argv
    total, touched = 0, []

    for p in targets(root):
        try:
            c = p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        n = 0
        for old, new in MAPPING + SPACED:
            k = c.count(old)
            if k:
                c = c.replace(old, new)
                n += k
        if n:
            total += n
            touched.append((p.relative_to(root).as_posix(), n))
            if apply:
                p.write_text(c, encoding="utf-8")

    for f, n in sorted(touched, key=lambda x: -x[1]):
        print(f"  {n:4d}  {f}")
    print(f"A 段：{'替换' if apply else '将替换'} {total} 处 / {len(touched)} 文件")

    print("B 段（精确点位）：")
    for f, old, new, why in PRECISE:
        p = root / f
        if not p.is_file():
            print(f"  ✗ 文件不存在 {f}"); continue
        c = p.read_text(encoding="utf-8")
        if old in c:
            if apply:
                p.write_text(c.replace(old, new), encoding="utf-8")
            print(f"  ✓ {f} — {why}")
        elif new in c:
            print(f"  = {f} — 已是目标态（幂等）")
        else:
            print(f"  ✗ 锚点未命中 {f} — 上游可能改了这行，需人看：{old[:50]}")


if __name__ == "__main__":
    main()
