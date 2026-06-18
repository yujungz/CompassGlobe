# CompassGlobe · 风水地球仪

罗盘与地理分析系统 — 基于 3D 地球仪的风水罗盘应用，结合卫星地图、实时地理数据和 AI 大模型分析。

> 📖 **终端用户**请参阅 [用户手册](docs/用户手册.md)；本文档面向**开发者与部署人员**（技术架构、部署、环境变量、API）。

## 项目结构

```
compass/
├── docker-compose.yml           # 生产环境（全容器化）
├── docker-compose.dev.yml       # 开发环境
├── apps/
│   ├── web/                     # 前端主应用（Vue 3 + CesiumJS）
│   ├── admin/                   # 后台管理系统（Vue 3 + Element Plus）
│   └── server/                  # 后端服务（Node.js + Express）
├── packages/shared/             # 共享类型定义
├── docker/
│   ├── Dockerfile               # 多阶段构建（server / nginx）
│   ├── nginx.conf               # 生产环境 Nginx
│   └── nginx.dev.conf           # 开发环境 Nginx
└── docs/                        # 项目文档
```

## 环境要求

### 开发环境
- Docker >= 20 + Docker Compose >= 2.0
- Node.js >= 18

### 生产环境
- Docker >= 20 + Docker Compose >= 2.0（不需要 Node.js）

## 快速开始

### 开发环境

```bash
# 1. 启动基础设施（数据库 + Redis + 后端 + Nginx）
docker-compose -f docker-compose.dev.yml up -d

# 2. 配置环境变量
cp apps/server/.env.example apps/server/.env
# 编辑 .env 填写 API Key

# 3. 初始化数据库（首次）
docker exec compass-server npx prisma db push

# 4. 安装前端依赖
npm install

# 5. 启动前端开发服务
npm run dev:web        # 前端主应用
npm run dev:admin      # 后台管理（另一个终端）

# 6. 访问
```

### 生产部署

```bash
# 1. 配置环境变量
cp apps/server/.env.example apps/server/.env
# 编辑 .env 填写生产环境配置

# 2. 一键构建并启动（不需要本地 Node.js）
docker-compose up -d --build

# 3. 初始化数据库（首次）
docker exec compass-server npx prisma db push
```

## 访问地址

统一入口端口 **8110**：

| 模块 | 地址 |
|------|------|
| 前端主应用 | http://localhost:8110/front |
| 后台管理 | http://localhost:8110/back |
| 后端 API | http://localhost:8110/api |

## 功能与数据源

地球仪提供四类地理数据查询（API 前缀 `/api/globe`）：

| 接口 | 功能 | 数据源 | 备注 |
|------|------|--------|------|
| `GET /location` | 经纬度 → 地址、时区 | 高德逆地理编码 | 需 `AMAP_KEY` |
| `GET /altitude` | 海拔 | Open-Meteo（主） → OpenTopoData（备） | 主备双源，自动降级，无需 Key |
| `GET /weather` | 实时天气（温度/湿度/风速/风向/天气状况） | 和风天气（JWT 认证） | 需 Ed25519 私钥 |
| `GET /tdt-key` | 下发天地图密钥 | — | 供前端瓦片图层使用 |

卫星底图由前端 Cesium 加载天地图 `img_w`（卫星影像）+ `cia_w`（中文注记），密钥通过 `/tdt-key` 接口从后端获取。

> 设计说明：海拔未采用高德（无公开 REST 海拔 API）与 Open-Elevation（公共服务不稳定）；天气采用和风新版 JWT 认证（旧版 API Key 自 2027-01-01 起受限）。

**AI 风水分析**：`POST /api/analysis/analyze`（需登录）—— 由大模型（默认 `gpt-5.2`，配置见 `AI_*` 环境变量）基于位置 / 海拔 / 天气 / 八卦方位生成分析报告并落库到 `analyses` 表。封装在 `apps/server/src/lib/ai.ts`（`chatCompletion`），提示词在 `apps/server/src/modules/analysis/prompt.ts`。

## 容器架构

```
                    ┌─────────────────┐
                    │  Nginx (:8110)  │
                    │    统一入口      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────▼─────┐ /front│        /back │
        │  静态文件  │       │        静态文件│
        └───────────┘       │              │
                        ┌───▼────┐    ┌────▼───┐
                        │ Server │    │  API   │
                        │ :3001  │    │ 代理   │
                        └───┬────┘    └────────┘
                            │
                   ┌────────┼────────┐
                   │        │        │
              ┌────▼──┐ ┌───▼──┐ ┌──▼───┐
              │ PgSQL │ │Redis │ │GLM-5 │
              └───────┘ └──────┘ └──────┘
```

