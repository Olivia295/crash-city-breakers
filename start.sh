#!/usr/bin/env bash
# CRASH!城市破坏者 一键启动
#   ./start.sh            构建并打开游戏（首次会自动安装依赖）
#   ./start.sh --dev      开发模式，改代码即时刷新
#   ./start.sh --no-open  只启动服务，不打开浏览器
#   PORT=8080 ./start.sh  指定端口
set -u
cd "$(dirname "$0")" || exit 1

MODE=preview
OPEN=1
for arg in "$@"; do
  case "$arg" in
    --dev) MODE=dev ;;
    --no-open) OPEN=0 ;;
    -h|--help) sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "未知参数：$arg（可用 --dev、--no-open）"; exit 2 ;;
  esac
done
if [ "$MODE" = dev ]; then PORT="${PORT:-5173}"; else PORT="${PORT:-4173}"; fi
URL="http://127.0.0.1:${PORT}/"

die() { echo "$1" >&2; exit 1; }

command -v node >/dev/null 2>&1 || die "没有找到 Node.js，请先安装 Node 20 或更新版本：https://nodejs.org/"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || die "当前 Node 版本过低（v$(node -v | tr -d v)），请升级到 20 或更新版本。"
command -v npm >/dev/null 2>&1 || die "没有找到 npm。"

if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
  echo "安装依赖"
  npm install --no-audit --no-fund || die "依赖安装失败。"
fi

if [ "$MODE" = preview ]; then
  if [ ! -f dist/index.html ] || [ -n "$(find src public index.html vite.config.ts package.json -newer dist/index.html -print -quit 2>/dev/null)" ]; then
    echo "构建游戏"
    npm run build --silent || die "构建失败。"
  fi
fi

open_url() {
  [ "$OPEN" = 1 ] || return 0
  if command -v open >/dev/null 2>&1; then open "$1"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$1" >/dev/null 2>&1
  elif command -v cmd.exe >/dev/null 2>&1; then cmd.exe /c start "" "$1" >/dev/null 2>&1
  else echo "请在浏览器打开：$1"; fi
}

if curl -s -o /dev/null --max-time 2 "$URL"; then
  echo "端口 ${PORT} 上已有服务，直接打开"
  open_url "$URL"
  exit 0
fi

if [ "$MODE" = dev ]; then
  npx vite --host 127.0.0.1 --port "$PORT" --strictPort &
else
  npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort >/dev/null 2>&1 &
fi
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null' EXIT INT TERM

for _ in $(seq 1 100); do
  curl -s -o /dev/null --max-time 1 "$URL" && break
  kill -0 "$SERVER" 2>/dev/null || die "服务没有启动，端口 ${PORT} 可能被占用，可用 PORT=8080 ./start.sh 换一个。"
  sleep 0.2
done
curl -s -o /dev/null --max-time 2 "$URL" || die "服务启动超时。"

echo "游戏地址：$URL"
open_url "$URL"
echo "按 Ctrl+C 停止。"
wait "$SERVER"
