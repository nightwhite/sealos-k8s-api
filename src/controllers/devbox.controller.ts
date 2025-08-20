import { Elysia, t } from 'elysia';
import { DevboxService, KubernetesService } from '../services';

export const devboxController = new Elysia({ prefix: '/devbox' })
  .decorate('k8sService', KubernetesService.getInstance())
  
  /**
   * 创建 Devbox
   * @description 创建一个新的 Devbox 开发环境
   * @example
   * POST /api/v1/devbox/create
   * {
   *   "devboxName": "my-k8s-api",        // 必填
   *   "urlPrefix": "abc123def456",       // 必填
   *   "urlSuffix": "sealosbja.site",     // 必填
   *   "templateID": "uuid",              // 必填
   *   "image": "registry/image:tag",     // 必填
   *   "cpu": "1000m",                    // 可选，默认 1000m
   *   "memory": "2048Mi"                 // 可选，默认 2048Mi
   * }
   */
  .post('/create', async ({ body, k8sService }) => {
    try {
      const devboxService = new DevboxService(k8sService);
      const result = await devboxService.createDevbox(body);
      
      if (!result.success) {
        return {
          success: false,
          message: result.message,
          error: result.error
        };
      }

      return {
        success: true,
        message: result.message,
        data: result.devbox
      };

    } catch (error: any) {
      console.error('创建 Devbox 失败:', error);
      return {
        success: false,
        message: '创建 Devbox 失败',
        error: error.message
      };
    }
  }, {
    body: t.Object({
      devboxName: t.String({
        description: 'Devbox 名称，只能包含小写字母、数字和连字符',
        pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$',
        minLength: 1,
        maxLength: 63,
        examples: ['my-k8s-api', 'web-app-dev', 'data-processor']
      }),
      urlPrefix: t.String({
        description: '网址前缀，通常是12位随机字符串',
        minLength: 8,
        maxLength: 20,
        examples: ['abc123def456', 'xyz789uvw012']
      }),
      urlSuffix: t.String({
        description: '网址后缀，域名后缀',
        examples: ['sealosbja.site', 'sealos.run', 'cloud.sealos.io']
      }),
      templateID: t.String({
        description: '模板ID，指定 Devbox 使用的模板',
        examples: ['54f55b3e-8ade-4da1-b1db-667379430a66']
      }),
      image: t.String({
        description: '基础镜像，指定 Devbox 使用的容器镜像',
        examples: ['labring-registry.cn-hangzhou.cr.aliyuncs.com/devbox-runtime/ubuntu-24.04:v0.1.1-cn']
      }),
      cpu: t.Optional(t.String({
        description: 'CPU 资源配置，默认 1000m',
        default: '1000m',
        examples: ['1000m', '2000m', '4000m']
      })),
      memory: t.Optional(t.String({
        description: '内存资源配置，默认 2048Mi',
        default: '2048Mi',
        examples: ['2048Mi', '4096Mi', '8192Mi']
      }))
    }),
    detail: {
      summary: '创建 Devbox',
      description: '创建一个新的 Devbox 开发环境，包括计算资源、网络服务和外部访问入口',
      tags: ['Devbox']
    }
  })

  /**
   * 获取 Devbox 列表
   * @description 获取当前命名空间下的所有 Devbox
   */
  .get('/list', async ({ k8sService }) => {
    try {
      const devboxService = new DevboxService(k8sService);
      const result = await devboxService.getDevboxList();

      if (!result.success) {
        return {
          success: false,
          message: '获取 Devbox 列表失败',
          error: result.error
        };
      }

      return {
        success: true,
        total: result.total,
        items: result.items
      };

    } catch (error: any) {
      console.error('获取 Devbox 列表失败:', error);
      return {
        success: false,
        message: '获取 Devbox 列表失败',
        error: error.message
      };
    }
  }, {
    detail: {
      summary: '获取 Devbox 列表',
      description: '获取当前命名空间下的所有 Devbox 开发环境',
      tags: ['Devbox']
    }
  })

  /**
   * 获取 Devbox 详情
   * @description 获取指定 Devbox 的详细信息
   */
  .get('/:name', async ({ params, k8sService }) => {
    try {
      const { name } = params;
      const devboxService = new DevboxService(k8sService);
      const result = await devboxService.getDevboxDetails(name);

      if (!result.success) {
        return {
          success: false,
          message: `Devbox ${name} 不存在`,
          error: result.error
        };
      }

      return {
        success: true,
        data: result.devbox
      };

    } catch (error: any) {
      console.error('获取 Devbox 详情失败:', error);
      return {
        success: false,
        message: '获取 Devbox 详情失败',
        error: error.message
      };
    }
  }, {
    params: t.Object({
      name: t.String({
        description: 'Devbox 名称'
      })
    }),
    detail: {
      summary: '获取 Devbox 详情',
      description: '获取指定 Devbox 的详细信息',
      tags: ['Devbox']
    }
  })

  /**
   * 删除 Devbox
   * @description 删除指定的 Devbox
   */
  .delete('/:name', async ({ params, k8sService }) => {
    try {
      const { name } = params;
      const devboxService = new DevboxService(k8sService);
      const result = await devboxService.deleteDevbox(name);

      return {
        success: result.success,
        message: result.message,
        error: result.error
      };

    } catch (error: any) {
      console.error('删除 Devbox 失败:', error);
      return {
        success: false,
        message: '删除 Devbox 失败',
        error: error.message
      };
    }
  }, {
    params: t.Object({
      name: t.String({
        description: 'Devbox 名称'
      })
    }),
    detail: {
      summary: '删除 Devbox',
      description: '删除指定的 Devbox 开发环境',
      tags: ['Devbox']
    }
  })

  /**
   * 暂停 Devbox
   * @description 暂停指定的 Devbox
   */
  .post('/:name/stop', async ({ params, k8sService }) => {
    try {
      const { name } = params;
      const devboxService = new DevboxService(k8sService);
      const result = await devboxService.stopDevbox(name);

      return {
        success: result.success,
        message: result.message,
        error: result.error
      };

    } catch (error: any) {
      console.error('暂停 Devbox 失败:', error);
      return {
        success: false,
        message: '暂停 Devbox 失败',
        error: error.message
      };
    }
  }, {
    params: t.Object({
      name: t.String({
        description: 'Devbox 名称'
      })
    }),
    detail: {
      summary: '暂停 Devbox',
      description: '暂停指定的 Devbox 开发环境',
      tags: ['Devbox']
    }
  })

  /**
   * 启动 Devbox
   * @description 启动指定的 Devbox
   */
  .post('/:name/start', async ({ params, k8sService }) => {
    try {
      const { name } = params;
      const devboxService = new DevboxService(k8sService);
      const result = await devboxService.startDevbox(name);

      return {
        success: result.success,
        message: result.message,
        error: result.error
      };

    } catch (error: any) {
      console.error('启动 Devbox 失败:', error);
      return {
        success: false,
        message: '启动 Devbox 失败',
        error: error.message
      };
    }
  }, {
    params: t.Object({
      name: t.String({
        description: 'Devbox 名称'
      })
    }),
    detail: {
      summary: '启动 Devbox',
      description: '启动指定的 Devbox 开发环境',
      tags: ['Devbox']
    }
  })

  /**
   * 修改 Devbox 资源配置
   * @description 修改指定 Devbox 的 CPU 和内存配置
   */
  .patch('/:name/resources', async ({ params, body, k8sService }) => {
    try {
      const { name } = params;
      const { cpu, memory } = body;
      const devboxService = new DevboxService(k8sService);
      const result = await devboxService.updateDevboxResources(name, cpu, memory);

      return {
        success: result.success,
        message: result.message,
        error: result.error
      };

    } catch (error: any) {
      console.error('修改 Devbox 资源配置失败:', error);
      return {
        success: false,
        message: '修改 Devbox 资源配置失败',
        error: error.message
      };
    }
  }, {
    params: t.Object({
      name: t.String({
        description: 'Devbox 名称'
      })
    }),
    body: t.Object({
      cpu: t.Optional(t.String({
        description: 'CPU 配置，如 1000m, 2000m',
        examples: ['1000m', '2000m', '4000m']
      })),
      memory: t.Optional(t.String({
        description: '内存配置，如 2048Mi, 4096Mi',
        examples: ['2048Mi', '4096Mi', '8192Mi']
      }))
    }),
    detail: {
      summary: '修改 Devbox 资源配置',
      description: '修改指定 Devbox 的 CPU 和内存配置',
      tags: ['Devbox']
    }
  });
