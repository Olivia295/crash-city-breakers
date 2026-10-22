#!/bin/bash
# CRASH! 城市连锁 — 双击启动。首次运行会自动安装依赖并构建，之后直接开局。
cd "$(dirname "$0")" || exit 1

PORT=4173
URL="http://127.0.0.1:$PORT/"

echo "=============================="
echo "   CRASH! 城市连锁  v0.5"
echo "=============================="

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。请先安装 Node 22+：https://nodejs.org/"
  read -n 1 -s -r -p "按任意键退出…"; exit 1
fi

if [ ! -d node_modules ]; then
  echo "首次运行：安装依赖…"
  npm install || { echo "依赖安装失败"; read -n 1 -s -r -p "按任意键退出…"; exit 1; }
fi

# 源码比构建产物新，或从未构建过，就重新构建。
if [ ! -f dist/index.html ] || [ -n "$(find src public index.html -newer dist/index.html 2>/dev/null | head -1)" ]; then
  echo "构建游戏…"
  npm run build || { echo "构建失败"; read -n 1 -s -r -p "按任意键退出…"; exit 1; }
fi

# 端口被占用时直接复用已在运行的服务。
if ! lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  npx vite preview --host 127.0.0.1 --port $PORT --strictPort >/dev/null 2>&1 &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null' EXIT
  for _ in $(seq 1 50); do
    curl -s -o /dev/null "$URL" && break
    sleep 0.2
  done
fi

echo "游戏地址：$URL"
open "$URL"
echo
echo "游戏已在浏览器中打开。关闭此窗口或按 Ctrl+C 即可停止。"
[ -n "$SERVER" ] && wait $SERVER
