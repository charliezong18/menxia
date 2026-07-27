#!/usr/bin/env bash
# 全部测试：单元（node 内置 runner）+ DOM 单元 + 端到端冒烟（真 Chrome）
# 零依赖：不装任何包，不跑任何构建。
#   test/run.sh          全跑
#   test/run.sh unit     只跑纯逻辑单元
#   test/run.sh browser  只跑浏览器两层
set -uo pipefail
cd "$(dirname "$0")/.."
WHAT="${1:-all}"
STATUS=0

if [ "$WHAT" = "all" ] || [ "$WHAT" = "unit" ]; then
  echo "── 单元（纯逻辑：锚定 / hunk 校验 / 批注串 / API 装配）──"
  node --test test/*.test.js || STATUS=1
fi

if [ "$WHAT" = "all" ] || [ "$WHAT" = "browser" ]; then
  ./test/run-browser.sh || STATUS=1
fi

[ $STATUS -eq 0 ] && echo "全部通过。" || echo "有测试失败（退出码 $STATUS）。"
exit $STATUS
