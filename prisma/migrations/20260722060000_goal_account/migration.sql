-- Link a goal to a funding account; progress tracks the account's balance.
ALTER TABLE "Goal" ADD COLUMN "accountId" TEXT;
CREATE INDEX "Goal_accountId_idx" ON "Goal"("accountId");
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
