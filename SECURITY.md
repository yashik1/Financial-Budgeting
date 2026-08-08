# Security & Data Protection

FinBud handles sensitive personal financial data (balances, transactions, and — once
connectivity is enabled — bank/broker access credentials). This document describes the
current posture and the checklist to satisfy **before** onboarding real users.

## What data we store

| Data | Sensitivity | At rest |
|---|---|---|
| Email, name, password hash | PII / credential | scrypt-hashed password (never plaintext) |
| Accounts, balances, transactions | Financial PII | plaintext in DB (protect via disk/DB encryption) |
| **Plaid access tokens** | **Secret** | **AES-256-GCM encrypted** (`src/lib/crypto.ts`) |
| **SnapTrade user secret** | **Secret** | **AES-256-GCM encrypted** |
| Session token | Auth | signed JWT in httpOnly, Secure, SameSite=Lax cookie |

We **never** store full card numbers, raw bank credentials, or MFA codes — aggregation
providers (Plaid/SnapTrade) hold those; we only hold the access token they issue us.

## What's implemented today

- **Secrets encrypted at rest** — provider access tokens/secrets are AES-256-GCM
  encrypted with `ENCRYPTION_KEY` before they touch the database, decrypted only in
  memory at sync time. Swap `src/lib/crypto.ts` for a KMS without changing call sites.
- **Passwords** hashed with scrypt + per-user salt (`src/lib/password.ts`). New passwords
  must be 12+ characters and aren't allowed to be one of the top breach-corpus entries;
  length is capped so scrypt can't be used as a CPU sink (`src/lib/validation.ts`).
- **Sessions** are signed JWTs (jose) in `httpOnly` + `Secure` (prod) + `SameSite=Lax`
  cookies — not readable by JS, sent only same-site. They last 7 days and carry a
  `tokenVersion` claim checked on every request, so **Settings → Sign out of all devices**
  (or any future password reset) invalidates every outstanding token immediately.
- **Configuration is validated at boot** (`src/instrumentation.ts`) — the server refuses
  to start if `AUTH_SECRET` is under 32 characters or is the placeholder that ships in
  `.env.example` (that value is public in this repo; a deployment keeping it would let
  anyone forge a session cookie for any user), and if the database is missing columns this
  build expects (`src/lib/schemaCheck.ts`), which otherwise surfaces as opaque 500s on
  every page that touches the changed model. An unreachable database only warns, so a
  container that starts ahead of Postgres still comes up.
- **Rate limiting** (`src/lib/rateLimit.ts`) on sign-in (per IP *and* per email), sign-up,
  the demo, and the AI coach. It's a per-instance sliding window — see the scaling note in
  that file for the Redis swap when running more than one instance.
- **Content-Security-Policy** with a per-request nonce (`src/middleware.ts`):
  `strict-dynamic` script policy, `frame-ancestors 'none'`, `object-src 'none'`, and Plaid
  Link allowlisted. The static headers in `next.config.mjs` (HSTS, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`) still apply.
- **Authorization** — every server action re-derives the user from the session and scopes
  every query by `userId`; ownership is re-checked on mutations, including the ids
  *referenced* by a mutation (category, goal, account), so nothing can point at another
  tenant's row.
- **Input validation** — auth inputs are parsed with Zod; money is clamped to the `int4`
  range the columns hold, and CSV imports are bounded by file size, row count, and field
  length on both the client and the server.
- **Isolated demo** — "Try the demo" clones the seeded dataset into a private, expiring
  user per visitor (`src/lib/demo.ts`) instead of sharing one row, so demo sessions can't
  read or overwrite each other. Clones are reaped after 24h.
- **Least data exposure** — provider secrets are excluded from all query selects that feed
  the UI; the client never receives them.

## Production hardening checklist (do before real users)

- [ ] **Secrets manager** — move `ENCRYPTION_KEY`, `AUTH_SECRET`, DB URL, and provider
      keys into a managed secret store (AWS Secrets Manager, GCP Secret Manager, Vault);
      never commit `.env`. Rotate `ENCRYPTION_KEY` via envelope encryption + re-wrap.
- [ ] **Encryption at rest for the whole DB** — enable Postgres/RDS storage encryption
      (financial PII, not just the token columns).
- [ ] **TLS everywhere** — terminate HTTPS (HSTS is already sent) and require it on the
      database connection too: `?sslmode=require` in `DATABASE_URL`.
- [ ] **Least-privilege DB role** — the app should connect as a role that owns only its
      own schema, with no `SUPERUSER`/`CREATEDB`. Run migrations as a separate role.
- [x] **Content-Security-Policy** — enforced with a per-request nonce; Plaid Link is
      allowlisted. Revisit if you add a third-party script or embed.
- [x] **Rate limiting** on sign-in, sign-up, demo, and AI coach. **Still to do:** make it
      shared across instances (Upstash/Redis or a WAF) before scaling out horizontally,
      and extend it to the sync/connect actions.
- [ ] **Audit logging** — record auth events, connect/sync, and data exports (who, when,
      what) to an append-only sink.
- [ ] **Real auth** — swap the cookie-JWT for Auth.js/OAuth + optional MFA; add email
      verification and password-reset flows. The `tokenVersion` mechanism is already in
      place for reset to hook into.
- [ ] **Third-party disclosure** — the AI coach sends a summary of the user's balances,
      spending, and goals to the Anthropic API. Disclose this and make it opt-in before
      real users; it's off entirely unless `ANTHROPIC_API_KEY` is set.
- [ ] **Backups & retention** — encrypted, tested restores; a documented retention +
      deletion policy (see compliance below).
- [ ] **Dependency & secret scanning** in CI (Dependabot/`npm audit`, gitleaks).

## Compliance considerations (US-centric; consult counsel)

- **GLBA / FTC Safeguards Rule** — handling consumer financial data obliges a written
  information-security program, access controls, encryption, and vendor oversight.
- **PCI DSS** — **out of scope by design**: we don't store/process card PANs (aggregators
  do). Keep it that way.
- **SOC 2 Type II** — the control set most fintech partners/customers will ask for.
- **GDPR / CCPA/CPRA** — right to access, delete, and export. The schema is per-user with
  cascade deletes, which makes "delete my account and all data" a single operation to
  build on. Add a data-export endpoint.
- **Plaid/SnapTrade agreements** — production access requires accepting their data-use and
  security terms and passing their review.

## Reporting

Found a vulnerability? Please open a private report rather than a public issue.
