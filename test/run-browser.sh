#!/usr/bin/env bash
# 浏览器层测试：DOM 单元（test/dom.test.html）+ 端到端冒烟（?demo=1&auto=1）
# 在真 Chrome headless 里跑，抓 console 输出判定，失败非零退出。零依赖：只要有 Chrome。
#
# 用法：test/run-browser.sh          # 两层都跑
#       test/run-browser.sh dom      # 只跑 DOM 单元
#       test/run-browser.sh smoke    # 只跑端到端冒烟
set -uo pipefail
cd "$(dirname "$0")/.."

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] || CHROME="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
if [ -z "$CHROME" ] || [ ! -x "$CHROME" ]; then
  if [ -n "${CI:-}" ]; then
    echo "✖ CI 里找不到 Chrome —— 浏览器层不能静默跳过（那是绿色空转）"
    exit 1
  fi
  echo "跳过浏览器层：未找到 Chrome（设 CHROME=/path/to/chrome 可指定）"
  exit 0
fi

# CI 的容器里没有 user namespace，不加这两个 flag 的 Chrome 直接 core dump
CI_FLAGS=()
[ -n "${CI:-}" ] && CI_FLAGS=(--no-sandbox --disable-dev-shm-usage)

PORT="${PORT:-4188}"
python3 -m http.server "$PORT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1

# Chrome --headless 截图/加载后不会自己退出，用「产物就绪即杀」的模式跑
run_page() {
  local url="$1" log="$2" budget="$3"
  local dir; dir="$(mktemp -d)"
  rm -f "$log"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --enable-logging=stderr --v=0 \
    "${CI_FLAGS[@]+"${CI_FLAGS[@]}"}" \
    --window-size=1440,1000 --virtual-time-budget="$budget" \
    --user-data-dir="$dir" --screenshot="$dir/shot.png" "$url" >/dev/null 2>"$log" &
  local pid=$!
  for _ in $(seq 1 60); do
    [ -s "$dir/shot.png" ] && break
    sleep 1
  done
  sleep 2
  kill $pid 2>/dev/null
  rm -rf "$dir" 2>/dev/null || true
}

# 期望断言条数：钉死总数，断言被删/被跳过也要红
DOM_EXPECT=22
SMOKE_EXPECT=52

WHAT="${1:-all}"
STATUS=0

if [ "$WHAT" = "all" ] || [ "$WHAT" = "dom" ]; then
  echo "── DOM 单元（渲染行号规则 / 锚定几何）──"
  run_page "http://127.0.0.1:$PORT/test/dom.test.html" /tmp/zhupi-dom.log 6000
  grep -o '\[dom\] [A-Z]* [^"]*' /tmp/zhupi-dom.log | sed 's/^/  /' || true
  RESULT=$(grep -o '\[dom\] RESULT pass=[0-9]* fail=[0-9]*' /tmp/zhupi-dom.log | tail -1)
  if [ -z "$RESULT" ]; then
    echo "  ✖ DOM 层没跑出结果（页面可能报错，详见 /tmp/zhupi-dom.log）"
    STATUS=1
  elif [ "$RESULT" = "[dom] RESULT pass=$DOM_EXPECT fail=0" ]; then
    echo "  ✔ $RESULT"
  else
    echo "  ✖ $RESULT（期望 pass=$DOM_EXPECT fail=0——条数对不上也算红，防断言被悄悄删掉）"
    STATUS=1
  fi
fi

if [ "$WHAT" = "all" ] || [ "$WHAT" = "smoke" ]; then
  echo "── 端到端冒烟（demo 免 token，真实事件路径划批 + rev 切换）──"
  run_page "http://127.0.0.1:$PORT/index.html?demo=1&auto=1" /tmp/zhupi-smoke.log 30000
  grep -o '\[smoke\] [^"]*' /tmp/zhupi-smoke.log | sed 's/^/  /' || true
  RESULT=$(grep -o '\[smoke\] RESULT pass=[0-9]* fail=[0-9]*' /tmp/zhupi-smoke.log | tail -1)
  if [ -z "$RESULT" ]; then
    echo "  ✖ 冒烟没跑出结果（详见 /tmp/zhupi-smoke.log）"
    STATUS=1
  elif [ "$RESULT" = "[smoke] RESULT pass=$SMOKE_EXPECT fail=0" ]; then
    echo "  ✔ $RESULT"
  else
    echo "  ✖ $RESULT（期望 pass=$SMOKE_EXPECT fail=0）"
    STATUS=1
  fi

  # 直达链接：URL 带 ?pr=998 应直接开到那折（归档折 → 自动切已钦此栏、只读）
  run_page "http://127.0.0.1:$PORT/index.html?demo=1&deep=1&pr=998" /tmp/zhupi-deep.log 5000
  grep -o '\[smoke\] [^"]*' /tmp/zhupi-deep.log | sed 's/^/  /' || true
  RD=$(grep -o '\[smoke\] RESULT pass=[0-9]* fail=[0-9]*' /tmp/zhupi-deep.log | tail -1)
  if [ "$RD" = "[smoke] RESULT pass=3 fail=0" ]; then echo "  ✔ deep $RD"; else echo "  ✖ deep $RD（期望 pass=3 fail=0）"; STATUS=1; fi

  # 故障注入两场：403 限流不得清 token（历史上误删过），401 才回设置页
  for mode in 403 401; do
    run_page "http://127.0.0.1:$PORT/index.html?demo=1&fail=$mode" "/tmp/zhupi-fail$mode.log" 4000
    grep -o "\[smoke\] [^\"]*" "/tmp/zhupi-fail$mode.log" | sed 's/^/  /' || true
    R=$(grep -o '\[smoke\] RESULT pass=[0-9]* fail=[0-9]*' "/tmp/zhupi-fail$mode.log" | tail -1)
    EXP=$([ "$mode" = "403" ] && echo 3 || echo 2)
    if [ "$R" = "[smoke] RESULT pass=$EXP fail=0" ]; then echo "  ✔ fail=$mode $R"; else echo "  ✖ fail=$mode $R（期望 pass=$EXP fail=0）"; STATUS=1; fi
  done
fi

exit $STATUS
