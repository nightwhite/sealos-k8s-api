import { Elysia, t } from 'elysia';
import { KubernetesService } from '../services/k8s.service';
import { V1Ingress, V1IngressRule, V1HTTPIngressPath, V1IngressTLS } from '@kubernetes/client-node';
import { is404Error, format404Error, formatGenericError } from './common/validation';
import { ResourceNameParam, OptionalResourceNameQuery } from './common/schemas';

export const ingressController = new Elysia({ prefix: '/ingress' })
  .decorate('k8sService', KubernetesService.getInstance())

  /**
   * 获取 Ingress 列表
   * @description 获取当前命名空间下的所有 Ingress 资源
   * @example
   * GET /api/v1/ingress
   */
  .get('/', async ({ k8sService }) => {
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
      tags: ['Ingress']
    }
  })


  /**
   * 获取指定 Ingress 详情
   * @description 获取指定名称的 Ingress 资源详细信息
   * @example
   * GET /api/v1/ingress/my-ingress
   */
  .get('/:name', async ({ params, k8sService }) => {
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
    params: ResourceNameParam,
    detail: {
      summary: '获取 Ingress 详情',
      description: '获取指定名称的 Ingress 资源详细信息',
      tags: ['Ingress']
    }
  });