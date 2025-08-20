# 构建阶段
FROM oven/bun:latest as builder

# 设置工作目录
WORKDIR /app

# 复制package.json和lock文件
COPY package.json bun.lockb* ./

# 安装依赖
RUN bun install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN bun run build

# 运行阶段
FROM oven/bun:slim

WORKDIR /app

# 安装 kubectl 和必要的工具
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 安装 kubectl
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/

# 复制构建产物和必要文件
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# 仅安装生产依赖
RUN bun install --production --frozen-lockfile

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=8080

# 暴露端口
EXPOSE 8080

# 添加健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# 指定启动命令
CMD ["bun", "run", "dist/index.js"]