/**
 * Secret K8s 操作服务
 */

import { K8sBaseService } from './base.service';

export class SecretService extends K8sBaseService {

  /**
   * 获取 Secret 列表
   */
  async getSecrets(namespace: string, options?: any): Promise<any> {
    try {
      const response = await this.k8sApi.coreV1Api.listNamespacedSecret({
        namespace,
        labelSelector: options?.labelSelector,
        fieldSelector: options?.fieldSelector
      });

      return response;
    } catch (error: any) {
      console.error('获取 Secret 列表失败:', error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 获取单个 Secret 详情
   */
  async getSecret(namespace: string, name: string): Promise<any> {
    try {
      const response = await this.k8sApi.coreV1Api.readNamespacedSecret({
        namespace,
        name
      });

      return response;
    } catch (error: any) {
      console.error('获取 Secret 详情失败:', error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 创建 Secret
   */
  async createSecret(namespace: string, secretSpec: any): Promise<any> {
    try {
      const response = await this.k8sApi.coreV1Api.createNamespacedSecret({
        namespace,
        body: secretSpec
      });

      return response;
    } catch (error: any) {
      console.error('创建 Secret 失败:', error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 更新 Secret
   */
  async updateSecret(namespace: string, name: string, secretSpec: any): Promise<any> {
    try {
      const response = await this.k8sApi.coreV1Api.replaceNamespacedSecret({
        namespace,
        name,
        body: secretSpec
      });

      return response;
    } catch (error: any) {
      console.error('更新 Secret 失败:', error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 修补 Secret
   */
  async patchSecret(namespace: string, name: string, patchData: any): Promise<any> {
    try {
      const response = await this.k8sApi.coreV1Api.patchNamespacedSecret({
        namespace,
        name,
        body: patchData
      });

      return response;
    } catch (error: any) {
      console.error('修补 Secret 失败:', error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 删除 Secret
   */
  async deleteSecret(namespace: string, name: string): Promise<any> {
    try {
      const response = await this.k8sApi.coreV1Api.deleteNamespacedSecret({
        namespace,
        name
      });

      return response;
    } catch (error: any) {
      console.error('删除 Secret 失败:', error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 创建 Opaque 类型 Secret
   */
  async createOpaqueSecret(namespace: string, name: string, data: Record<string, string>, labels?: Record<string, string>): Promise<any> {
    const secretSpec = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name,
        namespace,
        labels: labels || {}
      },
      type: 'Opaque',
      data: this.encodeSecretData(data)
    };

    return this.createSecret(namespace, secretSpec);
  }

  /**
   * 创建 TLS 类型 Secret
   */
  async createTLSSecret(namespace: string, name: string, tlsCert: string, tlsKey: string, labels?: Record<string, string>): Promise<any> {
    const secretSpec = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name,
        namespace,
        labels: labels || {}
      },
      type: 'kubernetes.io/tls',
      data: {
        'tls.crt': Buffer.from(tlsCert).toString('base64'),
        'tls.key': Buffer.from(tlsKey).toString('base64')
      }
    };

    return this.createSecret(namespace, secretSpec);
  }


  /**
   * 获取 Secret 数据（解码）
   */
  async getSecretData(namespace: string, name: string): Promise<Record<string, string>> {
    try {
      const secret = await this.getSecret(namespace, name);
      const data = secret.data || {};
      
      // 解码 base64 数据
      const decodedData: Record<string, string> = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          decodedData[key] = Buffer.from(value, 'base64').toString('utf-8');
        }
      }
      
      return decodedData;
    } catch (error: any) {
      console.error('获取 Secret 数据失败:', error);
      throw this.handleK8sError(error);
    }
  }

  /**
   * 编码 Secret 数据为 base64
   */
  private encodeSecretData(data: Record<string, string>): Record<string, string> {
    const encodedData: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      encodedData[key] = Buffer.from(value).toString('base64');
    }
    return encodedData;
  }
}