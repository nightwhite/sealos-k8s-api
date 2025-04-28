import { Elysia, t } from 'elysia';
import { KubernetesService } from '../services/k8s.service';
import { V1Service, V1Ingress, V1IngressRule, V1HTTPIngressPath, V1IngressTLS } from '@kubernetes/client-node';

/**
 * 集群资源管理控制器
 */
export const clusterController = new Elysia({ prefix: '/cluster' })
  .decorate('k8sService', new KubernetesService())
  
  /**
   * 获取服务列表
   * @description 获取当前命名空间下的所有服务
   * @example
   * GET /api/v1/cluster/services
   */
  .get('/services', async ({ k8sService }) => {
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
        error: `获取服务列表失败: ${error.message}`,
        status: error.response?.statusCode || 500
      };
    }
  }, {
    detail: {
      summary: '获取服务列表',
      description: '获取当前命名空间下的所有服务',
      tags: ['Cluster']
    }
  })

  /**
   * 获取 Ingress 列表
   * @description 获取当前命名空间下的所有 Ingress 资源
   * @example
   * GET /api/v1/cluster/ingresses
   */
  .get('/ingresses', async ({ k8sService }) => {
    try {
      const namespace = process.env.NAMESPACE || 'default';
      const response = await k8sService.getIngresses(namespace);
      
      const ingresses = response.items.map((ingress: V1Ingress) => ({
        name: ingress.metadata?.name,
        namespace: ingress.metadata?.namespace,
        className: ingress.spec?.ingressClassName,
        rules: ingress.spec?.rules?.map((rule: V1IngressRule) => ({
          host: rule.host,
          paths: rule.http?.paths.map((path: V1HTTPIngressPath) => ({
            path: path.path,
            pathType: path.pathType,
            backend: {
              service: {
                name: path.backend.service?.name,
                port: path.backend.service?.port?.number
              }
            }
          }))
        })),
        tls: ingress.spec?.tls?.map((tls: V1IngressTLS) => ({
          hosts: tls.hosts,
          secretName: tls.secretName
        })),
        age: ingress.metadata?.creationTimestamp ? 
          new Date(ingress.metadata.creationTimestamp).toISOString() : 'Unknown'
      }));

      return {
        success: true,
        total: ingresses.length,
        namespace,
        items: ingresses
      };
    } catch (error: any) {
      // 处理 403 Forbidden 错误
      if (error.statusCode === 403) {
        return {
          success: false,
          error: '权限不足：当前服务账号没有访问 Ingress 资源的权限，请参考 README.md 中的 RBAC 配置说明',
          details: error.message,
          status: 403
        };
      }

      return {
        success: false,
        error: `获取 Ingress 列表失败: ${error.message}`,
        status: error.statusCode || 500
      };
    }
  }, {
    detail: {
      summary: '获取 Ingress 列表',
      description: '获取当前命名空间下的所有 Ingress 资源',
      tags: ['Cluster']
    }
  })

  /**
   * 获取指定 Ingress 详情
   * @description 获取指定名称的 Ingress 资源详细信息
   * @example
   * GET /api/v1/cluster/ingresses/my-ingress
   */
  .get('/ingresses/:name', async ({ params, k8sService }) => {
    try {
      const namespace = process.env.NAMESPACE || 'default';
      const { name } = params;
      
      const response = await k8sService.getIngress(namespace, name);
      
      return {
        success: true,
        namespace,
        ingress: {
          name: response.metadata?.name,
          namespace: response.metadata?.namespace,
          className: response.spec?.ingressClassName,
          rules: response.spec?.rules?.map((rule: V1IngressRule) => ({
            host: rule.host,
            paths: rule.http?.paths.map((path: V1HTTPIngressPath) => ({
              path: path.path,
              pathType: path.pathType,
              backend: {
                service: {
                  name: path.backend.service?.name,
                  port: path.backend.service?.port?.number
                }
              }
            }))
          })),
          tls: response.spec?.tls?.map((tls: V1IngressTLS) => ({
            hosts: tls.hosts,
            secretName: tls.secretName
          })),
          age: response.metadata?.creationTimestamp ? 
            new Date(response.metadata.creationTimestamp).toISOString() : 'Unknown',
          annotations: response.metadata?.annotations,
          status: response.status
        }
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return {
          success: false,
          error: `Ingress ${params.name} 不存在`,
          status: 404
        };
      }

      return {
        success: false,
        error: `获取 Ingress 详情失败: ${error.message}`,
        status: error.statusCode || 500
      };
    }
  }, {
    params: t.Object({
      name: t.String({
        description: 'Ingress 名称'
      })
    }),
    detail: {
      summary: '获取 Ingress 详情',
      description: '获取指定名称的 Ingress 资源详细信息',
      tags: ['Cluster']
    }
  });
