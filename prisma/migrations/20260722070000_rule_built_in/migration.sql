-- Distinguish seeded starter rules from the ones a user writes themselves.
ALTER TABLE "Rule" ADD COLUMN "builtIn" BOOLEAN NOT NULL DEFAULT false;

-- Everything that exists today came from provisioning, not from a user.
UPDATE "Rule" SET "builtIn" = true;
