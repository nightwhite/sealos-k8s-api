import { Elysia, t } from 'elysia';
import { KubernetesService } from '../services/k8s.service';
import { DeployYamlRequest } from '../types/k8s.types';
import { V1Deployment } from '@kubernetes/client-node';
import { authGuard } from '../middleware/auth.guard';

/**
 * Deployment 资源管理控制器
 */
export const deploymentController = new Elysia({ prefix: '/deployments' })
  .guard(authGuard)  // 应用认证守卫
  .decorate('k8sService', new KubernetesService())
  
  /**
   * 获取部署列表
   * @description 获取当前命名空间下的所有部署
   * @example
   * GET /api/v1/deployments
   */
  .get('/', async ({ k8sService }) => {
    try {
      const namespace = process.env.NAMESPACE || 'default';
      console.log(`获取命名空间 ${namespace} 中的部署列表`);
      
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
      console.log(`获取部署详情: ${namespace}/${name}`);
      
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
    params: t.Object({
      name: t.String({
        description: '部署名称'
      })
    }),
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
      const resources = await k8sService.applyYaml(yamlContent, namespace);
      
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
    try {
      const namespace = process.env.NAMESPACE || 'default';
      const { name } = params;
      console.log(`删除部署: ${namespace}/${name}`);
      
      await k8sService.deleteResource('deployment', name, namespace);
      return {
        success: true,
        namespace,
        message: `部署 ${name} 已成功删除`
      };
    } catch (error: any) {
      return {
        success: false,
        error: `删除部署失败: ${error.message}`,
        status: error.response?.statusCode || 500
      };
    }
  }, {
    params: t.Object({
      name: t.String({
        description: '部署名称'
      })
    }),
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
    try {
      const namespace = process.env.NAMESPACE || 'default';
      const { name } = params;
      console.log(`重启部署: ${namespace}/${name}`);
      
      await k8sService.patchDeployment(namespace, name, {
        spec: {
          template: {
            metadata: {
              annotations: {
                'kubectl.kubernetes.io/restartedAt': new Date().toISOString()
              }
            }
          }
        }
      });
      
      return {
        success: true,
        namespace,
        message: `部署 ${name} 已成功重启`
      };
    } catch (error: any) {
      return {
        success: false,
        error: `重启部署失败: ${error.message}`,
        status: error.response?.statusCode || 500
      };
    }
  }, {
    params: t.Object({
      name: t.String({
        description: '部署名称'
      })
    }),
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
    try {
      const namespace = process.env.NAMESPACE || 'default';
      const { name } = params;
      const { replicas } = body;
      
      console.log(`调整部署 ${namespace}/${name} 的副本数量为 ${replicas}`);
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
      return {
        success: false,
        error: `调整副本数量失败: ${error.message}`,
        status: error.response?.statusCode || 500
      };
    }
  }, {
    params: t.Object({
      name: t.String({
        description: '部署名称'
      })
    }),
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