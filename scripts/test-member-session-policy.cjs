const assert = require('node:assert/strict');
const fs = require('node:fs');

const auth = fs.readFileSync('lib/member-auth.ts', 'utf8');
const login = fs.readFileSync('app/api/member/login/route.ts', 'utf8');
const form = fs.readFileSync('components/member/login-form.tsx', 'utf8');
const gateway = fs.readFileSync('supabase/functions/qcu-attendance/index.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260916090000_allow_multiple_durable_member_sessions.sql', 'utf8');

assert.match(auth, /MEMBER_SESSION_MAX_AGE = 60 \* 60 \* 24 \* 30/);
assert.doesNotMatch(auth, /MEMBER_WEB_SESSION_MAX_AGE|MEMBER_PWA_SESSION_MAX_AGE/);
assert.match(login, /const rememberMe = true/);
assert.doesNotMatch(form, /display-mode: standalone|isPwa/);
assert.match(gateway, /const MEMBER_SESSION_DAYS = 30/);
assert.match(gateway, /renewalWindow = 7 \* 24 \* 60 \* 60 \* 1000/);
assert.match(gateway, /await rest\("member_sessions",/);
assert.doesNotMatch(gateway, /member_sessions\?on_conflict=email/);
assert.match(migration, /drop index if exists public\.member_sessions_one_per_email_idx/);

console.log('Member session policy checks passed.');
