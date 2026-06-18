#!/bin/bash

# GLM-5 大模型连接测试

API_KEY="fc446d345a86465a8d06c30a6daa0d47.Cv7O2Zzq3NfrjF8J"
BASE_URL="https://open.bigmodel.cn/api/anthropic"

echo "========================================"
echo "GLM-5 大模型连接测试"
echo "========================================"
echo ""

# 测试 1: 基础对话
echo "测试 1: 基础文本对话..."
curl -s -X POST "${BASE_URL}/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 256,
    "messages": [
      {
        "role": "user",
        "content": "你好，请用一句话介绍风水罗盘的作用。"
      }
    ]
  }' | head -c 500

echo ""
echo ""
