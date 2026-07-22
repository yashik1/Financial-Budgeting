import "server-only";
import { prisma } from "../db";
import { categorize } from "../categorize";
import type { NormalizedAccount, NormalizedTransaction } from "./provider";

// Persist normalized provider data into FinBud's schema. Idempotent: accounts
// are keyed by externalId, transactions de-duplicated by externalId.

export async function upsertAccounts(
  userId: string,
  providerId: string,
  accounts: NormalizedAccount[],
  institutionOverride?: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const a of accounts) {
    const institution = institutionOverride ?? a.institution;
    const existing = await prisma.account.findFirst({
      where: { userId, externalId: a.externalId },
    });
    if (existing) {
      const updated = await prisma.account.update({
        where: { id: existing.id },
        data: { balanceCents: a.balanceCents, name: a.name, institution },
      });
      map.set(a.externalId, updated.id);
    } else {
      const created = await prisma.account.create({
        data: {
          userId,
          name: a.name,
          type: a.type,
          institution,
          mask: a.mask,
          balanceCents: a.balanceCents,
          currency: a.currency,
          isAsset: a.isAsset,
          color: a.color,
          providerId,
          externalId: a.externalId,
        },
      });
      map.set(a.externalId, created.id);
    }
  }
  return map;
}

export async function upsertTransactions(
  userId: string,
  accountMap: Map<string, string>,
  txns: NormalizedTransaction[],
): Promise<number> {
  if (txns.length === 0) return 0;

  const rules = (await prisma.rule.findMany({ where: { userId } })).map((r) => ({
    matcher: r.matcher,
    category: r.categoryId,
    priority: r.priority,
  }));

  // Skip transactions we've already stored (idempotent re-sync).
  const externalIds = txns.map((t) => t.externalId).filter(Boolean);
  const seen = new Set(
    (
      await prisma.transaction.findMany({
        where: { userId, externalId: { in: externalIds } },
        select: { externalId: true },
      })
    ).map((t) => t.externalId),
  );

  const data = txns
    .filter((t) => !seen.has(t.externalId))
    .map((t) => {
      const accountId = accountMap.get(t.accountExternalId);
      if (!accountId) return null;
      return {
        userId,
        accountId,
        date: t.date,
        amountCents: t.amountCents,
        merchant: t.merchant,
        rawDescription: t.rawDescription,
        pending: t.pending,
        isTransfer: t.isTransfer,
        externalId: t.externalId,
        categoryId: categorize(t.rawDescription || t.merchant, rules),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (data.length) await prisma.transaction.createMany({ data });
  return data.length;
}

export async function removeTransactions(userId: string, externalIds: string[]): Promise<void> {
  if (externalIds.length === 0) return;
  await prisma.transaction.deleteMany({ where: { userId, externalId: { in: externalIds } } });
}
