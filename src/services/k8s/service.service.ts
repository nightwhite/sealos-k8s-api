/**
 * Service 相关操作服务
 */

import { K8sBaseService } from './base.service';

export class ServiceService extends K8sBaseService {

  /**
   * 获取 Service 列表
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
   * 获取单个 Service 详情
   */
  async getService(namespace: string, name: string): Promise<any> {
    try {
      const response = await this.k8sApi.coreV1Api.readNamespacedService({
        namespace,
        name
      });
      
      return response;
    } catch (error: any) {
      console.error('获取 Service 详情失败:', error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 删除 Service
   */
  async deleteService(namespace: string, name: string): Promise<any> {
    try {
      return await this.k8sApi.coreV1Api.deleteNamespacedService({
        namespace,
        name
      });
    } catch (error: any) {
      console.error(`删除 Service ${name} 失败:`, error);
      throw this.handleK8sError(error);
    }
  }
}
