/**
 * Pod 相关操作服务
 */

import { K8sBaseService } from './base.service';

export class PodService extends K8sBaseService {

  /**
   * 获取 Pod 列表
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
   * 获取单个 Pod 详情
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
   * 删除 Pod
   */
  async deletePod(namespace: string, name: string): Promise<any> {
    try {
      return await this.k8sApi.coreV1Api.deleteNamespacedPod({
        namespace,
        name
      });
    } catch (error: any) {
      console.error(`删除 Pod ${name} 失败:`, error);
      throw this.handleK8sError(error);
    }
  }
}
