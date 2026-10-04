# Go-Shop authentication exploration

A private OpenAuth integration for Go-Shop on Cloudflare Workers.
The repository contains authentication code, D1 migrations, KV configuration, and client integration examples.

## Work locally

```sh
npm ci
npm run build
```

Review `wrangler.json` before starting `npm run dev`.
Use local credentials and a separate test database for authentication work.
Run `npm run migrate:local` only after checking the local D1 binding.

## Limits

This integration has not been established as production-ready.
Client helpers and example middleware need security review before use in another application.

The `migrate` script changes the remote database. The `deploy` script also runs a remote migration through `predeploy`.
Do not use deployment commands as local checks.

