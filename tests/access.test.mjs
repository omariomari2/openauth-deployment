import assert from 'node:assert/strict';
import test from 'node:test';
import { runtime, verifiedUser, email, password, cookie } from './runtime.mjs';

const example = 'examples/api-protection/worker.ts';

test('restricted access blocks signup and revokes sessions after removal', async (t) => {
  const app = await runtime(t, { AUTH_SIGNUP_MODE: 'restricted' }, undefined, example);
  assert.equal((await app.request('/api/auth/sign-up/email', { email, password, name: 'Alice' })).status, 200);
  assert.equal((await app.db.prepare('SELECT COUNT(*) AS count FROM auth_user').first()).count, 0);
  assert.equal(app.emails.length, 0);
  await app.db.prepare('INSERT INTO auth_membership (email) VALUES (?)').bind(email.toUpperCase()).run();
  await verifiedUser(app);
  const session = cookie(await app.request('/api/auth/sign-in/email', { email, password }));
  assert.equal((await app.request('/api/profile', undefined, session)).status, 200);
  await app.db.prepare('DELETE FROM auth_membership WHERE email = ?').bind(email).run();
  assert.equal((await app.request('/api/auth/get-session', undefined, session)).status, 403);
  assert.equal((await app.request('/api/profile', undefined, session)).status, 401);
  assert.equal((await app.request('/api/auth/sign-in/email', { email, password })).status, 403);
  await app.db.prepare('INSERT INTO auth_membership (email) VALUES (?)').bind(email).run();
  assert.equal((await app.request('/api/profile', undefined, session)).status, 401);
});

test('the drop-in Worker protects routes and rejects cross-site mutations', async (t) => {
  const app = await runtime(t, {}, undefined, example);
  assert.equal((await app.request('/api/profile')).status, 401);
  await verifiedUser(app);
  const session = cookie(await app.request('/api/auth/sign-in/email', { email, password }));
  const profile = await app.request('/api/profile', undefined, session);
  assert.equal((await profile.json()).email, email);
  assert.equal(profile.headers.get('cache-control'), 'no-store');
  assert.equal((await app.request('/api/profile', {}, session, { origin: 'https://attacker.example' })).status, 403);
  const other = await runtime(t, {}, undefined, example);
  assert.equal((await other.request('/api/profile', undefined, session)).status, 401);
});

test('an invalid access mode fails closed', async (t) => {
  const app = await runtime(t, { AUTH_SIGNUP_MODE: 'restrictd' });
  assert.equal((await app.request('/api/auth/get-session')).status, 503);
});

test('session renewal reaches the browser through protected routes and restricted auth routes', async (t) => {
  for (const mode of ['public', 'restricted']) {
    const app = await runtime(t, { AUTH_SIGNUP_MODE: mode }, undefined, example);
    await app.db.prepare('INSERT INTO auth_membership (email) VALUES (?)').bind(email).run();
    await verifiedUser(app);
    const session = cookie(await app.request('/api/auth/sign-in/email', { email, password }));
    const expires = new Date(Date.now() + 3600000).toISOString();
    await app.db.prepare('UPDATE auth_session SET expiresAt = ?').bind(expires).run();
    const path = mode === 'public' ? '/api/profile' : '/api/auth/get-session';
    const renewed = await app.request(path, undefined, session);
    assert.equal(renewed.status, 200);
    assert.match(renewed.headers.getSetCookie().join(';'), /session_token=.*Max-Age=604800/i);
    const updated = await app.db.prepare('SELECT expiresAt FROM auth_session').first();
    assert.ok(new Date(updated.expiresAt).getTime() > Date.now() + 6 * 86400000);
  }
});
