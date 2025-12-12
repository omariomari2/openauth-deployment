# Go-Shop OpenAuth Server

Production-ready authentication server for Go-Shop e-commerce platform, deployed on Cloudflare Workers with OpenAuth.

![Go-Shop Logo](https://ik.imagekit.io/dr5fryhth/logo1.png?updatedAt=1760472240746)

## Overview

This is a custom OpenAuth deployment for the **Go-Shop** e-commerce platform. It provides scalable, secure authentication using [OpenAuth](https://openauth.js.org/) on Cloudflare Workers, with data stored in [D1](https://developers.cloudflare.com/d1/) (SQLite) and [KV](https://developers.cloudflare.com/kv/) namespaces. The server supports both email/password and Google OAuth authentication flows.

### Key Features

- **Dual Authentication Methods**: Email/password and Google OAuth
- **E-commerce Ready**: Extended user schema with first name, last name, avatar, role, and address support
- **Client SDK**: TypeScript SDK for easy frontend integration (React, Vue, Angular, Vanilla JS)
- **Authentication Middleware**: Route protection, role-based access control, and rate limiting
- **Token Validation Helpers**: JWT parsing, expiration checks, and user extraction utilities
- **CORS Support**: Built-in CORS headers for cross-origin requests
- **Production Ready**: Observability enabled by default for monitoring and debugging

### Architecture

```
┌─────────────────┐
│   Frontend App  │
│   (Go-Shop UI)  │
└────────┬────────┘
         │
         │ OAuth Flow / API Calls
         │
┌────────▼────────────────────────────┐
│   OpenAuth Worker                   │
│   (Cloudflare Workers)              │
│                                     │
│   • Password Provider               │
│   • Google OAuth Provider           │
│   • User Management                 │
│   • Token Issuance                  │
└──────┬──────────────────┬───────────┘
       │                  │
       │                  │
   ┌───▼────┐      ┌──────▼──────┐
   │   D1   │      │     KV      │
   │Database│      │  Namespace  │
   │(Users) │      │  (Sessions) │
   └────────┘      └─────────────┘
```

## Setup Steps

### Prerequisites

- Node.js 18+ installed
- Cloudflare account with Workers enabled
- Google Cloud Console account (for OAuth)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `https://your-worker.workers.dev/callback`
5. Copy your Client ID and Client Secret

### 3. Create Cloudflare Resources

```bash
npm run db:create AUTH_DBD1Database

npm run kv:create AUTH_STORAGE
```

Update `wrangler.json` with the generated IDs.

### 4. Set Up Secrets

```bash
npm run setup:secrets
```

When prompted, enter:
- Google Client ID
- Google Client Secret

### 5. Run Database Migrations

```bash
npm run migrate
```

This creates the user table with extended e-commerce fields:
- `id`, `email`, `created_at` (base fields)
- `first_name`, `last_name`, `avatar_url`, `last_login` (extended fields)
- Support for ecommerce tables (products, orders, cart, addresses)

### 6. Deploy to Cloudflare

```bash
npm run deploy
```

Your OpenAuth server is now live at `https://openauth-deployment.workers.dev`

## Usage

### Frontend Integration

#### Using the Client SDK

```typescript
import { AuthClient } from './src/client-sdk';

const auth = new AuthClient({
  authServerUrl: 'https://openauth-deployment.workers.dev',
  clientId: 'go-shop',
  redirectUri: window.location.origin + '/auth/callback',
  scope: 'openid profile email'
});

auth.login();

const user = await auth.getCurrentUser();
console.log(user);
```

#### Using the React Hook

```typescript
import { useAuth } from './src/client-sdk';

function App() {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth({
    authServerUrl: 'https://openauth-deployment.workers.dev',
    clientId: 'go-shop',
    redirectUri: window.location.origin + '/auth/callback'
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {isAuthenticated ? (
        <>
          <p>Welcome, {user?.first_name}!</p>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <button onClick={login}>Login</button>
      )}
    </div>
  );
}
```

### API Protection

Use the middleware to protect your API routes:

```typescript
import { requireAuth, requireRole } from './src/middleware/auth';

export default {
  async fetch(request: Request, env: Env) {
    const authResult = await requireAuth(request, env);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const user = authResult.user;
    return new Response(`Hello, ${user.email}!`);
  }
};
```

### Role-Based Access Control

```typescript
import { requireRole } from './src/middleware/auth';

const adminResult = await requireRole(request, env, 'admin');
if (!adminResult.authorized) {
  return adminResult.response;
}
```

## Project Structure

```
openauth-deployment/
├── src/
│   ├── index.ts                    # Main OpenAuth server
│   ├── client-sdk.ts               # Frontend SDK with React hooks
│   ├── middleware/
│   │   └── auth.ts                 # Authentication & RBAC middleware
│   └── helpers/
│       └── token-validation.ts     # JWT utilities
├── migrations/
│   ├── 0001_create_user_table.sql
│   ├── 0002_extend_user_for_ecommerce.sql
│   └── 0003_create_ecommerce_tables.sql
├── examples/
│   ├── frontend-integration/
│   │   ├── react-example.tsx
│   │   ├── vanilla-js.html
│   │   └── README.md
│   └── api-protection/
│       └── worker.ts
├── wrangler.json                   # Cloudflare Worker config
├── package.json
└── tsconfig.json
```

## Available Scripts

### Development
- `npm run dev` - Start local development server
- `npm run build` - Build TypeScript files
- `npm run check` - Validate deployment (dry-run)

### Deployment
- `npm run deploy` - Deploy to production
- `npm run deploy:dev` - Deploy to development environment
- `npm run deploy:prod` - Deploy to production environment

### Database Management
- `npm run migrate` - Apply migrations to remote database
- `npm run migrate:local` - Apply migrations locally
- `npm run db:query` - Execute SQL query
- `npm run db:tables` - List all tables
- `npm run db:users` - View users table

### Secrets Management
- `npm run setup:secrets` - Configure OAuth secrets
- `npm run secrets:list` - List configured secrets

### Monitoring
- `npm run logs` - Tail production logs
- `npm run logs:dev` - Tail development logs

## Configuration

### Theme Customization

The authentication UI is branded for Go-Shop:

```typescript
theme: {
  title: "Go-Shop",
  primary: "#FFF8DC",
  favicon: "https://ik.imagekit.io/dr5fryhth/logo1.png?updatedAt=1760472240746",
  logo: {
    dark: "https://ik.imagekit.io/dr5fryhth/logo1.png?updatedAt=1760472240746",
    light: "https://ik.imagekit.io/dr5fryhth/logo1.png?updatedAt=1760472240746",
  },
}
```

### Environment Variables

Required secrets (set via `wrangler secret put`):
- `GOOGLE_CLIENT_ID` - Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth Client Secret

Bindings (configured in `wrangler.json`):
- `AUTH_STORAGE` - KV namespace for session storage
- `AUTH_DB` - D1 database for user data

## API Endpoints

### OpenAuth Endpoints

- `GET /` - Initiates OAuth flow (redirects to `/authorize`)
- `GET /authorize` - Authorization endpoint
- `POST /token` - Token exchange endpoint
- `GET /userinfo` - Get current user information
- `GET /callback` - OAuth callback handler

### Supported OAuth Flows

- Authorization Code Flow
- Refresh Token Flow
- Password Grant (email verification)
- Google OAuth 2.0

## Security Features

- **CSRF Protection**: State parameter validation
- **Rate Limiting**: Built-in rate limiting middleware
- **Token Expiration**: Automatic token refresh
- **Secure Token Storage**: httpOnly cookie support
- **CORS**: Configurable cross-origin policies
- **Input Sanitization**: User data validation with Valibot

## Monitoring & Debugging

View real-time logs:

```bash
npm run logs
```

Query database:

```bash
npm run db:query "SELECT * FROM user WHERE email = 'user@example.com';"
```

Check user count:

```bash
npm run db:query "SELECT COUNT(*) as total FROM user;"
```

## Examples

See the `examples/` directory for:
- **Frontend Integration**: React, Vue, Angular, Vanilla JS examples
- **API Protection**: Worker middleware examples
- **Full OAuth Flow**: Complete authentication flow demonstrations

## Troubleshooting

### Common Issues

**CORS Errors**
- Ensure your worker has proper CORS headers
- Use the `corsHeaders` helper from middleware

**Token Refresh Failures**
- Check that refresh tokens are being stored properly
- Verify token expiration times

**Google OAuth Issues**
- Verify redirect URI matches exactly
- Check that Google OAuth credentials are correct
- Ensure Google+ API is enabled

**Database Issues**
- Run migrations: `npm run migrate`
- Check table structure: `npm run db:tables`

### Debug Mode

Enable debug logging in the worker:

```typescript
console.log('Auth attempt:', { email, timestamp: Date.now() });
```

View logs in real-time:

```bash
npm run logs
```

## ARM Architecture Support

If you're on ARM CPU (Apple Silicon, Windows ARM), note that Wrangler's `workerd` may not support ARM64. Consider:
- Using GitHub Codespaces
- WSL2 on Windows
- Docker containers
- Direct deployment workflow (edit locally, deploy remotely)

## Contributing

This is a private deployment for Go-Shop. For OpenAuth issues and contributions, visit the [OpenAuth repository](https://github.com/openauthjs/openauth).

## License

This deployment is part of the Go-Shop e-commerce platform. OpenAuth is MIT licensed.
