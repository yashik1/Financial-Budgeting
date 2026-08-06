-- Tag a transaction as a contribution toward a goal, and let a transaction be
-- excluded from budget/report math without hiding it from the ledger.
ALTER TABLE "Transaction" ADD COLUMN "goalId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "excludeFromBudget" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Transaction_goalId_idx" ON "Transaction"("goalId");

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_goalId_fkey"
  FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
