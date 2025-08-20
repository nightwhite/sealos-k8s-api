/**
 * 通用类型定义
 */

// Devbox 创建参数
export interface DevboxCreateParams {
  devboxName: string;
  urlPrefix: string;
  urlSuffix: string;
  templateID: string;
  image: string;
  cpu?: string;
  memory?: string;
}

// Devbox 信息
export interface DevboxInfo {
  name: string;
  status: string;
  url?: string;
  cpu: string;
  memory: string;
  createdAt: string;
  namespace: string;
}

// 通用响应格式
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  warnings?: string[];
}

// K8s 资源操作结果
export interface K8sOperationResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}

// 资源删除验证结果
export interface ResourceDeletionResult {
  success: boolean;
  message: string;
  remainingResources?: string[];
}

// Devbox 端口信息
export interface DevboxPortInfo {
  name: string;
  port: number;
  protocol: string;
  targetPort: number;
  url: string | null;
  isPrimary: boolean;
}
