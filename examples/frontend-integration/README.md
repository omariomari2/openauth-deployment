# Frontend integration

[client.ts](client.ts) creates a Better Auth client for your app's same-origin `/api/auth` endpoints. It includes calls for signup, password login, Google/GitHub login, and password resets.

Connect these functions to your own forms and handle the returned `error` before showing success. Build the `/login`, `/app`, and `/reset-password` pages referenced in the example, or change the callback paths. After following a reset email, read the `token` query parameter on your reset page and pass it to `resetPassword` when the user submits their new password.

Use `auth.getSession()` to read the current session and `auth.signOut()` to log out. Session credentials travel in HttpOnly cookies; the frontend does not manage or persist auth tokens. Protect business routes on the server with [the Worker middleware example](../api-protection/worker.ts).

See the [project README](../../README.md) for setup, environment variables, allowlist management, and deployment limits.
