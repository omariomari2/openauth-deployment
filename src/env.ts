export interface AuthEnv {
  AUTH_DB: D1Database;
  AUTH_URL: string;
  AUTH_SECRET: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  AUTH_SIGNUP_MODE?: 'public' | 'restricted';
}

export function authOrigin(env: AuthEnv): string {
  const url = new URL(env.AUTH_URL);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      !env.AUTH_SECRET || env.AUTH_SECRET.length < 32 ||
      !env.RESEND_API_KEY || !env.EMAIL_FROM || /[\r\n]/.test(env.EMAIL_FROM) ||
      Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET) ||
      Boolean(env.GITHUB_CLIENT_ID) !== Boolean(env.GITHUB_CLIENT_SECRET) ||
      (env.AUTH_SIGNUP_MODE !== undefined && !['public', 'restricted'].includes(env.AUTH_SIGNUP_MODE))) {
    throw new Error('Invalid auth configuration');
  }
  return url.origin;
}
