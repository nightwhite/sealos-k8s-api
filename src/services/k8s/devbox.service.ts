/**
 * Devbox K8s 操作服务 - 只包含 Devbox 相关的功能
 */

import { K8sBaseService } from './base.service';

export class DevboxK8sService extends K8sBaseService {





  /**
   * 按名称删除 Service
   */
  private async deleteServiceByName(namespace: string, name: string): Promise<void> {
    try {
      await this.k8sApi.coreV1Api.deleteNamespacedService({
        namespace,
        name
      });
    } catch (error: any) {
      if (error.code === 404 || error.message?.includes('not found')) {
      } else {
      }
    }
  }



  /**
   * 删除带指定标签的 Ingress
   */
  private async deleteIngressByLabel(namespace: string, labelSelector: string): Promise<void> {
    try {
      const ingresses = await this.k8sApi.networkingV1Api.listNamespacedIngress({
        namespace,
        labelSelector
      });

      for (const ingress of ingresses.items) {
        const ingressName = ingress.metadata?.name;
        if (ingressName) {
          try {
            await this.k8sApi.networkingV1Api.deleteNamespacedIngress({
              namespace,
              name: ingressName
            });
          } catch (error: any) {
          }
        }
      }
    } catch (error: any) {
    }
  }

  /**
   * 按名称删除 Secret
   */
  private async deleteSecretByName(namespace: string, name: string): Promise<void> {
    try {
      await this.k8sApi.coreV1Api.deleteNamespacedSecret({
        namespace,
        name
      });
    } catch (error: any) {
      if (error.code === 404 || error.message?.includes('not found')) {
      } else {
      }
    }
  }





  /**
   * 获取 Devbox 列表
   */
  async getDevboxes(namespace?: string): Promise<any> {
    try {
      const targetNamespace = namespace || process.env.NAMESPACE || 'default';
      
      // 使用 CustomObjectsApi 获取 Devbox 资源
      const response = await this.k8sApi.customObjectsApi.listNamespacedCustomObject({
        group: 'devbox.sealos.io',
        version: 'v1alpha1',
        namespace: targetNamespace,
        plural: 'devboxes'
      });
      
      // 检查响应结构
      if (response && response.body) {
        return response.body;
      } else if (response) {
        return response;
      } else {
        return { items: [] };
      }
    } catch (error: any) {
      console.error('获取 Devbox 列表失败:', error.message || error);
      throw new Error(`获取 Devbox 列表失败: ${error.message || error}`);
    }
  }

  /**
   * 获取单个 Devbox 详情
   */
  async getDevbox(name: string, namespace?: string): Promise<any> {
    try {
      const targetNamespace = namespace || process.env.NAMESPACE || 'default';
      
      const response = await this.k8sApi.customObjectsApi.getNamespacedCustomObject({
        group: 'devbox.sealos.io',
        version: 'v1alpha1',
        namespace: targetNamespace,
        plural: 'devboxes',
        name: name
      });
      
      return response.body || response;
    } catch (error: any) {
      console.error('获取 Devbox 详情失败:', error);
      throw new Error(`获取 Devbox 详情失败: ${error.message || error}`);
    }
  }

  /**
   * 获取 DevBoxRelease 列表
   */
  async getDevboxReleases(namespace?: string): Promise<any> {
    try {
      const targetNamespace = namespace || process.env.NAMESPACE || 'default';
      
      const response = await this.k8sApi.customObjectsApi.listNamespacedCustomObject({
        group: 'devbox.sealos.io',
        version: 'v1alpha1',
        namespace: targetNamespace,
        plural: 'devboxreleases'
      });
      
      return response.body || response;
    } catch (error: any) {
      console.error('获取 DevBoxRelease 列表失败:', error);
      throw new Error(`获取 DevBoxRelease 列表失败: ${error.message || error}`);
    }
  }

