import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';
import { runtime, cookie, email, verifiedUser } from './runtime.mjs';

const credentials = {
  GITHUB_CLIENT_ID: 'synthetic-github', GITHUB_CLIENT_SECRET: 'synthetic-secret',
  GOOGLE_CLIENT_ID: 'synthetic-google', GOOGLE_CLIENT_SECRET: 'synthetic-secret',
};

async function authorize(app, provider) {
  const response = await app.request('/api/auth/sign-in/social', { provider, callbackURL: '/app' });
  assert.equal(response.status, 200);
  const url = new URL((await response.json()).url);
  assert.equal(url.searchParams.get('redirect_uri'), `${app.origin}/api/auth/callback/${provider}`);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(url.searchParams.get('code_challenge'));
  return { path: `/api/auth/callback/${provider}?code=synthetic-code&state=${url.searchParams.get('state')}`, cookie: cookie(response) };
}

function github(verified = true) {
  return async (request) => {
    if (request.url === 'https://github.com/login/oauth/access_token') {
      const body = new URLSearchParams(await request.text());
      assert.equal(body.get('code'), 'synthetic-code');
      assert.ok(body.get('code_verifier'));
      return Response.json({ access_token: 'synthetic-access', token_type: 'bearer', scope: 'read:user,user:email' });
    }
    if (request.url === 'https://api.github.com/user') return Response.json({ id: 123, name: 'Alice', login: 'alice', email: null });
    if (request.url === 'https://api.github.com/user/emails') return Response.json([{ email, primary: true, verified }]);
    throw new Error(`Unexpected request: ${request.url}`);
  };
}

test('GitHub uses verified private email, PKCE and single-use state', async (t) => {
  const app = await runtime(t, credentials, github());
  const auth = await authorize(app, 'github');
  const callback = await app.request(auth.path, undefined, auth.cookie);
  assert.equal(callback.status, 302);
  assert.equal(new URL(callback.headers.get('location'), app.origin).href, `${app.origin}/app`);
  const session = await app.request('/api/auth/get-session', undefined, cookie(callback));
  assert.equal((await session.json()).user.email, email);
  const replay = await app.request(auth.path, undefined, auth.cookie);
  assert.match(replay.headers.get('location'), /error=/);
  assert.doesNotMatch(cookie(replay), /session_token=.+/);
});

test('social login rejects an unverified email and does not merge a password account', async (t) => {
  const unverified = await runtime(t, credentials, github(false));
  const start = await authorize(unverified, 'github');
  const rejected = await unverified.request(start.path, undefined, start.cookie);
  assert.equal(rejected.status, 403);
  assert.equal((await unverified.db.prepare('SELECT COUNT(*) AS count FROM auth_session').first()).count, 0);
  const existing = await runtime(t, credentials, github());
  await verifiedUser(existing);
  const second = await authorize(existing, 'github');
  const collision = await existing.request(second.path, undefined, second.cookie);
  assert.match(collision.headers.get('location'), /error=/);
  assert.equal((await existing.db.prepare("SELECT COUNT(*) AS count FROM auth_account WHERE providerId = 'github'").first()).count, 0);
});

test('Google exchanges codes and rejects forged client identity tokens', async (t) => {
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...keys.publicKey.export({ format: 'jwk' }), kid: 'synthetic-key', alg: 'RS256', use: 'sig' };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({
    iss: 'https://accounts.google.com', aud: credentials.GOOGLE_CLIENT_ID, sub: 'google-alice',
    email, email_verified: true, name: 'Alice', iat: now, exp: now + 3600,
  })}`;
  const idToken = `${payload}.${sign('RSA-SHA256', Buffer.from(payload), keys.privateKey).toString('base64url')}`;
  const app = await runtime(t, credentials, async (request) => {
    if (request.url === 'https://oauth2.googleapis.com/token') {
      assert.ok(new URLSearchParams(await request.text()).get('code_verifier'));
      return Response.json({ access_token: 'synthetic-access', token_type: 'Bearer', id_token: idToken, expires_in: 3600 });
    }
    if (request.url === 'https://www.googleapis.com/oauth2/v3/certs') return Response.json({ keys: [jwk] });
    throw new Error(`Unexpected request: ${request.url}`);
  });
  const auth = await authorize(app, 'google');
  const callback = await app.request(auth.path, undefined, auth.cookie);
  assert.equal(new URL(callback.headers.get('location'), app.origin).href, `${app.origin}/app`);
  assert.equal((await (await app.request('/api/auth/get-session', undefined, cookie(callback))).json()).user.email, email);
  const rejected = await app.request('/api/auth/sign-in/social', {
    provider: 'google', idToken: { token: `${payload}.invalid-signature` },
  });
  assert.equal(rejected.status, 401);
  assert.equal((await app.db.prepare('SELECT COUNT(*) AS count FROM auth_session').first()).count, 1);
});

test('OAuth rejects external redirects, missing state cookies and partial configuration', async (t) => {
  const app = await runtime(t, credentials, github());
  assert.equal((await app.request('/api/auth/sign-in/social', { provider: 'github', callbackURL: 'https://attacker.example' })).status, 403);
  const auth = await authorize(app, 'github');
  assert.match((await app.request(auth.path)).headers.get('location'), /error=/);
  const misconfigured = await runtime(t, { GOOGLE_CLIENT_ID: 'client-without-secret' });
  assert.equal((await misconfigured.request('/api/auth/get-session')).status, 503);
});

test('restricted membership applies to social signup and returning accounts', async (t) => {
  const app = await runtime(t, { ...credentials, AUTH_SIGNUP_MODE: 'restricted' }, github());
  const blocked = await authorize(app, 'github');
  assert.equal((await app.request(blocked.path, undefined, blocked.cookie)).status, 403);
  assert.equal((await app.db.prepare('SELECT COUNT(*) AS count FROM auth_user').first()).count, 0);
  await app.db.prepare('INSERT INTO auth_membership (email) VALUES (?)').bind(email).run();
  const allowed = await authorize(app, 'github');
  const callback = await app.request(allowed.path, undefined, allowed.cookie);
  assert.equal(callback.headers.get('location'), '/app');
  await app.db.prepare('DELETE FROM auth_membership WHERE email = ?').bind(email).run();
  assert.equal((await app.request('/api/auth/get-session', undefined, cookie(callback))).status, 403);
  const returning = await authorize(app, 'github');
  assert.equal((await app.request(returning.path, undefined, returning.cookie)).status, 403);
});
