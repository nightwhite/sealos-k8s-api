/**
 * K8s 服务 - 组合所有子服务的统一接口
 */

import { DevboxK8sService } from './k8s/devbox.service';
import { PodService } from './k8s/pod.service';
import { DeploymentService } from './k8s/deployment.service';
import { ServiceService } from './k8s/service.service';
import { SecretService } from './k8s/secret.service';

// 导出主要的 K8s 服务类
export class KubernetesService extends DevboxK8sService {
  private static instance: KubernetesService;

  // 子服务实例
  private podService: PodService;
  private deploymentService: DeploymentService;
  private serviceService: ServiceService;
  private secretService: SecretService;

  constructor() {
    super();

    // 初始化子服务
    this.podService = new PodService();
    this.deploymentService = new DeploymentService();
    this.serviceService = new ServiceService();
    this.secretService = new SecretService();
  }

  /**
   * 获取单例实例（保持向后兼容性）
   */
  static getInstance(): KubernetesService {
    if (!KubernetesService.instance) {
      KubernetesService.instance = new KubernetesService();
    }
    return KubernetesService.instance;
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<boolean> {

    const isConnected = await this.verifyConnection();
    if (!isConnected) {
      throw new Error('无法连接到 Kubernetes API');
    }

    return true;
  }

  // ===== Pod 相关方法 (委托给 PodService) =====

  async getPods(namespace: string, options?: any): Promise<any> {
    return this.podService.getPods(namespace, options);
  }

  async getPodDetails(namespace: string, name: string): Promise<any> {
    return this.podService.getPodDetails(namespace, name);
  }

  // ===== Deployment 相关方法 (委托给 DeploymentService) =====

  async getDeployments(namespace: string, options?: any): Promise<any> {
    return this.deploymentService.getDeployments(namespace, options);
  }

  async getDeployment(namespace: string, name: string): Promise<any> {
    return this.deploymentService.getDeployment(namespace, name);
  }

  async patchDeployment(namespace: string, name: string, patchData: any): Promise<any> {
    return this.deploymentService.patchDeployment(namespace, name, patchData);
  }

  async scalePodReplicas(namespace: string, name: string, replicas: number): Promise<any> {
    return this.deploymentService.scalePodReplicas(namespace, name, replicas);
  }

  async restartDeployment(namespace: string, name: string): Promise<any> {
    return this.deploymentService.restartDeployment(namespace, name);
  }

  async applyYaml(yamlContent: string): Promise<any> {
    return this.deploymentService.applyYaml(yamlContent);
  }

  // ===== Service 相关方法 (委托给 ServiceService) =====

  async getServices(namespace: string, options?: any): Promise<any> {
    return this.serviceService.getServices(namespace, options);
  }

  async getService(namespace: string, name: string): Promise<any> {
    return this.serviceService.getService(namespace, name);
  }

  // ===== Secret 相关方法 =====

  async getSecrets(namespace: string, options?: any): Promise<any> {
    return this.secretService.getSecrets(namespace, options);
  }

  async getSecret(namespace: string, name: string): Promise<any> {
    return this.secretService.getSecret(namespace, name);
  }

  async createSecret(namespace: string, secretSpec: any): Promise<any> {
    return this.secretService.createSecret(namespace, secretSpec);
  }

  async updateSecret(namespace: string, name: string, secretSpec: any): Promise<any> {
    return this.secretService.updateSecret(namespace, name, secretSpec);
  }

  async patchSecret(namespace: string, name: string, patchData: any): Promise<any> {
    return this.secretService.patchSecret(namespace, name, patchData);
  }

  async deleteSecret(namespace: string, name: string): Promise<any> {
    return this.secretService.deleteSecret(namespace, name);
  }

  async createOpaqueSecret(namespace: string, name: string, data: Record<string, string>, labels?: Record<string, string>): Promise<any> {
    return this.secretService.createOpaqueSecret(namespace, name, data, labels);
  }

  async createTLSSecret(namespace: string, name: string, tlsCert: string, tlsKey: string, labels?: Record<string, string>): Promise<any> {
    return this.secretService.createTLSSecret(namespace, name, tlsCert, tlsKey, labels);
  }


  async getSecretData(namespace: string, name: string): Promise<Record<string, string>> {
    return this.secretService.getSecretData(namespace, name);
  }

  // ===== Ingress 相关方法 =====

  async getIngresses(namespace: string, options?: any): Promise<any> {
    try {
      const response = await this.k8sApi.networkingV1Api.listNamespacedIngress({
        namespace,
        ...options
      });
      return response;
    } catch (error: any) {
      console.error('获取 Ingress 列表失败:', error);
      throw new Error(`获取 Ingress 列表失败: ${error.message || error}`);
    }
  }

  async getIngress(namespace: string, name: string): Promise<any> {
    try {
      const response = await this.k8sApi.networkingV1Api.readNamespacedIngress({
        namespace,
        name
      });
      return response;
    } catch (error: any) {
      console.error('获取 Ingress 详情失败:', error);
      throw new Error(`获取 Ingress 详情失败: ${error.message || error}`);
    }
  }

  // ===== 集群相关方法已移除（权限不足） =====

  // ===== 通用资源删除方法 =====

  async deleteResource(resourceType: string, name: string, namespace: string): Promise<any> {
    switch (resourceType.toLowerCase()) {
      case 'pod':
        return this.podService.deletePod(namespace, name);
      case 'deployment':
        return this.deploymentService.deleteDeployment(namespace, name);
      case 'service':
        return this.serviceService.deleteService(namespace, name);
      case 'secret':
        return await this.k8sApi.coreV1Api.deleteNamespacedSecret({
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
  }
}

// 保持向后兼容性
export default KubernetesService;
