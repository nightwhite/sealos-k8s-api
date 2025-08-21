import { Elysia, t } from 'elysia';
import { DevboxService, KubernetesService } from '../services';

/**
 * 解析 DevBoxRelease 状态
 */
function parseReleaseStatus(status: any): string {
  if (!status) {
    return 'Pending';
  }

  // 检查常见的状态字段
  if (status.phase) {
    return status.phase; // Success, Failed, Pending 等
  }

  if (status.conditions && Array.isArray(status.conditions)) {
    // 查找最新的条件
    const latestCondition = status.conditions
      .sort((a: any, b: any) => 
        new Date(b.lastTransitionTime || 0).getTime() - 
        new Date(a.lastTransitionTime || 0).getTime()
      )[0];

    if (latestCondition) {
      if (latestCondition.type === 'Ready' && latestCondition.status === 'True') {
        return 'Success';
      }
      if (latestCondition.type === 'Failed' && latestCondition.status === 'True') {
        return 'Failed';
      }
      return latestCondition.type || 'Processing';
    }
  }

  // 检查其他可能的状态字段
  if (status.state) {
    return status.state;
  }

  if (status.ready === true) {
    return 'Success';
  }

  if (status.ready === false) {
    return 'Failed';
  }

  return 'Processing';
}

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
  })

  /**
   * 获取 DevBoxRelease 列表
   * @description 获取当前命名空间下的所有 DevBoxRelease，支持按 Devbox 名称筛选
   * @example
   * GET /api/v1/devbox/releases - 获取所有版本
   * GET /api/v1/devbox/releases?devboxName=my-k8s-api - 获取特定 Devbox 的版本
   */
  .get('/releases', async ({ query, k8sService }) => {
    try {
      const { devboxName } = query;
      const devboxService = new DevboxService(k8sService);
      
      let result;
      if (devboxName) {
        // 如果指定了 devboxName，则只获取该 Devbox 的版本
        result = await devboxService.getDevboxVersions(devboxName);
      } else {
        // 否则获取所有版本
        result = await devboxService.getDevboxReleaseList();
      }

      if (!result.success) {
        return {
          success: false,
          message: devboxName ? `获取 Devbox ${devboxName} 的版本列表失败` : '获取版本列表失败',
          error: result.error
        };
      }

      return {
        success: true,
        devboxName: devboxName || null,
        total: result.total,
        items: result.items
      };

    } catch (error: any) {
      console.error('获取版本列表失败:', error);
      return {
        success: false,
        message: '获取版本列表失败',
        error: error.message
      };
    }
  }, {
    query: t.Object({
      devboxName: t.Optional(t.String({
        description: 'Devbox 名称，用于筛选特定 Devbox 的版本。不提供则返回所有版本',
        examples: ['my-k8s-api', 'web-app', 'data-processor']
      }))
    }),
    detail: {
      summary: '获取 DevBoxRelease 列表',
      description: '获取当前命名空间下的 DevBoxRelease 版本信息，支持按 Devbox 名称筛选',
      tags: ['Devbox', 'Release']
    }
  })

  /**
   * 获取特定 Devbox 的版本列表
   * @description 获取指定 Devbox 的所有版本
   */
  .get('/:name/releases', async ({ params, k8sService }) => {
    try {
      const { name } = params;
      const devboxService = new DevboxService(k8sService);
      const result = await devboxService.getDevboxVersions(name);

      if (!result.success) {
        return {
          success: false,
          message: `获取 Devbox ${name} 的版本列表失败`,
          error: result.error
        };
      }

      return {
        success: true,
        devboxName: name,
        total: result.total,
        items: result.items
      };

    } catch (error: any) {
      console.error('获取 Devbox 版本列表失败:', error);
      return {
        success: false,
        message: '获取 Devbox 版本列表失败',
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
      summary: '获取 Devbox 的版本列表',
      description: '获取指定 Devbox 的所有版本信息',
      tags: ['Devbox', 'Release']
    }
  })

  /**
   * 发布新版本
   * @description 为指定的 Devbox 发布新版本，会自动检查并停止运行中的 Devbox
   * @example
   * POST /api/v1/devbox/my-k8s-api/release
   * {
   *   "newTag": "1.0.1",
   *   "notes": "修复重要 bug"
   * }
   */
  .post('/:name/release', async ({ params, body, k8sService }) => {
    try {
      const { name } = params;
      const { newTag, notes } = body;
      
      const devboxService = new DevboxService(k8sService);
      const result = await devboxService.createDevboxRelease({
        devboxName: name,
        newTag,
        notes
      });

      return {
        success: result.success,
        message: result.message,
        data: result.release,
        needsWaiting: result.needsWaiting,
        error: result.error
      };

    } catch (error: any) {
      console.error('发布版本失败:', error);
      return {
        success: false,
        message: '发布版本失败',
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
      newTag: t.String({
        description: '版本号',
        examples: ['1.0.1', '2.0.0-beta', 'v1.2.3']
      }),
      notes: t.String({
        description: '版本描述/更新说明',
        examples: ['修复重要 bug', '添加新功能', '性能优化']
      })
    }),
    detail: {
      summary: '发布新版本',
      description: '为指定的 Devbox 创建发布任务。系统采用异步处理机制：\n\n**如果 Devbox 状态为 Stopped：** 立即提交发布任务\n\n**如果 Devbox 正在运行：** 立即返回成功响应，后台自动停止 Devbox 并发布版本（最多等待 2 分钟）\n\n**状态跟踪：** 使用 GET /releases 接口查看发布状态和进度\n\n**响应字段说明：**\n- `needsWaiting: true` 表示后台正在处理\n- `needsWaiting: false` 表示已直接提交发布任务',
      tags: ['Devbox', 'Release']
    }
  })

  /**
   * 获取单个版本状态
   * @description 获取指定版本的详细状态信息
   * @example
   * GET /api/v1/devbox/my-k8s-api/release/1.0.1
   */
  .get('/:name/release/:tag', async ({ params, k8sService }) => {
    try {
      const { name, tag } = params;
      const releaseName = `${name}-${tag}`;
      
      const devboxService = new DevboxService(k8sService);
      
      // 通过 DevboxService 获取 DevBoxRelease
      const release = await devboxService.getDevboxRelease(releaseName);
      
      if (!release) {
        return {
          success: false,
          message: '版本不存在',
          error: `版本 ${tag} 不存在`
        };
      }

      // 验证版本属于指定的 Devbox
      if (release.spec?.devboxName !== name) {
        return {
          success: false,
          message: '版本不属于指定的 Devbox',
          error: `版本 ${tag} 不属于 Devbox ${name}`
        };
      }

      // 解析状态
      const status = parseReleaseStatus(release.status);

      return {
        success: true,
        release: {
          name: release.metadata?.name,
          devboxName: release.spec?.devboxName,
          newTag: release.spec?.newTag,
          notes: release.spec?.notes,
          createdAt: release.metadata?.creationTimestamp,
          status: status,
          phase: release.status?.phase || 'Unknown',
          // 提供详细的状态信息
          conditions: release.status?.conditions || [],
          // 完整状态供调试
          rawStatus: release.status
        }
      };

    } catch (error: any) {
      console.error('获取版本状态失败:', error);
      return {
        success: false,
        message: '获取版本状态失败',
        error: error.message
      };
    }
  }, {
    params: t.Object({
      name: t.String({
        description: 'Devbox 名称'
      }),
      tag: t.String({
        description: '版本号',
        examples: ['1.0.1', '2.0.0-beta', 'v1.2.3']
      })
    }),
    detail: {
      summary: '获取版本状态',
      description: '获取指定版本的详细状态信息，包括发布进度和结果。状态可能为：Pending（等待处理）、Processing（处理中）、Success（成功）、Failed（失败）',
      tags: ['Devbox', 'Release']
    }
  })

  /**
   * 删除版本
   * @description 删除指定 Devbox 的特定版本
   * @example
   * DELETE /api/v1/devbox/my-k8s-api/release/1.0.1
   */
  .delete('/:name/release/:tag', async ({ params, k8sService }) => {
    try {
      const { name, tag } = params;
      
      const devboxService = new DevboxService(k8sService);
      const result = await devboxService.deleteDevboxRelease({
        devboxName: name,
        newTag: tag
      });

      return {
        success: result.success,
        message: result.message,
        error: result.error
      };

    } catch (error: any) {
      console.error('删除版本失败:', error);
      return {
        success: false,
        message: '删除版本失败',
        error: error.message
      };
    }
  }, {
    params: t.Object({
      name: t.String({
        description: 'Devbox 名称'
      }),
      tag: t.String({
        description: '版本号',
        examples: ['1.0.1', '2.0.0-beta', 'v1.2.3']
      })
    }),
    detail: {
      summary: '删除版本',
      description: '删除指定 Devbox 的特定版本（DevBoxRelease 资源）',
      tags: ['Devbox', 'Release']
    }
  });
