import { Elysia, t } from 'elysia';
import { KubernetesService } from '../services/k8s.service';

export const secretController = new Elysia({ prefix: '/secrets' })
  .decorate('k8sService', KubernetesService.getInstance())
  
  /**
   * 获取 Secret 列表
   * @description 获取当前命名空间下的所有 Secret
   * @example
   * GET /api/v1/secrets
   * GET /api/v1/secrets?labelSelector=app=myapp
   */
  .get('/', async ({ query, k8sService }) => {
    try {
      const namespace = process.env.NAMESPACE || 'default';
      const { labelSelector } = query;

      const secrets = await k8sService.getSecrets(namespace, { labelSelector });
      
      return {
        success: true,
        namespace,
        total: secrets.items?.length || 0,
        items: secrets.items?.map((secret: any) => ({
          name: secret.metadata?.name,
          namespace: secret.metadata?.namespace,
          type: secret.type,
          dataKeys: Object.keys(secret.data || {}),
          labels: secret.metadata?.labels || {},
          annotations: secret.metadata?.annotations || {},
          createdAt: secret.metadata?.creationTimestamp
        })) || []
      };
    } catch (error: any) {
      return {
        success: false,
        message: '获取 Secret 列表失败',
        error: error.message
      };
    }
  }, {
    query: t.Object({
      labelSelector: t.Optional(t.String({
        description: '标签选择器，用于过滤 Secret',
        examples: ['app=myapp', 'tier=frontend']
      }))
    }),
    detail: {
      summary: '获取 Secret 列表',
      description: '获取当前命名空间下的所有 Secret，可以通过标签选择器进行过滤',
      tags: ['Secret']
    }
  })

  /**
   * 获取 Secret 详情
   * @description 获取指定 Secret 的详细信息
   * @example
   * GET /api/v1/secrets/my-secret
   */
  .get('/:name', async ({ params, k8sService }) => {
    try {
      const namespace = process.env.NAMESPACE || 'default';
      const { name } = params;

      const secret = await k8sService.getSecret(namespace, name);
      
      // 获取解码后的数据
      const decodedData = await k8sService.getSecretData(namespace, name);
      
      return {
        success: true,
        namespace,
        secret: {
          name: secret.metadata?.name,
          namespace: secret.metadata?.namespace,
          type: secret.type,
          data: decodedData,
          dataKeys: Object.keys(secret.data || {}),
          labels: secret.metadata?.labels || {},
          annotations: secret.metadata?.annotations || {},
          createdAt: secret.metadata?.creationTimestamp,
          hasData: Object.keys(secret.data || {}).length > 0
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `获取 Secret ${params.name} 失败`,
        error: error.message
      };
    }
  }, {
    params: t.Object({
      name: t.String({
        description: 'Secret 名称'
      })
    }),
    detail: {
      summary: '获取 Secret 详情',
      description: '获取指定 Secret 的详细信息（包含解码后的敏感数据内容）',
      tags: ['Secret']
    }
  })

  /**
   * 创建 Opaque Secret
   * @description 创建一个 Opaque 类型的 Secret
   * @example
   * POST /api/v1/secrets/opaque
   * {
   *   "name": "my-secret",
   *   "namespace": "default",
   *   "data": {
   *     "username": "admin",
   *     "password": "secret123"
   *   },
   *   "labels": {
   *     "app": "myapp"
   *   }
   * }
   */
  .post('/opaque', async ({ body, k8sService }) => {
    try {
      const { name, namespace, data, labels } = body;
      
      const result = await k8sService.createOpaqueSecret(namespace, name, data, labels);
      
      return {
        success: true,
        message: `Opaque Secret ${name} 创建成功`,
        secret: {
          name: result.metadata?.name,
          namespace: result.metadata?.namespace,
          type: result.type
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: '创建 Opaque Secret 失败',
        error: error.message
      };
    }
  }, {
    body: t.Object({
      name: t.String({
        description: 'Secret 名称',
        examples: ['my-secret', 'database-credentials']
      }),
      namespace: t.String({
        description: '命名空间名称',
        examples: ['default', 'production']
      }),
      data: t.Record(t.String(), t.String(), {
        description: 'Secret 数据，键值对形式',
        examples: [{
          username: 'admin',
          password: 'secret123',
          apiKey: 'abc123def456'
        }]
      }),
      labels: t.Optional(t.Record(t.String(), t.String(), {
        description: '标签',
        examples: [{ app: 'myapp', tier: 'backend' }]
      }))
    }),
    detail: {
      summary: '创建 Opaque Secret',
      description: '创建一个 Opaque 类型的 Secret，用于存储任意的键值对数据',
      tags: ['Secret']
    }
  })

  /**
   * 创建 TLS Secret
   * @description 创建一个 TLS 类型的 Secret
   * @example
   * POST /api/v1/secrets/tls
   * {
   *   "name": "tls-secret",
   *   "namespace": "default",
   *   "tlsCert": "-----BEGIN CERTIFICATE-----\n...",
   *   "tlsKey": "-----BEGIN PRIVATE KEY-----\n...",
   *   "labels": {
   *     "app": "nginx"
   *   }
   * }
   */
  .post('/tls', async ({ body, k8sService }) => {
    try {
      const { name, namespace, tlsCert, tlsKey, labels } = body;
      
      const result = await k8sService.createTLSSecret(namespace, name, tlsCert, tlsKey, labels);
      
      return {
        success: true,
        message: `TLS Secret ${name} 创建成功`,
        secret: {
          name: result.metadata?.name,
          namespace: result.metadata?.namespace,
          type: result.type
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: '创建 TLS Secret 失败',
        error: error.message
      };
    }
  }, {
    body: t.Object({
      name: t.String({
        description: 'Secret 名称',
        examples: ['tls-secret', 'nginx-tls']
      }),
      namespace: t.String({
        description: '命名空间名称',
        examples: ['default', 'production']
      }),
      tlsCert: t.String({
        description: 'TLS 证书内容',
        examples: ['-----BEGIN CERTIFICATE-----\n...']
      }),
      tlsKey: t.String({
        description: 'TLS 私钥内容',
        examples: ['-----BEGIN PRIVATE KEY-----\n...']
      }),
      labels: t.Optional(t.Record(t.String(), t.String(), {
        description: '标签',
        examples: [{ app: 'nginx', component: 'tls' }]
      }))
    }),
    detail: {
      summary: '创建 TLS Secret',
      description: '创建一个 TLS 类型的 Secret，用于存储 SSL/TLS 证书和私钥',
      tags: ['Secret']
    }
  })


  /**
   * 更新 Secret 数据
   * @description 更新 Secret 中的数据
   * @example
   * PUT /api/v1/secrets/my-secret/data
   * {
   *   "namespace": "default",
   *   "data": {
   *     "username": "newuser",
   *     "password": "newpassword"
   *   }
   * }
   */
  .put('/:name/data', async ({ params, body, k8sService }) => {
    try {
      const { name } = params;
      const { namespace, data } = body;
      
      // 获取现有 Secret
      const existingSecret = await k8sService.getSecret(namespace, name);
      
      // 编码数据为 base64
      const encodedData: Record<string, string> = {};
      for (const [key, value] of Object.entries(data)) {
        encodedData[key] = Buffer.from(value).toString('base64');
      }

      // 更新数据
      const updatedSecret = {
        ...existingSecret,
        data: encodedData
      };
      
      const result = await k8sService.updateSecret(namespace, name, updatedSecret);
      
      return {
        success: true,
        message: `Secret ${name} 数据更新成功`,
        secret: {
          name: result.metadata?.name,
          namespace: result.metadata?.namespace,
          dataKeys: Object.keys(data)
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `更新 Secret ${params.name} 数据失败`,
        error: error.message
      };
    }
  }, {
    params: t.Object({
      name: t.String({
        description: 'Secret 名称'
      })
    }),
    body: t.Object({
      namespace: t.String({
        description: '命名空间名称',
        examples: ['default', 'production']
      }),
      data: t.Record(t.String(), t.String(), {
        description: '新的 Secret 数据',
        examples: [{
          username: 'newuser',
          password: 'newpassword'
        }]
      })
    }),
    detail: {
      summary: '更新 Secret 数据',
      description: '更新指定 Secret 中的数据内容',
      tags: ['Secret']
    }
  })

  /**
   * 删除 Secret
   * @description 删除指定的 Secret
   * @example
   * DELETE /api/v1/secrets/my-secret
   */
  .delete('/:name', async ({ params, k8sService }) => {
    try {
      const namespace = process.env.NAMESPACE || 'default';
      const { name } = params;

      await k8sService.deleteSecret(namespace, name);
      
      return {
        success: true,
        namespace,
        message: `Secret ${name} 删除成功`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `删除 Secret ${params.name} 失败`,
        error: error.message
      };
    }
  }, {
    params: t.Object({
      name: t.String({
        description: 'Secret 名称'
      })
    }),
    detail: {
      summary: '删除 Secret',
      description: '删除指定的 Secret',
      tags: ['Secret']
    }
  });