// Run against your own disposable test backend, never a production farm.
// E2E_BASE_URL, E2E_EMAIL and E2E_PASSWORD are required. Creates test cow records.
import assert from 'node:assert/strict';
const base = process.env.E2E_BASE_URL;
if (!base || !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD)
  throw new Error('Set E2E_BASE_URL, E2E_EMAIL and E2E_PASSWORD for a disposable backend.');
let cookie = '';
async function request(path, method = 'GET', body) {
  const r = await fetch(base + path, {
    method,
    redirect: 'manual',
    headers: {
      Origin: base,
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return r;
}
let r = await request('/dashboard');
assert.equal(r.status, 307);
assert.equal(r.headers.get('location'), '/login');
r = await request('/api/backend/cows');
assert.equal(r.status, 401);
r = await fetch(base + '/api/session', {
  method: 'POST',
  headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'x@y.com', password: 'bad' }),
});
assert.equal(r.status, 403);
r = await request('/api/session', 'POST', {
  email: process.env.E2E_EMAIL,
  password: process.env.E2E_PASSWORD,
});
assert.equal(r.status, 200);
const header = r.headers.get('set-cookie');
assert.ok(header.includes('HttpOnly'));
assert.ok(header.includes('SameSite=lax'));
cookie = header.split(';')[0];
const login = await r.json();
assert.equal(login.data.role, 'OWNER');
assert.equal(login.data.accessToken, undefined);
r = await request('/api/session');
assert.equal(r.status, 200);
r = await request('/api/backend/dashboard');
assert.equal(r.status, 200);
const dashboard = (await r.json()).data;
assert.ok(dashboard.activeCattle >= 0);
console.log('Dashboard category count shape:', JSON.stringify(dashboard.byCategory));
r = await request('/api/backend/cows', 'POST', {
  tagNumber: 'FRONTEND-SMOKE-' + Date.now(),
  sex: 'FEMALE',
  category: 'DAIRY',
  origin: 'PURCHASED',
});
assert.equal(r.status, 201);
const cow = (await r.json()).data;
r = await request('/api/backend/cows/' + cow.id);
assert.equal(r.status, 200);
assert.equal((await r.json()).data.id, cow.id);
r = await request('/api/backend/cows/' + cow.id, 'PATCH', { name: 'Frontend integration cow' });
assert.equal(r.status, 200);
for (const path of [
  '/dashboard',
  '/cows',
  '/cows/' + cow.id,
  '/breeding',
  '/health',
  '/tasks',
  '/staff',
]) {
  r = await request(path);
  assert.equal(r.status, 200, path);
  assert.match(await r.text(), /Fahim Agro|Opening your farm/);
}
r = await request('/api/backend/cows', 'POST', {
  tagNumber: 'INVALID',
  sex: 'MALE',
  category: 'DAIRY',
  origin: 'PURCHASED',
});
assert.equal(r.status, 400);
r = await request('/api/backend/auth/login');
assert.equal(r.status, 404);
r = await request('/api/session', 'DELETE');
assert.equal(r.status, 200);
assert.match(r.headers.get('set-cookie'), /Max-Age=0/);
console.log(
  'PASS: unauthenticated redirects, CSRF origin protection, login HttpOnly cookie, session verification, dashboard, cow create/read/update, validation forwarding, route allowlist, seven page responses, and logout.',
);
