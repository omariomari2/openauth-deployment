# Auth Gate

A reusable authentication backend for small projects on Cloudflare Workers. Build your own login screens, mount `/api/auth/*` in your project, and protect your API routes with `withAuth`.

The intended use is personal apps and small projects with roughly 600 users or fewer. Each project has its own users, database, and secret. The implementation uses **Cloudflare Workers + D1**, [Better Auth](https://www.better-auth.com/), and [Resend](https://resend.com/) for email. Better Auth and Resend are third-party services/libraries; Cloudflare provides the runtime and database.

## What it handles

- Email/password signup, required email verification, login, logout, and password resets.
- Google and GitHub login with verified email addresses and automatic account linking disabled.
- Public signup or an email allowlist for private projects.
- HttpOnly cookie sessions, Secure cookies on HTTPS, and session revocation after password resets or membership removal.
- Database-backed request limits and email budgets.
- A frontend client and a Worker middleware helper. Your app supplies its pages and business permissions.

Auth endpoints and your frontend must share an origin, such as `https://app.example.com`. This is a per-project auth gate; it does not provide a shared identity service across unrelated domains. KV and Cloudflare Access are not required.

## Run locally

Use Node.js 24+ and npm 11.

```sh
npm ci
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Create an ignored `.dev.vars` file, using the generated value for `AUTH_SECRET`:

```dotenv
AUTH_SECRET="paste-generated-secret-here"
RESEND_API_KEY="re_your_key"
EMAIL_FROM="Your App <auth@your-domain.com>"
```

Verify your sending domain in Resend and use an address on that domain. Local development sends real email through Resend; the automated tests mock external email and OAuth services.

```sh
npm run migrate:local
npm run dev
```

The API runs at `http://localhost:8787`, matching the default `AUTH_URL` in `wrangler.json`. When connecting your frontend, serve it under the same origin or use a development proxy that preserves that public origin. A frontend on another port is a different origin.

## Drop it into a project

Use [the Worker example](examples/api-protection/worker.ts) as the starting point. It routes auth requests to `authGate.fetch(request, env, ctx)` and protects `/api/profile` with `withAuth`. Keep your application's other routes in its own Worker handler.

```ts
import { withAuth } from './src/middleware/auth.ts';

const profile = withAuth((_request, _env, _ctx, user) =>
  Response.json({ id: user.id, email: user.email, name: user.name }),
);
```

The app Worker needs the `AUTH_DB` binding and auth configuration below. Mounting this code into an existing Worker also requires the `better-auth` dependency and `nodejs_compat` compatibility flag from this repository. `withAuth` checks the session and membership on each request, forwards renewed cookies, and checks the origin of requests that can modify data. `getUser(request, env)` is available for a session read without renewal.

On the frontend:

```ts
import { createAuthClient } from './src/client-sdk.ts';

const auth = createAuthClient();

const { data, error } = await auth.signIn.email({
  email: 'you@example.com',
  password: 'your-password-here',
});

const session = await auth.getSession();
await auth.signOut();
```

Handle each operation's `error` in your UI. The client uses cookies; you do not need to store auth tokens in local storage. [The frontend example](examples/frontend-integration/client.ts) also includes signup, social login, and password-reset calls. Build the `/login`, `/app`, and `/reset-password` pages used by those examples, or change their callback paths to yours.

Passwords must be 12–128 characters. Verification links last one hour; reset tokens last 30 minutes and can be consumed once. Verification does not automatically sign the user in. Sessions last seven days and renew after a day of activity through the session endpoint or protected middleware.

## Configuration

| Setting | Purpose |
| --- | --- |
| `AUTH_DB` | D1 database binding; use a separate database for each project. |
| `AUTH_URL` | Exact frontend/Worker origin, with no path, query, or fragment. HTTPS is required except on localhost. |
| `AUTH_SECRET` | Random secret of at least 32 characters; generate a different one for each project. |
| `RESEND_API_KEY` | Resend API key. Required by the current configuration. |
| `EMAIL_FROM` | Sender address on your verified Resend domain. |
| `AUTH_SIGNUP_MODE` | `public` (default) or `restricted`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google login; supply both or neither. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Optional GitHub login; supply both or neither. |

Register these exact callback URLs with the providers, replacing the origin with your `AUTH_URL`:

```text
https://app.example.com/api/auth/callback/google
https://app.example.com/api/auth/callback/github
```

Provider callbacks are handled by the backend. Your frontend receives the final redirect specified by `callbackURL`, which must stay on your app's origin.

### Restricted projects

Set `AUTH_SIGNUP_MODE` to `restricted`, then manage allowed emails:

```sh
npm run member -- add person@example.com --local
npm run member -- remove person@example.com --local
```

Use `--remote` to manage the deployed database. Both password and social login obey the allowlist. Removing a member also deletes their sessions. Signup returns a generic response for disallowed or existing addresses; a success response does not necessarily mean an account was created.

## Deploy on Cloudflare

1. Stay on the Workers Free and Resend Free plans. Verify your sending domain in Resend.
2. Run `npx wrangler login`, then `npx wrangler d1 create my-project-auth`.
3. Set a unique Worker `name` in `wrangler.json`. Update the `AUTH_DB` entry with the created database's `database_name` and `database_id`.
4. Set `vars.AUTH_URL` to your public app origin and add `vars.EMAIL_FROM`. Set `vars.AUTH_SIGNUP_MODE` if the project is restricted.
5. Mount the auth handler in your app Worker and route it to that origin. The repository's default `src/index.ts` serves auth endpoints and `/health`; your app must serve its frontend and protected business routes.
6. Add secrets, apply migrations, and deploy:

```sh
npx wrangler secret put AUTH_SECRET
npx wrangler secret put RESEND_API_KEY
npm run migrate:remote
npm run deploy
```

For social login, also set the corresponding `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` or `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` using `wrangler secret put`. Keep secrets out of `wrangler.json` and Git.

### Free-tier limits

| Service | Free allowance |
| --- | --- |
| [Workers](https://developers.cloudflare.com/workers/platform/limits/) | 100,000 requests/day per account; 10 ms CPU per request. |
| [D1](https://developers.cloudflare.com/d1/platform/pricing/) | 5 million rows read/day, 100,000 rows written/day, 5 GB total storage. |
| [Resend](https://resend.com/pricing) | 3,000 transactional emails/month, capped at 100/day. |

The code reserves at most 100 email sends/day, 3,000/month, and five/day per recipient, using UTC calendar boundaries. These guards apply per deployment; projects sharing a Resend account still share its provider quota. Failed sends can consume the local budget. Email runs in the background, so request success does not guarantee delivery; check Worker logs for `auth_email_limit_reached` or `auth_email_delivery_failed`.

Free service limits and an existing domain are the target, not a guarantee based on user count. Production password-hashing CPU usage still needs measurement on Workers Free. The local tests do not prove it fits the 10 ms limit. Domain registration/renewal is separate from hosting costs.

## Endpoints

All auth routes are under `/api/auth`. POST requests use JSON.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/sign-up/email` | Create a password account and request verification. |
| POST | `/sign-in/email` | Sign in after email verification. |
| POST | `/sign-in/social` | Start Google or GitHub login. |
| GET | `/get-session` | Read or renew the current session. |
| POST | `/sign-out` | Revoke the current session. |
| POST | `/send-verification-email` | Request another verification email. |
| GET | `/verify-email` | Handle the emailed verification link. |
| POST | `/request-password-reset` | Request a reset email. |
| POST | `/reset-password` | Consume a reset token and change the password. |

`GET /health` is a liveness endpoint. It does not validate your database, credentials, or email delivery.

## Checks and migration

```sh
npm test
npm run check
npm audit --omit=dev
```

The suite covers auth flows in the local Workers runtime, provider callbacks with mocked external services, access removal, cookie renewal, request/email limits, the D1 schema, and the frontend bundle. `check` runs TypeScript and a Wrangler deployment dry run. Live provider/email flows and production capacity require separate verification.

This replaces the original OpenAuth/Go-Shop implementation. Old migrations remain to preserve existing tables; new auth data uses `auth_*` tables. Existing OpenAuth users and sessions are not migrated automatically. The former token SDK, `/userinfo` endpoint, and role helpers are no longer part of this implementation.
