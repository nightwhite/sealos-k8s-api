/**
 * Devbox 管理服务
 */

import { DevboxK8sService } from '../k8s/devbox.service';
import { DevboxInfo, DevboxCreateParams, ApiResponse } from '../common/types';
import { parseDevboxStatus, buildDevboxUrl, buildPortsInfo, sleep } from '../common/utils';
import { generateDevboxYamls, generateDevboxReleaseYaml } from '../../templates/devbox.templates';

export class DevboxManagerService {
  constructor(private k8sService: DevboxK8sService) {}

  /**
   * 解析 DevBoxRelease 状态
   */
  private parseReleaseStatus(status: any): string {
    if (!status) {
      return 'Pending';
    }

    // 检查常见的状态字段
    if (status.phase) {
      return status.phase; // Success, Failed, Pending 等
    }

    if (status.conditions && Array.isArray(status.conditions)) {
      // 查找最新的条件
      const latestCondition = status.conditions
        .sort((a: any, b: any) => 
          new Date(b.lastTransitionTime || 0).getTime() - 
          new Date(a.lastTransitionTime || 0).getTime()
        )[0];

      if (latestCondition) {
        if (latestCondition.type === 'Ready' && latestCondition.status === 'True') {
          return 'Success';
        }
        if (latestCondition.type === 'Failed' && latestCondition.status === 'True') {
          return 'Failed';
        }
        return latestCondition.type || 'Processing';
      }
    }

    // 检查其他可能的状态字段
    if (status.state) {
      return status.state;
    }

    if (status.ready === true) {
      return 'Success';
    }

    if (status.ready === false) {
      return 'Failed';
    }

    return 'Processing';
  }

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
          
