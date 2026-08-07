#!/usr/bin/env bash
# 推完 main 之后核一眼：这次到底上线了没有。
#
# 用法：
#   ./deploy-check.sh                 # 核 origin/main 的 HEAD
#   ./deploy-check.sh <sha>           # 核指定 commit
#   TIMEOUT=900 ./deploy-check.sh     # 等构建的上限（秒，默认 600）
#
# 为什么需要它，三条都是 2026-08-06 当晚实证出来的：
#
# 1. **`gh api …/pages --jq .status` 报的是「上一次完成的构建」，不是你这次推的。**
#    我照它判过一次：自己的构建刚开始 building，它却返回了 7 小时前那次的 `errored`，
#    当场误报「部署失败」。判定必须锚在 commit sha 上——`pages/builds/latest.commit`。
#
# 2. **Pages 的失败完全静默**：站点不报错、不回滚，就停在上一次成功的版本。
#    2026-07-31 因此静默停更 13 小时。push 成功 ≠ 上线。
#
# 3. **仓里的 `pages-alert` 工作流治不了这一类**：它自己跑在 GitHub Actions 上，
#    而当晚正是 Actions 排不上 runner 才让构建挂掉——告警器与被告警的系统同源，
#    一起哑。实测：18:15 构建失败（job 零步骤被取消），18:29 告警排队、19:57 被取消，
#    真正的推送迟到 7.5 小时才发出，内容还写着「线上已停更」而那时已经不成立了。
#
# 结论：这个脚本是这条链上**唯一不与 GitHub Actions 共享故障域**的一环——
# 它只要 API 和站点可达就能跑。所以「推完人肉核一眼」不是可省的礼节。
#
# 退出码：0=真上线了；1=构建失败/超时；2=构建说成功但线上字节对不上（最坏的一种）。
set -uo pipefail
cd "$(dirname "$0")"

REPO="${REPO:-charliezong18/menxia}"
SITE="${SITE:-https://charliezong18.github.io/menxia}"
TIMEOUT="${TIMEOUT:-600}"

SHA="${1:-$(git rev-parse origin/main 2>/dev/null)}"
[ -n "$SHA" ] || { echo "✖ 取不到 sha（先 git fetch，或直接传一个）"; exit 1; }
SHORT="${SHA:0:7}"

echo "── 核部署 $SHORT @ $REPO ──"

# ① 等这个 sha 的构建落到终态。**不看 .status，只认 builds/latest.commit**（见上文 1）
deadline=$(( $(date +%s) + TIMEOUT ))
while :; do
  json="$(gh api "repos/$REPO/pages/builds/latest" 2>/dev/null)" || json='{}'
  cur="$(printf '%s' "$json" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("commit") or "")' 2>/dev/null)"
  st="$(printf '%s' "$json" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("status") or "?")' 2>/dev/null)"
  if [ "$cur" = "$SHA" ] && [ "$st" != "building" ]; then break; fi
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "✖ 等超时（${TIMEOUT}s）：latest build 仍是 ${cur:0:7}/$st，不是 $SHORT"
    echo "  Actions 排不上 runner 时就长这样（job 零步骤被取消）。去看："
    echo "  https://github.com/$REPO/actions"
    exit 1
  fi
  sleep 10
done

if [ "$st" != "built" ]; then
  err="$(printf '%s' "$json" | python3 -c 'import json,sys;d=json.load(sys.stdin);print((d.get("error") or {}).get("message") or "")' 2>/dev/null)"
  echo "✖ 构建终态是 $st${err:+ —— $err}"
  echo "  线上仍停在上一版。别默认「过一会儿就好了」，Pages 不会自己重试。"
  echo "  想踢一脚重建：gh api -X POST repos/$REPO/pages/builds"
  exit 1
fi
echo "✔ 构建 built（$SHORT）"

# ② 光看 built 不够：真去站点抓字节，跟本地这个 sha 的同名文件逐一比。
#    只比这次**真改过**的文件——拿没变的文件比 md5 相同，证明不了部署过。
#    用 while read 而不是 mapfile：macOS 自带的是 bash 3.2，`mapfile` 是 bash 4+ 才有的，
#    在他机器上直接 "command not found" 然后一路 unbound variable（2026-08-06 实测栽过）。
base="$(git rev-parse "$SHA^" 2>/dev/null || echo '')"
changed=()
while IFS= read -r line; do
  [ -n "$line" ] && changed+=("$line")
done <<EOF
$(if [ -n "$base" ]; then git diff --name-only "$base" "$SHA" -- 'src/*' index.html 2>/dev/null
  else git ls-files 'src/*' index.html; fi)
EOF
if [ "${#changed[@]}" -eq 0 ]; then
  echo "✔ 本次没动前端文件，无需比字节"
  exit 0
fi

bad=0
for f in "${changed[@]}"; do
  [ -f "$f" ] || continue                      # 本次删掉的文件，跳过
  want="$(git show "$SHA:$f" 2>/dev/null | shasum -a 256 | cut -d' ' -f1)"
  got="$(curl -fsSL "$SITE/$f?cachebust=$$-$RANDOM" 2>/dev/null | shasum -a 256 | cut -d' ' -f1)"
  if [ "$want" = "$got" ]; then
    printf '  ✔ %s\n' "$f"
  else
    printf '  ✖ %s —— 线上字节对不上（want %.8s got %.8s）\n' "$f" "$want" "${got:-空}"
    bad=$((bad + 1))
  fi
done

if [ "$bad" -gt 0 ]; then
  echo "✖ 构建报 built，但线上 $bad 个文件不是这个版本——这是最坏的一种：闸门绿、人还在用旧代码。"
  echo "  先排 CDN 缓存（Pages 发 max-age=600），过 10 分钟再跑一次；仍不对就踢重建。"
  exit 2
fi
echo "✔ 线上字节 = $SHORT，真上线了"
