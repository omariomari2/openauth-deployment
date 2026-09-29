import { createAuth } from './auth.ts';
import { authOrigin, type AuthEnv } from './env.ts';
import { canAccess } from './access.ts';
import { boundedRequest, privateResponse } from './http.ts';

export default {
  async fetch(request: Request, env: AuthEnv, ctx: ExecutionContext): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/health' && request.method === 'GET') return Response.json({ status: 'ok' });
    if (!path.startsWith('/api/auth/')) return new Response(null, { status: 404 });
    try {
      if (new URL(request.url).origin !== authOrigin(env)) {
        return privateResponse(Response.json({ code: 'INVALID_HOST' }, { status: 400 }));
      }
      const bounded = await boundedRequest(request);
      if (!bounded) return privateResponse(Response.json({ code: 'PAYLOAD_TOO_LARGE' }, { status: 413 }));
      request = bounded;
      const auth = createAuth(env, ctx);
      if (env.AUTH_SIGNUP_MODE === 'restricted' && request.headers.has('cookie') && path !== '/api/auth/sign-out') {
        const session = await auth.api.getSession({ headers: request.headers });
        if (session && !await canAccess(env, session.user)) {
          return privateResponse(Response.json({ code: 'ACCESS_DENIED', message: 'Access is restricted' }, { status: 403 }));
        }
      }
      const response = await auth.handler(request);
      return privateResponse(response);
    } catch {
      console.error('auth_request_failed');
      return privateResponse(Response.json({ code: 'AUTH_UNAVAILABLE', message: 'Authentication is unavailable' }, { status: 503 }));
    }
  },
};