          // 转换为详细格式，包含更多有用信息
          const devboxList: DevboxInfo[] = devboxes.map((devbox: any) => {
            return {
              name: devbox.metadata?.name || 'Unknown',
              status: parseDevboxStatus(devbox.status),
              cpu: devbox.spec?.resource?.cpu || 'Unknown',
              memory: devbox.spec?.resource?.memory || 'Unknown',
              createdAt: devbox.metadata?.creationTimestamp || '',
              namespace: devbox.metadata?.namespace || '',
              // 添加更多有用信息
              uid: devbox.metadata?.uid || '',
              image: devbox.spec?.image || '',
              templateID: devbox.spec?.templateID || '',
              phase: devbox.status?.phase || 'Unknown',
              networkType: devbox.spec?.network?.type || '',
              nodePort: devbox.status?.network?.nodePort || null,
              appPorts: devbox.spec?.config?.appPorts?.map((port: any) => ({
                name: port.name,
                port: port.port,
                targetPort: port.targetPort,
                protocol: port.protocol
              })) || [],
              // 提交历史中的最新信息
              lastCommit: devbox.status?.commitHistory?.[0] ? {
                image: devbox.status.commitHistory[0].image,
                time: devbox.status.commitHistory[0].time,
                status: devbox.status.commitHistory[0].status,
                node: devbox.status.commitHistory[0].node
              } : null,
              // 运行状态信息
              lastState: devbox.status?.lastState || null,
              // 当前状态详情
              currentState: devbox.status?.state || null
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
          // 基本信息
          name: devbox.metadata?.name,
          namespace: devbox.metadata?.namespace,
          uid: devbox.metadata?.uid,
          resourceVersion: devbox.metadata?.resourceVersion,
          generation: devbox.metadata?.generation,
          createdAt: devbox.metadata?.creationTimestamp,
          
          // 状态信息
          state: parseDevboxStatus(devbox.status),
          phase: devbox.status?.phase || 'Unknown',
          
          // 网络信息
          networkType: devbox.status?.network?.type || 'Unknown',
          nodePort: devbox.status?.network?.nodePort || 'Unknown',
          url: await buildDevboxUrl(devbox, this.k8sService),
          ports: await buildPortsInfo(devbox, this.k8sService),
          
          // 资源配置
          cpu: devbox.spec?.resource?.cpu,
          memory: devbox.spec?.resource?.memory,
          image: devbox.spec?.image,
          templateID: devbox.spec?.templateID,
          
          // 配置详情
          user: devbox.spec?.config?.user,
          workingDir: devbox.spec?.config?.workingDir,
          releaseCommand: devbox.spec?.config?.releaseCommand,
          releaseArgs: devbox.spec?.config?.releaseArgs,
          
          // 运行时信息
          runtime: {
            lastRunningNode: devbox.status?.commitHistory?.[0]?.node,
            lastRunningPod: devbox.status?.commitHistory?.[0]?.pod,
            lastStartTime: devbox.status?.lastState?.running?.startedAt,
            commitHistory: devbox.status?.commitHistory || []
          },
          
          // 元数据
          labels: devbox.metadata?.labels || {},
          annotations: devbox.metadata?.annotations || {},
          finalizers: devbox.metadata?.finalizers || [],
          
          // 完整的原始数据
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
   * 获取 DevBoxRelease 列表
   */
  async getDevboxReleaseList(): Promise<{
    success: boolean;
    total: number;
    items: any[];
    error?: string;
  }> {
    try {
      const response = await this.k8sService.getDevboxReleases();
      
      const releases = response.items.map((release: any) => ({
        name: release.metadata?.name,
        namespace: release.metadata?.namespace,
        devboxName: release.spec?.devboxName,
        newTag: release.spec?.newTag,
        notes: release.spec?.notes,
        createdAt: release.metadata?.creationTimestamp,
        ownerReferences: release.metadata?.ownerReferences,
        uid: release.metadata?.uid,
        // 状态信息 - 用于跟踪发布进度
        status: this.parseReleaseStatus(release.status),
        phase: release.status?.phase || 'Unknown',
        // 完整的状态对象，供调试使用
        rawStatus: release.status
      }));

      return {
        success: true,
        total: releases.length,
        items: releases
      };

    } catch (error: any) {
      console.error('获取 DevBoxRelease 列表失败:', error);
      return {
        success: false,
        total: 0,
        items: [],
        error: error.message
      };
    }
  }

  /**
   * 获取特定 Devbox 的版本列表
   */
  async getDevboxVersions(devboxName: string): Promise<{
    success: boolean;
    total: number;
    items: any[];
    error?: string;
  }> {
    try {
      const allReleases = await this.getDevboxReleaseList();
      
      if (!allReleases.success) {
        return allReleases;
      }

      // 过滤出特定 Devbox 的版本
      const devboxReleases = allReleases.items.filter(
        release => release.devboxName === devboxName
      );

      return {
        success: true,
        total: devboxReleases.length,
        items: devboxReleases
      };

    } catch (error: any) {
      console.error('获取 Devbox 版本列表失败:', error);
      return {
        success: false,
        total: 0,
        items: [],
        error: error.message
      };
    }
  }

  /**
   * 发布新版本（异步处理）
   */
  async createDevboxRelease(params: {
    devboxName: string;
    newTag: string;
    notes: string;
  }): Promise<{
    success: boolean;
    message: string;
    release?: any;
    error?: string;
    needsWaiting?: boolean;
  }> {
    try {
      const { devboxName, newTag, notes } = params;

      // 1. 检查 Devbox 是否存在
      const devbox = await this.k8sService.getDevbox(devboxName);
      if (!devbox) {
        return {
          success: false,
          message: 'Devbox 不存在',
          error: `Devbox ${devboxName} 不存在`
        };
      }

      // 2. 检查版本是否已存在
      const versionExists = await this.k8sService.checkDevboxReleaseExists(devboxName, newTag);
      if (versionExists) {
        return {
          success: false,
          message: '版本已存在',
          error: `版本 ${newTag} 已经存在`
        };
      }

      // 3. 检查 Devbox 状态
      const currentState = parseDevboxStatus(devbox.status);
      let needsWaiting = false;

      if (currentState !== 'Stopped') {
        needsWaiting = true;
        
        // 立即返回成功响应，告知用户任务已提交
        const releaseName = `${devboxName}-${newTag}`;
        
        // 在后台异步处理停止和发布
        this.processDevboxReleaseAsync(devboxName, newTag, notes, devbox.metadata?.uid)
          .catch(error => {
            console.error(`后台处理发布任务失败 [${devboxName}-${newTag}]:`, error);
          });

        return {
          success: true,
          message: `发布任务已提交。Devbox 当前状态为 ${currentState}，系统将自动停止后发布版本 ${newTag}，预计需要 1-2 分钟。`,
          release: {
            name: releaseName,
            devboxName: devboxName,
            newTag: newTag,
            notes: notes,
            status: 'Processing',
            createdAt: new Date().toISOString()
          },
          needsWaiting: true
        };
      }

      // 如果已经是 Stopped 状态，直接发布
      try {
        const release = await this.createDevboxReleaseNow(devboxName, newTag, notes, devbox.metadata?.uid);

        return {
          success: true,
          message: `版本 ${newTag} 发布任务已提交`,
          release: {
            name: release.metadata?.name,
            devboxName: release.spec?.devboxName,
            newTag: release.spec?.newTag,
            notes: release.spec?.notes,
            createdAt: release.metadata?.creationTimestamp,
            status: release.status || 'Processing'
          },
          needsWaiting: false
        };
      } catch (error: any) {
        // 如果是 409 错误（资源已存在），返回友好提示
        if (error.code === 409 || error.message?.includes('already exists')) {
          return {
            success: false,
            message: '版本已存在',
            error: `版本 ${newTag} 已经存在，可能正在处理中或已完成`
          };
        }
        // 其他错误继续抛出
        throw error;
      }

    } catch (error: any) {
      console.error('发布版本失败:', error);
      return {
        success: false,
        message: '发布版本失败',
        error: error.message
      };
    }
  }

  /**
   * 后台异步处理发布任务
   */
  private async processDevboxReleaseAsync(
    devboxName: string, 
    newTag: string, 
    notes: string, 
    devboxUid: string
  ): Promise<void> {
    try {
      console.log(`开始后台处理发布任务: ${devboxName}-${newTag}`);
      
      // 1. 获取当前状态
      let devbox = await this.k8sService.getDevbox(devboxName);
      let currentState = parseDevboxStatus(devbox.status);
      
      // 2. 如果不是 Stopping 状态，则主动停止
      if (currentState !== 'Stopped' && currentState !== 'Stopping') {
        console.log(`后台任务: 停止 Devbox ${devboxName}，当前状态: ${currentState}`);
        await this.k8sService.stopDevbox(devboxName);
      }
      
      // 3. 等待停止完成（最多 2 分钟）
      const maxWait = 120; // 2 分钟
      let waitCount = 0;
      
      while (waitCount < maxWait) {
        await sleep(1000);
        
        devbox = await this.k8sService.getDevbox(devboxName);
        currentState = parseDevboxStatus(devbox.status);
        
        if (currentState === 'Stopped') {
          console.log(`后台任务: Devbox ${devboxName} 已停止，开始发布版本`);
          break;
        }
        
        waitCount++;
        
        // 每 10 秒输出一次状态
        if (waitCount % 10 === 0) {
          console.log(`后台任务: 等待 Devbox ${devboxName} 停止... (${waitCount}/${maxWait}s) 状态: ${currentState}`);
        }
      }
      
      if (currentState !== 'Stopped') {
        console.error(`后台任务: Devbox ${devboxName} 在 ${maxWait} 秒内未能停止，当前状态: ${currentState}`);
        return;
      }
      
      // 4. 创建 DevBoxRelease
      try {
        await this.createDevboxReleaseNow(devboxName, newTag, notes, devboxUid);
        console.log(`后台任务完成: 版本 ${devboxName}-${newTag} 已提交发布`);
      } catch (error: any) {
        // 如果是 409 错误（资源已存在），说明已经有其他任务创建了，这是正常的
        if (error.code === 409 || error.message?.includes('already exists')) {
          console.log(`后台任务: 版本 ${devboxName}-${newTag} 已存在，可能被其他任务创建`);
        } else {
          throw error; // 其他错误继续抛出
        }
      }
      
    } catch (error: any) {
      console.error(`后台发布任务失败 [${devboxName}-${newTag}]:`, error);
    }
  }

  /**
   * 立即创建 DevBoxRelease
   */
  private async createDevboxReleaseNow(
    devboxName: string,
    newTag: string,
    notes: string,
    devboxUid: string
  ): Promise<any> {
    const releaseName = `${devboxName}-${newTag}`;
    const releaseSpec = {
      apiVersion: 'devbox.sealos.io/v1alpha1',
      kind: 'DevBoxRelease',
      metadata: {
        name: releaseName,
        ownerReferences: [
          {
            apiVersion: 'devbox.sealos.io/v1alpha1',
            kind: 'Devbox',
            name: devboxName,
            blockOwnerDeletion: false,
            controller: false,
            uid: devboxUid
          }
        ]
      },
      spec: {
        devboxName: devboxName,
        newTag: newTag,
        notes: notes
      }
    };

    return await this.k8sService.createDevboxRelease(releaseSpec);
  }

  /**
   * 获取单个 DevBoxRelease
   */
  async getDevboxRelease(releaseName: string): Promise<any> {
    try {
      return await this.k8sService.getDevboxRelease(releaseName);
    } catch (error: any) {
      console.error('获取 DevBoxRelease 失败:', error);
      return null;
    }
  }

  /**
   * 删除版本
   */
  async deleteDevboxRelease(params: {
    devboxName: string;
    newTag: string;
  }): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      const { devboxName, newTag } = params;
      const releaseName = `${devboxName}-${newTag}`;

      // 1. 检查版本是否存在
      const release = await this.k8sService.getDevboxRelease(releaseName);
      if (!release) {
        return {
          success: false,
          message: '版本不存在',
          error: `版本 ${newTag} 不存在`
        };
      }

      // 2. 验证这个版本确实属于指定的 Devbox
      if (release.spec?.devboxName !== devboxName) {
        return {
          success: false,
          message: '版本不属于指定的 Devbox',
          error: `版本 ${newTag} 不属于 Devbox ${devboxName}`
        };
      }

      // 3. 删除 DevBoxRelease
      await this.k8sService.deleteDevboxRelease(releaseName);

      return {
        success: true,
        message: `版本 ${newTag} 删除成功`
      };

    } catch (error: any) {
      console.error('删除版本失败:', error);
      return {
        success: false,
        message: '删除版本失败',
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
            url: await buildDevboxUrl(devbox, this.k8sService),
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