  /**
   * 获取单个 DevBoxRelease 详情
   */
  async getDevboxRelease(name: string, namespace?: string): Promise<any> {
    try {
      const targetNamespace = namespace || process.env.NAMESPACE || 'default';
      
      const response = await this.k8sApi.customObjectsApi.getNamespacedCustomObject({
        group: 'devbox.sealos.io',
        version: 'v1alpha1',
        namespace: targetNamespace,
        plural: 'devboxreleases',
        name: name
      });
      
      return response.body || response;
    } catch (error: any) {
      if (error.code === 404) {
        return null; // 不存在时返回 null
      }
      console.error('获取 DevBoxRelease 详情失败:', error);
      throw new Error(`获取 DevBoxRelease 详情失败: ${error.message || error}`);
    }
  }

  /**
   * 创建 DevBoxRelease
   */
  async createDevboxRelease(releaseSpec: any, namespace?: string): Promise<any> {
    try {
      const targetNamespace = namespace || process.env.NAMESPACE || 'default';
      
      const response = await this.k8sApi.customObjectsApi.createNamespacedCustomObject({
        group: 'devbox.sealos.io',
        version: 'v1alpha1',
        namespace: targetNamespace,
        plural: 'devboxreleases',
        body: releaseSpec
      });
      
      return response.body || response;
    } catch (error: any) {
      console.error('创建 DevBoxRelease 失败:', error);
      // 保留原始错误信息，包括错误码
      const newError = new Error(`创建 DevBoxRelease 失败: ${error.message || error}`);
      (newError as any).code = error.code;
      (newError as any).originalError = error;
      throw newError;
    }
  }

  /**
   * 检查特定 Devbox 的版本是否已存在
   */
  async checkDevboxReleaseExists(devboxName: string, newTag: string, namespace?: string): Promise<boolean> {
    try {
      const releaseName = `${devboxName}-${newTag}`;
      const release = await this.getDevboxRelease(releaseName, namespace);
      return release !== null;
    } catch (error: any) {
      // 出错时认为不存在
      return false;
    }
  }

  /**
   * 删除 DevBoxRelease
   */
  async deleteDevboxRelease(releaseName: string, namespace?: string): Promise<any> {
    try {
      const targetNamespace = namespace || process.env.NAMESPACE || 'default';
      
      const response = await this.k8sApi.customObjectsApi.deleteNamespacedCustomObject({
        group: 'devbox.sealos.io',
        version: 'v1alpha1',
        namespace: targetNamespace,
        plural: 'devboxreleases',
        name: releaseName
      });
      
      return response.body || response;
    } catch (error: any) {
      console.error('删除 DevBoxRelease 失败:', error);
      throw new Error(`删除 DevBoxRelease 失败: ${error.message || error}`);
    }
  }

  /**
   * 修改 Devbox 状态
   */
  async patchDevbox(name: string, patchData: any, namespace?: string): Promise<any> {
    try {
      const targetNamespace = namespace || process.env.NAMESPACE || 'default';
      
      
      // 直接使用 Kubernetes API 进行 patch 操作
      const response = await this.k8sApi.customObjectsApi.patchNamespacedCustomObject({
        group: 'devbox.sealos.io',
        version: 'v1alpha1',
        namespace: targetNamespace,
        plural: 'devboxes',
        name: name,
        body: patchData
      });

      return response.body || response;


      
    } catch (error: any) {
      console.error(`修改 Devbox ${name} 失败:`, error);
      throw new Error(`修改 Devbox 失败: ${error.message || error}`);
    }
  }

  /**
   * 暂停 Devbox
   */
  async stopDevbox(name: string, namespace?: string): Promise<any> {
    // 使用 JSON Patch 格式
    const jsonPatch = [
      {
        op: 'replace',
        path: '/spec/state',
        value: 'Stopped'
      }
    ];
    return this.patchDevbox(name, jsonPatch, namespace);
  }

  /**
   * 启动 Devbox
   */
  async startDevbox(name: string, namespace?: string): Promise<any> {
    // 使用 JSON Patch 格式
    const jsonPatch = [
      {
        op: 'replace',
        path: '/spec/state',
        value: 'Running'
      }
    ];
    return this.patchDevbox(name, jsonPatch, namespace);
  }

