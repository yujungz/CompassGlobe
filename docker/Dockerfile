# ========================================
# 后端依赖安装
# ========================================
FROM node:20-slim AS server-deps

RUN apt-get update -y && apt-get install -y openssl fonts-noto-cjk

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
RUN npx prisma generate
RUN npx -p typescript tsc --outDir dist

# ========================================
# 前端 Web 构建
# ========================================
FROM node:20-slim AS web-builder

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# hoisted 模式：扁平 node_modules，确保 cesium 等包的目录结构完整可访问
RUN echo 'node-linker=hoisted' > .npmrc \
 && npm install -g pnpm \
 && pnpm install --frozen-lockfile 2>/dev/null || pnpm install

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

RUN apt-get update -y && apt-get install -y openssl fonts-noto-cjk

WORKDIR /app

# 安装生产依赖（npm flat node_modules）
COPY --from=server-builder /app/apps/server/package.json ./
RUN npm install --omit=dev

# 编译产物 + Prisma schema + 生成 Prisma Client
COPY --from=server-builder /app/apps/server/dist ./dist
COPY --from=server-builder /app/apps/server/prisma ./prisma
RUN npx prisma generate

EXPOSE 3001

CMD ["node", "dist/index.js"]

# ========================================
# Nginx 生产镜像（前端 + 后台管理）
# ========================================
FROM nginx:alpine AS nginx-production

RUN rm -rf /usr/share/nginx/html/*

# 前端：展平 vite-plugin-cesium 产生的嵌套 dist/front/cesium/
COPY --from=web-builder /app/apps/web/dist /tmp/web_dist
COPY --from=admin-builder /app/apps/admin/dist /tmp/admin_dist
# 展平：vite-plugin-cesium 输出 dist/front/cesium/（base 前缀所致），提升到 /front/cesium/
RUN mkdir -p /usr/share/nginx/html/front /usr/share/nginx/html/back \
 && cp -r /tmp/web_dist/* /usr/share/nginx/html/front/ \
 && if [ -d /tmp/web_dist/front ]; then \
      cp -r /tmp/web_dist/front/* /usr/share/nginx/html/front/ \
      && rm -rf /usr/share/nginx/html/front/front; \
    fi \
 && cp -r /tmp/admin_dist/* /usr/share/nginx/html/back/ \
 && rm -rf /tmp/web_dist /tmp/admin_dist

EXPOSE 80
