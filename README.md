private OpenAuth integration for Go-Shop on Cloudflare Workers.
The repository contains authentication code, D1 migrations, KV configuration, and client integration examples.

## Work locally

```sh
npm ci
npm run build
```

Review `wrangler.json` before starting `npm run dev`.
Use local credentials and a separate test database for authentication work.
Run `npm run migrate:local` only after checking the local D1 binding.
