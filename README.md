# 💸 FinBud — budgeting that's actually fun

FinBud is a cross-platform (responsive web + PWA) personal-budgeting app that aims to
be **fun and deep at the same time** — the gap most tools leave open. It pairs serious
envelope/zero-based budgeting, cash-flow and net-worth tracking with a game-like layer:
streaks, monthly challenges, achievements, and **Fitch**, a mascot who reacts to how your
month is going.

> **Status:** Phase 1 MVP + **sandbox-ready connectivity**. Runs entirely on demo data + CSV
> import out of the box — **no keys required**. Real bank (Plaid) and broker (SnapTrade)
> connectivity is fully wired behind the same interface and turns on the moment you drop in
> **free sandbox keys**; see [Connectivity](#connectivity).

---

## Why FinBud (the landscape)

| App | Strong at | Weak spot |
|---|---|---|
| YNAB | Zero-based budgeting, behavior change | Dry, steep learning curve, paid only |
| Monarch | Couples, net worth | Paid only |
| Copilot | AI + design | **iOS only** |
| Rocket Money | Subscriptions | Shallow budgeting |
| Cleo | Fun/chatty | Shallow |
| Mint | (shut down Jan 2024) | — |

Most apps are either *serious-but-dry* or *fun-but-shallow*, and the best-looking one is
iOS-locked. **FinBud targets fun + deep + runs anywhere in a browser.**

---

## Features (Phase 1)

- **Dashboard** — net-worth trend, cash-flow (income vs spending), spending-by-category
  donut, budget progress, financial-health score, and the mascot with your streak + monthly challenge.
- **Monthly insights** — a **month switcher** on the dashboard and budgets pages plus a
  comparison card: income/spending/saved vs the previous month and the biggest category movers.
- **Calendar & recurring** — bills, subscriptions, and income on a monthly calendar. FinBud
  **detects recurring charges automatically** from your history (cadence + next due date), shows
  upcoming ones as "expected", and lists your bills/subscriptions with a monthly total.
- **Cash-flow forecast** — "where you'll land": projected month-end position from actuals so far,
  the recurring bills still due, and your typical daily spending. On the dashboard and calendar.
- **CSV export** — download the current (filtered) transaction view as CSV.
- **Reports** — a 3/6/12-month view of income vs spending, savings rate month by month,
  **category trends** (each category's shape over time, with the latest month scored against its
  own average), **top merchants**, and an **assets vs liabilities** breakdown.
- **Transactions** — **rich filters** (search, income/expense/transfer, category, tag,
  account, account type — e.g. just your credit card — and date range), free-form **#tags**
  with a **tags-in-use** bar and one-tap reuse, one-tap (sub)categorization, and inline
  **edit + notes + delete**; auto-categorized on import.
- **Categorization rules** — teach FinBud where a merchant belongs and it sticks on every future
  import, sync, and manual entry. Your rules override the ~110 built-in ones, and **Apply to
  uncategorized** sorts your backlog in one click (it never rewrites categories you already set).
- **Budgets** — envelope budgeting with **categories & collapsible subcategories** (e.g. Transportation → Gas, Oil Change, Tires — click a category to expand), inline-editable limits, parent roll-ups, and live progress. Subcategory limits **can't exceed their parent** (you get a clear error), and an **Uncategorized** section surfaces spending that isn't in any budget so you can sort it.
- **Currency** — pick any of the world's currencies in Settings; amounts re-format everywhere with the right symbol and decimal rules (e.g. ¥ has none). Display-only — no FX conversion.
- **Accounts** — grouped by institution; **edit any account inline** (name, institution, type, balance, currency, sharing) or delete it. Types are **global**: a universal *kind* plus country-specific *products* — Canada's RRSP/TFSA/FHSA, US 401(k)/IRA/HSA, UK ISA/SIPP, AU Super — driven by a code catalog (`src/lib/accountTypes.ts`) and your **home country** (Settings), with any country selectable per account.
- **Goals** — create and **edit** savings goals (name, target, date, icon) and **link each to a funding account** so progress tracks that account's balance automatically — no manual top-ups. FinBud reads how fast that account is actually growing and **projects the finish date**, flagging whether you're on track for your target date.
- **Accounts** — grouped by institution; add manually, load demo accounts, or **import CSV/OFV**.
- **CSV import** — upload a bank/brokerage export, map columns (single-amount or debit/credit),
  preview, and import with automatic categorization.
- **Gamification** — levels & points, on-budget streaks, monthly challenges, unlockable achievements.
- **AI Coach** *(optional)* — "ask your money anything" chat + auto-generated insights, powered by
  the Claude API (`claude-opus-4-8`). Off until you add `ANTHROPIC_API_KEY`.
- **Couples / shared households** — invite a partner by email to share a combined view (net worth,
  spending, per-person split, shared goals) with **per-account/goal privacy** toggles.
- **Themes** — six selectable looks in Settings, each working in light and dark: **Refined** (porcelain + indigo, default), **Almanac** (a warm "money journal" — Fraunces serif, pine/persimmon paper, Fitch in his own handwriting, budgets as paper **envelopes** and goals as filling **jars**), **Midnight**, **Sunset**, **Grape**, and **Ocean**.
- **Polish** — light/dark, responsive layout, PWA-installable, animated charts.

### Security & data protection

Provider access tokens/secrets are **encrypted at rest** (AES-256-GCM, `src/lib/crypto.ts`),
passwords are scrypt-hashed, sessions are httpOnly/Secure/SameSite cookies, and every response
carries security headers. Full posture + production checklist + compliance notes in
[`SECURITY.md`](./SECURITY.md).

### Scaling & going mobile

- **Database at scale:** SQLite dev → managed **Postgres** prod with pooling and versioned
  migrations — see [`docs/SCALING.md`](./docs/SCALING.md).
- **Make it an app:** it's an installable PWA today; App Store/Play Store via a Capacitor
  wrapper that reuses this whole app — see [`docs/MOBILE.md`](./docs/MOBILE.md).

---

## Tech stack

- **Next.js 15** (App Router, Server Components, Server Actions) + **TypeScript**
- **Tailwind CSS** design system (CSS-variable theming, light/dark)
- **Prisma** ORM on **Postgres** (versioned migrations; Docker Postgres for local dev)
- **Recharts** for charts, **Framer Motion** / CSS for motion, **lucide-react** icons
- Cookie session auth via **jose** (swappable for Auth.js/OAuth)
- **Vitest** unit tests for the pure domain logic

---

## Quick start

```bash
cp .env.example .env        # then set AUTH_SECRET + ENCRYPTION_KEY (see below)
docker compose up -d db     # start local Postgres (matches the .env URL)
npm install
npm run setup               # prisma generate + migrate deploy + seed demo data
npm run dev                 # http://localhost:3000
```

Generate the two required secrets and paste them into `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # ENCRYPTION_KEY
```

Then click **“Try the demo — no signup”** to explore a fully-populated household
(4 accounts, ~9 months of transactions, budgets, goals, streaks & badges).

### Useful scripts

| Script | Does |
|---|---|
| `npm run setup` | Generate client, push schema, seed demo data |
| `npm run seed` | Re-seed the demo household |
| `npm run dev` / `build` / `start` | Next.js dev / production build / serve |
| `npm test` | Run the Vitest suite |
| `npm run typecheck` | `tsc --noEmit` |

---

## Architecture

```
src/
  app/
    login/                 # auth pages + server actions
    (app)/                 # authenticated shell: dashboard, transactions, budgets, goals, accounts
      actions.ts           # server actions (recategorize, budgets, goals, import, accounts)
  lib/
    aggregation/           # ← the connectivity seam
      provider.ts          #   AggregationProvider interface (all sources implement this)
      demo.ts              #   DemoProvider — generates lifelike accounts + transactions
      csv.ts               #   CSV/OFX parser + column mapping
      plaid.ts             #   Plaid: link token, token exchange, transactionsSync mapping
      snaptrade.ts         #   SnapTrade: user registration, portal URL, activity mapping
      sync.ts              #   normalize → DB upsert (idempotent, auto-categorized)
    budget.ts              # cash-flow + envelope math (pure, tested)
    categorize.ts          # deterministic merchant→category matching (pure, tested)
    gamification.ts        # levels, mascot, streaks, challenges (pure, tested)
    networth.ts            # net-worth history reconstruction (pure, tested)
    categories.ts          # category taxonomy + default rules (shared everywhere)
    queries.ts             # server-side data assembly for each screen
    session.ts / auth.ts   # cookie sessions
prisma/
  schema.prisma            # portable schema (int cents, string enums) → SQLite or Postgres
  seed.ts                  # builds the demo household by reusing lib/* logic
```

**Design principle:** all money is stored as **integer cents**; category/enum fields are
strings — so the schema ports cleanly between SQLite and Postgres.

---

## Connectivity

No budgeting app talks to banks directly — they resell aggregation APIs. FinBud isolates
that behind one interface (`src/lib/aggregation/provider.ts`). All sources — demo, CSV,
manual, **Plaid**, and **SnapTrade** — implement the same shape, so nothing else in the app
changes when you switch:

- **Always on:** `DemoProvider` + **CSV/OFX import** + manual entry (zero cost).
- **Wired & sandbox-ready:** **Plaid** (banks/cards/transactions) and **SnapTrade**
  (brokerages/crypto). Fully implemented — Plaid Link + public-token exchange + incremental
  `transactionsSync`; SnapTrade user registration + hosted connection portal + activity sync.
  They stay dormant until keys are present, then appear as **Connect** buttons on the
  Accounts page. Data is normalized and auto-categorized through the same pipeline as demo/CSV.

### Activate the sandboxes (free, ~5 minutes)

**Plaid (banks):**
1. Sign up free at <https://dashboard.plaid.com/signup> → **Team Settings → Keys**.
2. Copy your `client_id` and the **Sandbox** secret into `.env`:
   ```
   PLAID_CLIENT_ID=...
   PLAID_SECRET=...
   PLAID_ENV=sandbox
   ```
3. Restart, open **Accounts → Connect a bank**, and in Plaid Link use sandbox creds
   `user_good` / `pass_good`.

**SnapTrade (brokers):**
1. Request free sandbox access at <https://snaptrade.com> (Dashboard → API keys).
2. Add to `.env`:
   ```
   SNAPTRADE_CLIENT_ID=...
   SNAPTRADE_CONSUMER_KEY=...
   ```
3. Restart, open **Accounts → Connect a broker**, complete the portal, then **Sync**.

> **Production** (real, live accounts) additionally requires a paid business plan and
> compliance verification with each provider — that's the only thing sandbox keys don't unlock.
> Access tokens/secrets are stored plaintext for sandbox convenience; **encrypt them at rest
> before going to production.**

---

## Deploy

FinBud runs on Postgres and applies migrations automatically on each deploy
(`prisma migrate deploy` via the `start:migrate` script / `railway.json`).

- **Railway** (recommended): step-by-step in [`docs/DEPLOY-RAILWAY.md`](./docs/DEPLOY-RAILWAY.md)
  — add a Postgres plugin, set env vars, deploy.
- **Anywhere else**: any host that runs a Node server + Postgres works. Set `DATABASE_URL`,
  `AUTH_SECRET`, `ENCRYPTION_KEY`, run `prisma migrate deploy`, then `next start`. Only add
  `DIRECT_URL` (+ the `directUrl` line in the schema) if `DATABASE_URL` is a pooled URL. See
  [`docs/SCALING.md`](./docs/SCALING.md) for pooling and indexing.

---

## Roadmap

- **P2** — Plaid + SnapTrade **sandbox is done**; next: production access, a scheduled
  background sync, webhook-driven updates, and reconnection handling
- **P3** — AI insights & chat: **done** (`ANTHROPIC_API_KEY` → live Coach); next: AI-assisted
  categorization and spending forecasts
- **P4** — couples / shared households: **done** (invite, combined view, privacy toggles)
- **P5** — native mobile: PWA today; Capacitor wrapper next (see `docs/MOBILE.md`)

---

*Demo data is fictional. FinBud is a project scaffold, not financial advice.*
