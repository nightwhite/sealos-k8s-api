import { Elysia, t } from 'elysia';
import { KubernetesService } from '../services/k8s.service';
import { PodListOptions } from '../types/k8s.types';
import { V1Pod } from '@kubernetes/client-node';
import { authGuard } from '../middleware/auth.guard';

/**
 * Pod 资源管理控制器
 */
export const podController = new Elysia({ prefix: '/pods' })
  .guard(authGuard)  // 应用认证守卫
  .decorate('k8sService', new KubernetesService())
  
  /**
   * 获取 Pod 列表
   * @description 获取当前命名空间下的所有 Pod，支持标签过滤和数量限制
   * @example
   * GET /api/v1/pods
   * GET /api/v1/pods?labelSelector=app=nginx
   * GET /api/v1/pods?limit=10
   */
  .get('/', async ({ query, k8sService }) => {
    try {
      // 总是使用环境变量中的命名空间
      const targetNamespace = process.env.NAMESPACE || 'default';
      console.log(`获取命名空间 ${targetNamespace} 中的 Pod 列表`);
      
      const podsResponse = await k8sService.getPods(targetNamespace);
      
      let pods = podsResponse.items.map((pod: V1Pod) => {
        const podData = {
          name: pod.metadata?.name,
          namespace: pod.metadata?.namespace,
          status: pod.status?.phase,
          restarts: pod.status?.containerStatuses?.[0]?.restartCount || 0,
          age: pod.metadata?.creationTimestamp ? 
            new Date(pod.metadata.creationTimestamp).toISOString() : 'Unknown',
          ip: pod.status?.podIP,
          node: pod.spec?.nodeName,
          labels: pod.metadata?.labels || {}
        };
        return podData;
      });

      // 应用过滤器
      if (query.labelSelector) {
        const labelFilters = query.labelSelector.split(',').map(filter => {
          const [key, value] = filter.split('=');
          return { key, value };
        });
        
        pods = pods.filter((pod) => 
          labelFilters.every(filter => 
            pod.labels[filter.key] === filter.value
          )
        );
      }

      // 应用限制
      if (query.limit && !isNaN(Number(query.limit))) {
        pods = pods.slice(0, Number(query.limit));
      }

      return {
        success: true,
        total: pods.length,
        namespace: targetNamespace,
        items: pods
      };
    } catch (error: any) {
      console.error('获取Pod列表失败:', error);
      return {
        success: false,
        error: `获取Pod列表失败: ${error.message}`,
        status: error.response?.statusCode || 500
      };
    }
  }, {
    query: t.Object({
      labelSelector: t.Optional(t.String({
        description: '标签选择器，例如：app=nginx,env=prod'
      })),
      fieldSelector: t.Optional(t.String({
        description: '字段选择器'
      })),
      limit: t.Optional(t.Number({
        description: '返回结果的最大数量'
      }))
    }),
    detail: {
      summary: '获取 Pod 列表',
      description: '获取当前命名空间下的所有 Pod，支持标签过滤和数量限制',
      tags: ['Pods']
    }
  })
  
  /**
   * 获取 Pod 详情
   * @description 获取指定 Pod 的详细信息，包括状态、容器、标签等
   * @example
   * GET /api/v1/pods/my-pod-name
   */
  .get('/:name', async ({ params, k8sService }) => {
    try {
      const namespace = process.env.NAMESPACE || 'default';
      const { name } = params;
      console.log(`获取 Pod 详情: ${namespace}/${name}`);
      
      const pod = await k8sService.getPodDetails(namespace, name);
      return {
        success: true,
        namespace,
        pod: {
          name: pod.metadata?.name,
          namespace: pod.metadata?.namespace,
          status: pod.status?.phase,
          restarts: pod.status?.containerStatuses?.[0]?.restartCount || 0,
          age: pod.metadata?.creationTimestamp ? 
            new Date(pod.metadata.creationTimestamp).toISOString() : 'Unknown',
          ip: pod.status?.podIP,
          node: pod.spec?.nodeName,
          labels: pod.metadata?.labels || {},
          containers: pod.spec?.containers?.map(container => ({
            name: container.name,
            image: container.image,
            ports: container.ports,
            resources: container.resources
          })) || []
        }
      };
    } catch (error: any) {
      console.error('获取 Pod 详情失败:', error);
      return {
        success: false,
        error: `获取 Pod 详情失败: ${error.message}`,
        status: error.response?.statusCode || 500
      };
    }
  }, {
    params: t.Object({
      name: t.String({
        description: 'Pod 名称'
      })
    }),
    detail: {
      summary: '获取 Pod 详情',
      description: '获取指定 Pod 的详细信息，包括状态、容器、标签等',
      tags: ['Pods']
    }
  })
  
  /**
   * 删除 Pod
   * @description 删除指定的 Pod
   * @example
   * DELETE /api/v1/pods/my-pod-name
   */
  .delete('/:name', async ({ params, k8sService }) => {
    try {
      const namespace = process.env.NAMESPACE || 'default';
      const { name } = params;
      console.log(`删除 Pod: ${namespace}/${name}`);
      
      await k8sService.deleteResource('pod', name, namespace);
      return {
        success: true,
        namespace,
        message: `Pod ${name} 已成功删除`
      };
    } catch (error: any) {
      return {
        success: false,
        error: `删除 Pod 失败: ${error.message}`,
        status: error.response?.statusCode || 500
      };
    }
  }, {
    params: t.Object({
      name: t.String({
        description: 'Pod 名称'
      })
    }),
    detail: {
      summary: '删除 Pod',
      description: '删除指定的 Pod',
      tags: ['Pods']
    }
  });