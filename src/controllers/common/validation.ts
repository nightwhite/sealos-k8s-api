/**
 * 通用的参数验证和错误处理工具
 */

/**
 * 验证资源名称参数
 */
export function validateResourceName(name: string, resourceType: string = 'Resource'): { valid: boolean; error?: any } {
  if (!name || name.trim() === '') {
    return {
      valid: false,
      error: {
        success: false,
        error: `请提供有效的 ${resourceType} 名称`,
        status: 400
      }
    };
  }

  // 检查是否使用了占位符
  if (name === '{name}' || name.includes('{') || name.includes('}')) {
    return {
      valid: false,
      error: {
        success: false,
        error: `请提供有效的 ${resourceType} 名称，不要使用占位符如 {name}`,
        status: 400,
        hint: `正确示例: /api/v1/deployments/my-deployment`
      }
    };
  }

  // 检查 Kubernetes 资源名称规范
  const k8sNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
  if (!k8sNameRegex.test(name)) {
    return {
      valid: false,
      error: {
        success: false,
        error: `${resourceType} 名称格式不正确`,
        status: 400,
        hint: '名称必须由小写字母、数字和连字符组成，且不能以连字符开头或结尾'
      }
    };
  }

  return { valid: true };
}

/**
 * 检查是否为 404 错误
 */
export function is404Error(error: any): boolean {
  return error.code === 404 || 
         error.statusCode === 404 ||
         (error.message && error.message.includes('not found')) ||
         (error.body && error.body.includes('not found'));
}

/**
 * 格式化 404 错误响应
 */
export function format404Error(name: string, resourceType: string = 'Resource'): any {
  return {
    success: false,
    error: `${resourceType} "${name}" 不存在`,
    status: 404,
    hint: `请检查 ${resourceType} 名称是否正确，或使用相应的列表接口查看可用的资源`
  };
}

/**
 * 格式化通用错误响应
 */
export function formatGenericError(error: any, operation: string = '操作'): any {
  return {
    success: false,
    error: `${operation}失败: ${error.message}`,
    status: error.code || error.statusCode || error.response?.statusCode || 500
  };
}

/**
 * 验证副本数量参数
 */
export function validateReplicas(replicas: any): { valid: boolean; error?: any } {
  if (typeof replicas !== 'number') {
    return {
      valid: false,
      error: {
        success: false,
        error: '副本数量必须是数字',
        status: 400
      }
    };
  }

  if (replicas < 0) {
    return {
      valid: false,
      error: {
        success: false,
        error: '副本数量不能为负数',
        status: 400
      }
    };
  }

  if (!Number.isInteger(replicas)) {
    return {
      valid: false,
      error: {
        success: false,
        error: '副本数量必须是整数',
        status: 400
      }
    };
  }

  return { valid: true };
}