  /**
   * 修改 Devbox 资源配置
   */
  async updateDevboxResources(name: string, cpu?: string, memory?: string, namespace?: string): Promise<any> {
    const patchData: any = {
      spec: {
        resource: {}
      }
    };

    if (cpu) {
      patchData.spec.resource.cpu = cpu;
    }
    
    if (memory) {
      patchData.spec.resource.memory = memory;
    }

    return this.patchDevbox(name, patchData, namespace);
  }

  /**
   * 删除 Devbox 及其相关资源
   */
  async deleteDevbox(name: string, namespace?: string): Promise<any> {
    const targetNamespace = namespace || process.env.NAMESPACE || 'default';
    
    // 构建标签选择器（使用 Devbox 管理器标签）
    const devboxManagerLabel = `cloud.sealos.io/devbox-manager=${name}`;
    
    
    let errors: string[] = [];
    
    try {
      // 1. 删除 Service 
      await this.deleteServiceByName(targetNamespace, name);
      await this.deleteServiceByName(targetNamespace, name + "-svc");

      // 2. 删除 Ingress (使用标签删除，因为有 devbox-manager 标签)
      await this.deleteIngressByLabel(targetNamespace, devboxManagerLabel);

      // 3. 删除 Secret
      await this.deleteSecretByName(targetNamespace, name);
      
      // 5. 最后删除 Devbox 资源本身
      try {
        await this.k8sApi.customObjectsApi.deleteNamespacedCustomObject({
          group: 'devbox.sealos.io',
          version: 'v1alpha1',
          namespace: targetNamespace,
          plural: 'devboxes',
          name: name
        });
      } catch (devboxError: any) {
        // 检查多种可能的 404 错误格式
        const is404 = devboxError.code === 404 ||
                     devboxError.statusCode === 404 ||
                     (devboxError.message && devboxError.message.includes('not found')) ||
                     (devboxError.body && devboxError.body.includes('not found'));

        if (is404) {
        } else {
          console.error(`删除 Devbox ${name} 资源失败:`, devboxError.message);
          errors.push(`删除 Devbox 资源失败: ${devboxError.message}`);
        }
      }
      
      
      if (errors.length > 0) {
        return {
          success: true,
          message: `Devbox ${name} 删除完成，但有部分警告`,
          warnings: errors
        };
      }
      
      return {
        success: true,
        message: `Devbox ${name} 删除成功`
      };
      
    } catch (error: any) {
      console.error('删除 Devbox 过程中发生错误:', error);
      throw new Error(`删除 Devbox 失败: ${error.message || error}`);
    }
  }

