import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { spawn, type ChildProcess } from 'node:child_process';
import type { PrismaClient } from '../src/server/generated/prisma/client';
let pg: PGlite, server: PGLiteSocketServer, app: string, db: PrismaClient;
let web: ChildProcess;
let ownerToken: string,
  workerToken: string,
  workerId: string,
  cowId: string,
  otherCowId: string,
  cycleId: string,
  pregnancyId: string,
  serviceId: string,
  healthId: string,
  treatmentId: string,
  administrationId: string;
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const api = (token = ownerToken) => ({
  get: (path: string) =>
    request(app)
      .get('/api/v1' + path)
      .auth(token, { type: 'bearer' }),
  post: (path: string, body: object) =>
    request(app)
      .post('/api/v1' + path)
      .auth(token, { type: 'bearer' })
      .send(body),
  patch: (path: string, body: object) =>
    request(app)
      .patch('/api/v1' + path)
      .auth(token, { type: 'bearer' })
      .send(body),
});
before(
  async () => {
    pg = await PGlite.create();
    await pg.exec(
      await readFile(
        new URL('../prisma/migrations/202609160001_initial/migration.sql', import.meta.url),
        'utf8',
      ),
    );
    server = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0, maxConnections: 10 });
    await server.start();
    Object.assign(process.env, { NODE_ENV: 'test' });
    process.env.DATABASE_POOL_SIZE = '1';
    process.env.JWT_SECRET = 'integration-test-only-secret-at-least-32-characters';
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${server.getServerConn()}/postgres`;
    app = 'http://127.0.0.1:3002';
    ({ db } = await import('../src/server/lib/db'));
    await db.farmUser.create({
      data: {
        name: 'Owner',
        email: 'owner@test.local',
        passwordHash: await bcrypt.hash('a-strong-test-password', 4),
        role: 'OWNER',
      },
    });
    web = spawn(
      process.execPath,
      ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '-p', '3002'],
      {
        env: {
          ...process.env,
          NODE_ENV: 'production',
          APP_ORIGIN: app,
          SESSION_COOKIE_SECURE: 'false',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    web.stderr?.on('data', (b) => process.stderr.write(b));
    let ready = false;
    for (let i = 0; i < 120; i++) {
      try {
        if ((await fetch(app + '/ready')).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.ok(ready, 'Next.js server becomes ready');
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'owner@test.local', password: 'a-strong-test-password' })
      .expect(200);
    ownerToken = login.body.data.accessToken;
  },
  { timeout: 60000 },
);
after(async () => {
  if (web) {
    const ended = new Promise<void>((resolve) => web.once('exit', () => resolve()));
    web.kill('SIGTERM');
    await ended;
  }
  if (db) await db.$disconnect();
  if (server) await server.stop();
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (pg) await pg.close();
});

test('health/readiness, authentication and credential handling', async () => {
  await request(app).get('/api/health').expect(200);
  await request(app).get('/ready').expect(200);
  await request(app).get('/api/v1/cows').expect(401);
  await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'owner@test.local', password: 'wrong' })
    .expect(401);
  const me = await api().get('/auth/me').expect(200);
  assert.equal(me.body.data.role, 'OWNER');
  assert.equal(me.body.data.passwordHash, undefined);
});
test('owner provisions worker, worker cannot create cows or staff', async () => {
  const w = await api()
    .post('/users', {
      name: 'Worker',
      email: 'worker@test.local',
      password: 'worker-test-password',
      role: 'WORKER',
    })
    .expect(201);
  workerId = w.body.data.id;
  assert.equal(w.body.data.passwordHash, undefined);
  const l = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'worker@test.local', password: 'worker-test-password' })
    .expect(200);
  workerToken = l.body.data.accessToken;
  await api(workerToken)
    .post('/cows', {
      tagNumber: 'UNAUTHORIZED',
      sex: 'FEMALE',
      category: 'DAIRY',
      origin: 'PURCHASED',
    })
    .expect(403);
  await api(workerToken).get('/users').expect(403);
});
test('cow creation, decimal persistence, validation and duplicate conflicts', async () => {
  const c = await api()
    .post('/cows', {
      tagNumber: 'TEST-001',
      sex: 'FEMALE',
      category: 'DAIRY',
      origin: 'PURCHASED',
      birthDate: '2020-01-01',
      purchasePrice: 123456.78,
    })
    .expect(201);
  cowId = c.body.data.id;
  assert.equal(c.body.data.purchasePrice, '123456.78');
  otherCowId = (
    await api()
      .post('/cows', {
        tagNumber: 'TEST-002',
        sex: 'FEMALE',
        category: 'BEEF',
        origin: 'PURCHASED',
      })
      .expect(201)
  ).body.data.id;
  await api()
    .post('/cows', { tagNumber: 'TEST-001', sex: 'FEMALE', category: 'DAIRY', origin: 'PURCHASED' })
    .expect(409);
  await api()
    .post('/cows', { tagNumber: 'BAD', sex: 'MALE', category: 'DAIRY', origin: 'PURCHASED' })
    .expect(400);
  await api()
    .post('/cows', {
      tagNumber: 'BAD',
      sex: 'FEMALE',
      category: 'DAIRY',
      origin: 'PURCHASED',
      purchasePrice: -1,
    })
    .expect(400);
  await api().get('/cows/not-a-uuid').expect(400);
  await api()
    .patch('/cows/' + cowId, { name: 'Lali' })
    .expect(200);
  await api()
    .patch('/cows/' + cowId, { status: 'SOLD' })
    .expect(400);
});
test('one active cycle per cow and services leave pregnancy unconfirmed', async () => {
  cycleId = (await api().post('/breeding/cycles', { cowId, startedOn: '2025-01-01' }).expect(201))
    .body.data.id;
  await api().post('/breeding/cycles', { cowId, startedOn: '2025-01-02' }).expect(409);
  await api(workerToken)
    .post(`/breeding/cycles/${cycleId}/heats`, {
      observedAt: '2025-01-02T08:00:00+06:00',
      signs: 'Observed heat',
    })
    .expect(201);
  serviceId = (
    await api()
      .post(`/breeding/cycles/${cycleId}/services`, {
        performedAt: '2025-01-02T14:00:00+06:00',
        method: 'ARTIFICIAL_INSEMINATION',
        cost: 500,
        pregnancyCheckDueAt: '2025-02-10T10:00:00+06:00',
      })
      .expect(201)
  ).body.data.id;
  const c = await api()
    .get('/breeding/cycles/' + cycleId)
    .expect(200);
  assert.equal(c.body.data.status, 'OPEN');
  assert.equal(c.body.data.pregnancy, null);
});
test('positive check atomically confirms pregnancy and generates tasks', async () => {
  const p = await api()
    .post(`/breeding/cycles/${cycleId}/checks`, {
      checkedAt: '2025-02-10T10:00:00+06:00',
      method: 'Veterinary examination',
      result: 'PREGNANT',
      breedingServiceId: serviceId,
      estimatedCalvingDate: '2025-10-10',
      plannedDryOffDate: '2025-08-10',
    })
    .expect(201);
  pregnancyId = p.body.data.pregnancy.id;
  assert.equal((await api().get('/breeding/cycles/' + cycleId)).body.data.status, 'PREGNANT');
  await api()
    .post(`/breeding/cycles/${cycleId}/services`, {
      performedAt: '2025-03-01T00:00:00Z',
      method: 'NATURAL_SERVICE',
    })
    .expect(409);
  await api()
    .post(`/breeding/cycles/${cycleId}/checks`, {
      checkedAt: '2025-03-01T00:00:00Z',
      method: 'Check',
      result: 'NOT_PREGNANT',
    })
    .expect(409);
  await api()
    .patch(`/breeding/pregnancies/${pregnancyId}/plan`, { estimatedCalvingDate: '2025-10-15' })
    .expect(200);
});
test('calving rejects invalid counts and rolls back all writes for duplicate calf tags', async () => {
  await api()
    .post(`/breeding/pregnancies/${pregnancyId}/calving`, {
      calvedAt: '2025-10-10T00:00:00Z',
      totalBorn: 2,
      bornAlive: 1,
      stillborn: 0,
      calves: [{ tagNumber: 'CALF-X', sex: 'FEMALE' }],
    })
    .expect(400);
  await api()
    .post(`/breeding/pregnancies/${pregnancyId}/calving`, {
      calvedAt: '2025-10-10T00:00:00Z',
      totalBorn: 2,
      bornAlive: 2,
      stillborn: 0,
      calves: [
        { tagNumber: 'ROLLBACK-CALF', sex: 'FEMALE' },
        { tagNumber: 'TEST-001', sex: 'MALE' },
      ],
    })
    .expect(409);
  assert.equal(await db.cow.count({ where: { tagNumber: 'ROLLBACK-CALF' } }), 0);
  assert.equal(await db.calving.count({ where: { pregnancyId } }), 0);
  assert.equal(
    (await db.pregnancy.findUniqueOrThrow({ where: { id: pregnancyId } })).status,
    'ONGOING',
  );
});
test('dry-off and calving create calves and close the cycle', async () => {
  await api()
    .post(`/breeding/pregnancies/${pregnancyId}/dry-off`, { actualDryOffDate: '2025-08-10' })
    .expect(200);
  const birth = await api()
    .post(`/breeding/pregnancies/${pregnancyId}/calving`, {
      calvedAt: '2025-10-10T00:00:00Z',
      totalBorn: 2,
      bornAlive: 2,
      stillborn: 0,
      calves: [
        { tagNumber: 'CALF-A', sex: 'FEMALE' },
        { tagNumber: 'CALF-B', sex: 'MALE' },
      ],
      postpartumCheckDueAt: '2025-10-15T00:00:00Z',
    })
    .expect(201);
  assert.equal(birth.body.data.calves.length, 2);
  assert.equal(birth.body.data.calves[0].motherId, cowId);
  assert.equal(
    (await db.breedingCycle.findUniqueOrThrow({ where: { id: cycleId } })).status,
    'CLOSED_CALVED',
  );
  await api()
    .post(`/breeding/pregnancies/${pregnancyId}/loss`, {
      endedOn: '2025-10-11',
      outcomeNotes: 'Invalid second outcome',
    })
    .expect(409);
});
test('new cycle and pregnancy loss preserve prior reproductive history', async () => {
  const c = (await api().post('/breeding/cycles', { cowId, startedOn: '2026-01-01' }).expect(201))
    .body.data;
  const p = (
    await api()
      .post(`/breeding/cycles/${c.id}/checks`, {
        checkedAt: '2026-02-10T10:00:00Z',
        method: 'Veterinary check',
        result: 'PREGNANT',
      })
      .expect(201)
  ).body.data.pregnancy;
  await api()
    .post(`/breeding/pregnancies/${p.id}/loss`, {
      endedOn: '2026-03-01',
      outcomeNotes: 'Veterinarian confirmed loss',
    })
    .expect(200);
  assert.equal(
    (await db.breedingCycle.findUniqueOrThrow({ where: { id: c.id } })).status,
    'CLOSED_LOSS',
  );
  assert.equal(await db.pregnancy.count({ where: { cycle: { cowId } } }), 2);
});
test('health events, treatment doses and required withdrawal updates', async () => {
  healthId = (
    await api(workerToken)
      .post('/health/events', {
        cowId,
        eventType: 'ILLNESS',
        occurredAt: '2026-04-01T08:00:00Z',
        symptoms: 'Recorded symptoms',
      })
      .expect(201)
  ).body.data.id;
  treatmentId = (
    await api()
      .post(`/health/events/${healthId}/treatments`, {
        treatmentType: 'MEDICATION',
        productName: 'Test prescribed product',
        prescribedInstructions: 'Test instructions',
        startsOn: '2026-04-01',
        milkWithdrawalRequired: true,
        meatWithdrawalRequired: false,
      })
      .expect(201)
  ).body.data.id;
  const dose = { administeredAt: '2026-04-01T10:00:00Z', doseAmount: 1, doseUnit: 'mL' };
  await api(workerToken)
    .post(`/health/treatments/${treatmentId}/administrations`, dose)
    .expect(400);
  administrationId = (
    await api(workerToken)
      .post(`/health/treatments/${treatmentId}/administrations`, {
        ...dose,
        milkRestrictedUntil: '2026-04-05T10:00:00Z',
      })
      .expect(201)
  ).body.data.id;
  await api()
    .post(`/health/treatments/${treatmentId}/administrations`, {
      ...dose,
      administeredAt: '2026-04-02T10:00:00Z',
      milkRestrictedUntil: '2026-04-03T10:00:00Z',
    })
    .expect(400);
});
test('tasks reject cross-cow links and require correct completion evidence', async () => {
  await api()
    .post('/tasks', {
      cowId: otherCowId,
      treatmentId,
      taskType: 'TREATMENT',
      title: 'Wrong cow',
      dueAt: '2026-04-01T10:00:00Z',
    })
    .expect(400);
  const t = (
    await api()
      .post('/tasks', {
        cowId,
        treatmentId,
        assignedTo: workerId,
        taskType: 'TREATMENT',
        title: 'Administer prescribed treatment',
        dueAt: '2026-04-01T10:00:00Z',
      })
      .expect(201)
  ).body.data;
  await api(workerToken)
    .post(`/tasks/${t.id}/complete`, { completedAt: now(), completionNotes: 'Done' })
    .expect(400);
  const otherEvent = (
    await api()
      .post('/health/events', {
        cowId: otherCowId,
        eventType: 'CHECKUP',
        occurredAt: '2026-04-01T10:00:00Z',
      })
      .expect(201)
  ).body.data;
  const follow = (
    await api()
      .post('/tasks', {
        cowId,
        taskType: 'VET_FOLLOWUP',
        title: 'Visit',
        dueAt: '2026-04-01T10:00:00Z',
      })
      .expect(201)
  ).body.data;
  await api()
    .post(`/tasks/${follow.id}/complete`, {
      completedAt: now(),
      completionNotes: 'Visit',
      evidence: { type: 'HEALTH_EVENT', id: otherEvent.id },
    })
    .expect(400);
  await api(workerToken)
    .post(`/tasks/${t.id}/complete`, {
      completedAt: now(),
      completionNotes: 'Actual dose recorded',
      evidence: { type: 'ADMINISTRATION', id: administrationId },
    })
    .expect(200);
  await api()
    .post(`/tasks/${t.id}/complete`, {
      completedAt: now(),
      completionNotes: 'Duplicate',
      evidence: { type: 'ADMINISTRATION', id: administrationId },
    })
    .expect(409);
});
test('vaccination task rejects a non-vaccine administration', async () => {
  const t = (
    await api()
      .post('/tasks', {
        cowId,
        taskType: 'VACCINATION',
        title: 'Vaccinate',
        dueAt: '2026-04-01T10:00:00Z',
      })
      .expect(201)
  ).body.data;
  await api()
    .post(`/tasks/${t.id}/complete`, {
      completedAt: now(),
      completionNotes: 'Wrong product',
      evidence: { type: 'ADMINISTRATION', id: administrationId },
    })
    .expect(400);
  await api(workerToken)
    .post(`/tasks/${t.id}/complete`, {
      completedAt: now(),
      completionNotes: 'Not assigned',
      evidence: { type: 'ADMINISTRATION', id: administrationId },
    })
    .expect(403);
});
test('timeline, dashboard, list pagination and unknown fields', async () => {
  const timeline = await api().get(`/cows/${cowId}/timeline?limit=2`).expect(200);
  assert.equal(timeline.body.data.items.length, 2);
  assert.ok(timeline.body.data.total > 2);
  const list = await api().get('/cows?limit=1&search=TEST').expect(200);
  assert.equal(list.body.data.items.length, 1);
  assert.equal(list.body.data.total, 2);
  await api().get('/dashboard').expect(200);
  await api().get('/tasks?overdue=true').expect(200);
  await api().get('/cows?limit=101').expect(400);
  await api()
    .post('/health/events', { cowId, eventType: 'CHECKUP', occurredAt: now(), unknown: true })
    .expect(400);
});
test('archival cancels pending tasks and blocks further event creation', async () => {
  await api().post(`/cows/${cowId}/exit`, { status: 'SOLD', exitDate: today() }).expect(200);
  assert.equal(await db.scheduledTask.count({ where: { cowId, status: 'PENDING' } }), 0);
  await api()
    .post('/health/events', { cowId, eventType: 'CHECKUP', occurredAt: now() })
    .expect(409);
  await api().get(`/cows/${cowId}/timeline`).expect(200);
});
test('database CHECK constraints reject invalid direct writes', async () => {
  await assert.rejects(
    db.treatmentAdministration.create({
      data: { treatmentId, administeredAt: new Date(), doseAmount: -1, doseUnit: 'mL' },
    }),
  );
  await assert.rejects(
    db.cow.create({
      data: { tagNumber: 'INVALID-DB', sex: 'MALE', category: 'DAIRY', origin: 'PURCHASED' },
    }),
  );
});

test('Next.js session cookie, CSRF and direct local farm API', async () => {
  const bad = await fetch(app + '/api/session', {
    method: 'POST',
    headers: { Origin: 'https://wrong.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@test.local', password: 'a-strong-test-password' }),
  });
  assert.equal(bad.status, 403);
  const login = await fetch(app + '/api/session', {
    method: 'POST',
    headers: { Origin: app, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@test.local', password: 'a-strong-test-password' }),
  });
  assert.equal(login.status, 200);
  const raw = login.headers.get('set-cookie')!;
  assert.match(raw, /HttpOnly/);
  assert.equal((await login.json()).data.accessToken, undefined);
  const cookie = raw.split(';')[0];
  const result = await fetch(app + '/api/backend/dashboard', { headers: { Cookie: cookie } });
  assert.equal(result.status, 200);
  const protectedPage = await fetch(app + '/dashboard', { redirect: 'manual' });
  assert.equal(protectedPage.status, 307);
  for (const path of ['/dashboard', '/cows', '/breeding', '/health', '/tasks', '/staff'])
    assert.equal((await fetch(app + path, { headers: { Cookie: cookie } })).status, 200, path);
  const logout = await fetch(app + '/api/session', {
    method: 'DELETE',
    headers: { Origin: app, Cookie: cookie },
  });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie')!, /Max-Age=0/);
});
