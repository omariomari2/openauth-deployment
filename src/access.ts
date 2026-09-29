import type { AuthEnv } from './env.ts';

export async function isMember(env: AuthEnv, email: string): Promise<boolean> {
  if (env.AUTH_SIGNUP_MODE !== 'restricted') return true;
  return Boolean(await env.AUTH_DB.prepare('SELECT email FROM auth_membership WHERE email = ?')
    .bind(email).first());
}

export async function canAccess(env: AuthEnv, user: { id: string; email: string; emailVerified: boolean }): Promise<boolean> {
  if (user.emailVerified && await isMember(env, user.email)) return true;
  await env.AUTH_DB.prepare('DELETE FROM auth_session WHERE userId = ?').bind(user.id).run();
  return false;
}
