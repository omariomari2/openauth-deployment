import authGate from '../../src/index.ts';
import { withAuth } from '../../src/middleware/auth.ts';
import type { AuthEnv } from '../../src/env.ts';

const profile = withAuth((_request, _env, _ctx, user) => Response.json({ id: user.id, email: user.email, name: user.name }));

export default {
  fetch(request: Request, env: AuthEnv, ctx: ExecutionContext): Promise<Response> {
    if (new URL(request.url).pathname === '/api/profile') return profile(request, env, ctx);
    return authGate.fetch(request, env);
  },
};
