# Fahim Agro — Full-stack Next.js Cow Farm

One **Next.js 16 + Tailwind CSS 4 + shadcn/ui** application containing both the frontend and backend, with **Prisma 7 + PostgreSQL**.

There is **no Express server to run**, no API proxy to port 5001, and no Docker requirement. PostgreSQL still runs as a separate database service on your Mac.

## Use your existing farm database

The Prisma models and initial SQL migration are unchanged from `cow-farm-backend`. Only the generated client's output directory has moved. Existing cow records, users, passwords, breeding history and treatments remain in the same PostgreSQL database.

1. Extract this ZIP to your Desktop as `cow-farm-nextjs`.
2. Stop the old frontend and Express processes with **Control + C** in their Terminal windows. Leave PostgreSQL running.
3. Open Terminal and run:

```bash
cd ~/Desktop/cow-farm-nextjs
npm ci --include=dev
cp ../cow-farm-backend/.env .env
```

This copies your working database connection and JWT secret. It does not copy or change the database. If the old backend is in a different folder, copy its `.env` into this project manually.

In the new `.env`, keep your existing `DATABASE_URL` and `JWT_SECRET`. Add these frontend settings if they are missing:

```dotenv
APP_ORIGIN=http://localhost:3000
SESSION_COOKIE_SECURE=false
```

Your database URL will usually look like:

```dotenv
DATABASE_URL="postgresql://fahim@localhost:5432/cow_farm?schema=public"
```

Then run:

```bash
npm run db:generate
npm run db:deploy
npm run dev
```

Open **http://localhost:3000** and sign in with your existing owner credentials.

`db:deploy` checks migration history. If the original initial migration is already applied, there is no new migration to run. **Do not run `prisma migrate reset`, delete the database, or create replacement tables.** You do not need to seed an existing owner account again.

Keep the previous ZIPs as backups, and back up your PostgreSQL database before future schema changes. This project does not automatically back up data.

## Fresh installation instead

For a new database with no existing records:

```bash
npm ci --include=dev
cp .env.example .env
```

Edit `.env` with your PostgreSQL connection, a real random JWT secret, and owner details. The example JWT secret must be replaced. `SEED_OWNER_PASSWORD` must be at least 12 characters and no more than 72 UTF-8 bytes.

```bash
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

The seed only creates an account when its email is absent. It never resets existing passwords or changes existing roles.

Generate a secret if you do not already have one:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Use **`.env`** for this combined project so Next.js, Prisma CLI and the seed read the same values. Avoid a separate `.env.local` overriding those database settings.

## Environment settings

| Variable                | Purpose                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`          | Existing PostgreSQL connection URL                              |
| `DATABASE_POOL_SIZE`    | Maximum connections per running application process; default 10 |
| `JWT_SECRET`            | Existing backend signing secret, at least 32 characters         |
| `APP_ORIGIN`            | Exact frontend browser origin, normally `http://localhost:3000` |
| `SESSION_COOKIE_SECURE` | `false` for local HTTP, `true` for HTTPS hosting                |
| `SEED_OWNER_NAME`       | Owner name, only used by the optional seed                      |
| `SEED_OWNER_EMAIL`      | Owner email, only used by the optional seed                     |
| `SEED_OWNER_PASSWORD`   | Owner password, only used by the optional seed                  |

The old backend's `PORT` and `CORS_ORIGINS` settings are unused here. `API_BASE_URL` is no longer needed. The app listens on port **3000** through its npm scripts.

## What changed

The frontend routes and farm workflows remain familiar. Their requests now execute locally:

1. The browser sends a request to a Next.js route handler.
2. The route handler verifies the session and role.
3. The local server module validates the data and runs its business logic.
4. Prisma reads/writes PostgreSQL directly.
5. Next.js returns the response.

`src/server/lib/router.ts` is a small internal route registry, not Express. It matches method/path pairs and runs the existing domain handlers. Keeping their shared request/response interface preserves their transaction logic while moving execution into Next.js native Route Handlers. It does not start a listener or forward HTTP requests.

## Project structure

```text
src/app/
  (farm)/                      Dashboard and farm pages
  login/                       Login page
  api/session/route.ts         Login cookie, current user, logout
  api/backend/[...path]/route.ts  Local cookie-authenticated farm API
  api/v1/[...path]/route.ts    Local bearer-token API for Postman/mobile
  api/health/route.ts          Liveness
  ready/route.ts               Database readiness
src/server/
  modules/                    Cows, breeding, health, tasks, dashboard, users
  middleware/                 Authentication, role checks, centralized errors
  lib/                        Prisma, transactions, validation helpers, route registry
  config/                     Lazy validated environment settings
  dispatch.ts                 Route selection and bounded JSON parsing
  generated/prisma/           Generated Prisma client (not in ZIP)
src/components/
  ui/                         shadcn/ui primitives
  farm/                       Shared UI and workflow forms
src/lib/                      Frontend types, requests, date/currency helpers
prisma/
  schema.prisma
  migrations/202609160001_initial/migration.sql
  seed.ts
```

