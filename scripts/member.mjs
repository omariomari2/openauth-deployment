import { spawnSync } from 'node:child_process';

const [action, input, target] = process.argv.slice(2);
const email = input?.trim().toLowerCase();
if (!['add', 'remove'].includes(action) || !email || email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['--local', '--remote'].includes(target)) {
  console.error('Usage: npm run member -- <add|remove> <email> <--local|--remote>');
  process.exit(1);
}
const value = `'${email.replaceAll("'", "''")}'`;
const sql = action === 'add'
  ? `INSERT INTO auth_membership (email) VALUES (${value}) ON CONFLICT DO NOTHING;`
  : `DELETE FROM auth_membership WHERE email = ${value}; DELETE FROM auth_session WHERE userId IN (SELECT id FROM auth_user WHERE email = ${value});`;
const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'AUTH_DB', target, '--command', sql], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
