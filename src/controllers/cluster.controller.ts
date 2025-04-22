import { Elysia, t } from 'elysia';
import { KubernetesService } from '../services/k8s.service';
import { CreateNamespaceRequest, V1NodeWithStatus } from '../types/k8s.types';
import { V1Namespace, V1Service } from '@kubernetes/client-node';
import { authGuard } from '../middleware/auth.guard';

/**
 * 集群资源管理控制器
 */
export const clusterController = new Elysia({ prefix: '/cluster' })
  .guard(authGuard)  // 应用认证守卫
  .decorate('k8sService', new KubernetesService())
  
  /**
   * 获取集群状态概览
   * @description 获取集群的整体状态，包括节点健康状况、资源使用情况等
   * @example
   * GET /api/v1/cluster/status
   */
  .get('/status', async ({ k8sService }) => {
    try {
      // 获取节点信息
      const nodesResponse = await k8sService.getNodes();
      
      const nodes = {
        total: nodesResponse.items.length,
        ready: 0,
        notReady: 0,
        items: nodesResponse.items.map((node: V1NodeWithStatus) => {
          const conditions = node.status?.conditions || [];
          const readyCondition = conditions.find(c => c.type === 'Ready');
          const isReady = readyCondition?.status === 'True';
          
          if (isReady) {
            nodes.ready++;
          } else {
            nodes.notReady++;
          }

          const roles: string[] = [];
          if (node.metadata?.labels) {
            if (node.metadata.labels['node-role.kubernetes.io/control-plane'] === 'true' || 
                node.metadata.labels['node-role.kubernetes.io/master'] === 'true') {
              roles.push('master');
            }
            if (node.metadata.labels['node-role.kubernetes.io/worker'] === 'true') {
              roles.push('worker');
            }
          }
          
          return {
            name: node.metadata?.name,
            status: isReady ? 'Ready' : 'NotReady',
            roles: roles.length ? roles : ['<none>'],
            version: node.status?.nodeInfo?.kubeletVersion,
            internalIP: node.status?.addresses?.find(addr => addr.type === 'InternalIP')?.address,
            cpuCapacity: node.status?.capacity?.cpu,
            memoryCapacity: node.status?.capacity?.memory
          };
        })
      };

      return { nodes };
    } catch (error: any) {
      return {
        error: `获取集群状态失败: ${error.message}`,
        status: 500
      };
    }
  }, {
    detail: {
      summary: '获取集群状态',
      description: '获取集群的整体状态，包括节点健康状况、资源使用情况等',
      tags: ['Cluster']
    }
  })
  
  /**
   * 获取命名空间列表
   * @description 获取集群中所有的命名空间
   * @example
   * GET /api/v1/cluster/namespaces
   */
  .get('/namespaces', async ({ k8sService }) => {
    try {
      const namespacesResponse = await k8sService.getNamespaces();
      
      const namespaces = namespacesResponse.items.map((namespace: V1Namespace) => ({
        name: namespace.metadata?.name,
        status: namespace.status?.phase,
        age: namespace.metadata?.creationTimestamp ? 
          new Date(namespace.metadata.creationTimestamp).toISOString() : 'Unknown',
        labels: namespace.metadata?.labels
      }));

      return {
        total: namespaces.length,
        items: namespaces
      };
    } catch (error: any) {
      return {
        error: `获取命名空间列表失败: ${error.message}`,
        status: 500
      };
    }
  }, {
    detail: {
      summary: '获取命名空间列表',
      description: '获取集群中所有的命名空间',
      tags: ['Cluster']
    }
  })
  
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
   * 创建命名空间
   * @description 在集群中创建一个新的命名空间，可选择添加标签
   * @example
   * POST /api/v1/cluster/namespaces
   * Content-Type: application/json
   * 
   * {
   *   "name": "my-namespace",
   *   "labels": {
   *     "team": "dev",
   *     "environment": "staging"
   *   }
   * }
   */
  .post('/namespaces', async ({ body, k8sService }) => {
    try {
      const { name, labels } = body as CreateNamespaceRequest;
      const namespace = await k8sService.createNamespace(name, labels);
      
      return {
        success: true,
        message: `命名空间 ${name} 已成功创建`,
        namespace: name
      };
    } catch (error: any) {
      return {
        success: false,
        message: `创建命名空间失败: ${error.message}`
      };
    }
  }, {
    body: t.Object({
      name: t.String({
        description: '命名空间名称'
      }),
      labels: t.Optional(t.Record(t.String(), t.String(), {
        description: '命名空间标签'
      }))
    }),
    detail: {
      summary: '创建命名空间',
      description: '在集群中创建一个新的命名空间，可选择添加标签',
      tags: ['Cluster']
    }
  });