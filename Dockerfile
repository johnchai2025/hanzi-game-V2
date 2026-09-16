# 汉字对对碰 — 生产镜像
# 参照 mult99-game 的三阶段构建。Node 22：undici@8 要求 >= 22.19。
#
# 构建时注意：本机若为 Apple Silicon，必须指定目标架构，否则镜像在 x86 服务器上无法运行
#   docker buildx build --platform linux/amd64 -t hanzi-game:local .

FROM node:22-alpine AS deps
WORKDIR /app
# 构建阶段需要 devDependencies（typescript、eslint-config-next），所以装全量依赖
# 跳过 Playwright 浏览器下载：构建不需要，只会拖慢镜像构建
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 不需要任何 API Key：三个 API 路由都是 POST，next build 不会调用它们，
# lib/gemini.ts 也只在函数内部才检查密钥。密钥一律运行时注入，不进镜像。
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# 容器没有 IPv6 出口；强制 Node 解析微软 TTS 域名时只用 IPv4
# （mult99-game 在同一台服务器上踩过这个坑，本项目同样用 msedge-tts）
ENV NODE_OPTIONS=--dns-result-order=ipv4first
# 词卡图库落盘目录——必须给这条路径挂数据卷（docker run -v），否则容器
# 重建/重启后之前生成的图片全部丢失，等于白花钱重新生成一遍
ENV IMAGE_LIBRARY_DIR=/data/word-images
RUN mkdir -p /data/word-images

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
