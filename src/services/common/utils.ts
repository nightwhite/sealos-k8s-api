/**
 * 通用工具函数
 */

/**
 * 解析 Devbox 状态
 */
export function parseDevboxStatus(status: any): string {
  if (!status || Object.keys(status).length === 0) {
    return 'Stopped';
  }
  
  if (status.running) {
    return 'Running';
  }
  
  if (status.pending) {
    return 'Pending';
  }
  
  if (status.terminated) {
    return 'Terminated';
  }
  
  // 如果有 phase 字段，使用它
  if (status.phase) {
    return status.phase;
  }
  
  // 如果有 state 字段，使用它
  if (status.state) {
    return status.state;
  }
  
  return 'Unknown';
}

/**
 * 构建 Devbox 访问 URL
 */
export async function buildDevboxUrl(devbox: any): Promise<string> {
  // 尝试多种方式获取域名信息
  let domain = null;
  
  // 方式1: 从 labels 中获取
  domain = devbox.metadata?.labels?.['cloud.sealos.io/app-deploy-manager-domain'];
  if (domain) {
    return `https://${domain}`;
  }
  
  // 方式2: 从 annotations 中获取
  domain = devbox.metadata?.annotations?.['cloud.sealos.io/app-deploy-manager-domain'];
  if (domain) {
    return `https://${domain}`;
  }
  
  // 方式3: 从 status 中查找网络信息
  if (devbox.status?.network?.nodePort) {
    const firstAppPort = devbox.spec?.config?.appPorts?.[0];
    if (firstAppPort && firstAppPort.name) {
      const urlPrefix = firstAppPort.name;
      const clusterDomain = process.env.CLUSTER_DOMAIN || 'jp-members-1.clawcloudrun.com';
      const fullDomain = `${urlPrefix}.${clusterDomain}`;
      return `https://${fullDomain}`;
    }
  }
  
  // 如果没有域名信息，返回占位符
  return `https://${devbox.metadata?.name || 'unknown'}.example.com`;
}

/**
 * 构建端口信息
 */
export function buildPortsInfo(devbox: any): any[] {
  const appPorts = devbox.spec?.config?.appPorts || [];
  const clusterDomain = process.env.CLUSTER_DOMAIN || 'jp-members-1.clawcloudrun.com';
  
  return appPorts.map((port: any) => ({
    name: port.name,
    port: port.port,
    protocol: port.protocol,
    targetPort: port.targetPort,
    url: port.name ? `https://${port.name}.${clusterDomain}` : null,
    isPrimary: port.port === 8080 || (appPorts.length === 1)
  }));
}

/**
 * 格式化错误信息
 */
export function formatError(error: any): string {
  if (typeof error === 'string') {
    return error;
  }

  // 处理 Kubernetes API 错误
  if (error?.code === 404) {
    // 解析 404 错误中的资源信息
    try {
      const body = typeof error.body === 'string' ? JSON.parse(error.body) : error.body;
      if (body?.message) {
        // 提取资源类型和名称，使其更友好
        const message = body.message;
        if (message.includes('not found')) {
          return message;
        }
      }
    } catch (e) {
      // 解析失败，使用默认消息
    }
    return '资源未找到';
  }

  // 处理其他 HTTP 错误码
  if (error?.code && error?.body) {
    try {
      const body = typeof error.body === 'string' ? JSON.parse(error.body) : error.body;
      if (body?.message) {
        return body.message;
      }
    } catch (e) {
      // 解析失败，继续处理
    }
  }

  if (error?.message) {
    return error.message;
  }

  if (error?.response?.body?.message) {
    return error.response.body.message;
  }

  return '未知错误';
}

/**
 * 等待指定时间
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
