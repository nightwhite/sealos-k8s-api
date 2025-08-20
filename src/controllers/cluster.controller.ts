import { Elysia } from 'elysia';
import { KubernetesService } from '../services/k8s.service';

/**
 * 集群资源管理控制器
 */
export const clusterController = new Elysia({ prefix: '/cluster' })
  .decorate('k8sService', KubernetesService.getInstance())
  
  /**
   * 获取集群节点信息
   * @description 获取集群中所有节点的状态信息
   * @example
   * GET /api/v1/cluster/nodes
   */
  .get('/nodes', async ({ k8sService }) => {
    try {
      const clusterInfo = await k8sService.getClusterInfo();
      
      return {
        success: true,
        nodes: clusterInfo.nodes || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: `获取集群节点信息失败: ${error.message}`,
        status: error.statusCode || 500
      };
    }
  }, {
    detail: {
      summary: '获取集群节点信息',
      description: '获取集群中所有节点的状态信息',
      tags: ['Cluster']
    }
  })

  /**
   * 获取命名空间列表
   * @description 获取集群中所有命名空间
   * @example
   * GET /api/v1/cluster/namespaces
   */
  .get('/namespaces', async ({ k8sService }) => {
    try {
      const clusterInfo = await k8sService.getClusterInfo();
      
      return {
        success: true,
        namespaces: clusterInfo.namespaces || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: `获取命名空间列表失败: ${error.message}`,
        status: error.statusCode || 500
      };
    }
  }, {
    detail: {
      summary: '获取命名空间列表',
      description: '获取集群中所有命名空间',
      tags: ['Cluster']
    }
  })

  /**
   * 获取集群整体信息
   * @description 获取集群的整体状态和统计信息
   * @example
   * GET /api/v1/cluster/info
   */
  .get('/info', async ({ k8sService }) => {
    try {
      const clusterInfo = await k8sService.getClusterInfo();
      
      return {
        success: true,
        cluster: clusterInfo
      };
    } catch (error: any) {
      return {
        success: false,
        error: `获取集群信息失败: ${error.message}`,
        status: error.statusCode || 500
      };
    }
  }, {
    detail: {
      summary: '获取集群整体信息',
      description: '获取集群的整体状态和统计信息',
      tags: ['Cluster']
    }
  })

