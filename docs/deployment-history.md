# 腾讯云发布记录

## 2026-09-14（首次上线）

- 服务：`hanzi-game`
- 对外端口：`8082`（容器端口 `3000`）
- 当前镜像：`hanzi-game:local`
- 发布镜像：`hanzi-game:release-20260914-1237`
- 镜像摘要：`sha256:34982c4fc5539d38742051edbf30816f366ac5a56e888785eb942fef47a3d4ce`
- 回退镜像：无（首次发布，无上一版本）
- 发布包 SHA-256：`86f0576f8cfb97de40229a8b15e2d2a96efd7ddcd591c9b1627d0f8428b03e81`
- 镜像架构：`linux/amd64`（本机为 Apple Silicon，必须 `docker buildx build --platform linux/amd64`）
- 运行策略：`unless-stopped`
- 密钥文件：`/root/hanzi-game.env`（权限 600，含 DASHSCOPE_API_KEY / DEEPSEEK_API_KEY，不进镜像）

### 本次随部署一并完成的改动

1. **字体自托管**：原先从 `fonts.googleapis.com` 加载 Ma Shan Zheng / ZCOOL KuaiLe，国内访问会超时导致字体退化。
   现裁剪为仅含界面用到的 1038 个汉字并放入 `public/fonts/`（7 MB → 554 KB）。
   字表由 `scripts/build-font-subset.mjs` 生成，新增关卡词后重跑该脚本再执行 pyftsubset 即可。
2. **修复故事生成静默降级**：`deepseek-flash` 是推理模型，推理会吃掉 `max_tokens` 预算
   （实测 1600–8000 token），超出后 `content` 返回空，接口静默返回本地模板故事且 HTTP 仍为 200。
   实测失败率约 50%。改为 `thinking: { type: 'disabled' }`：耗时 31s → 2-3s，输出 token 降约 35 倍，
   连续 5 次全部真实生成。见 `lib/gemini.ts`。

### 发布前验证

- 本地生产构建通过，standalone 产物正常
- 本地容器冒烟：首页 200、字体 200、故事连续 5 次真实生成

### 发布后验证（经 SSH 隧道，8 项全通过）

| 项目 | 结果 |
|---|---|
| 首页 | HTTP 200 |
| 本地字体 ×2 | HTTP 200，页面无谷歌字体外链 |
| levels.json | HTTP 200 |
| 生故事（DeepSeek） | 真实生成，无 fallback 标记 |
| 朗读（微软 Edge TTS） | 正常返回音频（依赖 Dockerfile 里的 `--dns-result-order=ipv4first`） |
| 生图（阿里云百炼） | 19 秒出图，响应 3.1 MB |

容器日志无 error；内存占用 108.7 MiB。

### 部署时顺带处理

服务器磁盘原为 95%（仅剩 2.3 GB），清理 19 个悬空镜像 + 未使用构建缓存后降至 83%（可用 7.0 GB）。
所有带标签镜像与 7 个运行中容器均未受影响。

### 公网访问

- 访问地址：http://211.159.160.4:8082
- 腾讯云安全组已放行 `8082`（入站 TCP，0.0.0.0/0），与 8080/8081 并列。
- 公网端到端验证：8 项全部通过（含生图 20s / 3.2 MB 响应）。

服务器连接参数保存在本地 `.env.deploy`，不写入发布记录。
