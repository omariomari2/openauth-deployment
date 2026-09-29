import { createAuth } from '../auth.ts';
import { canAccess } from '../access.ts';
import { authOrigin, type AuthEnv } from '../env.ts';

export type { AuthEnv } from '../env.ts';

export type User = NonNullable<Awaited<ReturnType<ReturnType<typeof createAuth>['api']['getSession']>>>['user'];

export async function getUser(request: Request, env: AuthEnv): Promise<User | null> {
  return (await resolveUser(request, env, false)).user;
}

async function resolveUser(request: Request, env: AuthEnv, refresh: boolean) {
  const { response: session, headers } = await createAuth(env).api.getSession({
    headers: request.headers, returnHeaders: true, query: { disableRefresh: !refresh },
  });
  const user = session && await canAccess(env, session.user) ? session.user : null;
  return { user, headers };
}

export function withAuth<E extends AuthEnv>(handler: (request: Request, env: E, ctx: ExecutionContext, user: User) => Promise<Response> | Response) {
  return async (request: Request, env: E, ctx: ExecutionContext): Promise<Response> => {
    let user: User | null;
    let headers: Headers;
    try {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.get('origin') !== authOrigin(env)) {
        return Response.json({ code: 'INVALID_ORIGIN' }, { status: 403, headers: { 'cache-control': 'no-store' } });
      }
      ({ user, headers } = await resolveUser(request, env, true));
    } catch {
      return Response.json({ code: 'AUTH_UNAVAILABLE' }, { status: 503, headers: { 'cache-control': 'no-store' } });
    }
    if (!user) return Response.json({ code: 'UNAUTHORIZED' }, { status: 401, headers: { 'cache-control': 'no-store' } });
    const result = await handler(request, env, ctx, user);
    const response = new Response(result.body, result);
    for (const cookie of headers.getSetCookie()) response.headers.append('set-cookie', cookie);
    response.headers.set('cache-control', 'no-store');
    return response;
  };
}
