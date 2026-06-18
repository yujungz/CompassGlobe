# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

风水地球仪 - 罗盘与地理分析系统

基于 CesiumJS 的 3D 地球仪应用，结合风水罗盘功能和 AI 大模型，提供地理信息展示和智能风水分析。

## Tech Stack

- **Frontend (Web)**: Vue 3 + TypeScript + Vite + CesiumJS
- **Admin**: Vue 3 + TypeScript + Vite + Element Plus
- **Backend**: Node.js + Express + TypeScript + Prisma
- **Database**: PostgreSQL + PostGIS
- **Cache**: Redis
- **AI**: GLM-5
- **Maps**: 天地图 + 高德地图
- **Email**: QQ邮箱 SMTP
- **Deploy**: Docker + Nginx（全容器化）

## Project Structure

```
compass/
├── docker-compose.yml           # 生产环境（全容器化）
├── docker-compose.dev.yml       # 开发环境
├── apps/
│   ├── web/                     # 前端主应用（base: /front/）
│   ├── admin/                   # 后台管理系统（base: /back/）
│   └── server/                  # 后端服务
├── packages/shared/             # 共享类型定义
├── docker/
│   ├── Dockerfile               # 多阶段构建（server / nginx）
│   ├── nginx.conf               # 生产 Nginx 配置
│   └── nginx.dev.conf           # 开发 Nginx 配置
└── docs/                        # 项目文档
```

## Docker Architecture

所有服务容器化运行，统一入口端口 **8110**：

| 容器 | 说明 | 端口 |
|------|------|------|
| compass-nginx | Nginx 反向代理 + 前端静态文件 | 8110 → 80 |
| compass-server | Node.js 后端 API | 3001 |
| compass-postgres | PostgreSQL 数据库 | 5432 |
| compass-redis | Redis 缓存 | 6379 |

### 开发环境

```bash
# 启动基础设施 + 后端
docker-compose -f docker-compose.dev.yml up -d

# 本地启动前端开发服务
npm run dev:web
npm run dev:admin
```

开发环境中，后端在容器内运行（挂载源码，热重载），前端在本地 Vite dev server 运行，Nginx 统一代理。

### 生产环境

```bash
docker-compose up -d --build
```

所有服务完全容器化，不需要本地 Node.js。

## Development Commands

```bash
# Docker
docker-compose -f docker-compose.dev.yml up -d    # 启动开发环境
docker-compose -f docker-compose.dev.yml down      # 停止开发环境
docker-compose -f docker-compose.dev.yml logs -f   # 查看日志
docker-compose up -d --build                       # 生产构建并启动
docker-compose down                                # 停止生产环境

# 前端开发（本地）
npm run dev:web              # 前端主应用
npm run dev:admin            # 后台管理

# 构建
npm run build                # 构建所有项目
npm run build:web            # 仅前端
npm run build:admin          # 仅后台管理
npm run build:server         # 仅后端

# 数据库（容器内执行）
docker exec compass-server npx prisma generate
docker exec compass-server npx prisma db push
docker exec compass-server npx prisma studio
```

## Access URLs

| 模块 | 地址 |
|------|------|
| 前端主应用 | http://localhost:8110/front |
| 后台管理 | http://localhost:8110/back |
| 后端 API | http://localhost:8110/api |

## Environment Variables

复制 `apps/server/.env.example` 到 `apps/server/.env`：

- `DATABASE_URL` - PostgreSQL 连接
- `JWT_SECRET` - JWT 密钥
- `TDT_KEY` - 天地图 API Key
- `AMAP_KEY` - 高德地图 API Key
- `QWEATHER_KEY` - 和风天气 API Key
- `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` - QQ邮箱 SMTP
- `ANTHROPIC_BASE_URL` - GLM-5 API 地址
- `ANTHROPIC_API_KEY` - GLM-5 API Key

## Architecture

### Frontend (apps/web)
- `src/views/` - 页面组件（首页、登录、注册、个人中心、分析、历史）
- `src/components/Globe/` - 地球仪组件（Globe、SidePanel）
- `src/components/common/` - 通用组件（NavBar）
- `src/api/` - API 请求封装（request、auth、globe）
- `src/composables/` - 组合式函数（useDevice、useAuth）
- `src/router/` - 路由配置（base: /front/）
- 响应式设计，PC/移动端一套代码

### Admin (apps/admin)
- `src/views/` - 仪表盘、用户管理、分析记录、系统配置
- `src/layouts/AdminLayout.vue` - 侧边栏 + 头部布局
- Element Plus + 自动导入（base: /back/）

### Backend (apps/server)
- `src/modules/auth/` - 认证（手机/邮箱/微信注册登录）
- `src/modules/globe/` - 地球仪数据（位置、海拔、天气）
- `src/modules/analysis/` - 风水分析（CRUD + AI）
- `src/modules/user/` - 用户管理（个人信息、密码）
- `src/middlewares/` - JWT 认证、错误处理
- `src/lib/` - Prisma、JWT、密码加密、邮箱发送、微信模拟
- `prisma/schema.prisma` - 数据库模型（User、Analysis、History、Config）

### Authentication
- 手机号 + 短信验证码（模拟）
- 手机号/邮箱 + 密码
- 邮箱 + 验证码（QQ邮箱 SMTP）
- 微信扫码登录（模拟，UI 已完成）

## API Endpoints

### Auth
- `POST /api/auth/register` - 注册（手机/邮箱）
- `POST /api/auth/login` - 登录（密码/短信/邮箱验证码）
- `POST /api/auth/sms-code` - 发送短信验证码
- `POST /api/auth/email-code` - 发送邮箱验证码
- `GET /api/auth/wechat/qrcode` - 获取微信二维码
- `GET /api/auth/wechat/check/:ticket` - 轮询扫码状态
- `GET /api/auth/me` - 获取当前用户

### Globe
- `GET /api/globe/location` - 获取位置信息
- `GET /api/globe/altitude` - 获取海拔
- `GET /api/globe/weather` - 获取天气

### Analysis
- `POST /api/analysis` - 创建分析记录
- `GET /api/analysis` - 获取分析历史
- `GET /api/analysis/:id` - 获取分析详情
- `PUT /api/analysis/:id` - 更新分析结果
- `DELETE /api/analysis/:id` - 删除分析记录

### User
- `GET /api/user/profile` - 获取用户信息
- `PUT /api/user/profile` - 更新用户信息
- `PUT /api/user/password` - 修改密码
