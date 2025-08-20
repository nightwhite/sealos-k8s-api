/**
 * Devbox YAML 模板常量
 * 使用 {{VARIABLE}} 格式的占位符进行替换
 */

export const DEVBOX_TEMPLATE = `apiVersion: devbox.sealos.io/v1alpha1
kind: Devbox
metadata:
  name: {{DEVBOX_NAME}}
spec:
  squash: false
  network:
    type: NodePort
    extraPorts:
      - containerPort: 8080
  resource:
    cpu: {{CPU}}
    memory: {{MEMORY}}
  templateID: {{TEMPLATE_ID}}
  image: {{IMAGE}}
  config:
    appPorts:
      - port: 8080
        name: {{URL_PREFIX}}
        protocol: TCP
        targetPort: 8080
    ports:
      - containerPort: 22
        name: devbox-ssh-port
        protocol: TCP
    releaseArgs:
      - /home/devbox/project/entrypoint.sh prod
    releaseCommand:
      - /bin/bash
      - '-c'
    user: devbox
    workingDir: /home/devbox/project
  state: Running
  tolerations:
    - key: devbox.sealos.io/node
      operator: Exists
      effect: NoSchedule
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: devbox.sealos.io/node
                operator: Exists`;

export const SERVICE_TEMPLATE = `apiVersion: v1
kind: Service
metadata:
  name: {{DEVBOX_NAME}}
  labels:
    cloud.sealos.io/devbox-manager: {{DEVBOX_NAME}}
spec:
  ports:
    - port: 8080
      targetPort: 8080
      name: {{URL_PREFIX}}
  selector:
    app.kubernetes.io/name: {{DEVBOX_NAME}}
    app.kubernetes.io/part-of: devbox
    app.kubernetes.io/managed-by: sealos`;

export const INGRESS_TEMPLATE = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{DEVBOX_NAME}}-{{URL_PREFIX}}
  labels:
    cloud.sealos.io/devbox-manager: {{DEVBOX_NAME}}
    cloud.sealos.io/app-deploy-manager-domain: {{FULL_DOMAIN}}
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/proxy-body-size: 32m
    nginx.ingress.kubernetes.io/ssl-redirect: 'false'
    nginx.ingress.kubernetes.io/backend-protocol: HTTP
    nginx.ingress.kubernetes.io/client-body-buffer-size: 64k
    nginx.ingress.kubernetes.io/proxy-buffer-size: 64k
    nginx.ingress.kubernetes.io/proxy-send-timeout: '300'
    nginx.ingress.kubernetes.io/proxy-read-timeout: '300'
    nginx.ingress.kubernetes.io/server-snippet: |
      client_header_buffer_size 64k;
      large_client_header_buffers 4 128k;
spec:
  rules:
    - host: {{FULL_DOMAIN}}
      http:
        paths:
          - pathType: Prefix
            path: /
            backend:
              service:
                name: {{DEVBOX_NAME}}
                port:
                  number: 8080
  tls:
    - hosts:
        - {{FULL_DOMAIN}}
      secretName: wildcard-cert`;

/**
 * 模板变量替换函数
 */
export function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
  }
  return result;
}

/**
 * 生成所有 Devbox YAML 配置
 */
export function generateDevboxYamls(params: {
  devboxName: string;
  urlPrefix: string;
  urlSuffix: string;
  templateID: string;
  image: string;
  cpu?: string;
  memory?: string;
}): {
  devbox: string;
  service: string;
  ingress: string;
} {
  const variables = {
    '{{DEVBOX_NAME}}': params.devboxName,
    '{{URL_PREFIX}}': params.urlPrefix,
    '{{FULL_DOMAIN}}': `${params.urlPrefix}.${params.urlSuffix}`,
    '{{CPU}}': params.cpu || '1000m',
    '{{MEMORY}}': params.memory || '2048Mi',
    '{{TEMPLATE_ID}}': params.templateID,
    '{{IMAGE}}': params.image
  };

  return {
    devbox: replaceTemplateVariables(DEVBOX_TEMPLATE, variables),
    service: replaceTemplateVariables(SERVICE_TEMPLATE, variables),
    ingress: replaceTemplateVariables(INGRESS_TEMPLATE, variables)
  };
}
