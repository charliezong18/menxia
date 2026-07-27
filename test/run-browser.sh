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
  echo "跳过浏览器层：未找到 Chrome（设 CHROME=/path/to/chrome 可指定）"
  exit 0
fi

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
  elif echo "$RESULT" | grep -q 'fail=0'; then
    echo "  ✔ $RESULT"
  else
    echo "  ✖ $RESULT"
    STATUS=1
  fi
fi

if [ "$WHAT" = "all" ] || [ "$WHAT" = "smoke" ]; then
  echo "── 端到端冒烟（demo 免 token，真实事件路径划批 + rev 切换）──"
  run_page "http://127.0.0.1:$PORT/index.html?demo=1&auto=1" /tmp/zhupi-smoke.log 9000
  grep -o '\[smoke\] [^"]*' /tmp/zhupi-smoke.log | sed 's/^/  /' || true
  RESULT=$(grep -o '\[smoke\] RESULT pass=[0-9]* fail=[0-9]*' /tmp/zhupi-smoke.log | tail -1)
  if [ -z "$RESULT" ]; then
    echo "  ✖ 冒烟没跑出结果（详见 /tmp/zhupi-smoke.log）"
    STATUS=1
  elif echo "$RESULT" | grep -q 'fail=0'; then
    echo "  ✔ $RESULT"
  else
    echo "  ✖ $RESULT"
    STATUS=1
  fi
fi

exit $STATUS