The `/api/backend` name is retained to keep frontend URLs compatible. It is now a direct local handler, **not a forwarding proxy**.

## Included workflows

- Owner/manager/worker login and permissions.
- Individual cattle profiles, search, filtering, editing and archival.
- Heat observations, repeated breeding services, pregnancy checks and confirmation.
- Pregnancy planning, dry-off, pregnancy loss and unsuccessful cycle closure.
- Calving with individual calf registration, including twins and stillbirth counts.
- Health events, vaccination/deworming plans, treatment administrations and withdrawal records.
- Scheduled tasks, assignments, overdue filters and evidence-based completion.
- Cow timelines and dashboard.
- Owner-only staff creation.

Date/time inputs and displays use Bangladesh time. Costs use BDT. Actual events must not be in the future. Scheduling dates are entered from the farm's veterinary plan; the app does not calculate doses or veterinary intervals.

Record the actual administration/check/heat event before completing the corresponding task. The backend validates that the completion evidence belongs to the right animal and, when applicable, the linked cycle or treatment. Closing a pregnancy or treatment cancels related pending tasks. Complete relevant tasks first.

A service does not imply pregnancy. A positive check creates the pregnancy. Calving and calf creation use a transaction so duplicate tags cannot leave a partially saved birth.

## Authentication and API access

The browser receives an **HttpOnly, SameSite=Lax** session cookie after login. Its token is not exposed to browser JavaScript. Cookie-authenticated mutations require the matching `APP_ORIGIN`. Roles and active status are checked against PostgreSQL for every authenticated request.

The `/api/v1` API is bearer-token-only and never consumes browser cookies. Existing Postman requests can use this base URL:

```text
http://localhost:3000/api/v1
```

Login:

```http
POST /api/v1/auth/login
Content-Type: application/json

{"email":"your-existing-email","password":"your-existing-password"}
```

Use `data.accessToken` in `Authorization: Bearer TOKEN` for other `/api/v1` requests. The same endpoints and response envelopes from the Express backend are preserved. Import `docs/Cow-Farm-Nextjs.postman_collection.json` if supplied.

Health checks:

- `http://localhost:3000/api/health` — application liveness.
- `http://localhost:3000/ready` — database connection.

Tokens expire after eight hours. Login throttling is in-memory with per-account and process-wide limits. For multiple production instances, replace it with a shared limiter. Sign-out clears the browser cookie; there is no token revocation or refresh-token implementation in this release.

## Commands

```bash
npm run dev
npm run build
npm start
npm run typecheck
npm run db:generate
npm run db:deploy
npm run db:seed
npm run db:studio
```

For future schema changes, use `npm run db:migrate -- --name your_change`. Preserve the custom migration constraints and partial unique index. Do not replace migrations with `db push`.

After `npm run build`, `npm test` runs integration tests against a fresh embedded PostgreSQL database and the actual compiled Next.js HTTP server. Tests do not touch the configured farm database. Test dependencies are development-only. Test port 3002 must be free.

## Troubleshooting

- **Commands not found:** run `npm ci --include=dev` and wait for successful installation.
- **Database unavailable:** confirm PostgreSQL is running, `DATABASE_URL` is correct, and `JWT_SECRET` is a real secret. The placeholder secret is rejected.
- **Request origin rejected:** use `http://localhost:3000` if that is your configured `APP_ORIGIN`. If opening `127.0.0.1`, update the origin to match and restart.
- **Login fails:** use your farm owner credentials, not the PostgreSQL username/password. Changing seed variables does not change an existing account password.
- **Port 3000 already in use:** stop the previous frontend before starting this project.
- **Migration already applied:** that is expected when reusing the original `cow_farm` database. Do not reset it.

## Scope and hosting

This remains a single-farm application. Milk production, feed inventory, financial accounting, poultry, outbound notifications, file uploads and password reset are not included. No mock records are loaded into your database. Historical events remain append-only; existing frontend edit and status-change operations are preserved.

The app requires the **Node.js runtime** and PostgreSQL. If deploying, use a reachable PostgreSQL database, HTTPS, secure cookies, an exact origin, and an appropriate connection-pool budget. It cannot be hosted as a static export or an Edge-only app. No site is deployed by this ZIP.