  /**
   * 获取 Pod 列表 (向后兼容)
   */
  async getPods(namespace: string, options?: any): Promise<any> {
    try {
      const response = await this.k8sApi.coreV1Api.listNamespacedPod({
        namespace,
        labelSelector: options?.labelSelector,
        fieldSelector: options?.fieldSelector
      });

      return response;
    } catch (error: any) {
      console.error('获取 Pod 列表失败:', error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 获取单个 Pod 详情 (向后兼容)
   */
  async getPodDetails(namespace: string, name: string): Promise<any> {
    try {
      const response = await this.k8sApi.coreV1Api.readNamespacedPod({
        namespace,
        name
      });

      return response;
    } catch (error: any) {
      console.error('获取 Pod 详情失败:', error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 删除资源 (向后兼容)
   */
  async deleteResource(resourceType: string, name: string, namespace: string): Promise<any> {
    try {
      switch (resourceType.toLowerCase()) {
        case 'pod':
          const response = await this.k8sApi.coreV1Api.deleteNamespacedPod({
            namespace,
            name
          });
          return response;

        case 'service':
          return await this.k8sApi.coreV1Api.deleteNamespacedService({
            namespace,
            name
          });

        case 'deployment':
          return await this.k8sApi.appsV1Api.deleteNamespacedDeployment({
            namespace,
            name
          });

        case 'ingress':
          return await this.k8sApi.networkingV1Api.deleteNamespacedIngress({
            namespace,
            name
          });

        default:
          throw new Error(`不支持的资源类型: ${resourceType}`);
      }
    } catch (error: any) {
      console.error(`删除 ${resourceType} ${name} 失败:`, error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 获取单个 Deployment 详情 (向后兼容)
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
   * 应用 YAML 配置 (向后兼容)
   */
  async applyYaml(yamlContent: string, namespace: string): Promise<any> {
    try {
      // 使用 kubectl apply 命令
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

  /**
   * 修补 Deployment (向后兼容)
   */
  async patchDeployment(namespace: string, name: string, patchData: any): Promise<any> {
    try {
      // 使用原始的简单实现
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
   * 调整 Pod 副本数量 (向后兼容)
   */
  async scalePodReplicas(namespace: string, name: string, replicas: number): Promise<any> {
    try {
      // 方法1: 使用 scale API (推荐)
      try {
        // 先获取当前的 scale 信息
        const currentScale = await this.k8sApi.appsV1Api.readNamespacedDeploymentScale({
          namespace,
          name
        });

        const currentReplicas = currentScale.spec?.replicas || 0;

        // 更新副本数
        currentScale.spec!.replicas = replicas;

        const result = await this.k8sApi.appsV1Api.replaceNamespacedDeploymentScale({
          namespace,
          name,
          body: currentScale
        });

        // 返回包含当前和目标副本数的信息
        return {
          ...result,
          currentReplicas,
          targetReplicas: replicas
        };
      } catch (scaleError: any) {

        // 方法2: 使用 patch (备用)
        // 先获取当前 deployment 信息
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
   * 获取 Deployment 列表 (向后兼容)
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
   * 获取 Service 列表 (向后兼容)
   */
  async getServices(namespace: string, options?: any): Promise<any> {
    try {
      const response = await this.k8sApi.coreV1Api.listNamespacedService({
        namespace,
        labelSelector: options?.labelSelector,
        fieldSelector: options?.fieldSelector
      });

      return response;
    } catch (error: any) {
      console.error('获取 Service 列表失败:', error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 获取集群信息 (向后兼容)
   */
  async getClusterInfo(): Promise<any> {
    try {
      const nodes = await this.k8sApi.coreV1Api.listNode();
      const namespaces = await this.k8sApi.coreV1Api.listNamespace();

      return {
        nodes: nodes.items,
        namespaces: namespaces.items
      };
    } catch (error: any) {
      console.error('获取集群信息失败:', error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 重启部署 (向后兼容)
   */
  async restartDeployment(namespace: string, name: string): Promise<any> {
    try {

      // 方法1: 删除相关 Pod 来触发重启（最可靠的方法）
      try {
        // 获取部署的标签选择器
        const deployment = await this.getDeployment(namespace, name);
        const labelSelector = deployment.spec?.selector?.matchLabels;

        if (labelSelector) {
          // 构建标签选择器字符串
          const selectorString = Object.entries(labelSelector)
            .map(([key, value]) => `${key}=${value}`)
            .join(',');


          // 获取匹配的 Pod
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
      } catch (podDeleteError: any) {

        // 方法2: 使用 kubectl 命令（备用）
        try {
          const result = await this.executeKubectlCommand(`rollout restart deployment/${name}`);

          if (result.success) {
            return {
              success: true,
              message: `部署 ${name} 重启命令已发送`,
              output: result.stdout,
              method: 'kubectl-rollout'
            };
          } else {
            throw new Error(`kubectl 命令失败: ${result.stderr}`);
          }
        } catch (kubectlError: any) {
          console.error('所有重启方法都失败了');
          throw new Error(`重启失败: Pod删除失败(${podDeleteError.message}), kubectl失败(${kubectlError.message})`);
        }
      }

    } catch (error: any) {
      console.error('重启部署失败:', error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 获取与 Devbox 相关的 Ingress
   */
  async getDevboxIngress(devboxName: string, namespace?: string): Promise<any> {
    try {
      const targetNamespace = namespace || process.env.NAMESPACE || 'default';

      // 查找标签匹配的 Ingress
      const response = await this.k8sApi.networkingV1Api.listNamespacedIngress({
        namespace: targetNamespace,
        labelSelector: `cloud.sealos.io/devbox-manager=${devboxName}`
      });

      return response;
    } catch (error: any) {
      console.error('获取 Devbox Ingress 失败:', error);
      return { items: [] };
    }
  }
}
