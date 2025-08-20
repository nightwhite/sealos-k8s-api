/**
 * Devbox 管理服务
 */

import { DevboxK8sService } from '../k8s/devbox.service';
import { DevboxInfo, DevboxCreateParams, ApiResponse } from '../common/types';
import { parseDevboxStatus, buildDevboxUrl, buildPortsInfo, sleep } from '../common/utils';
import { generateDevboxYamls } from '../../templates/devbox.templates';

export class DevboxManagerService {
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

      // 2. 检查 Devbox CRD 是否安装
      // const crdCheck = await this.k8sService.checkDevboxCRD();
      // if (!crdCheck.exists) {
      //   return {
      //     success: false,
      //     message: 'Devbox CRD 未安装',
      //     error: crdCheck.message
      //   };
      // }

      // 3. 检查 Devbox 是否已存在
      const exists = await this.checkDevboxExists(params.devboxName);
      if (exists) {
        return {
          success: false,
          message: 'Devbox 已存在',
          error: `Devbox ${params.devboxName} 已经存在`
        };
      }

      // 4. 生成 YAML 配置
      const yamlConfigs = await this.generateYamlConfigs(params);

      // 5. 应用 YAML 配置到 Kubernetes
      await this.applyYamlConfigs(yamlConfigs);

      // 6. 等待 Devbox 就绪
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
   * 获取 Devbox 列表
   */
  async getDevboxList(): Promise<{
    success: boolean;
    total: number;
    items: DevboxInfo[];
    error?: string;
  }> {
    try {
      // 先尝试使用 K8s API
      try {
        const response = await this.k8sService.getDevboxes();
        
        if (response && response.items) {
          const devboxes = response.items;
          
          // 转换为简化格式（列表不包含 URL）
          const devboxList: DevboxInfo[] = devboxes.map((devbox: any) => {
            return {
              name: devbox.metadata?.name || 'Unknown',
              status: parseDevboxStatus(devbox.status),
              cpu: devbox.spec?.resource?.cpu || 'Unknown',
              memory: devbox.spec?.resource?.memory || 'Unknown',
              createdAt: devbox.metadata?.creationTimestamp || '',
              namespace: devbox.metadata?.namespace || ''
            };
          });

          return {
            success: true,
            total: devboxList.length,
            items: devboxList
          };
        }
      } catch (k8sError: any) {
      }
      
      // 如果 K8s API 失败，回退到 kubectl 命令
      const result = await this.k8sService.executeKubectlCommand('get devbox -o json');
      
      if (!result.success) {
        throw new Error(`kubectl 命令失败: ${result.error || result.stderr}`);
      }

      // 解析 kubectl 输出
      let data;
      try {
        data = JSON.parse(result.stdout || '{}');
      } catch {
        throw new Error('无法解析 kubectl 输出');
      }

      const devboxes = data.items || [];

      // 转换为简化格式（列表不包含 URL）
      const devboxList: DevboxInfo[] = devboxes.map((devbox: any) => ({
        name: devbox.metadata?.name || 'Unknown',
        status: parseDevboxStatus(devbox.status),
        cpu: devbox.spec?.resource?.cpu || 'Unknown',
        memory: devbox.spec?.resource?.memory || 'Unknown',
        createdAt: devbox.metadata?.creationTimestamp || '',
        namespace: devbox.metadata?.namespace || ''
      }));

      return {
        success: true,
        total: devboxList.length,
        items: devboxList
      };

    } catch (error: any) {
      console.error('获取 Devbox 列表失败:', error);
      return {
        success: false,
        total: 0,
        items: [],
        error: error.message
      };
    }
  }

