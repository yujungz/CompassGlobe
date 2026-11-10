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
- **Docker Hub 拉取受限（国内/港线服务器）**：直连 `registry-1.docker.io` 可能被拒（`pull access denied`）或超时。在 `/etc/docker/daemon.json` 配置 `registry-mirrors` 加速站后 `systemctl restart docker`。两个坑：① 若原配置含 `data-root`（数据目录指定到数据盘），修改时务必保留，整文件覆盖会让 Docker 改读默认 `/var/lib/docker`，表现为「容器全部消失」（数据仍在旧目录，恢复 data-root 即可）；② Docker 23+ 已移除 `graph` 等老配置项，写进 daemon.json 会导致 dockerd 直接启动失败，报 `directives don't match any configuration option`。
- **MinIO 已停用（当前用本地文件存储）**：生产 `docker-compose.yml` 中 minio 服务已整体注释——部分服务器拉取 `minio/minio` 镜像受限，且 `apps/server/src/lib/storage.ts` 在 MinIO 不可用时自动回退到本地文件系统（`storage_data` 卷持久化），上传/读取功能不受影响。server 日志出现 `MinIO unavailable, using local storage` 属正常回退。将来启用 MinIO：取消三处注释即可（minio 服务块、server `depends_on` 的 minio 条目、底部 `minio_data` 卷声明）。
- **后台管理员初始化（首登 401）**：全新部署的数据库 `Admin` 表为空，后台 `/back` 登录必返回 401「用户名或密码错误」。开发环境可直接 `docker exec compass-server npm run db:seed`；**生产镜像未安装 `tsx`，`prisma db seed` 跑不了**，用下面命令初始化超管（默认 `admin / admin123`，**登录后立即改密码**，该默认密码公开在仓库中）：

  ```bash
  docker exec -i compass-server node --input-type=commonjs <<'EOF'
  const { PrismaClient } = require('@prisma/client')
  const bcrypt = require('bcryptjs')
  const prisma = new PrismaClient()
  ;(async () => {
    const exists = await prisma.admin.findUnique({ where: { username: 'admin' } })
    if (exists) { console.log('admin 已存在，跳过'); return }
    await prisma.admin.create({
      data: { username: 'admin', password: bcrypt.hashSync('admin123', 10), nickname: '超级管理员', role: 'super', status: 1 }
    })
    console.log('创建成功: admin / admin123')
  })().finally(() => prisma.$disconnect())
  EOF
  ```

## HTTPS 配置（SSL 证书）

项目支持通过 HTTPS（端口 8112）访问，用于手机端摄像头、陀螺仪等需要安全上下文的功能。

### 域名更换时重新生成证书

证书文件存放在 `ssl/` 目录（已 gitignore，不入库），Nginx 容器通过 volume 挂载读取。

#### 方案一：Let's Encrypt 免费证书（推荐，浏览器无警告）

> 前提：域名已解析到服务器 IP，且服务器的 80 端口可临时释放。

```bash
cd ~/compass

# 1. 查看并停止占用 80 端口的服务
sudo ss -tlnp | grep :80          # 查看占用进程
sudo systemctl stop nginx          # 停掉占用进程（按实际情况）

# 2. 停止 compass-nginx 释放 80 端口
docker stop compass-nginx

# 3. 用 Docker 版 certbot 申请证书（避免系统 certbot 依赖问题）
docker run -it --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d 你的域名.com \
  --agree-tos -m 你的邮箱

# 4. 复制证书到项目目录
mkdir -p ssl
cp /etc/letsencrypt/live/你的域名.com/fullchain.pem ssl/claw.crt
cp /etc/letsencrypt/live/你的域名.com/privkey.pem ssl/claw.key

# 5. 更新 nginx 配置中的域名
sed -i 's/旧域名/你的域名.com/g' docker/nginx.conf

# 6. 恢复 80 端口服务并启动 compass-nginx
sudo systemctl start nginx         # 恢复原服务（如有）
docker compose up -d --build nginx
```

#### 证书续期（Let's Encrypt 有效期 90 天）

到期前 30 天内执行：

```bash
cd ~/compass

# 1. 临时释放 80 端口
docker stop compass-nginx
sudo systemctl stop nginx          # 如有其他服务占用

# 2. 续期
docker run -it --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -p 80:80 \
  certbot/certbot renew

# 3. 复制新证书
cp /etc/letsencrypt/live/你的域名.com/fullchain.pem ssl/claw.crt
cp /etc/letsencrypt/live/你的域名.com/privkey.pem ssl/claw.key

# 4. 恢复服务
sudo systemctl start nginx
docker compose up -d --build nginx
```

> `certbot renew` 只在到期前 30 天内才会真正续期，提前执行也安全。

#### 方案二：自签证书（快速，浏览器会提示不安全）

```bash
cd ~/compass
mkdir -p ssl
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout ssl/claw.key -out ssl/claw.crt \
  -subj "/CN=你的域名.com"

# 更新域名
sed -i 's/旧域名/你的域名.com/g' docker/nginx.conf

# 重建 nginx
docker compose up -d --build nginx
```

访问 `https://你的域名.com:8112/front`，浏览器点击「高级 → 继续访问」即可。

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
