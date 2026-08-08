-- Session revocation: bumping tokenVersion invalidates every outstanding JWT.
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Ephemeral per-visitor demo clones are reaped once this passes.
ALTER TABLE "User" ADD COLUMN "demoExpiresAt" TIMESTAMP(3);

CREATE INDEX "User_demoExpiresAt_idx" ON "User"("demoExpiresAt");
