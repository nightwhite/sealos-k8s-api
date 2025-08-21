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
