import type { AuthEnv } from './env.ts';

export async function sendAuthEmail(env: AuthEnv, to: string, subject: string, url: string) {
  try {
    if (!await reserveEmail(env, to)) {
      console.warn('auth_email_limit_reached');
      return;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text: `${subject}\n\n${url}` }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) console.error('auth_email_delivery_failed', response.status);
  } catch {
    console.error('auth_email_delivery_failed');
  }
}

async function reserveEmail(env: AuthEnv, email: string): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase()));
  const key = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const recipient = await env.AUTH_DB.prepare(`
    INSERT INTO auth_email_recipient (key, day, count) VALUES (?, ?, 1)
    ON CONFLICT(key) DO UPDATE SET day = excluded.day,
      count = CASE WHEN day = excluded.day THEN count + 1 ELSE 1 END
    WHERE day != excluded.day OR count < 5
    RETURNING count
  `).bind(key, day).first();
  if (!recipient) return false;
  const budget = await env.AUTH_DB.prepare(`
    INSERT INTO auth_email_budget (month, day, daily, monthly) VALUES (?, ?, 1, 1)
    ON CONFLICT(month) DO UPDATE SET day = excluded.day, monthly = monthly + 1,
      daily = CASE WHEN day = excluded.day THEN daily + 1 ELSE 1 END
    WHERE monthly < 3000 AND (day != excluded.day OR daily < 100)
    RETURNING daily
  `).bind(month, day).first();
  return Boolean(budget);
}
