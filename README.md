# Kubernetes 管理 API

基于 Elysia 和 Bun 运行时实现的 Sealos Kubernetes 资源管理 API 服务。

## 功能特性

- Pod 资源管理（列表、详情、删除）
- Deployment 资源管理（创建、更新、扩缩容、重启）
- 集群管理（节点状态、命名空间、服务）
- 基于 Bearer Token 的 API 认证
- Swagger API 文档

## 快速开始

### 环境要求

推荐使用 claw 版的 Sealos ，性价比更高，每个月赠送五美金额度。

Claw 版注册地址：[https://console.run.claw.cloud/signin?link=7KWLLHVRSOTG](https://console.run.claw.cloud/signin?link=7KWLLHVRSOTG)

Sealos 官方版本：[https://cloud.sealos.run/?uid=C2jkh_blDz](https://cloud.sealos.run/?uid=C2jkh_blDz)

- 选择 Devbox Node 运行时
- 安装 Bun， `npm i bun -g`
- Kubernetes 集群访问权限

### 环境变量配置

在项目根目录创建 `.env` 文件，配置以下环境变量：

```env
# Kubernetes API Server 地址
APISERVER=https://kubernetes.default.svc.cluster.local:443

# Kubernetes Service Account Token
USER_TOKEN=your-service-account-token

# 默认操作的命名空间
NAMESPACE=default

# Service Account 用户名
USER_NAME=default

# API 认证令牌
AUTH_TOKEN=your-api-token
```

### 环境变量说明

启动 Sealos terminal 之后去打印环境变量，确保环境变量正确加载。 

`printenv | grep -E '^(APISERVER|USER_TOKEN|NAMESPACE|USER_NAME|AUTH_HEADER)='`

| 变量名 | 必填 | 说明 | 示例值 |
|--------|------|------|--------|
| APISERVER | 是 | Kubernetes API 服务器地址 | https://kubernetes.default.svc.cluster.local:443 |
| USER_TOKEN | 是 | Service Account Token | eyJhbGciOiJSUzI1... |
| NAMESPACE | 否 | 默认操作的命名空间 | default |
| USER_NAME | 否 | Service Account 用户名 | default |
| AUTH_TOKEN | 是 | API 认证令牌 | your-api-token |

### 启动服务

```bash
# 安装依赖
bun install

# 开发模式启动
bun run dev
```

# 发布之前需要编译
```bash
# 编译
bun build
```

## API 文档

启动服务后，可以通过以下地址访问 Swagger API 文档：

```
http://localhost:8080/docs
```

### API 认证

所有 API 请求都需要在 Header 中携带 Bearer Token：

```http
Authorization: Bearer your-api-token
```

## API 路由

- `/api/v1/pods` - Pod 资源管理
- `/api/v1/deployments` - Deployment 资源管理
- `/api/v1/cluster` - 集群资源管理

详细的 API 说明请参考 Swagger 文档。

## 开发说明

### 项目结构

```
src/
  ├── controllers/     # API 控制器
  ├── services/       # 业务逻辑服务
  ├── middleware/     # 中间件
  └── types/         # 类型定义
```

### 调试信息

- API 服务默认运行在 8080 端口
- Swagger 文档访问路径：`/docs`
- 健康检查接口：`/health`
