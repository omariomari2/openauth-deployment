import type { AuthEnv } from './env.ts';

export async function sendAuthEmail(env: AuthEnv, to: string, subject: string, url: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text: `${subject}\n\n${url}` }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Email delivery failed');
}
