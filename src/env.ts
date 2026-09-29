export interface AuthEnv {
  AUTH_DB: D1Database;
  AUTH_URL: string;
  AUTH_SECRET: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
}

export function authOrigin(env: AuthEnv): string {
  const url = new URL(env.AUTH_URL);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      !env.AUTH_SECRET || env.AUTH_SECRET.length < 32 ||
      !env.RESEND_API_KEY || !env.EMAIL_FROM || /[\r\n]/.test(env.EMAIL_FROM)) {
    throw new Error('Invalid auth configuration');
  }
  return url.origin;
}
