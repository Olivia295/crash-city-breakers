#!/bin/bash
# CRASH!城市破坏者 macOS 双击启动：调用同目录的 start.sh
cd "$(dirname "$0")" || exit 1
bash ./start.sh "$@"
STATUS=$?
if [ "$STATUS" -ne 0 ]; then
  echo
  read -n 1 -s -r -p "启动失败，按任意键关闭窗口"
fi
exit "$STATUS"
