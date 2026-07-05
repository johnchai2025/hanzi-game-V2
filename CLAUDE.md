# 汉字对对碰 v2 — 项目规则

## 项目概况

面向小学低年级（6-9岁）的汉字词语消除游戏，在原开源项目基础上大幅扩展，加入 AI 词卡生成和故事模块。

**完整开发方案**：见 `docs/plan.md`

---

## 技术栈

- **框架**：Next.js 16 + React 19 + TypeScript
- **样式**：自定义 CSS（`app/globals.css`），不使用 Tailwind
- **图片生成**：阿里云百炼 wan2.6-t2i（`app/api/generate-image/route.ts`）
- **TTS**：浏览器内置 Web Speech API
- **存储**：localStorage（无数据库）
- **部署**：Docker 或 Vercel

---

## 目录约定

```
app/
  api/generate-image/   ← DashScope wan2.6-t2i 图片生成 API
  api/generate-story/   ← Gemini 故事生成 API
components/             ← 所有 React 组件（均需 'use client'）
hooks/                  ← 所有自定义 hooks（均需 'use client'）
lib/                    ← 服务端工具（gemini.ts 等）
types.ts                ← 所有类型定义
public/levels.json      ← 关卡数据（已校正词对，不轻易修改）
docs/plan.md            ← 完整功能规划
```

---

## 已完成

- [x] Next.js 迁移（从原 Vite 项目）
- [x] levels.json 词对质量修正（7关 16组）
- [x] 起始界面 Bug 修复（默认进选关界面）
- [x] 所有组件加 `'use client'`
- [x] `@google/generative-ai` 已安装
- [x] **死局检测**：消除后扫描棋盘，无可消对时提示重排
- [x] **Profile 设置向导**：首次进入弹出 IP / 场景偏好配置
- [x] **AI 词卡生成**：配对成功后台调用 DashScope wan2.6-t2i，生成后自动保存到词卡库
- [x] **词卡库 UI**：带图片的卡片展示，替代现有词语本
- [x] **Bug 修复**：硬编码 18 改为动态计算
- [x] **故事模块**：选词 → 生成故事 → TTS 朗读（逐句高亮 + 再生成按钮）

## 待开发（按优先级）

- [ ] **部署上线**：Vercel（快速）或 Docker + `output: 'standalone'`（私有），需配置 `DASHSCOPE_API_KEY` 环境变量
- [ ] **音效**：匹配成功音、消除音、关卡完成庆祝（Web Audio API / `<audio>`）
- [ ] **关卡星级**：用时越短得星越多，增加复玩动力
- [ ] **提示功能**：点击"提示"高亮一对可消除词对
- [ ] **课程词库接入**：`public/curriculum/` 已有数据，补充到关卡选择界面
- [ ] **自定义词库入口优化**：移到 LevelSelectScreen 显眼位置

---

## 开发规则

- 所有客户端组件文件顶部必须有 `'use client'`
- DashScope API Key 只在服务端（API Routes）调用，不暴露到客户端
- 关卡数据变更后运行验证：`node scripts/validate-levels.js public/levels.json`（脚本在原 fork 仓库，可按需复制）
- 新类型统一加到 `types.ts`，不在组件内定义接口

## 环境变量

```bash
# .env.local（不提交到 git）
DASHSCOPE_API_KEY=your_key_here
```
