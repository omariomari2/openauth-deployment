import assert from 'node:assert/strict';
import test from 'node:test';
import { runtime } from './runtime.mjs';

const fixture = 'tests/fixtures/mail-worker.ts';

test('concurrent email sends cannot exceed the daily budget', async (t) => {
  const app = await runtime(t, {}, undefined, fixture);
  const day = new Date().toISOString().slice(0, 10);
  await app.db.prepare('INSERT INTO auth_email_budget VALUES (?, ?, 99, 99)').bind(day.slice(0, 7), day).run();
  await Promise.all([0, 1, 2].map((i) => app.request('/mail', { to: `user${i}@example.test` })));
  assert.equal(app.emails.length, 1);
  assert.equal((await app.db.prepare('SELECT daily FROM auth_email_budget').first()).daily, 100);
});

test('monthly budgets and recipient limits stop additional email', async (t) => {
  const app = await runtime(t, {}, undefined, fixture);
  for (let i = 0; i < 6; i++) await app.request('/mail', { to: 'alice@example.test' });
  assert.equal(app.emails.length, 5);
  await app.db.prepare("UPDATE auth_email_budget SET monthly = 3000, day = '2000-01-01'").run();
  await app.request('/mail', { to: 'bob@example.test' });
  assert.equal(app.emails.length, 5);
  assert.equal((await app.db.prepare('SELECT monthly FROM auth_email_budget').first()).monthly, 3000);
});

test('auth responses reject oversized bodies and mismatched hosts without caching errors', async (t) => {
  const app = await runtime(t);
  const response = await app.request('/api/auth/sign-up/email', { name: 'x'.repeat(20000) });
  assert.equal(response.status, 413);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const wrongHost = await app.request('https://wrong.example.test/api/auth/get-session');
  assert.equal(wrongHost.status, 400);
  assert.equal(wrongHost.headers.get('cache-control'), 'no-store');
});
