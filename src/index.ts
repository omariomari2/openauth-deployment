import { createAuth } from './auth.ts';
import type { AuthEnv } from './env.ts';

export default {
  async fetch(request: Request, env: AuthEnv): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/health') return Response.json({ status: 'ok' });
    if (!path.startsWith('/api/auth/')) return new Response(null, { status: 404 });
    try {
      const response = await createAuth(env).handler(request);
      response.headers.set('cache-control', 'no-store');
      response.headers.set('x-content-type-options', 'nosniff');
      response.headers.set('referrer-policy', 'no-referrer');
      return response;
    } catch {
      return Response.json({ code: 'AUTH_UNAVAILABLE', message: 'Authentication is unavailable' }, { status: 503 });
    }
  },
};
