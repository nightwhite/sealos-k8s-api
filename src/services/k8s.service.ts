import * as k8s from '@kubernetes/client-node';
import * as yaml from 'yaml';
import * as https from 'https';

export class KubernetesService {
  private k8sApi: {
    coreV1Api: k8s.CoreV1Api;
    appsV1Api: k8s.AppsV1Api;
    networkingV1Api: k8s.NetworkingV1Api;
    customObjectsApi: k8s.CustomObjectsApi;
  };
  private kc: k8s.KubeConfig = new k8s.KubeConfig();

  constructor() {
    try {
      // 从环境变量获取配置
      const apiServer = process.env.APISERVER || 'https://kubernetes.default.svc.cluster.local:443';
      const userToken = process.env.USER_TOKEN;
      const namespace = process.env.NAMESPACE || 'default';
      const userName = process.env.USER_NAME || 'default';

      if (!userToken) {
        throw new Error('未找到用户令牌，请检查 USER_TOKEN 环境变量');
      }

      // 创建 HTTP Agent 配置
      const agent = new https.Agent({
        rejectUnauthorized: false,
        keepAlive: true 
      });

      // 设置集群配置
      const cluster: k8s.Cluster = {
        name: 'kubernetes',
        server: apiServer,
        skipTLSVerify: true
      };

      // 设置用户配置
      const user: k8s.User = {
        name: userName,
        token: userToken
      };

      // 设置上下文配置
      const context: k8s.Context = {
        name: 'default-context',
        user: user.name,
        cluster: cluster.name,
        namespace: namespace
      };

      // 加载配置
      this.kc.loadFromOptions({
        clusters: [cluster],
        users: [user],
        contexts: [context],
        currentContext: context.name
      });

      // 初始化自定义请求配置
      const requestOptions = {
        agent: agent,
        headers: {} as Record<string, string>
      };

      if (process.env.AUTH_HEADER) {
        requestOptions.headers['X-SEALOS-PNHT2'] = '';
      }

      // 初始化 API 客户端
      this.k8sApi = {
        coreV1Api: this.kc.makeApiClient(k8s.CoreV1Api),
        appsV1Api: this.kc.makeApiClient(k8s.AppsV1Api),
        networkingV1Api: this.kc.makeApiClient(k8s.NetworkingV1Api),
        customObjectsApi: this.kc.makeApiClient(k8s.CustomObjectsApi)
      };

      // 为每个 API 客户端配置请求选项
      Object.values(this.k8sApi).forEach(client => {
        const apiClient = client as any;
        if (apiClient.httpClient) {
          apiClient.httpClient.defaults = {
            ...apiClient.httpClient.defaults,
            httpsAgent: agent,
            headers: {
              ...apiClient.httpClient.defaults?.headers,
              ...requestOptions.headers
            }
          };
        }
      });

      console.log('使用环境变量配置初始化 Kubernetes 客户端');
      console.log(`API服务器地址: ${apiServer}`);
      console.log(`命名空间: ${namespace}`);
      console.log(`用户名: ${userName}`);

      // 验证连接（修复参数类型）
      this.k8sApi.coreV1Api.listNamespacedPod({ namespace })
        .then((response) => {
          console.log(`成功连接到 Kubernetes API，已验证对命名空间 ${namespace} 的访问权限`);
        })
        .catch((error: any) => {
          console.error('连接到 Kubernetes API 失败:', this.formatError(error));
        });

    } catch (error: any) {
      const errorMessage = `Kubernetes 客户端初始化失败: ${error.message}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  // 获取集群节点信息
  async getNodes() {
    try {
      const response = await this.k8sApi.coreV1Api.listNode();
      return response;
    } catch (error) {
      throw this.handleK8sError(error);
    }
  }

  // 获取命名空间列表
  async getNamespaces() {
    try {
      const response = await this.k8sApi.coreV1Api.listNamespace();
      return response;
    } catch (error) {
      throw this.handleK8sError(error);
    }
  }

  // 获取Pod列表
  async getPods(namespace = '') {
    try {
      let response;
      if (namespace) {
        // 修复参数类型
        response = await this.k8sApi.coreV1Api.listNamespacedPod({
          namespace
        });
      } else {
        response = await this.k8sApi.coreV1Api.listPodForAllNamespaces();
      }
      return response;
    } catch (error) {
      throw this.handleK8sError(error);
    }
  }

  // 获取Pod详情
  async getPodDetails(namespace: string, name: string) {
    try {
      const response = await this.k8sApi.coreV1Api.readNamespacedPod({ 
        name,
        namespace 
      });
      return response;
    } catch (error) {
      throw this.handleK8sError(error);
    }
  }

  // 获取部署列表
  async getDeployments(namespace = '') {
    try {
      let response;
      if (namespace) {
        response = await this.k8sApi.appsV1Api.listNamespacedDeployment({
          namespace
        });
      } else {
        response = await this.k8sApi.appsV1Api.listDeploymentForAllNamespaces();
      }
      return response;
    } catch (error) {
      throw this.handleK8sError(error);
    }
  }

  // 获取部署详情
  async getDeployment(namespace: string, name: string) {
    try {
      const response = await this.k8sApi.appsV1Api.readNamespacedDeployment({
        name,
        namespace
      });
      return response;
    } catch (error) {

      console.error('获取部署详情失败:', error);
      throw this.handleK8sError(error);
    }
  }

  // 扩展或缩减Pod副本数量
  async scalePodReplicas(namespace: string, deploymentName: string, replicas: number) {
    try {
      // 获取当前部署信息
      const currentDeployment = await this.getDeployment(namespace, deploymentName);
      
      // 设置新的副本数量
      const patch = [{
        op: 'replace',
        path: '/spec/replicas',
        value: replicas
      }];
      
      // 应用补丁更新
      const options = {
        name: deploymentName,
        namespace: namespace,
        body: patch
      };

      const response = await this.k8sApi.appsV1Api.patchNamespacedDeployment(options);
      
      return {
        currentReplicas: currentDeployment.spec?.replicas,
        newReplicas: replicas,
        deployment: response
      };
    } catch (error) {
      throw this.handleK8sError(error);
    }
  }

  // 修补部署
  async patchDeployment(namespace: string, name: string, patch: any) {
    try {
      const options = {
        name,
        namespace,
        body: patch
      };
      
      const response = await this.k8sApi.appsV1Api.patchNamespacedDeployment(options);
      return response;
    } catch (error) {
      throw this.handleK8sError(error);
    }
  }

  // 应用YAML配置
  async applyYaml(yamlContent: string, namespace?: string) {
    try {
      const documents = yaml.parseAllDocuments(yamlContent);
      const resources = [];

      for (const doc of documents) {
        if (!doc || !doc.toJSON()) continue;
        
        const resource = doc.toJSON();
        const resourceNamespace = namespace || resource.metadata?.namespace || 'default';

        try {
          switch (resource.kind) {
            case 'Deployment':
              try {
                if (!resource.metadata?.name) {
                  throw new Error('部署配置缺少必需的 metadata.name 字段');
                }

                // 删除可能导致问题的字段
                delete resource.metadata.creationTimestamp;
                delete resource.metadata.resourceVersion;
                delete resource.metadata.uid;
                delete resource.metadata.generation;
                delete resource.status;

                try {
                  // 创建新部署
                  console.log('创建新部署:', resource.metadata.name);
                  await this.k8sApi.appsV1Api.createNamespacedDeployment(
                   {
                      namespace: resourceNamespace,
                      body: resource
                   }
                  );
                  console.log('部署创建成功');
                  resources.push(`Deployment/${resource.metadata.name} (已创建)`);
                } catch (e: any) {
                  if (e.response?.statusCode === 409) {
                    // 如果资源已存在，执行更新
                    console.log('部署已存在，进行更新:', resource.metadata.name);
                    const existing = await this.k8sApi.appsV1Api.readNamespacedDeployment(
                      {
                        name: resource.metadata.name,
                        namespace: resourceNamespace
                      }
                    );
                    resource.metadata.resourceVersion = existing.metadata?.resourceVersion;
                    await this.k8sApi.appsV1Api.replaceNamespacedDeployment(
                      {
                        name: resource.metadata.name,
                        namespace: resourceNamespace,
                        body: resource
                      }
                    );
                    console.log('部署更新成功');
                    resources.push(`Deployment/${resource.metadata.name} (已更新)`);
                  } else {
                    throw e;
                  }
                }
              } catch (e: any) {
                console.error(`处理 Deployment ${resource.metadata?.name} 失败:`, e);
                throw e;
              }
              break;

            case 'Service':
              try {
                if (!resource.metadata?.name) {
                  throw new Error('服务配置缺少必需的 metadata.name 字段');
                }

                // 删除可能导致问题的字段
                delete resource.metadata.creationTimestamp;
                delete resource.metadata.resourceVersion;
                delete resource.metadata.uid;
                delete resource.spec.clusterIP;
                delete resource.spec.clusterIPs;
                delete resource.status;

                try {
                  // 创建新服务
                  console.log('创建新服务:', resource.metadata.name);
                  await this.k8sApi.coreV1Api.createNamespacedService(
                    {
                      namespace: resourceNamespace,
                      body: resource
                    }
                  );
                  console.log('服务创建成功');
                  resources.push(`Service/${resource.metadata.name} (已创建)`);
                } catch (e: any) {
                  if (e.response?.statusCode === 409) {
                    // 如果资源已存在，执行更新
                    console.log('服务已存在，进行更新:', resource.metadata.name);
                    const existing = await this.k8sApi.coreV1Api.readNamespacedService(
                      resource.metadata.name,
                      resourceNamespace
                    );
                    resource.metadata.resourceVersion = existing.metadata?.resourceVersion;
                    await this.k8sApi.coreV1Api.replaceNamespacedService(
                      {
                        name: resource.metadata.name,
                        namespace: resourceNamespace,
                        body: resource
                      }
                    );
                    console.log('服务更新成功');
                    resources.push(`Service/${resource.metadata.name} (已更新)`);
                  } else {
                    throw e;
                  }
                }
              } catch (e: any) {
                console.error(`处理 Service ${resource.metadata?.name} 失败:`, e);
                throw e;
              }
              break;

            case 'Ingress':
              try {
                if (!resource.metadata?.name) {
                  throw new Error('Ingress配置缺少必需的 metadata.name 字段');
                }

                // 删除可能导致问题的字段
                delete resource.metadata.creationTimestamp;
                delete resource.metadata.resourceVersion;
                delete resource.metadata.uid;
                delete resource.metadata.generation;
                delete resource.status;

                try {
                  // 创建新 Ingress
                  console.log('创建新 Ingress:', resource.metadata.name);
                  await this.k8sApi.networkingV1Api.createNamespacedIngress(
                    {
                      namespace: resourceNamespace,
                      body: resource
                    }
                  );
                  console.log('Ingress 创建成功');
                  resources.push(`Ingress/${resource.metadata.name} (已创建)`);
                } catch (e: any) {
                  if (e.response?.statusCode === 409) {
                    // 如果资源已存在，执行更新
                    console.log('Ingress 已存在，进行更新:', resource.metadata.name);
                    const existing = await this.k8sApi.networkingV1Api.readNamespacedIngress(
                      resource.metadata.name,
                      resourceNamespace
                    );
                    resource.metadata.resourceVersion = existing.metadata?.resourceVersion;
                    await this.k8sApi.networkingV1Api.replaceNamespacedIngress(
                      {
                        name: resource.metadata.name,
                        namespace: resourceNamespace,
                        body: resource
                      }
                    );
                    console.log('Ingress 更新成功');
                    resources.push(`Ingress/${resource.metadata.name} (已更新)`);
                  } else {
                    throw e;
                  }
                }
              } catch (e: any) {
                console.error(`处理 Ingress ${resource.metadata?.name} 失败:`, e);
                throw e;
              }
              break;

            default:
              console.warn(`不支持的资源类型: ${resource.kind}`);
              break;
          }
        } catch (error: any) {
          const errorDetails = error.response?.body?.message || error.message;
          const resourceInfo = `${resource.kind}/${resource.metadata?.name}`;
          throw new Error(`处理资源 ${resourceInfo} 失败: ${errorDetails}`);
        }
      }

      if (resources.length === 0) {
        throw new Error('没有可应用的资源');
      }

      return resources;
    } catch (error) {
      throw this.handleK8sError(error);
    }
  }

  // 获取服务列表
  async getServices(namespace = '') {
    try {
      let response;
      if (namespace) {
        response = await this.k8sApi.coreV1Api.listNamespacedService({
          namespace
        });
      } else {
        response = await this.k8sApi.coreV1Api.listServiceForAllNamespaces();
      }
      return response;
    } catch (error) {
      throw this.handleK8sError(error);
    }
  }

  // 获取 Ingress 列表
  async getIngresses(namespace = '') {
    try {
      let response;
      if (namespace) {
        response = await this.k8sApi.networkingV1Api.listNamespacedIngress({
          namespace
        });
      } else {
        response = await this.k8sApi.networkingV1Api.listIngressForAllNamespaces();
      }
      return response;
    } catch (error) {
      throw this.handleK8sError(error);
    }
  }

  // 获取 Ingress 详情
  async getIngress(namespace: string, name: string) {
    try {
      const response = await this.k8sApi.networkingV1Api.readNamespacedIngress({
        name,
        namespace
      });
      return response;
    } catch (error) {
      throw this.handleK8sError(error);
    }
  }

  // 删除资源
  async deleteResource(kind: string, name: string, namespace: string) {
    try {
      switch (kind.toLowerCase()) {
        case 'deployment':
          await this.k8sApi.appsV1Api.deleteNamespacedDeployment({
            name,
            namespace
          });
          break;
        case 'service':
          await this.k8sApi.coreV1Api.deleteNamespacedService({
            name,
            namespace
          });
          break;
        case 'pod':
          await this.k8sApi.coreV1Api.deleteNamespacedPod({
            name,
            namespace
          });
          break;
        case 'configmap':
          await this.k8sApi.coreV1Api.deleteNamespacedConfigMap({
            name,
            namespace
          });
          break;
        case 'secret':
          await this.k8sApi.coreV1Api.deleteNamespacedSecret({
            name,
            namespace
          });
          break;
        default:
          throw new Error(`不支持删除资源类型: ${kind}`);
      }
      return true;
    } catch (error) {
      throw this.handleK8sError(error);
    }
  }

  // 创建命名空间
  async createNamespace(name: string, labels?: Record<string, string>) {
    try {
      const namespace = {
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: {
          name,
          ...(labels && { labels })
        }
      };
      
      const response = await this.k8sApi.coreV1Api.createNamespace({
        body: namespace
      });
      return response;
    } catch (error) {
      throw this.handleK8sError(error);
    }
  }

  // 处理 Kubernetes API 错误
  private handleK8sError(error: unknown): Error {
    const k8sError = error as Error;
    const message = k8sError.message;
    const enhancedError = new Error(message);
    return enhancedError;
  }

  // 添加错误格式化方法
  private formatError(error: any): string {
    if (error.response?.body) {
      const body = error.response.body;
      return `${body.message} (HTTP ${error.response.statusCode})`;
    }
    return error.message || '未知错误';
  }
}