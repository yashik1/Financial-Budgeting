import { Snaptrade } from "snaptrade-typescript-sdk";
import type { NormalizedAccount, NormalizedTransaction } from "./provider";
import { PALETTE } from "../categories";

// SnapTrade = brokerages & crypto exchanges. Exercised only when
// SNAPTRADE_CLIENT_ID / SNAPTRADE_CONSUMER_KEY are set.

export function isSnapTradeEnabled(): boolean {
  return !!(process.env.SNAPTRADE_CLIENT_ID && process.env.SNAPTRADE_CONSUMER_KEY);
}

export function snapClient(): Snaptrade {
  return new Snaptrade({
    clientId: process.env.SNAPTRADE_CLIENT_ID!,
    consumerKey: process.env.SNAPTRADE_CONSUMER_KEY!,
  });
}

/** Register (or return an existing) SnapTrade user; returns the userSecret. */
export async function registerSnapTradeUser(
  userId: string,
): Promise<{ snapUserId: string; userSecret: string }> {
  const res = await snapClient().authentication.registerSnapTradeUser({ userId });
  return { snapUserId: res.data.userId ?? userId, userSecret: res.data.userSecret ?? "" };
}

/** URL to SnapTrade's hosted connection portal (redirect the user here). */
export async function getSnapTradePortalUrl(userId: string, userSecret: string): Promise<string> {
  const res = await snapClient().authentication.loginSnapTradeUser({ userId, userSecret });
  const data = res.data as { redirectURI?: string };
  return data.redirectURI ?? "";
}

function mapSnapAccount(a: any, i = 0): NormalizedAccount {
  const total = a?.balance?.total;
  return {
    externalId: String(a?.id ?? `snap-${i}`),
    name: a?.name || a?.institution_name || "Brokerage",
    type: "investment",
    institution: a?.institution_name || "Brokerage",
    mask: String(a?.number ?? "").slice(-4) || "0000",
    balanceCents: Math.round((total?.amount ?? 0) * 100),
    isAsset: true,
    currency: total?.currency?.code || total?.currency || "USD",
    color: [PALETTE.indigo, PALETTE.teal, PALETTE.violet][i % 3],
  };
}

const TRANSFER_TYPES = new Set(["TRANSFER", "CONTRIBUTION", "DEPOSIT", "WITHDRAWAL", "INTERNAL_CASH_TRANSFER"]);

function mapSnapActivity(act: any): NormalizedTransaction {
  const type = String(act?.type ?? "").toUpperCase();
  const symbol = act?.symbol?.symbol || act?.symbol?.raw_symbol;
  const desc = act?.description || `${type} ${symbol ?? ""}`.trim() || "Activity";
  return {
    externalId: String(act?.id ?? `${act?.account?.id}-${act?.trade_date}-${act?.amount}`),
    accountExternalId: String(act?.account?.id ?? act?.account ?? ""),
    date: new Date(act?.trade_date || act?.settlement_date || Date.now()),
    amountCents: Math.round((act?.amount ?? 0) * 100),
    merchant: symbol || desc,
    rawDescription: desc,
    pending: false,
    isTransfer: TRANSFER_TYPES.has(type),
  };
}

export type SnapTradeData = {
  accounts: NormalizedAccount[];
  transactions: NormalizedTransaction[];
};

/** Pull the user's brokerage accounts and recent activities. */
export async function fetchSnapTradeData(userId: string, userSecret: string): Promise<SnapTradeData> {
  const client = snapClient();

  const accountsRes = await client.accountInformation.listUserAccounts({ userId, userSecret });
  const accounts = (accountsRes.data as any[]).map((a, i) => mapSnapAccount(a, i));

  const activitiesRes = await client.transactionsAndReporting.getActivities({ userId, userSecret });
  // Response may be an array or a paginated { data: [...] } envelope.
  const raw = activitiesRes.data as any;
  const list: any[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
  const transactions = list
    .filter((a) => a?.account)
    .map(mapSnapActivity);

  return { accounts, transactions };
}
