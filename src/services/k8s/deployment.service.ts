/**
 * Deployment 相关操作服务
 */

import { K8sBaseService } from './base.service';

export class DeploymentService extends K8sBaseService {

  /**
   * 获取 Deployment 列表
   */
  async getDeployments(namespace: string, options?: any): Promise<any> {
    try {
      const response = await this.k8sApi.appsV1Api.listNamespacedDeployment({
        namespace,
        labelSelector: options?.labelSelector,
        fieldSelector: options?.fieldSelector
      });
      
      return response;
    } catch (error: any) {
      console.error('获取 Deployment 列表失败:', error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 获取单个 Deployment 详情
   */
  async getDeployment(namespace: string, name: string): Promise<any> {
    try {
      const response = await this.k8sApi.appsV1Api.readNamespacedDeployment({
        namespace,
        name
      });
      
      return response;
    } catch (error: any) {
      console.error('获取 Deployment 详情失败:', error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 删除 Deployment
   */
  async deleteDeployment(namespace: string, name: string): Promise<any> {
    try {
      return await this.k8sApi.appsV1Api.deleteNamespacedDeployment({
        namespace,
        name
      });
    } catch (error: any) {
      console.error(`删除 Deployment ${name} 失败:`, error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 修补 Deployment
   */
  async patchDeployment(namespace: string, name: string, patchData: any): Promise<any> {
    try {
      const options = {
        name,
        namespace,
        body: patchData
      };
      
      const response = await this.k8sApi.appsV1Api.patchNamespacedDeployment(options);
      return response;
    } catch (error: any) {
      console.error('修补 Deployment 失败:', error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 调整 Pod 副本数量
   */
  async scalePodReplicas(namespace: string, name: string, replicas: number): Promise<any> {
    try {
      // 使用 scale API
      try {
        const currentScale = await this.k8sApi.appsV1Api.readNamespacedDeploymentScale({
          namespace,
          name
        });
        
        const currentReplicas = currentScale.spec?.replicas || 0;
        currentScale.spec!.replicas = replicas;
        
        const result = await this.k8sApi.appsV1Api.replaceNamespacedDeploymentScale({
          namespace,
          name,
          body: currentScale
        });
        
        return {
          ...result,
          currentReplicas,
          targetReplicas: replicas
        };
      } catch (scaleError: any) {
        
        const currentDeployment = await this.getDeployment(namespace, name);
        const currentReplicas = currentDeployment.spec?.replicas || 0;
        
        const patchData = {
          spec: {
            replicas: replicas
          }
        };
        
        const result = await this.patchDeployment(namespace, name, patchData);
        
        return {
          ...result,
          currentReplicas,
          targetReplicas: replicas
        };
      }
    } catch (error: any) {
      console.error('调整副本数量失败:', error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 重启部署
   */
  async restartDeployment(namespace: string, name: string): Promise<any> {
    try {
      
      // 删除相关 Pod 来触发重启
      const deployment = await this.getDeployment(namespace, name);
      const labelSelector = deployment.spec?.selector?.matchLabels;
      
      if (labelSelector) {
        const selectorString = Object.entries(labelSelector)
          .map(([key, value]) => `${key}=${value}`)
          .join(',');
        
        const pods = await this.k8sApi.coreV1Api.listNamespacedPod({
          namespace,
          labelSelector: selectorString
        });
        
        let deletedPods = 0;
        for (const pod of pods.items) {
          const podName = pod.metadata?.name;
          if (podName) {
            try {
              await this.k8sApi.coreV1Api.deleteNamespacedPod({
                namespace,
                name: podName
              });
              deletedPods++;
            } catch (podError: any) {
            }
          }
        }
        
        if (deletedPods > 0) {
          return { 
            success: true, 
            message: `部署 ${name} 重启成功，删除了 ${deletedPods} 个 Pod`,
            deletedPods,
            method: 'pod-deletion'
          };
        } else {
          throw new Error('没有找到可删除的 Pod');
        }
      } else {
        throw new Error('无法获取部署的标签选择器');
      }
    } catch (error: any) {
      console.error('重启部署失败:', error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 应用 YAML 配置
   */
  async applyYaml(yamlContent: string): Promise<any> {
    try {
      const result = await this.executeKubectlCommand('apply -f -', yamlContent);
      
      if (!result.success) {
        throw new Error(`应用 YAML 失败: ${result.error || result.stderr}`);
      }
      
      return { success: true, output: result.stdout };
    } catch (error: any) {
      console.error('应用 YAML 失败:', error);
      throw this.handleK8sError(error);
    }
  }
}
