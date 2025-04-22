// 禁用证书验证
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import * as dotenv from 'dotenv';
// 加载环境变量
dotenv.config();

import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { podController } from './controllers/pod.controller';
import { deploymentController } from './controllers/deployment.controller';
import { clusterController } from './controllers/cluster.controller';

// 创建 API 版本前缀
const API_VERSION = '/api/v1';

// 创建应用并添加 Swagger 文档
const app = new Elysia()
  .use(swagger({
    path: '/docs',
    documentation: {
      info: {
        title: 'Sealos Kubernetes 管理 API',
        version: '1.0.0',
        description: '用户 Sealos K8s 集群的资源管理 API',
      },
      tags: [
        { name: 'Pods', description: 'Pod 相关操作' },
        { name: 'Deployments', description: '部署相关操作' },
        { name: 'Cluster', description: '集群状态相关操作' }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'token',
            description: 'API 认证令牌'
          }
        }
      },
      security: [
        { bearerAuth: [] }
      ]
    }
  }))
  
  // 添加状态检查端点
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  }))
  
  // 添加根端点，提供 API 基本信息
  .get('/', () => ({
    name: 'Kubernetes Management API',
    description: '用于自动化工具管理 K8s 资源的 API 服务',
    version: '1.0.0',
    docs: '/docs',
    health: '/health',
    apiBase: API_VERSION
  }))
  
  // 添加 API 路由组
  .group(API_VERSION, app => 
    app.use(podController)
       .use(deploymentController)
       .use(clusterController)
  )

  // 全局错误处理
  .onError(({ code, error }) => {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    console.error(`[${code}] ${errorMessage}`);
    
    if (code === 'NOT_FOUND') {
      console.error('请求的资源不存在', error);
      return {
        success: false,
        error: 'Not Found',
        message: '请求的资源不存在',
        status: 404
      };
    }
    
    return {
      success: false,
      error: 'Internal Server Error',
      message: errorMessage,
      status: 500
    };
  })
  
  // 启动服务器
  .listen(process.env.PORT || 8080);

console.log(
  `🦊 Kubernetes 管理 API 运行中 - ${app.server?.hostname}:${app.server?.port}`
);
console.log(`📚 API 文档可在 ${app.server?.hostname}:${app.server?.port}/docs 访问`);

// 导出应用以供测试
export type App = typeof app;
