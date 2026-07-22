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
- **Passwords** hashed with scrypt + per-user salt (`src/lib/password.ts`).
- **Sessions** are signed JWTs (jose) in `httpOnly` + `Secure` (prod) + `SameSite=Lax`
  cookies — not readable by JS, sent only same-site.
- **Security headers** on every response (`next.config.mjs`): HSTS, `X-Frame-Options:
  DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- **Authorization** — every server action re-derives the user from the session and scopes
  every query by `userId`; ownership is re-checked on mutations (no IDOR).
- **Least data exposure** — provider secrets are excluded from all query selects that feed
  the UI; the client never receives them.

## Production hardening checklist (do before real users)

- [ ] **Secrets manager** — move `ENCRYPTION_KEY`, `AUTH_SECRET`, DB URL, and provider
      keys into a managed secret store (AWS Secrets Manager, GCP Secret Manager, Vault);
      never commit `.env`. Rotate `ENCRYPTION_KEY` via envelope encryption + re-wrap.
- [ ] **Encryption at rest for the whole DB** — enable Postgres/RDS storage encryption
      (financial PII, not just the token columns).
- [ ] **TLS everywhere** — terminate HTTPS; HSTS is already sent.
- [ ] **Content-Security-Policy** — add a strict CSP; it must allowlist Plaid Link
      (`https://cdn.plaid.com`, `https://*.plaid.com` frames) and self. Ship report-only
      first, then enforce.
- [ ] **Rate limiting & lockout** on `/login` and the sync/connect actions (e.g. Upstash
      ratelimit or a WAF) to blunt credential stuffing and API abuse.
- [ ] **Audit logging** — record auth events, connect/sync, and data exports (who, when,
      what) to an append-only sink.
- [ ] **Real auth** — swap the cookie-JWT for Auth.js/OAuth + optional MFA; add email
      verification and password-reset flows.
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
