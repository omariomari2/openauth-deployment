import assert from 'node:assert/strict';
import test from 'node:test';
import { runtime, verifiedUser, password, email, cookie, emailUrl } from './runtime.mjs';

test('password accounts require verification and establish revocable sessions', async (t) => {
  const app = await runtime(t);
  const signup = await app.request('/api/auth/sign-up/email', { name: 'Alice', email, password, callbackURL: '/app' });
  assert.equal(signup.status, 200);
  assert.equal((await signup.json()).token, null);
  await app.waitForEmails(1);
  assert.equal(app.emails.length, 1);
  assert.deepEqual(app.emails[0].to, [email]);
  assert.equal((await app.request('/api/auth/sign-in/email', { email, password })).status, 403);
  assert.equal((await app.request(emailUrl(app.emails.at(-1)))).status, 302);
  assert.equal((await app.request('/api/auth/sign-in/email', { email, password: 'incorrect-password!' })).status, 401);
  const login = await app.request('/api/auth/sign-in/email', { email, password });
  assert.equal(login.status, 200);
  assert.match(login.headers.getSetCookie().join(';'), /HttpOnly/i);
  assert.match(login.headers.getSetCookie().join(';'), /Secure/i);
  const sessionCookie = cookie(login);
  const session = await app.request('/api/auth/get-session', undefined, sessionCookie);
  assert.equal((await session.json()).user.email, email);
  assert.equal(session.headers.get('cache-control'), 'no-store');
  assert.equal((await app.request('/api/auth/sign-out', {}, sessionCookie)).status, 200);
  assert.equal(await (await app.request('/api/auth/get-session', undefined, sessionCookie)).json(), null);
});

test('reset tokens are consumed and old sessions and passwords stop working', async (t) => {
  const app = await runtime(t);
  await verifiedUser(app);
  const sessionCookie = cookie(await app.request('/api/auth/sign-in/email', { email, password }));
  assert.equal((await app.request('/api/auth/request-password-reset', { email, redirectTo: '/reset' })).status, 200);
  await app.waitForEmails(2);
  const redirect = await app.request(emailUrl(app.emails.at(-1)));
  const token = new URL(redirect.headers.get('location'), app.origin).searchParams.get('token');
  const reset = { token, newPassword: 'New-synthetic-password-54321!' };
  assert.equal((await app.request('/api/auth/reset-password', reset)).status, 200);
  assert.equal((await app.request('/api/auth/reset-password', reset)).status, 400);
  assert.equal(await (await app.request('/api/auth/get-session', undefined, sessionCookie)).json(), null);
  assert.equal((await app.request('/api/auth/sign-in/email', { email, password })).status, 401);
  assert.equal((await app.request('/api/auth/sign-in/email', { email, password: reset.newPassword })).status, 200);
});

test('untrusted origins and repeated password guesses are rejected', async (t) => {
  const app = await runtime(t);
  assert.equal((await app.request('/api/auth/sign-in/email', { email, password }, undefined, { origin: 'https://attacker.example' })).status, 403);
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await app.request('/api/auth/sign-in/email', { email, password })).status);
  assert.equal(statuses.at(-1), 429);
});

test('missing configuration fails without leaking secrets or stack traces', async (t) => {
  const app = await runtime(t, { AUTH_SECRET: 'short' });
  const response = await app.request('/api/auth/get-session');
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { code: 'AUTH_UNAVAILABLE', message: 'Authentication is unavailable' });
  assert.equal((await app.request('/_probe/setup')).status, 404);
});
