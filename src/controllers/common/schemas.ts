/**
 * 通用的参数和响应模式定义
 */

import { t } from 'elysia';

/**
 * 通用的无占位符参数验证
 * 拒绝任何包含 {} 的占位符
 */
const NoPlaceholderParam = (description: string, example: string) => t.String({
  description,
  pattern: '^(?!.*[{}])(?!:.*$)(?!\\{.*\\}$).+$',
  error: `请提供正确的${description}。不要使用占位符（如 {name}、{resource}），请输入实际的${description}（如：${example}）`
});

/**
 * Kubernetes 资源名称参数
 * 符合 K8s 命名规范且无占位符
 */
export const K8sResourceNameParam = t.String({
  description: '资源名称', 
  pattern: '^(?!.*[{}])(?!:name$)(?!{name}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?$',
  error: '请提供正确的资源名称。不要使用 {name} 占位符，请输入实际的资源名称（如：my-resource-123）'
});

/**
 * 通用名称参数 (符合 K8s 命名规范)
 */
export const ResourceNameParam = t.Object({
  name: K8sResourceNameParam
});

/**
 * 资源类型参数 (kubectl 使用)
 */
export const ResourceTypeParam = t.Object({
  resource: NoPlaceholderParam('资源类型', 'pods')
});

/**
 * Pod 名称参数 (kubectl logs 使用)
 */
export const PodNameParam = t.Object({
  podName: NoPlaceholderParam('Pod 名称', 'my-pod-123')
});

/**
 * 资源类型和名称参数 (kubectl describe 使用)
 */
export const ResourceTypeAndNameParam = t.Object({
  resource: NoPlaceholderParam('资源类型', 'pods'),
  name: K8sResourceNameParam
});

// 为了向后兼容，保留这些别名
export const ServiceNameParam = ResourceNameParam;
export const DeploymentNameParam = ResourceNameParam;
export const IngressNameParam = ResourceNameParam;
export const DevboxNameParam = ResourceNameParam;

/**
 * 可选的资源名称查询参数
 */
export const OptionalResourceNameQuery = t.Object({
  name: t.Optional(K8sResourceNameParam)
});

/**
 * 副本数量参数
 */
export const ReplicasParam = t.Object({
  replicas: t.Number({
    description: '副本数量',
    minimum: 0,
    error: '副本数量必须是大于等于0的整数'
  })
});

/**
 * 通用成功响应
 */
export const SuccessResponse = t.Object({
  success: t.Literal(true),
  message: t.Optional(t.String()),
  data: t.Optional(t.Any())
});

/**
 * 通用错误响应
 */
export const ErrorResponse = t.Object({
  success: t.Literal(false),
  error: t.String(),
  status: t.Optional(t.Number()),
  hint: t.Optional(t.String())
});