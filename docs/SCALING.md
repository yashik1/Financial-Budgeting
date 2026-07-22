# Scaling FinBud — the right database & production setup

FinBud runs on **Postgres** everywhere — local dev via the Docker Postgres in
`docker-compose.yml`, production via a managed instance. Money is stored as integer cents
and enum-like fields as strings, so the data model scales cleanly. For a hosted deploy, the
quickest path is [`DEPLOY-RAILWAY.md`](./DEPLOY-RAILWAY.md); the notes below apply to any host.

## 1. Pick a managed Postgres

Any of these work; all give you backups, encryption at rest, and a connection pooler:

| Provider | Notes |
|---|---|
| **Neon** | Serverless Postgres, built-in pooler + branching — great with Vercel |
| **Supabase** | Postgres + pooler (PgBouncer) + auth/storage if you want them |
| **AWS RDS / Aurora** | Enterprise; pair with RDS Proxy for pooling |
| **GCP Cloud SQL** | Enterprise; use the Cloud SQL connector/proxy |

Local Postgres for testing is in `docker-compose.yml` (`docker compose up -d`).

## 2. Point at your Postgres

The schema is already `provider = "postgresql"` using a single `DATABASE_URL` — set that to
your managed instance and you're done. A **direct** connection is only needed when
`DATABASE_URL` is a *pooled* URL (a pooler can't run DDL); in that case add a direct URL for
migrations **and** uncomment the `directUrl` line in `prisma/schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled connection (app runtime)
  directUrl = env("DIRECT_URL")     // direct connection (migrations) — pooled setups only
}
```

```bash
# .env — ONLY when DATABASE_URL is a pooled URL
DATABASE_URL="postgresql://user:pass@HOST:6543/finbud?pgbouncer=true&sslmode=require"  # pooled
DIRECT_URL="postgresql://user:pass@HOST:5432/finbud?sslmode=require"                    # direct
```

Railway's default Postgres is a direct connection, so leave `directUrl` out there.

## 3. Migrations are versioned

Schema changes ship as versioned migrations (committed under `prisma/migrations/`), applied
on deploy:

```bash
npm run migrate:dev      # create a migration from schema changes (dev)
npm run migrate:deploy   # apply pending migrations (CI/production release step)
```

(Scripts added to `package.json`. Commit the generated `prisma/migrations/` folder.)

## 4. Connection pooling (critical for serverless)

Each serverless function instance opens its own DB connection; without a pooler you exhaust
Postgres `max_connections` fast. Options:

- **Pooled URL** from Neon/Supabase (PgBouncer) → put it in `DATABASE_URL`, keep `DIRECT_URL`
  for migrations (as above). Simplest.
- **Prisma Accelerate** — managed pooler + edge cache; set `DATABASE_URL="prisma://…"`.
- **RDS Proxy / Cloud SQL connector** for AWS/GCP.

The Prisma client is already a hot-reload-safe singleton (`src/lib/db.ts`).

## 5. Indexes & query shape

The schema already indexes the hot paths: `Transaction(userId, date)`,
`Transaction(accountId)`, `Transaction(categoryId)`, `Transaction(externalId)`,
`BudgetLine(userId, month)`, and per-user indexes elsewhere. As data grows:

- Keep transaction reads **paginated** (the list is already capped; add cursor paging).
- Consider a monthly rollup table (per user/category/month totals) if dashboards get heavy —
  the pure functions in `src/lib/budget.ts` make precomputation straightforward.
- Money stays **integer cents** everywhere — never floats.

## 6. Move provider sync off the request path

Today a "Sync" click pulls Plaid/SnapTrade inline. At scale:

- Run syncs in a **background worker / queue** (e.g. a cron route + a job queue, or a
  durable queue like SQS/Cloud Tasks/Inngest).
- Subscribe to **Plaid webhooks** (`SYNC_UPDATES_AVAILABLE`) and **SnapTrade webhooks** so
  you pull only when data changes, instead of polling.
- The idempotent `upsert*`/`externalId` dedup in `src/lib/aggregation/sync.ts` already makes
  repeated syncs safe.

## 7. Everything else

- **Sessions/rate-limits** → Redis (Upstash) when you have multiple instances.
- **Caching** → Next.js route/segment caching + `revalidatePath` (already used on mutations).
- **Backups** → enable automated encrypted snapshots + test restores.
- **Observability** → structured logs, error tracking (Sentry), and DB slow-query logs.

See `../SECURITY.md` for the data-protection checklist that goes alongside this.
