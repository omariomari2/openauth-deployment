import { createAuth } from './auth.ts';
import type { AuthEnv } from './env.ts';
import { canAccess } from './access.ts';

export default {
  async fetch(request: Request, env: AuthEnv): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/health') return Response.json({ status: 'ok' });
    if (!path.startsWith('/api/auth/')) return new Response(null, { status: 404 });
    try {
      const auth = createAuth(env);
      if (env.AUTH_SIGNUP_MODE === 'restricted' && request.headers.has('cookie') && path !== '/api/auth/sign-out') {
        const session = await auth.api.getSession({ headers: request.headers });
        if (session && !await canAccess(env, session.user)) {
          return Response.json({ code: 'ACCESS_DENIED', message: 'Access is restricted' }, { status: 403 });
        }
      }
      const response = await auth.handler(request);
      response.headers.set('cache-control', 'no-store');
      response.headers.set('x-content-type-options', 'nosniff');
      response.headers.set('referrer-policy', 'no-referrer');
      return response;
    } catch {
      return Response.json({ code: 'AUTH_UNAVAILABLE', message: 'Authentication is unavailable' }, { status: 503 });
    }
  },
};
