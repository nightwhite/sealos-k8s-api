# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码仓库中工作提供指导。

## 项目概述

这是一个基于 Elysia (TypeScript) 和 Bun 运行时构建的 Sealos Kubernetes 管理 API。提供用于管理 Kubernetes 资源（包括 Pod、Deployment 和集群信息）的 REST API 端点。

## 开发命令

```bash
# 安装依赖
bun install

# 开发模式（热重载）
bun run dev

# 生产环境构建
bun build

# 未配置测试脚本 - 需要设置测试
```

## 环境设置

应用程序需要以下环境变量（创建 `.env` 文件）：

```env
APISERVER=https://kubernetes.default.svc.cluster.local:443
USER_TOKEN=your-service-account-token
NAMESPACE=default
USER_NAME=default
AUTH_TOKEN=your-api-token
```

- `APISERVER`: Kubernetes API 服务器地址
- `USER_TOKEN`: 用于 K8s API 访问的 Service Account 令牌
- `NAMESPACE`: 操作的默认命名空间
- `USER_NAME`: Service Account 用户名
- `AUTH_TOKEN`: API 认证的 Bearer 令牌

## 架构

### 核心结构
- **入口点**: `src/index.ts` - 主要的 Elysia 服务器设置，包含 Swagger 文档
- **服务层**: `src/services/k8s.service.ts` - Kubernetes 客户端封装，提供全面的资源管理
- **控制器**: `src/controllers/` - 不同资源类型的 API 路由处理器
- **中间件**: `src/middleware/auth.guard.ts` - Bearer 令牌认证

### 主要架构模式

1. **服务层模式**: `KubernetesService` 集中处理所有 K8s API 交互
2. **控制器模式**: 每种资源类型（pods、deployments、cluster、kubectl）都有专用控制器
3. **认证中间件**: Bearer 令牌认证应用于所有 `/api/v1/*` 路由
4. **错误处理**: 集中化错误处理，提供格式化响应

### API 设计
- 基础路径: `/api/v1/`
- Swagger 文档位于 `/docs`
- 健康检查位于 `/health`
- 所有端点都需要 Bearer 令牌认证
- RESTful 资源端点: `/pods`、`/deployments`、`/cluster`、`/kubectl`

### Kubernetes 集成
- 使用官方 `@kubernetes/client-node` 库
- 支持自定义 ServiceAccount 令牌认证
- 处理开发环境的 SSL/TLS 证书验证绕过
- 全面的资源管理（CRUD 操作、扩缩容、YAML 部署）
- 支持 kubectl 命令执行，覆盖所有 kubectl 功能

## 主要功能

1. **Pod 管理**: 列表、获取详情、删除 Pod，支持过滤
2. **Deployment 管理**: 创建、更新、扩缩容、重启部署，支持 YAML
3. **集群管理**: 节点状态、命名空间、服务概览
4. **YAML 部署**: 应用复杂的多资源 YAML 配置
5. **kubectl 命令执行**: 
   - 通用命令执行接口 (`POST /kubectl/exec`)
   - 快捷资源获取 (`GET /kubectl/get/{resource}`)
   - 资源详细描述 (`GET /kubectl/describe/{resource}/{name}`)
   - Pod 日志获取 (`GET /kubectl/logs/{podName}`)
   - 自动添加认证信息，支持所有 kubectl 功能
6. **自动生成 API 文档**: 包含认证的 Swagger/OpenAPI 文档

## 开发流程

### 代码修改原则
- 完成代码修改后，**不要自动启动服务或执行测试**
- 修改完成后，告知用户"修改完成"并提供**测试方案**
- 让用户自己决定何时启动服务和执行测试

### 修改完成后的标准流程
1. **告知修改完成**: 简要说明完成了什么修改
2. **提供测试方案**: 给出具体的测试步骤和命令
3. **等待用户反馈**: 让用户自己测试并反馈结果

## 开发说明

- 服务器默认运行在 8080 端口
- TLS 证书验证已禁用 (`NODE_TLS_REJECT_UNAUTHORIZED = '0'`)
- 使用 Bun 运行时提升性能
- API 响应和文档支持中文
- 专为 Sealos 云环境设计