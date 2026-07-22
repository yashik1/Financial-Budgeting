// The single seam through which FinBud pulls in financial data. Today only the
// DemoProvider and CSV importer implement it; Plaid (banks) and SnapTrade
// (brokers) will implement the *same* interface, so switching to real
// connectivity is a config change, not a rewrite. See README "Connectivity".

export type NormalizedAccount = {
  externalId: string;
  name: string;
  type: "checking" | "savings" | "credit" | "investment" | "cash" | "loan";
  institution: string;
  mask: string;
  balanceCents: number; // signed contribution to net worth (liabilities negative)
  isAsset: boolean;
  currency: string;
  color: string;
};

export type NormalizedTransaction = {
  externalId: string;
  accountExternalId: string;
  date: Date;
  amountCents: number; // signed: negative = outflow, positive = inflow
  merchant: string;
  rawDescription: string;
  pending: boolean;
  isTransfer: boolean;
};

export interface AggregationProvider {
  /** Stable id stored on Account.providerId, e.g. "demo" | "plaid" | "snaptrade". */
  readonly id: string;
  /** Human label shown in the "connect an account" UI. */
  readonly label: string;
  getAccounts(): Promise<NormalizedAccount[]>;
  getTransactions(opts?: { months?: number }): Promise<NormalizedTransaction[]>;
}

/** Resolve the active provider from env. Real providers slot in here later. */
export function providerName(): string {
  return process.env.AGGREGATION_PROVIDER || "demo";
}
