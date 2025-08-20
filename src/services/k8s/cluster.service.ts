/**
 * 集群相关操作服务
 */

import { K8sBaseService } from './base.service';

export class ClusterService extends K8sBaseService {

  /**
   * 获取集群信息
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
   * 获取节点列表
   */
  async getNodes(): Promise<any> {
    try {
      const response = await this.k8sApi.coreV1Api.listNode();
      return response;
    } catch (error: any) {
      console.error('获取节点列表失败:', error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 获取命名空间列表
   */
  async getNamespaces(): Promise<any> {
    try {
      const response = await this.k8sApi.coreV1Api.listNamespace();
      return response;
    } catch (error: any) {
      console.error('获取命名空间列表失败:', error);
      throw this.handleK8sError(error);
    }
  }
}
