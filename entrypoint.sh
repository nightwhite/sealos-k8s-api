#!/bin/bash

# 查找 bun 可执行文件的路径
BUN_PATH=$(which bun)

if [ -z "$BUN_PATH" ]; then
    echo "错误: 未找到 bun。请确保已安装 bun 并添加到 PATH 环境变量中。"
    exit 1
fi

echo "使用 bun 路径: $BUN_PATH"
$BUN_PATH run --watch /home/devbox/project/dist/index.js