| 容器 | 镜像 | 说明 |
|------|------|------|
| compass-nginx | 自定义构建（nginx + 前端静态文件） | 反向代理 + 静态资源 |
| compass-server | 自定义构建（node + 后端代码） | API 服务 |
| compass-postgres | postgres:15-alpine | 数据库 |
| compass-redis | redis:7-alpine | 缓存 |

## 常用命令

```bash
# Docker（开发环境）
docker-compose -f docker-compose.dev.yml up -d     # 启动
docker-compose -f docker-compose.dev.yml down       # 停止
docker-compose -f docker-compose.dev.yml logs -f    # 日志

# Docker（生产环境）
docker-compose up -d --build                        # 构建并启动
docker-compose down                                 # 停止
docker-compose logs -f                              # 日志

# 本地开发（仅前端）
npm install                                         # 安装依赖
npm run dev:web                                     # 前端主应用
npm run dev:admin                                   # 后台管理

# 构建
npm run build                                       # 构建所有项目

# 数据库
docker exec compass-server npx prisma generate      # 生成 Client
docker exec compass-server npx prisma db push       # 推送结构
docker exec compass-server npx prisma studio        # 管理界面
```

## 环境变量

在 `apps/server/.env` 中配置：

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串（开发环境已自动配置） |
| `JWT_SECRET` | 是 | JWT 密钥 |
| `SMTP_HOST` | 否 | 邮箱 SMTP 地址（默认 smtp.qq.com） |
| `SMTP_USER` | 否 | 邮箱账号 |
| `SMTP_PASS` | 否 | 邮箱 SMTP 授权码 |
| `TDT_KEY` | 否 | 天地图 API Key（卫星底图 `img_w` + 注记 `cia_w`） |
| `AMAP_KEY` | 否 | 高德 API Key（逆地理编码 `/location`） |
| `QWEATHER_API_HOST` | 否 | 和风天气自定义 API Host（JWT 认证） |
| `QWEATHER_PROJECT_ID` | 否 | 和风项目 ID（JWT `sub`） |
| `QWEATHER_CREDENTIAL_ID` | 否 | 和风凭据 ID（JWT `kid`） |
| `QWEATHER_PRIVATE_KEY_PATH` | 否 | Ed25519 私钥路径（JWT 签名） |
| `AI_CHAT_URL` | 否 | 文本对话接口地址（OpenAI 兼容） |
| `AI_CHAT_KEY` | 否 | 文本对话密钥 |
| `AI_CHAT_MODEL` | 否 | 文本对话模型（如 gpt-5.2） |
| `AI_IMAGE_URL` | 否 | 文生图接口地址（generations） |
| `AI_IMAGE_EDIT_URL` | 否 | 修图接口地址（edits） |
| `AI_IMAGE_KEY` | 否 | 图像接口密钥（文生图 / 修图共用） |
| `AI_IMAGE_MODEL` | 否 | 图像模型（如 gpt-image-2-pro） |

## 部署注意事项

- **和风天气私钥**：生产部署前，把 Ed25519 私钥放到 `secrets/qweather-ed25519.pem`（该目录已 gitignore，不入库）。生产 `docker-compose.yml` 会把它只读挂载进 `compass-server` 容器的 `/run/secrets/qweather_ed25519`，`QWEATHER_PRIVATE_KEY_PATH` 已固定指向该容器路径。本地开发则用 `apps/server/.env` 的 `QWEATHER_PRIVATE_KEY_PATH` 指向宿主机路径。切勿把私钥打进镜像或提交 git。
- **天地图防盗刷**：`TDT_KEY` 会下发到前端浏览器，上线前请在天地图控制台为该 Key 配置**域名白名单**。
- **邮箱验证码**：依赖 `SMTP_*`；短信验证码为模拟实现。

## 认证方式

- 手机号 + 短信验证码
- 手机号 / 邮箱 + 密码
- 邮箱 + 验证码（QQ邮箱 SMTP）
- 微信扫码登录

## 技术栈

| 分类 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Vite + CesiumJS |
| 后台 | Vue 3 + TypeScript + Element Plus |
| 后端 | Node.js + Express + TypeScript + Prisma |
| 数据库 | PostgreSQL + PostGIS |
| 缓存 | Redis |
| AI | OpenAI 兼容接口（文本对话 gpt-5.2 / 图像 gpt-image-2-pro） |
| 地图 | 天地图 + 高德地图 |
| 邮箱 | QQ邮箱 SMTP |
| 部署 | Docker + Nginx |
