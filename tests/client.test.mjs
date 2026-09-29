import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createAuthClient } from '../src/client-sdk.ts';
import { runtime, cookie, emailUrl, password, email } from './runtime.mjs';

test('the frontend client completes cookie-based authentication against the Worker', async (t) => {
  const app = await runtime(t, {}, undefined, 'examples/api-protection/worker.ts');
  let sessionCookie;
  const client = createAuthClient({
    baseURL: app.origin,
    fetchOptions: {
      customFetchImpl: async (url, init) => {
        assert.equal(init.credentials, 'include');
        const response = await app.request(String(url), init.body ? JSON.parse(init.body) : undefined, sessionCookie);
        if (response.headers.getSetCookie().length) sessionCookie = cookie(response);
        return response;
      },
    },
  });
  assert.equal((await client.signUp.email({ email, password, name: 'Alice' })).error, null);
  await app.waitForEmails(1);
  await app.request(emailUrl(app.emails[0]));
  assert.equal((await client.signIn.email({ email, password })).error, null);
  assert.equal((await client.getSession()).data.user.email, email);
  assert.equal((await app.request('/api/profile', undefined, sessionCookie)).status, 200);
  assert.equal((await client.signOut()).error, null);
  assert.equal((await client.getSession()).data, null);
});

test('the frontend entry builds without server credentials or Node dependencies', async () => {
  const result = await build({ entryPoints: ['examples/frontend-integration/client.ts'], bundle: true, write: false, platform: 'browser', format: 'esm', metafile: true });
  assert.deepEqual(Object.keys(result.metafile.inputs).filter((path) => path.startsWith('src/')), ['src/client-sdk.ts']);
  assert.doesNotMatch(result.outputFiles[0].text, /RESEND_API_KEY|node:crypto|AUTH_DB/);
});
