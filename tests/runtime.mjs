import { randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const bundles = new Map();
function bundle(entryPoint) {
  if (!bundles.has(entryPoint)) bundles.set(entryPoint, build({
  entryPoints: [entryPoint], bundle: true, write: false, format: 'esm',
  platform: 'neutral', target: 'es2022', mainFields: ['module', 'main'],
  conditions: ['workerd', 'worker', 'browser'], external: ['node:*', 'cloudflare:*'],
  }));
  return bundles.get(entryPoint);
}

export async function runtime(t, overrides = {}, outbound, entryPoint = 'src/index.ts') {
  const origin = overrides.AUTH_URL ?? 'https://app.example.test';
  const emails = [];
  const mf = new Miniflare(convertV4MiniflareOptions({
    name: 'auth-test', modules: true, script: (await bundle(entryPoint)).outputFiles[0].text,
    compatibilityDate: '2026-09-26', compatibilityFlags: ['nodejs_compat'],
    d1Databases: ['AUTH_DB'], cf: false,
    bindings: {
      AUTH_URL: origin, AUTH_SECRET: randomBytes(48).toString('base64url'),
      RESEND_API_KEY: 'synthetic-key', EMAIL_FROM: 'Auth <auth@example.test>', ...overrides,
    },
    outboundService: async (request) => {
      if (outbound && request.url !== 'https://api.resend.com/emails') return outbound(request);
      if (request.url !== 'https://api.resend.com/emails') throw new Error('Unexpected outbound request');
      emails.push(await request.json());
      return Response.json({ id: crypto.randomUUID() });
    },
  }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('AUTH_DB');
  for (const file of (await readdir('migrations')).filter((x) => x.endsWith('.sql')).sort()) {
    const sql = await readFile(`migrations/${file}`, 'utf8');
    for (const statement of sql.replace(/^--.*$/gm, '').split(';').filter((x) => x.trim())) {
      await db.prepare(statement).run();
    }
  }
  return {
    db, emails, origin,
    async request(path, body, cookie, headers = {}) {
      let timer;
      return Promise.race([
        mf.dispatchFetch(new URL(path, origin).href, {
          method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
          headers: { origin, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}), ...headers },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Request timed out')), 15000); }),
      ]).finally(() => clearTimeout(timer));
    },
  };
}

export const password = 'Synthetic-password-12345!';
export const email = 'alice@example.test';
export const cookie = (response) => response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
export const emailUrl = (message) => message.text.split('\n\n')[1];

export async function verifiedUser(app) {
  const signup = await app.request('/api/auth/sign-up/email', { name: 'Alice', email, password, callbackURL: '/app' });
  if (signup.status !== 200) throw new Error(`Signup failed: ${signup.status}`);
  const verification = await app.request(emailUrl(app.emails.at(-1)));
  if (verification.status !== 302) throw new Error(`Verification failed: ${verification.status}`);
}
