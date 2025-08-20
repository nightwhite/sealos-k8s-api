import { Elysia, t } from 'elysia';
import { KubernetesService } from '../services/k8s.service';
import { V1Service } from '@kubernetes/client-node';
import { validateResourceName, is404Error, format404Error, formatGenericError } from './common/validation';

export const serviceController = new Elysia({ prefix: '/service' })
  .decorate('k8sService', KubernetesService.getInstance())

  /**
   * 获取 Service 列表
   * @description 获取当前命名空间下的所有 Service 资源
   * @example
   * GET /api/v1/service
   */
  .get('/', async ({ k8sService }) => {
    try {
      const namespace = process.env.NAMESPACE || 'default';
      const servicesResponse = await k8sService.getServices(namespace);
      
      const services = servicesResponse.items.map((service: V1Service) => ({
        name: service.metadata?.name,
        namespace: service.metadata?.namespace,
        type: service.spec?.type,
        clusterIP: service.spec?.clusterIP,
        externalIP: service.status?.loadBalancer?.ingress?.[0]?.ip,
        ports: service.spec?.ports?.map(port => ({
          port: port.port,
          targetPort: port.targetPort,
          protocol: port.protocol,
          nodePort: port.nodePort
        })),
        age: service.metadata?.creationTimestamp ? 
          new Date(service.metadata.creationTimestamp).toISOString() : 'Unknown',
        selectors: service.spec?.selector
      }));

      return {
        success: true,
        total: services.length,
        namespace,
        items: services
      };
    } catch (error: any) {
      return {
        success: false,
        error: `获取 Service 列表失败: ${error.message}`,
        status: error.response?.statusCode || 500
      };
    }
  }, {
    detail: {
      summary: '获取 Service 列表',
      description: '获取当前命名空间下的所有 Service 资源',
      tags: ['Service']
    }
  })

  /**
   * 获取 Service 详情（查询参数方式）
   * @description 通过查询参数获取指定 Service 的详细信息
   * @example
   * GET /api/v1/service/detail?name=my-service
   */
  .get('/detail', async ({ query, k8sService }) => {
    try {
      const namespace = process.env.NAMESPACE || 'default';
      const { name } = query;
      
      // 如果没有提供 name，返回提示
      if (!name) {
        return {
          success: false,
          error: '请提供 Service 名称参数: ?name=service-name',
          example: `/api/v1/service/detail?name=my-service`,
          status: 400
        };
      }
      
      const response = await k8sService.getService(namespace, name);
      
      return {
        success: true,
        namespace,
        service: {
          name: response.metadata?.name,
          namespace: response.metadata?.namespace,
          type: response.spec?.type,
          clusterIP: response.spec?.clusterIP,
          externalIP: response.status?.loadBalancer?.ingress?.[0]?.ip,
          ports: response.spec?.ports?.map((port: any) => ({
            port: port.port,
            targetPort: port.targetPort,
            protocol: port.protocol,
            nodePort: port.nodePort,
            name: port.name
          })),
          selectors: response.spec?.selector,
          sessionAffinity: response.spec?.sessionAffinity,
          age: response.metadata?.creationTimestamp ? 
            new Date(response.metadata.creationTimestamp).toISOString() : 'Unknown',
          annotations: response.metadata?.annotations,
          labels: response.metadata?.labels,
          endpoints: response.status?.loadBalancer
        }
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          success: false,
          error: `Service ${query.name} 不存在`,
          status: 404
        };
      }

      return {
        success: false,
        error: `获取 Service 详情失败: ${error.message}`,
        status: error.statusCode || 500
      };
    }
  }, {
    query: t.Object({
      name: t.Optional(t.String({
        description: 'Service 名称'
      }))
    }),
    detail: {
      summary: '获取 Service 详情（查询参数）',
      description: '通过查询参数获取指定 Service 的详细信息',
      tags: ['Service']
    }
  })

  /**
   * 获取指定 Service 详情
   * @description 获取指定名称的 Service 资源详细信息
   * @example
   * GET /api/v1/service/my-service
   */
  .get('/:name', async ({ params, k8sService }) => {
    try {
      const namespace = process.env.NAMESPACE || 'default';
      const { name } = params;
      
      // 验证参数
      const validation = validateResourceName(name, 'Service');
      if (!validation.valid) {
        return validation.error;
      }
      
      const response = await k8sService.getService(namespace, name);
      
      return {
        success: true,
        namespace,
        service: {
          name: response.metadata?.name,
          namespace: response.metadata?.namespace,
          type: response.spec?.type,
          clusterIP: response.spec?.clusterIP,
          externalIP: response.status?.loadBalancer?.ingress?.[0]?.ip,
          ports: response.spec?.ports?.map((port: any) => ({
            port: port.port,
            targetPort: port.targetPort,
            protocol: port.protocol,
            nodePort: port.nodePort,
            name: port.name
          })),
          selectors: response.spec?.selector,
          sessionAffinity: response.spec?.sessionAffinity,
          age: response.metadata?.creationTimestamp ? 
            new Date(response.metadata.creationTimestamp).toISOString() : 'Unknown',
          annotations: response.metadata?.annotations,
          labels: response.metadata?.labels,
          endpoints: response.status?.loadBalancer
        }
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          success: false,
          error: `Service ${params.name} 不存在`,
          status: 404
        };
      }

      return {
        success: false,
        error: `获取 Service 详情失败: ${error.message}`,
        status: error.statusCode || 500
      };
    }
  }, {
    params: t.Object({
      name: t.String({
        description: 'Service 名称'
      })
    }),
    detail: {
      summary: '获取 Service 详情',
      description: '获取指定名称的 Service 资源详细信息',
      tags: ['Service']
    }
  })

  /**
   * 删除 Service
   * @description 删除指定名称的 Service 资源
   * @example
   * DELETE /api/v1/service/my-service
   */
  .delete('/:name', async ({ params, k8sService }) => {
    try {
      const namespace = process.env.NAMESPACE || 'default';
      const { name } = params;
      
      await k8sService.deleteResource('service', name, namespace);
      
      return {
        success: true,
        message: `Service ${name} 删除成功`,
        namespace
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          success: false,
          error: `Service ${params.name} 不存在`,
          status: 404
        };
      }

      return {
        success: false,
        error: `删除 Service 失败: ${error.message}`,
        status: error.statusCode || 500
      };
    }
  }, {
    params: t.Object({
      name: t.String({
        description: 'Service 名称'
      })
    }),
    detail: {
      summary: '删除 Service',
      description: '删除指定名称的 Service 资源',
      tags: ['Service']
    }
  });