#!/usr/bin/env bash
# 上线后验证：三个 AI 功能都要实测，不能只看首页能不能打开。
# 注意：生故事和朗读失败时接口仍返回 HTTP 200（静默降级），所以必须看返回内容里的标记位。
#
#   bash scripts/verify-deploy.sh <服务器IP> <端口>

set -u
HOST="${1:?用法: verify-deploy.sh <IP> <端口>}"
PORT="${2:?用法: verify-deploy.sh <IP> <端口>}"
BASE="http://${HOST}:${PORT}"
pass=0; fail=0
chk() { if [ "$1" = "ok" ]; then echo "  ✓ $2"; pass=$((pass+1)); else echo "  ✗ $2"; fail=$((fail+1)); fi; }

echo "▶ 目标: $BASE"
echo
echo "[1] 首页"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE/")
[ "$code" = "200" ] && chk ok "HTTP $code" || chk no "HTTP $code"

echo "[2] 本地字体（不依赖谷歌）"
for f in MaShanZheng-subset.woff2 ZCOOLKuaiLe-subset.woff2; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE/fonts/$f")
  [ "$code" = "200" ] && chk ok "$f ($code)" || chk no "$f ($code)"
done
if curl -s --max-time 20 "$BASE/" | grep -q "fonts.googleapis.com"; then
  chk no "页面仍引用谷歌字体"
else
  chk ok "页面无谷歌字体外链"
fi

echo "[3] 关卡数据"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE/levels.json")
[ "$code" = "200" ] && chk ok "levels.json ($code)" || chk no "levels.json ($code)"

echo "[4] 生故事（DeepSeek）—— 查 fallback 标记"
resp=$(curl -s --max-time 90 -X POST "$BASE/api/generate-story" \
  -H 'Content-Type: application/json' \
  -d '{"words":["太阳","月亮","星星"],"animal":"兔子","characterName":"小白","scene":"森林"}')
if echo "$resp" | grep -q '"fallback":true'; then
  chk no "返回了本地模板故事 —— DeepSeek 实际调用失败（查 docker logs）"
elif echo "$resp" | grep -q '"story"'; then
  chk ok "DeepSeek 真实生成（无 fallback 标记）"
else
  chk no "响应异常: $(echo "$resp" | head -c 160)"
fi

echo "[5] 朗读（微软 Edge TTS）—— 查 unsupported 标记"
resp=$(curl -s --max-time 60 -X POST "$BASE/api/generate-speech" \
  -H 'Content-Type: application/json' -d '{"text":"小白兔在森林里"}')
if echo "$resp" | grep -q '"unsupported":true'; then
  chk no "TTS 不可用，已降级到浏览器朗读（容器到微软的 WebSocket 不通）"
elif echo "$resp" | grep -q '"audio"\|audioBase64\|"mime"'; then
  chk ok "Edge TTS 正常返回音频"
else
  chk no "响应异常: $(echo "$resp" | head -c 160)"
fi

echo "[6] 生图（阿里云百炼 + 服务器图库）—— force=true 强制重生，确保测的是真实生成路径而非缓存"
word="生日"
start=$(date +%s)
resp=$(curl -s --max-time 180 -X POST "$BASE/api/generate-image" \
  -H 'Content-Type: application/json' -d "{\"word\":\"$word\",\"force\":true}")
elapsed=$(( $(date +%s) - start ))
imageUrl=$(echo "$resp" | python3 -c "import json,sys; print(json.load(sys.stdin).get('imageUrl',''))" 2>/dev/null)
if [ -n "$imageUrl" ]; then
  chk ok "强制重生成功（耗时 ${elapsed}s）→ $imageUrl"

  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE$imageUrl")
  [ "$code" = "200" ] && chk ok "图库文件可下载 ($code)" || chk no "图库文件下载失败 ($code)"

  echo "[7] 图库命中 —— 同一个词不带 force 再请求一次，应秒级返回同一个 URL、不再调用生图 API"
  start2=$(date +%s)
  resp2=$(curl -s --max-time 15 -X POST "$BASE/api/generate-image" \
    -H 'Content-Type: application/json' -d "{\"word\":\"$word\"}")
  elapsed2=$(( $(date +%s) - start2 ))
  imageUrl2=$(echo "$resp2" | python3 -c "import json,sys; print(json.load(sys.stdin).get('imageUrl',''))" 2>/dev/null)
  if [ "$imageUrl2" = "$imageUrl" ] && [ "$elapsed2" -le 3 ]; then
    chk ok "命中缓存（耗时 ${elapsed2}s，URL 不变）"
  else
    chk no "疑似未命中缓存（耗时 ${elapsed2}s，URL: $imageUrl2）"
  fi
else
  chk no "出图失败（${elapsed}s）: $(echo "$resp" | head -c 160)"
fi

echo
echo "────────────────────────"
echo "通过 $pass 项，失败 $fail 项"
[ "$fail" -eq 0 ] && echo "全部通过 ✓" || echo "有失败项，请查 docker logs hanzi-game"
exit 0
