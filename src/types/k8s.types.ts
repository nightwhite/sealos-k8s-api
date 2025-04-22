import { V1Node, V1Pod, V1NodeStatus, V1PodSpec, V1PodStatus } from '@kubernetes/client-node';

// K8s API 请求和响应的类型定义

// Pod 相关类型
export interface ScalePodRequest {
  namespace: string;  // Kubernetes 命名空间
  deployment: string; // 部署名称
  replicas: number;   // 副本数量
}

export interface ScalePodResponse {
  success: boolean;
  message: string;
  deployment: string;
  namespace: string;
  currentReplicas?: number;
  targetReplicas?: number;
}

// 部署相关类型
export interface DeployYamlRequest {
  yamlContent: string; // YAML 配置内容
  namespace?: string;  // 可选的命名空间
}

export interface DeployYamlResponse {
  success: boolean;
  message: string;
  resources?: string[];  // 部署的资源列表
}

// 集群状态相关类型
export interface ClusterStatusResponse {
  nodes: {
    total: number;
    ready: number;
    notReady: number;
    items: Array<{
      name: string;
      status: string;
      roles: string[];
      version: string;
      internalIP: string;
      cpuCapacity: string;
      memoryCapacity: string;
    }>;
  };
}

export interface PodListOptions {
  namespace?: string;
  labelSelector?: string;
  fieldSelector?: string;
  limit?: number;
}

export interface PodListResponse {
  total: number;
  items: Array<{
    name: string;
    namespace: string;
    status: string;
    restarts: number;
    age: string;
    ip: string;
    node?: string;
  }>;
}

export interface CreateNamespaceRequest {
  name: string;
  labels?: Record<string, string>;
}

export interface KubernetesError extends Error {
  code?: number;
  response?: {
    body?: {
      message?: string;
      reason?: string;
      code?: number;
    };
  };
}

// 扩展类型以支持返回数据格式
export interface V1NodeWithStatus extends V1Node {
  status?: V1NodeStatus;
}

export interface V1PodWithStatus extends V1Pod {
  status?: V1PodStatus;
  spec?: V1PodSpec;
  metadata?: {
    labels?: Record<string, string>;
  };
}