# Deploy FinBud to Railway

Railway is a good fit: it runs FinBud as a long-lived Node server (no serverless
connection-pooling to worry about) and gives you a managed Postgres in the same project.
The repo ships a `railway.json` that runs database migrations automatically on each deploy.

## 1. Create the project

1. In Railway: **New Project → Deploy from GitHub repo** → pick `Financial-Budgeting`.
   (Select the branch you want — `main` after PR #1 merges, or the feature branch to preview.)
2. In the same project: **New → Database → PostgreSQL**.

## 2. Set environment variables

On the **web service → Variables**, add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (references the Postgres plugin) |
| `AUTH_SECRET` | a 32-byte hex string (below) |
| `ENCRYPTION_KEY` | a 32-byte hex string (below) |
| `AGGREGATION_PROVIDER` | `demo` (or `plaid` once keys are set) |
| `ANTHROPIC_API_KEY` | *(optional)* enables the AI Coach |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` / `PLAID_ENV=sandbox` | *(optional)* enables bank connect |
| `SNAPTRADE_CLIENT_ID` / `SNAPTRADE_CONSUMER_KEY` | *(optional)* enables broker connect |

Generate the two secrets locally and paste the values — run it twice, once per
variable, so they aren't the same string:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # ENCRYPTION_KEY
```

> Do **not** commit these. Railway injects them at runtime.

> **Never paste the value from `.env.example`.** Anyone can read it in this
> repo, so a deployment using it lets a stranger forge a session cookie for any
> account and read that user's finances. The server checks for this at boot and
> refuses to start — if a deploy crash-loops with *"AUTH_SECRET is still the
> example placeholder"* or *"missing or too short"*, this is why. Changing
> `AUTH_SECRET` signs everyone out, which is the right move if a real secret was
> ever exposed.

## 3. Deploy

Railway builds with Nixpacks (`npm run build`) and starts with
`npm run start:migrate` → **`prisma migrate deploy && next start`**, so the schema is
created/updated automatically on first boot. Railway provides `PORT`; `next start` binds to it.

Then **Settings → Networking → Generate Domain** to get a public `https://…up.railway.app` URL.

## 4. (Optional) seed demo data

The app works immediately via **sign-up** (new accounts get the default categories + rules).
To also get the "Try the demo" household on the deployed instance, run once from the
service shell:

```bash
npm run seed
```

## 5. Point providers at your domain

- **SnapTrade**: set the redirect/return URL in the SnapTrade dashboard to your Railway
  domain (e.g. `https://your-app.up.railway.app/accounts`).
- **Plaid**: sandbox Link needs no redirect; if you enable OAuth banks later, add the
  Railway domain to Plaid's allowed redirect URIs.

## Notes

- **Migrations** are versioned in `prisma/migrations/` and applied on every deploy — safe
  and idempotent. Create new ones locally with `npm run migrate:dev` and commit them.
- **Local dev** mirrors this: `docker compose up -d db` → `npm run setup` → `npm run dev`.
- See `SCALING.md` for pooling/indexing and `../SECURITY.md` for the go-live security checklist.
