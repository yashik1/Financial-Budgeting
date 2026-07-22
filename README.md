# 💸 FinBud — budgeting that's actually fun

FinBud is a cross-platform (responsive web + PWA) personal-budgeting app that aims to
be **fun and deep at the same time** — the gap most tools leave open. It pairs serious
envelope/zero-based budgeting, cash-flow and net-worth tracking with a game-like layer:
streaks, monthly challenges, achievements, and **Fitch**, a mascot who reacts to how your
month is going.

> **Status:** Phase 1 MVP. Runs entirely on demo data + CSV import — **no paid API keys
> or bank logins required**. Real bank/broker connectivity (Plaid, SnapTrade) plugs into
> the same interface later; see [Connectivity](#connectivity).

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
- **Transactions** — filter/search and **one-tap recategorization**; auto-categorized on import.
- **Budgets** — envelope budgeting with inline-editable monthly limits and live progress.
- **Goals** — create, fund, and track savings goals.
- **Accounts** — grouped by institution; add manually, load demo accounts, or **import CSV/OFV**.
- **CSV import** — upload a bank/brokerage export, map columns (single-amount or debit/credit),
  preview, and import with automatic categorization.
- **Gamification** — levels & points, on-budget streaks, monthly challenges, unlockable achievements.
- **Polish** — light/dark themes, responsive layout, PWA-installable, animated charts.

---

## Tech stack

- **Next.js 15** (App Router, Server Components, Server Actions) + **TypeScript**
- **Tailwind CSS** design system (CSS-variable theming, light/dark)
- **Prisma** ORM — **SQLite** in dev (zero-setup), **Postgres** in prod
- **Recharts** for charts, **Framer Motion** / CSS for motion, **lucide-react** icons
- Cookie session auth via **jose** (swappable for Auth.js/OAuth)
- **Vitest** unit tests for the pure domain logic

---

## Quick start

```bash
cp .env.example .env        # SQLite + a dev AUTH_SECRET are pre-filled
npm install
npm run setup               # prisma generate + db push + seed demo data
npm run dev                 # http://localhost:3000
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
      provider.ts          #   AggregationProvider interface (banks/brokers implement this)
      demo.ts              #   DemoProvider — generates lifelike accounts + transactions
      csv.ts               #   CSV/OFX parser + column mapping
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
that behind one interface (`src/lib/aggregation/provider.ts`):

- **Today:** `DemoProvider` + **CSV/OFX import** + manual entry (zero cost, fully usable).
- **Next (drop-in):** **Plaid** (banks, cards, transactions) and **SnapTrade** (brokerages,
  crypto) implement the *same* `AggregationProvider` interface. Adding them is API keys +
  an OAuth link flow — **not a rewrite**. Env slots already exist in `.env.example`.

> Production access to Plaid/SnapTrade requires a paid business account and compliance
> verification, which is why v1 ships on demo + CSV.

---

## Using Postgres (production)

```bash
docker compose up -d                       # starts Postgres on :5432
# in prisma/schema.prisma: set datasource provider = "postgresql"
# in .env: DATABASE_URL=postgresql://finbud:finbud@localhost:5432/finbud?schema=public
npm run setup
```

---

## Roadmap

- **P2** — Plaid + SnapTrade (sandbox → production), sync scheduler, reconnection handling
- **P3** — AI insights & chat ("ask your money anything"), smarter categorization, forecasts
- **P4** — couples / shared households with per-person views & privacy controls
- **P5** — native mobile client reusing the backend & domain logic

---

*Demo data is fictional. FinBud is a project scaffold, not financial advice.*
