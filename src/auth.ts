import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { APIError } from 'better-auth/api';
import { authOrigin, type AuthEnv } from './env.ts';
import { sendAuthEmail } from './mail.ts';

export function authOptions(env: AuthEnv) {
  const origin = authOrigin(env);
  return {
    database: env.AUTH_DB,
    secret: env.AUTH_SECRET,
    baseURL: origin,
    basePath: '/api/auth',
    trustedOrigins: [origin],
    logger: { disabled: true },
    user: { modelName: 'auth_user' },
    account: { modelName: 'auth_account', accountLinking: { enabled: false } },
    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? {
        google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
      } : {}),
      ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET ? {
        github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
      } : {}),
    },
    databaseHooks: {
      session: { create: { before: async (session) => {
        const user = await env.AUTH_DB.prepare('SELECT emailVerified FROM auth_user WHERE id = ?')
          .bind(session.userId).first<{ emailVerified: number }>();
        if (!user?.emailVerified) throw new APIError('FORBIDDEN', { message: 'Email verification required' });
      } } },
    },
    verification: { modelName: 'auth_verification' },
    session: {
      modelName: 'auth_session',
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: { enabled: true, storage: 'database', modelName: 'auth_rate_limit' },
    advanced: {
      cookiePrefix: 'auth-gate',
      useSecureCookies: origin.startsWith('https:'),
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      database: { validateSchema: false },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 30,
      sendResetPassword: ({ user, url }) => sendAuthEmail(env, user.email, 'Reset your password', url),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60,
      sendVerificationEmail: ({ user, url }) => sendAuthEmail(env, user.email, 'Verify your email', url),
    },
  } satisfies BetterAuthOptions;
}

export function createAuth(env: AuthEnv) {
  return betterAuth(authOptions(env));
}
