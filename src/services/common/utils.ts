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
  
  // 优先检查 phase 字段，这通常是最准确的
  if (status.phase) {
    return status.phase; // Stopped, Running, Pending, Stopping 等
  }
  
  // 检查 state 字段
  if (status.state) {
    return status.state;
  }
  
  // 检查具体的状态标志
  if (status.running) {
    return 'Running';
  }
  
  if (status.pending) {
    return 'Pending';
  }
  
  if (status.terminated) {
    return 'Terminated';
  }
  
  // 检查是否正在停止
  if (status.stopping) {
    return 'Stopping';
  }
  
  return 'Unknown';
}

/**
 * 构建 Devbox 访问 URL
 */
export async function buildDevboxUrl(devbox: any, k8sService?: any): Promise<string> {
  const devboxName = devbox.metadata?.name;
  
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
  
  // 方式3: 通过 k8s 服务查询 Ingress 获取真实域名（主要方案）
  if (k8sService && devboxName) {
    try {
      const ingresses = await k8sService.getDevboxIngress(devboxName);
      if (ingresses && ingresses.items && ingresses.items.length > 0) {
        const ingress = ingresses.items[0];
        // 从 Ingress 的 rules 中获取 host
        const host = ingress.spec?.rules?.[0]?.host;
        if (host) {
          return `https://${host}`;
        }
        // 或者从 labels 中获取
        const ingressDomain = ingress.metadata?.labels?.['cloud.sealos.io/app-deploy-manager-domain'];
        if (ingressDomain) {
          return `https://${ingressDomain}`;
        }
      }
    } catch (error) {
      console.warn('查询 Ingress 失败:', error);
    }
  }
  
  // 如果没有域名信息，返回占位符
  return `https://${devbox.metadata?.name || 'unknown'}.example.com`;
}

/**
 * 构建端口信息
 */
export async function buildPortsInfo(devbox: any, k8sService?: any): Promise<any[]> {
  const appPorts = devbox.spec?.config?.appPorts || [];
  const containerPorts = devbox.spec?.config?.ports || [];
  const extraPorts = devbox.spec?.network?.extraPorts || [];
  
  const allPorts = [];
  
  // 获取真实的域名（从 Ingress 查询）
  let realDomain = null;
  if (k8sService && devbox.metadata?.name) {
    try {
      const ingresses = await k8sService.getDevboxIngress(devbox.metadata.name);
      if (ingresses && ingresses.items && ingresses.items.length > 0) {
        const ingress = ingresses.items[0];
        realDomain = ingress.spec?.rules?.[0]?.host;
      }
    } catch (error) {
      // 忽略错误，不设置域名
    }
  }
  
  // 1. 应用端口 (有外部访问URL)
  for (const port of appPorts) {
    // 只有查询到真实域名时才设置 URL
    const url = realDomain ? `https://${realDomain}` : null;
      
    allPorts.push({
      name: port.name,
      port: port.port,
      protocol: port.protocol,
      targetPort: port.targetPort,
      url: url,
      isPrimary: port.port === 8080 || (appPorts.length === 1),
      type: 'app'
    });
  }
  
  // 2. 容器端口 (如SSH等)
  for (const port of containerPorts) {
    // 避免重复添加已在 appPorts 中的端口
    if (!allPorts.find(p => p.port === port.containerPort)) {
      allPorts.push({
        name: port.name || `port-${port.containerPort}`,
        port: port.containerPort,
        protocol: port.protocol,
        targetPort: port.containerPort,
        url: null, // 容器端口通常没有外部URL
        isPrimary: false,
        type: 'container'
      });
    }
  }
  
  // 3. 额外端口
  for (const port of extraPorts) {
    // 避免重复添加
    if (!allPorts.find(p => p.port === port.containerPort)) {
      allPorts.push({
        name: `extra-${port.containerPort}`,
        port: port.containerPort,
        protocol: port.protocol || 'TCP',
        targetPort: port.containerPort,
        url: null,
        isPrimary: false,
        type: 'extra'
      });
    }
  }
  
  return allPorts;
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
