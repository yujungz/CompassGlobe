# ========================================
# 后端依赖安装
# ========================================
FROM node:20-slim AS server-deps

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/

RUN npm install -g pnpm && pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# ========================================
# 后端构建
# ========================================
FROM node:20-slim AS server-builder

WORKDIR /app

COPY --from=server-deps /app/node_modules ./node_modules
COPY --from=server-deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=server-deps /app/packages/shared/node_modules ./packages/shared/node_modules

COPY package.json pnpm-workspace.yaml ./
COPY apps/server ./apps/server
COPY packages/shared ./packages/shared

WORKDIR /app/apps/server
RUN npx tsc --outDir dist

# ========================================
# 前端 Web 构建
# ========================================
FROM node:20-slim AS web-builder

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN npm install -g pnpm && pnpm install --frozen-lockfile 2>/dev/null || pnpm install

COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

WORKDIR /app/apps/web
RUN npx vite build

# ========================================
# 后台管理构建
# ========================================
FROM node:20-slim AS admin-builder

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY apps/admin/package.json ./apps/admin/
COPY packages/shared/package.json ./packages/shared/

RUN npm install -g pnpm && pnpm install --frozen-lockfile 2>/dev/null || pnpm install

COPY apps/admin ./apps/admin
COPY packages/shared ./packages/shared

WORKDIR /app/apps/admin
RUN npx vite build

# ========================================
# 后端生产镜像
# ========================================
FROM node:20-slim AS server-production

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

COPY --from=server-builder /app/apps/server/dist ./dist
COPY --from=server-builder /app/apps/server/node_modules ./node_modules
COPY --from=server-builder /app/apps/server/package.json ./
COPY --from=server-builder /app/apps/server/prisma ./prisma

RUN npx prisma generate

EXPOSE 3001

CMD ["node", "dist/index.js"]

# ========================================
# Nginx 生产镜像（前端 + 后台管理）
# ========================================
FROM nginx:alpine AS nginx-production

RUN rm -rf /usr/share/nginx/html/*

COPY --from=web-builder /app/apps/web/dist /usr/share/nginx/html/front
COPY --from=admin-builder /app/apps/admin/dist /usr/share/nginx/html/back

EXPOSE 80
