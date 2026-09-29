import { sendAuthEmail } from '../../src/mail.ts';
import type { AuthEnv } from '../../src/env.ts';

export default {
  async fetch(request: Request, env: AuthEnv) {
    const { to } = await request.json<{ to: string }>();
    await sendAuthEmail(env, to, 'Verify your email', 'https://app.example.test/synthetic-token');
    return Response.json({ ok: true });
  },
};
