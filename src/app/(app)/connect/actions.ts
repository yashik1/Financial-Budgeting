"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  isPlaidEnabled,
  createPlaidLinkToken,
  exchangePlaidPublicToken,
  fetchPlaidSync,
} from "@/lib/aggregation/plaid";
import {
  isSnapTradeEnabled,
  registerSnapTradeUser,
  getSnapTradePortalUrl,
  fetchSnapTradeData,
} from "@/lib/aggregation/snaptrade";
import { upsertAccounts, upsertTransactions, removeTransactions } from "@/lib/aggregation/sync";

type Result = { ok: boolean; message: string; imported?: number };

// ----------------------------- Plaid -----------------------------

export async function startPlaidLink(): Promise<{ linkToken?: string; error?: string }> {
  await requireUser();
  if (!isPlaidEnabled()) return { error: "Plaid keys are not configured." };
  const user = await requireUser();
  try {
    const linkToken = await createPlaidLinkToken(user.id);
    return { linkToken };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not start Plaid Link." };
  }
}

export async function finishPlaidLink(publicToken: string): Promise<Result> {
  const user = await requireUser();
  if (!isPlaidEnabled()) return { ok: false, message: "Plaid keys are not configured." };
  try {
    const { accessToken, itemId } = await exchangePlaidPublicToken(publicToken);
    await prisma.plaidItem.upsert({
      where: { itemId },
      update: { accessToken },
      create: { userId: user.id, itemId, accessToken },
    });
    const imported = await syncOnePlaidItem(user.id, itemId, accessToken, null);
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    return { ok: true, message: "Bank connected.", imported };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed to connect bank." };
  }
}

async function syncOnePlaidItem(userId: string, itemId: string, accessToken: string, cursor: string | null) {
  const { accounts, added, removedIds, nextCursor } = await fetchPlaidSync(accessToken, cursor ?? undefined);
  const accountMap = await upsertAccounts(userId, "plaid", accounts);
  await removeTransactions(userId, removedIds);
  const imported = await upsertTransactions(userId, accountMap, added);
  await prisma.plaidItem.update({ where: { itemId }, data: { cursor: nextCursor } });
  return imported;
}

export async function syncPlaid(): Promise<Result> {
  const user = await requireUser();
  if (!isPlaidEnabled()) return { ok: false, message: "Plaid keys are not configured." };
  const items = await prisma.plaidItem.findMany({ where: { userId: user.id } });
  if (items.length === 0) return { ok: false, message: "No banks connected yet." };
  try {
    let imported = 0;
    for (const item of items) {
      imported += await syncOnePlaidItem(user.id, item.itemId, item.accessToken, item.cursor);
    }
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    return { ok: true, message: `Synced ${items.length} bank connection(s).`, imported };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Sync failed." };
  }
}

// ---------------------------- SnapTrade ----------------------------

export async function connectSnapTrade(): Promise<{ url?: string; error?: string }> {
  const user = await requireUser();
  if (!isSnapTradeEnabled()) return { error: "SnapTrade keys are not configured." };
  try {
    let conn = await prisma.snapTradeConnection.findUnique({ where: { userId: user.id } });
    if (!conn) {
      const { snapUserId, userSecret } = await registerSnapTradeUser(user.id);
      conn = await prisma.snapTradeConnection.create({
        data: { userId: user.id, snapUserId, userSecret },
      });
    }
    const url = await getSnapTradePortalUrl(conn.snapUserId, conn.userSecret);
    return { url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not start SnapTrade." };
  }
}

export async function syncSnapTrade(): Promise<Result> {
  const user = await requireUser();
  if (!isSnapTradeEnabled()) return { ok: false, message: "SnapTrade keys are not configured." };
  const conn = await prisma.snapTradeConnection.findUnique({ where: { userId: user.id } });
  if (!conn) return { ok: false, message: "No brokerage connected yet." };
  try {
    const { accounts, transactions } = await fetchSnapTradeData(conn.snapUserId, conn.userSecret);
    const accountMap = await upsertAccounts(user.id, "snaptrade", accounts);
    const imported = await upsertTransactions(user.id, accountMap, transactions);
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    return { ok: true, message: "Brokerage synced.", imported };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Sync failed." };
  }
}
