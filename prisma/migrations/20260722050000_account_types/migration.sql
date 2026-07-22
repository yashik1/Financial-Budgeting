-- Account subtype + jurisdiction, and a per-user default country.
ALTER TABLE "Account" ADD COLUMN "subtype" TEXT;
ALTER TABLE "Account" ADD COLUMN "country" TEXT;
ALTER TABLE "User" ADD COLUMN "country" TEXT;
