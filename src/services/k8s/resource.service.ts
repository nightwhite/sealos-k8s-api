/**
 * K8s 资源管理服务
 */

import { K8sBaseService } from './base.service';

export class K8sResourceService extends K8sBaseService {
  
  /**
   * 根据标签删除资源的通用方法
   */
  async deleteResourcesByLabels(
    resourceType: string, 
    namespace: string, 
    labels: Record<string, string>
  ): Promise<void> {
    try {
      const labelSelector = Object.entries(labels)
        .map(([key, value]) => `${key}=${value}`)
        .join(',');
      
      
      switch (resourceType) {
        case 'Pod':
          const pods = await this.k8sApi.coreV1Api.listNamespacedPod({
            namespace,
            labelSelector
          });
          
          for (const pod of pods.items) {
            await this.k8sApi.coreV1Api.deleteNamespacedPod({
              name: pod.metadata?.name || '',
              namespace
            });
          }
          break;
          
        case 'Service':
          const services = await this.k8sApi.coreV1Api.listNamespacedService({
            namespace,
            labelSelector
          });
          
          for (const service of services.items) {
            await this.k8sApi.coreV1Api.deleteNamespacedService({
              name: service.metadata?.name || '',
              namespace
            });
          }
          break;
          
        case 'Secret':
          const secrets = await this.k8sApi.coreV1Api.listNamespacedSecret({
            namespace,
            labelSelector
          });
          
          for (const secret of secrets.items) {
            await this.k8sApi.coreV1Api.deleteNamespacedSecret({
              name: secret.metadata?.name || '',
              namespace
            });
          }
          break;
          
        case 'Ingress':
          const ingresses = await this.k8sApi.networkingV1Api.listNamespacedIngress({
            namespace,
            labelSelector
          });
          
          for (const ingress of ingresses.items) {
            await this.k8sApi.networkingV1Api.deleteNamespacedIngress({
              name: ingress.metadata?.name || '',
              namespace
            });
          }
          break;
          
        default:
      }
      
    } catch (error: any) {
      // 不抛出错误，继续删除其他资源
    }
  }

  /**
   * 根据名称删除单个资源
   */
  async deleteResourcesByName(
    resourceType: string,
    namespace: string,
    resourceName: string
  ): Promise<void> {
    try {
      
      switch (resourceType) {
        case 'Service':
          try {
            await this.k8sApi.coreV1Api.deleteNamespacedService({
              name: resourceName,
              namespace
            });
          } catch (error: any) {
            if (error.statusCode === 404) {
            } else {
            }
          }
          break;
          
        case 'Ingress':
          try {
            await this.k8sApi.networkingV1Api.deleteNamespacedIngress({
              name: resourceName,
              namespace
            });
          } catch (error: any) {
            if (error.statusCode === 404) {
            } else {
            }
          }
          break;

        case 'Secret':
          try {
            await this.k8sApi.coreV1Api.deleteNamespacedSecret({
              name: resourceName,
              namespace
            });
          } catch (error: any) {
            if (error.statusCode === 404) {
            } else {
            }
          }
          break;
          
        default:
      }
      
    } catch (error: any) {
    }
  }

  /**
   * 删除以指定名称开头的 Ingress 资源
   */
  async deleteIngressByPrefix(
    namespace: string,
    namePrefix: string
  ): Promise<void> {
    try {
      
      // 获取所有 Ingress
      const ingresses = await this.k8sApi.networkingV1Api.listNamespacedIngress({
        namespace
      });
      
      // 查找以指定名称开头的 Ingress
      const matchingIngresses = ingresses.items.filter(ingress => 
        ingress.metadata?.name?.startsWith(namePrefix + '-')
      );
      
      for (const ingress of matchingIngresses) {
        const ingressName = ingress.metadata?.name;
        if (ingressName) {
          try {
            await this.k8sApi.networkingV1Api.deleteNamespacedIngress({
              name: ingressName,
              namespace
            });
          } catch (error: any) {
          }
        }
      }
      
    } catch (error: any) {
    }
  }
}
