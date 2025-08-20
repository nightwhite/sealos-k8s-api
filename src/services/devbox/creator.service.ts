/**
 * Devbox 创建服务
 */

import { DevboxK8sService } from '../k8s/devbox.service';
import { DevboxCreateParams, DevboxInfo, ApiResponse } from '../common/types';
import { parseDevboxStatus, buildDevboxUrl, sleep } from '../common/utils';
import { generateDevboxYamls } from '../../templates/devbox.templates';

export class DevboxCreatorService {
  constructor(private k8sService: DevboxK8sService) {}

  /**
   * 创建 Devbox
   */
  async createDevbox(params: DevboxCreateParams): Promise<{
    success: boolean;
    message: string;
    devbox?: DevboxInfo;
    error?: string;
  }> {
    try {

      // 1. 验证参数
      const validationError = this.validateParams(params);
      if (validationError) {
        return {
          success: false,
          message: '参数验证失败',
          error: validationError
        };
      }

      // 2. 检查 Devbox 是否已存在
      const exists = await this.checkDevboxExists(params.devboxName);
      if (exists) {
        return {
          success: false,
          message: 'Devbox 已存在',
          error: `Devbox ${params.devboxName} 已经存在`
        };
      }

      // 3. 生成 YAML 配置
      const yamlConfigs = await this.generateYamlConfigs(params);

      // 4. 应用 YAML 配置到 Kubernetes
      await this.applyYamlConfigs(yamlConfigs);

      // 5. 等待 Devbox 就绪
      const devboxInfo = await this.waitForDevboxReady(params.devboxName, params.urlPrefix, params.urlSuffix);

      return {
        success: true,
        message: 'Devbox 创建成功',
        devbox: devboxInfo
      };

    } catch (error: any) {
      console.error('创建 Devbox 失败:', error);
      return {
        success: false,
        message: '创建 Devbox 失败',
        error: error.message
      };
    }
  }

  /**
   * 验证创建参数
   */
  private validateParams(params: DevboxCreateParams): string | null {
    if (!params.devboxName || params.devboxName.trim() === '') {
      return 'devboxName 不能为空';
    }

    if (!params.urlPrefix || params.urlPrefix.trim() === '') {
      return 'urlPrefix 不能为空';
    }

    if (!params.urlSuffix || params.urlSuffix.trim() === '') {
      return 'urlSuffix 不能为空';
    }

    if (!params.templateID || params.templateID.trim() === '') {
      return 'templateID 不能为空';
    }

    if (!params.image || params.image.trim() === '') {
      return 'image 不能为空';
    }

    // 验证 devboxName 格式（Kubernetes 资源名称规则）
    const nameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    if (!nameRegex.test(params.devboxName)) {
      return 'devboxName 格式不正确，只能包含小写字母、数字和连字符，且不能以连字符开头或结尾';
    }

    return null;
  }

  /**
   * 检查 Devbox 是否已存在
   */
  private async checkDevboxExists(name: string): Promise<boolean> {
    try {
      await this.k8sService.getDevbox(name);
      return true;
    } catch (error: any) {
      // 404 错误表示不存在，这是正常的
      if (error.code === 404 ||
          error.statusCode === 404 ||
          (error.message && error.message.includes('not found')) ||
          (error.body && error.body.includes('not found'))) {
        return false;
      }

      // 其他错误记录日志但也认为不存在，让后续创建过程处理
      return false;
    }
  }

  /**
   * 生成 YAML 配置
   */
  private async generateYamlConfigs(params: DevboxCreateParams): Promise<string[]> {
    // 使用代码模板生成 YAML 配置
    const yamls = generateDevboxYamls({
      devboxName: params.devboxName,
      urlPrefix: params.urlPrefix,
      urlSuffix: params.urlSuffix,
      templateID: params.templateID,
      image: params.image,
      cpu: params.cpu,
      memory: params.memory
    });

    return [yamls.devbox, yamls.service, yamls.ingress];
  }

  /**
   * 应用 YAML 配置到 Kubernetes
   */
  private async applyYamlConfigs(yamlConfigs: string[]): Promise<void> {
    for (const [index, yamlContent] of yamlConfigs.entries()) {

      // 使用 kubectl apply 命令，跳过验证以避免 OpenAPI 下载问题
      const result = await this.k8sService.executeKubectlCommand(`apply -f - --validate=false`, yamlContent);

      if (!result.success) {
        throw new Error(`应用 YAML 配置失败: ${result.error || result.stderr}`);
      }

    }
  }

  /**
   * 等待 Devbox 就绪
   */
  private async waitForDevboxReady(
    devboxName: string, 
    urlPrefix: string, 
    urlSuffix: string,
    maxWaitTime: number = 120000 // 2分钟
  ): Promise<DevboxInfo> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const devbox = await this.k8sService.getDevbox(devboxName);
        const status = parseDevboxStatus(devbox.status);
        
        
        if (status === 'Running') {
          // Devbox 已就绪，构建返回信息
          return {
            name: devbox.metadata?.name || devboxName,
            status: status,
            url: await buildDevboxUrl(devbox),
            cpu: devbox.spec?.resource?.cpu || 'Unknown',
            memory: devbox.spec?.resource?.memory || 'Unknown',
            createdAt: devbox.metadata?.creationTimestamp || new Date().toISOString(),
            namespace: devbox.metadata?.namespace || ''
          };
        }
        
        // 等待 5 秒后重试
        await sleep(5000);
        
      } catch (error: any) {
        await sleep(5000);
      }
    }
    
    throw new Error(`Devbox ${devboxName} 在 ${maxWaitTime / 1000} 秒内未能就绪`);
  }
}
