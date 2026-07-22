import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  type AccountBase,
  type Transaction as PlaidTransaction,
} from "plaid";
import type { NormalizedAccount, NormalizedTransaction } from "./provider";
import { PALETTE } from "../categories";

// Plaid = banks, cards, transactions. This module is only exercised when
// PLAID_CLIENT_ID / PLAID_SECRET are set; otherwise the app stays on demo data.

export function isPlaidEnabled(): boolean {
  return !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

export function plaidClient(): PlaidApi {
  const env = (process.env.PLAID_ENV || "sandbox") as keyof typeof PlaidEnvironments;
  const config = new Configuration({
    basePath: PlaidEnvironments[env] ?? PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  });
  return new PlaidApi(config);
}

/** Link token drives the Plaid Link UI on the client. */
export async function createPlaidLinkToken(userId: string): Promise<string> {
  const res = await plaidClient().linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "FinBud",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
  });
  return res.data.link_token;
}

/** Exchange the short-lived public_token (from Link) for a durable access_token. */
export async function exchangePlaidPublicToken(
  publicToken: string,
): Promise<{ accessToken: string; itemId: string }> {
  const res = await plaidClient().itemPublicTokenExchange({ public_token: publicToken });
  return { accessToken: res.data.access_token, itemId: res.data.item_id };
}

const ACCOUNT_COLORS = [PALETTE.sky, PALETTE.emerald, PALETTE.rose, PALETTE.indigo, PALETTE.amber, PALETTE.violet];

function mapAccountType(a: AccountBase): { type: NormalizedAccount["type"]; isAsset: boolean } {
  const type = String(a.type);
  const subtype = String(a.subtype ?? "");
  if (type === "credit") return { type: "credit", isAsset: false };
  if (type === "loan") return { type: "loan", isAsset: false };
  if (type === "investment") return { type: "investment", isAsset: true };
  if (type === "depository") {
    if (subtype === "savings") return { type: "savings", isAsset: true };
    if (subtype === "checking") return { type: "checking", isAsset: true };
    return { type: "cash", isAsset: true };
  }
  return { type: "cash", isAsset: true };
}

export function mapPlaidAccount(a: AccountBase, i = 0): NormalizedAccount {
  const { type, isAsset } = mapAccountType(a);
  const current = a.balances.current ?? 0;
  return {
    externalId: a.account_id,
    name: a.name || a.official_name || "Account",
    type,
    institution: "Bank",
    mask: a.mask ?? "0000",
    // Liabilities contribute negatively to net worth.
    balanceCents: Math.round((isAsset ? current : -current) * 100),
    isAsset,
    currency: a.balances.iso_currency_code ?? "USD",
    color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
  };
}

export function mapPlaidTransaction(t: PlaidTransaction): NormalizedTransaction {
  // Plaid sign convention is the OPPOSITE of ours: positive = money out of the
  // account. We negate so that negative = outflow (spending).
  return {
    externalId: t.transaction_id,
    accountExternalId: t.account_id,
    date: new Date(t.date),
    amountCents: Math.round(-t.amount * 100),
    merchant: t.merchant_name || t.name,
    rawDescription: t.name,
    pending: t.pending,
    isTransfer: (t.personal_finance_category?.primary ?? "") === "TRANSFER_IN" ||
      (t.personal_finance_category?.primary ?? "") === "TRANSFER_OUT",
  };
}

export type PlaidSyncResult = {
  accounts: NormalizedAccount[];
  added: NormalizedTransaction[];
  removedIds: string[];
  nextCursor: string;
};

/** Pull accounts + an incremental transaction delta since `cursor`. */
export async function fetchPlaidSync(accessToken: string, cursor?: string): Promise<PlaidSyncResult> {
  const client = plaidClient();

  const accountsRes = await client.accountsGet({ access_token: accessToken });
  const accounts = accountsRes.data.accounts.map((a, i) => mapPlaidAccount(a, i));

  const added: NormalizedTransaction[] = [];
  const removedIds: string[] = [];
  let nextCursor = cursor ?? "";
  let hasMore = true;

  while (hasMore) {
    const res = await client.transactionsSync({
      access_token: accessToken,
      cursor: nextCursor || undefined,
    });
    added.push(...res.data.added.map(mapPlaidTransaction));
    added.push(...res.data.modified.map(mapPlaidTransaction));
    removedIds.push(...res.data.removed.map((r) => r.transaction_id!).filter(Boolean));
    nextCursor = res.data.next_cursor;
    hasMore = res.data.has_more;
  }

  return { accounts, added, removedIds, nextCursor };
}

/** Interface conformance: a per-item snapshot view (used by generic callers). */
export class PlaidProvider {
  readonly id = "plaid";
  readonly label = "Plaid (banks & cards)";
  constructor(private accessToken: string) {}
  async getAccounts(): Promise<NormalizedAccount[]> {
    const res = await plaidClient().accountsGet({ access_token: this.accessToken });
    return res.data.accounts.map((a, i) => mapPlaidAccount(a, i));
  }
  async getTransactions(): Promise<NormalizedTransaction[]> {
    return (await fetchPlaidSync(this.accessToken)).added;
  }
}
