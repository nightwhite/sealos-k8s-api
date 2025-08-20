import { Elysia, t } from 'elysia';
import { KubernetesService } from '../services/k8s.service';
import { ResourceTypeParam, ResourceTypeAndNameParam, PodNameParam } from './common/schemas';

/**
 * 解析 kubectl 表格输出为 JSON 格式
 */
function parseTableOutput(output: string): any[] {
  const lines = output.trim().split('\n');
  if (lines.length < 2) return [];

  // 第一行是标题
  const headers = lines[0].split(/\s+/);
  const result = [];

  // 从第二行开始是数据
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(/\s+/);
    const item: any = {};

    headers.forEach((header, index) => {
      item[header.toLowerCase()] = values[index] || '';
    });

    result.push(item);
  }

  return result;
}

/**
 * kubectl 命令执行控制器
 */
export const kubectlController = new Elysia({ prefix: '/kubectl' })
  .decorate('k8sService', KubernetesService.getInstance())
  
  /**
   * 执行 kubectl 命令
   * @description 执行完整的 kubectl 命令，支持所有 kubectl 功能
   * @example
   * POST /api/v1/kubectl/exec
   * {
   *   "command": "get pods -n ns-bgywgilf -o wide"
   * }
   */
  .post('/exec', async ({ body, k8sService }) => {
    try {
      const { command } = body;

      // 执行完整的 kubectl 命令
      const result = await k8sService.executeKubectlCommand(command);

      if (!result.success) {
        return {
          success: false,
          error: result.error || '命令执行失败',
          stderr: result.stderr,
          stdout: result.stdout
        };
      }

      // 尝试解析输出
      let parsedOutput: any = result.stdout;

      if (command.includes('-o json') || command.includes('--output json')) {
        // JSON 格式输出
        try {
          parsedOutput = JSON.parse(result.stdout || '{}');
        } catch {
          parsedOutput = result.stdout;
        }
      } else if (command.includes('get ') && !command.includes('-o ')) {
        // 表格格式输出，尝试解析为 JSON
        try {
          parsedOutput = parseTableOutput(result.stdout || '');
        } catch {
          parsedOutput = result.stdout;
        }
      }

      return {
        success: true,
        command: `kubectl ${command}`,
        stdout: result.stdout,
        data: parsedOutput,
        stderr: result.stderr
      };
    } catch (error: any) {
      return {
        success: false,
        error: `kubectl 命令执行失败: ${error.message}`
      };
    }
  }, {
    body: t.Object({
      command: t.String({
        description: '完整的 kubectl 命令（不包含 kubectl 前缀）',
        examples: [
          'get pods',
          'get pods -n ns-bgywgilf -o wide',
          'get pods --show-labels',
          'describe pod pod-name -n namespace',
          'logs pod-name -n namespace --tail=100',
          'apply -f deployment.yaml',
          'get nodes -o json'
        ]
      })
    }),
    detail: {
      summary: '执行 kubectl 命令',
      description: '执行完整的 kubectl 命令，支持所有 kubectl 功能和参数。命令会自动添加认证信息。',
      tags: ['kubectl']
    }
  })
  
  /**
   * 快捷获取资源
   * @description 快速获取指定类型的资源
   * @example
   * GET /api/v1/kubectl/get/pods
   * GET /api/v1/kubectl/get/deployments?output=yaml
   */
  .get('/get/:resource', async ({ params, query, k8sService }) => {
    try {
      const { resource } = params;
      const { namespace, output = 'json', selector } = query;
      
      // 构建完整的 get 命令
      let command = `get ${resource}`;
      if (namespace) command += ` -n ${namespace}`;
      if (output) command += ` -o ${output}`;
      if (selector) command += ` -l ${selector}`;

      // 执行 get 命令
      const result = await k8sService.executeKubectlCommand(command);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || '获取资源失败',
          stderr: result.stderr
        };
      }
      
      // 尝试解析 JSON 输出
      let parsedOutput = result.stdout;
      if (output === 'json' && result.stdout) {
        try {
          parsedOutput = JSON.parse(result.stdout);
        } catch {
          // 如果不是有效的 JSON，保持原始输出
        }
      }
      
      return {
        success: true,
        resource,
        namespace: namespace || process.env.NAMESPACE || 'default',
        data: parsedOutput,
        stderr: result.stderr
      };
    } catch (error: any) {
      return {
        success: false,
        error: `获取资源失败: ${error.message}`
      };
    }
  }, {
    params: ResourceTypeParam,
    query: t.Object({
      namespace: t.Optional(t.String({
        description: '命名空间'
      })),
      output: t.Optional(t.String({
        description: '输出格式',
        default: 'json',
        examples: ['json', 'yaml', 'wide']
      })),
      selector: t.Optional(t.String({
        description: '标签选择器',
        examples: ['app=nginx', 'env=prod']
      }))
    }),
    detail: {
      summary: '快捷获取资源',
      description: '快速获取指定类型的 Kubernetes 资源',
      tags: ['kubectl']
    }
  })
  
  /**
   * 快捷描述资源
   * @description 快速描述指定的资源
   * @example
   * GET /api/v1/kubectl/describe/pod/nginx-xxx
   */
  .get('/describe/:resource/:name', async ({ params, query, k8sService }) => {
    try {
      const { resource, name } = params;
      const { namespace } = query;
      
      // 构建完整的 describe 命令
      let command = `describe ${resource} ${name}`;
      if (namespace) command += ` -n ${namespace}`;

      // 执行 describe 命令
      const result = await k8sService.executeKubectlCommand(command);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || '描述资源失败',
          stderr: result.stderr
        };
      }
      
      return {
        success: true,
        resource,
        name,
        namespace: namespace || process.env.NAMESPACE || 'default',
        description: result.stdout,
        stderr: result.stderr
      };
    } catch (error: any) {
      return {
        success: false,
        error: `描述资源失败: ${error.message}`
      };
    }
  }, {
    params: ResourceTypeAndNameParam,
    query: t.Object({
      namespace: t.Optional(t.String({
        description: '命名空间'
      }))
    }),
    detail: {
      summary: '快捷描述资源',
      description: '快速获取指定资源的详细描述信息',
      tags: ['kubectl']
    }
  })
  
  /**
   * 获取资源日志
   * @description 获取 Pod 的日志信息
   * @example
   * GET /api/v1/kubectl/logs/nginx-xxx?lines=100
   */
  .get('/logs/:podName', async ({ params, query, k8sService }) => {
    try {
      const { podName } = params;
      const { namespace, container, lines, follow, previous } = query;

      // 构建完整的 logs 命令
      let command = `logs ${podName}`;
      if (namespace) command += ` -n ${namespace}`;
      if (container) command += ` -c ${container}`;
      if (lines) command += ` --tail=${lines}`;
      if (follow) command += ` -f`;
      if (previous) command += ` --previous`;

      // 执行 logs 命令
      const result = await k8sService.executeKubectlCommand(command);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || '获取日志失败',
          stderr: result.stderr
        };
      }
      
      return {
        success: true,
        pod: podName,
        container: container || 'default',
        namespace: namespace || process.env.NAMESPACE || 'default',
        logs: result.stdout,
        stderr: result.stderr
      };
    } catch (error: any) {
      return {
        success: false,
        error: `获取日志失败: ${error.message}`
      };
    }
  }, {
    params: PodNameParam,
    query: t.Object({
      namespace: t.Optional(t.String({
        description: '命名空间'
      })),
      container: t.Optional(t.String({
        description: '容器名称（多容器 Pod 时需要指定）'
      })),
      lines: t.Optional(t.Number({
        description: '显示的日志行数',
        default: 100
      })),
      follow: t.Optional(t.Boolean({
        description: '是否持续跟踪日志',
        default: false
      })),
      previous: t.Optional(t.Boolean({
        description: '是否获取上一个容器实例的日志',
        default: false
      }))
    }),
    detail: {
      summary: '获取 Pod 日志',
      description: '获取指定 Pod 的日志信息',
      tags: ['kubectl']
    }
  });