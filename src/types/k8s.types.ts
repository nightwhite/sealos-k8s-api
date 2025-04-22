import { V1Node, V1Pod, V1NodeStatus, V1PodSpec, V1PodStatus } from '@kubernetes/client-node';

// K8s API 请求和响应的类型定义

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

// Node 类型定义
export interface V1NodeWithStatus extends V1Node {
  status?: V1NodeStatus;
}

// 命名空间创建请求
export interface CreateNamespaceRequest {
  name: string;
  labels?: Record<string, string>;
}