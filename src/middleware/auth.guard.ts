import { Context } from 'elysia'

// 创建认证中间件守卫函数
export const authGuard = ({ request, set, path }: Context) => {
  console.log(`正在验证路径 ${path} 的访问权限...`);
  
  const expectedToken = process.env.AUTH_TOKEN;
  
  // 检查 AUTH_TOKEN 环境变量是否配置
  if (!expectedToken) {
    set.status = 500;
    return {
      success: false,
      message: '服务器认证配置错误：AUTH_TOKEN 环境变量未设置',
      error: 'Server authentication configuration error'
    };
  }

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    set.status = 401;
    set.headers['WWW-Authenticate'] = 'Bearer realm="api", error="invalid_token"';
    return {
      success: false,
      message: '无效的认证令牌',
      error: 'Invalid token'
    };
  }

  const token = authorization.substring(7);
  if (token !== expectedToken) {
    set.status = 401;
    set.headers['WWW-Authenticate'] = 'Bearer realm="api", error="invalid_token"';
    return {
      success: false,
      message: '无效的认证令牌',
      error: 'Invalid token'
    };
  }
};