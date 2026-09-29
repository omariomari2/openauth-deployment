import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { getMigrations } from 'better-auth/db/migration';
import { authOptions } from '../src/auth.ts';

test('migrations satisfy the installed auth schema', async (t) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  for (const file of (await readdir('migrations')).filter((name) => name.endsWith('.sql')).sort()) {
    db.exec(await readFile(`migrations/${file}`, 'utf8'));
  }
  const options = authOptions({
    AUTH_DB: db, AUTH_URL: 'https://app.example.test',
    AUTH_SECRET: 'synthetic-schema-test-secret-12345',
    RESEND_API_KEY: 'synthetic-key', EMAIL_FROM: 'auth@example.test',
  });
  const migrations = await getMigrations(options);
  assert.deepEqual(migrations.toBeCreated, []);
  assert.deepEqual(migrations.toBeAdded, []);
  assert.deepEqual(migrations.toBeAddedIndexes, []);
});
