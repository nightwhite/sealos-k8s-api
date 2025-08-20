import { Elysia, t } from 'elysia';
import { KubernetesService } from '../services/k8s.service';
import {
  validateReplicas,
  is404Error,
  format404Error,
  formatGenericError
} from './common/validation';
import { ResourceNameParam, ReplicasParam } from './common/schemas';
import { V1Deployment } from '@kubernetes/client-node';

/**
 * Deployment 资源管理控制器
 */
export const deploymentController = new Elysia({ prefix: '/deployment' })
  .decorate('k8sService', KubernetesService.getInstance())
  
  /**
   * 获取部署列表
   * @description 获取当前命名空间下的所有部署
   * @example
   * GET /api/v1/deployments
   */
  .get('/', async ({ k8sService }) => {
    try {
      const namespace = process.env.NAMESPACE || 'default';
      
      const deploymentsResponse = await k8sService.getDeployments(namespace);
      
      const deployments = deploymentsResponse.items.map((deployment: V1Deployment) => ({
        name: deployment.metadata?.name,
        namespace: deployment.metadata?.namespace,
        replicas: {
          desired: deployment.spec?.replicas,
          current: deployment.status?.replicas,
          available: deployment.status?.availableReplicas,
          unavailable: deployment.status?.unavailableReplicas
        },
        age: deployment.metadata?.creationTimestamp ? 
          new Date(deployment.metadata.creationTimestamp).toISOString() : 'Unknown',
        labels: deployment.metadata?.labels
      }));

      return {
        success: true,
        total: deployments.length,
        namespace,
        items: deployments
      };
    } catch (error: any) {
      return {
        success: false,
        error: `获取部署列表失败: ${error.message}`,
        status: error.response?.statusCode || 500
      };
    }
  }, {
    detail: {
      summary: '获取部署列表',
      description: '获取当前命名空间下的所有部署',
      tags: ['Deployments']
    }
  })
  
  /**
   * 获取部署详情
   * @description 获取指定部署的详细信息，包括副本状态、容器配置等
   * @example
   * GET /api/v1/deployments/my-deployment
   */
  .get('/:name', async ({ params, k8sService }) => {
    try {
      const namespace = process.env.NAMESPACE || 'default';
      const { name } = params;

      const deployment = await k8sService.getDeployment(namespace, name);
      return {
        success: true,
        namespace,
        deployment: {
          name: deployment.metadata?.name,
          namespace: deployment.metadata?.namespace,
          replicas: {
            desired: deployment.spec?.replicas,
            current: deployment.status?.replicas,
            available: deployment.status?.availableReplicas,
            unavailable: deployment.status?.unavailableReplicas
          },
          containers: deployment.spec?.template.spec?.containers,
          age: deployment.metadata?.creationTimestamp ? 
            new Date(deployment.metadata.creationTimestamp).toISOString() : 'Unknown',
          labels: deployment.metadata?.labels,
          strategy: deployment.spec?.strategy,
          conditions: deployment.status?.conditions
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `获取部署详情失败: ${error.message}`,
        status: error.response?.statusCode || 404
      };
    }
  }, {
    params: ResourceNameParam,
    detail: {
      summary: '获取部署详情',
      description: '获取指定部署的详细信息，包括副本状态、容器配置等',
      tags: ['Deployments']
    }
  })
  
  /**
   * 应用 YAML 配置创建部署
   * @description 通过 YAML 配置文件创建或更新部署
   * @example
   * POST /api/v1/deployments/apply
   * Content-Type: application/json
   * 
   * {
   *   "yamlContent": "apiVersion: apps/v1\nkind: Deployment\n..."
   * }
   */
  .post('/apply', async ({ body, k8sService }) => {
    try {
      const { yamlContent } = body;
      const namespace = process.env.NAMESPACE || 'default';
      const resources = await k8sService.applyYaml(yamlContent);
      
      return {
        success: true,
        namespace,
        message: `成功应用YAML配置，创建了 ${resources.length} 个资源`,
        resources
      };
    } catch (error: any) {
      return {
        success: false,
        message: `应用YAML配置失败: ${error.message}`
      };
    }
  }, {
    body: t.Object({
      yamlContent: t.String({
        description: 'Kubernetes YAML 配置内容'
      })
    }),
    detail: {
      summary: '应用 YAML 配置创建部署',
      description: '通过 YAML 配置文件创建或更新部署',
      tags: ['Deployments']
    }
  })
  
  /**
   * 删除部署
   * @description 删除指定的部署及其关联的资源
   * @example
   * DELETE /api/v1/deployments/my-deployment
   */
  .delete('/:name', async ({ params, k8sService }) => {
    const namespace = process.env.NAMESPACE || 'default';
    const { name } = params;

    try {

      await k8sService.deleteResource('deployment', name, namespace);
      return {
        success: true,
        namespace,
        message: `部署 ${name} 已成功删除`
      };
    } catch (error: any) {
      console.error('删除部署失败:', error);

      // 处理 404 错误
      if (is404Error(error)) {
        return format404Error(name, 'Deployment');
      }

      return formatGenericError(error, '删除部署');
    }
  }, {
    params: ResourceNameParam,
    detail: {
      summary: '删除部署',
      description: '删除指定的部署及其关联的资源',
      tags: ['Deployments']
    }
  })
  
  /**
   * 重启部署
   * @description 通过更新部署的 Pod 模板注解来触发滚动重启
   * @example
   * POST /api/v1/deployments/my-deployment/restart
   */
  .post('/:name/restart', async ({ params, k8sService }) => {
    const namespace = process.env.NAMESPACE || 'default';
    const { name } = params;

    try {
      const result = await k8sService.restartDeployment(namespace, name);

      return {
        success: true,
        namespace,
        deployment: name,
        message: `部署 ${name} 已成功重启`,
        output: result.output
      };
    } catch (error: any) {
      console.error('重启部署失败:', error);

      // 处理 404 错误
      const is404Error = error.code === 404 ||
                         error.statusCode === 404 ||
                         (error.message && error.message.includes('not found')) ||
                         (error.body && error.body.includes('not found'));

      if (is404Error) {
        return {
          success: false,
          error: `Deployment "${name}" 不存在`,
          status: 404,
          hint: '请检查 Deployment 名称是否正确，或使用 GET /api/v1/deployments 查看可用的部署'
        };
      }

      return {
        success: false,
        error: `重启部署失败: ${error.message}`,
        status: error.code || error.response?.statusCode || 500
      };
    }
  }, {
    params: ResourceNameParam,
    detail: {
      summary: '重启部署',
      description: '通过更新部署的 Pod 模板注解来触发滚动重启',
      tags: ['Deployments']
    }
  })
  
  /**
   * 调整部署副本数量
   * @description 扩展或缩减部署的副本数量
   * @example
   * POST /api/v1/deployments/my-deployment/scale
   * Content-Type: application/json
   * 
   * {
   *   "replicas": 3
   * }
   */
  .post('/:name/scale', async ({ params, body, k8sService }) => {
    const namespace = process.env.NAMESPACE || 'default';
    const { name } = params;
    const { replicas } = body;

    try {
      // Parameter validation is handled by schema

      if (typeof replicas !== 'number' || replicas < 0) {
        return {
          success: false,
          error: '副本数量必须是非负整数',
          status: 400
        };
      }

      const result = await k8sService.scalePodReplicas(namespace, name, replicas);
      
      return {
        success: true,
        namespace,
        deployment: name,
        message: `成功将部署副本数量从 ${result.currentReplicas} 调整为 ${replicas}`,
        currentReplicas: result.currentReplicas,
        targetReplicas: replicas
      };
    } catch (error: any) {
      console.error('调整副本数量失败:', error);

      // 处理 404 错误
      const is404Error = error.code === 404 ||
                         error.statusCode === 404 ||
                         (error.message && error.message.includes('not found')) ||
                         (error.body && error.body.includes('not found'));

      if (is404Error) {
        return {
          success: false,
          error: `Deployment "${name}" 不存在`,
          status: 404,
          hint: '请检查 Deployment 名称是否正确，或使用 GET /api/v1/deployments 查看可用的部署'
        };
      }

      return {
        success: false,
        error: `调整副本数量失败: ${error.message}`,
        status: error.code || error.response?.statusCode || 500
      };
    }
  }, {
    params: ResourceNameParam,
    body: t.Object({
      replicas: t.Number({
        description: '目标副本数量',
        minimum: 0
      })
    }),
    detail: {
      summary: '调整部署副本数量',
      description: '扩展或缩减部署的副本数量',
      tags: ['Deployments']
    }
  });