  /**
   * 获取单个 Devbox 详情
   */
  async getDevboxDetails(name: string): Promise<{
    success: boolean;
    devbox?: any;
    error?: string;
  }> {
    try {
      
      const devbox = await this.k8sService.getDevbox(name);
      
      return {
        success: true,
        devbox: {
          name: devbox.metadata?.name,
          state: parseDevboxStatus(devbox.status),
          phase: devbox.status?.phase || 'Unknown',
          networkType: devbox.status?.network?.type || 'Unknown',
          nodePort: devbox.status?.network?.nodePort || 'Unknown',
          url: await buildDevboxUrl(devbox),
          // 提供所有端口的详细信息
          ports: buildPortsInfo(devbox),
          cpu: devbox.spec?.resource?.cpu,
          memory: devbox.spec?.resource?.memory,
          image: devbox.spec?.image,
          templateID: devbox.spec?.templateID,
          createdAt: devbox.metadata?.creationTimestamp,
          namespace: devbox.metadata?.namespace,
          labels: devbox.metadata?.labels,
          annotations: devbox.metadata?.annotations,
          spec: devbox.spec,
          status: devbox.status
        }
      };

    } catch (error: any) {
      console.error('获取 Devbox 详情失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 删除 Devbox
   */
  async deleteDevbox(name: string): Promise<ApiResponse> {
    try {
      
      const result = await this.k8sService.deleteDevbox(name);
      
      return {
        success: result.success,
        message: result.message,
        warnings: result.warnings
      };

    } catch (error: any) {
      console.error('删除 Devbox 失败:', error);
      return {
        success: false,
        message: '删除 Devbox 失败',
        error: error.message
      };
    }
  }

  /**
   * 暂停 Devbox
   */
  async stopDevbox(name: string): Promise<ApiResponse> {
    try {
      
      await this.k8sService.stopDevbox(name);
      
      return {
        success: true,
        message: `Devbox ${name} 暂停成功`
      };

    } catch (error: any) {
      console.error('暂停 Devbox 失败:', error);
      return {
        success: false,
        message: '暂停 Devbox 失败',
        error: error.message
      };
    }
  }

  /**
   * 启动 Devbox
   */
  async startDevbox(name: string): Promise<ApiResponse> {
    try {
      
      await this.k8sService.startDevbox(name);
      
      return {
        success: true,
        message: `Devbox ${name} 启动成功`
      };

    } catch (error: any) {
      console.error('启动 Devbox 失败:', error);
      return {
        success: false,
        message: '启动 Devbox 失败',
        error: error.message
      };
    }
  }

  /**
   * 修改 Devbox 资源配置
   */
  async updateDevboxResources(name: string, cpu?: string, memory?: string): Promise<ApiResponse> {
    try {
      
      if (!cpu && !memory) {
        return {
          success: false,
          message: '请提供要修改的 CPU 或内存配置',
          error: '参数不能为空'
        };
      }
      
      await this.k8sService.updateDevboxResources(name, cpu, memory);
      
      const changes = [];
      if (cpu) changes.push(`CPU: ${cpu}`);
      if (memory) changes.push(`内存: ${memory}`);
      
      return {
        success: true,
        message: `Devbox ${name} 资源配置修改成功 (${changes.join(', ')})`
      };

    } catch (error: any) {
      console.error('修改 Devbox 资源配置失败:', error);
      return {
        success: false,
        message: '修改 Devbox 资源配置失败',
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
    const resourceTypes = ['Devbox', 'Service', 'Ingress'];

    for (const [index, yamlContent] of yamlConfigs.entries()) {
      const resourceType = resourceTypes[index] || `Resource ${index + 1}`;

      // 使用 kubectl apply 命令，跳过验证以避免 OpenAPI 下载问题
      const result = await this.k8sService.executeKubectlCommand('apply -f - --validate=false', yamlContent);

      if (!result.success) {
        console.error(`应用 ${resourceType} 失败:`);
        console.error(`错误: ${result.error}`);
        console.error(`stderr: ${result.stderr}`);
        console.error(`stdout: ${result.stdout}`);
        throw new Error(`应用 ${resourceType} 配置失败: ${result.error || result.stderr}`);
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
