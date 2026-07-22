import type {
  AggregationProvider,
  NormalizedAccount,
  NormalizedTransaction,
} from "./provider";
import { PALETTE } from "../categories";

// Deterministic PRNG (mulberry32) so the demo data is reproducible.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ACC = {
  checking: "demo-checking",
  savings: "demo-savings",
  credit: "demo-credit",
  brokerage: "demo-brokerage",
};

const DEMO_ACCOUNTS: NormalizedAccount[] = [
  {
    externalId: ACC.checking,
    name: "Everyday Checking",
    type: "checking",
    institution: "Chase",
    mask: "4021",
    balanceCents: 328_640,
    isAsset: true,
    currency: "USD",
    color: PALETTE.sky,
  },
  {
    externalId: ACC.savings,
    name: "High-Yield Savings",
    type: "savings",
    institution: "Ally",
    mask: "8837",
    balanceCents: 1_486_200,
    isAsset: true,
    currency: "USD",
    color: PALETTE.emerald,
  },
  {
    externalId: ACC.credit,
    name: "Sapphire Credit Card",
    type: "credit",
    institution: "Chase",
    mask: "1199",
    balanceCents: -114_530, // owed (liability → negative net-worth contribution)
    isAsset: false,
    currency: "USD",
    color: PALETTE.rose,
  },
  {
    externalId: ACC.brokerage,
    name: "Brokerage",
    type: "investment",
    institution: "Vanguard",
    mask: "5510",
    balanceCents: 2_853_900,
    isAsset: true,
    currency: "USD",
    color: PALETTE.indigo,
  },
];

type MerchantPool = { name: string; desc: string }[];
const GROCERS: MerchantPool = [
  { name: "Whole Foods", desc: "WHOLE FOODS MKT #221" },
  { name: "Trader Joe's", desc: "TRADER JOE'S #455" },
  { name: "Safeway", desc: "SAFEWAY 1123" },
  { name: "Costco", desc: "COSTCO WHOLESALE #12" },
];
const DINING: MerchantPool = [
  { name: "Chipotle", desc: "CHIPOTLE 2841" },
  { name: "Sushi Neko", desc: "SUSHI NEKO RESTAURANT" },
  { name: "DoorDash", desc: "DOORDASH*THAI BASIL" },
  { name: "Uber Eats", desc: "UBER EATS PIZZERIA" },
  { name: "Pete's Pizza", desc: "PETES PIZZA CO" },
];
const COFFEE: MerchantPool = [
  { name: "Starbucks", desc: "STARBUCKS #0912" },
  { name: "Blue Bottle", desc: "BLUE BOTTLE COFFEE" },
  { name: "Dunkin'", desc: "DUNKIN #33812" },
];
const TRANSPORT: MerchantPool = [
  { name: "Uber", desc: "UBER TRIP HELP.UBER.COM" },
  { name: "Lyft", desc: "LYFT *RIDE WED" },
  { name: "Shell", desc: "SHELL OIL 5749821" },
  { name: "Chevron", desc: "CHEVRON 00291" },
];
const SHOPPING: MerchantPool = [
  { name: "Amazon", desc: "AMAZON.COM*RT4A2" },
  { name: "Target", desc: "TARGET T-1188" },
  { name: "Best Buy", desc: "BEST BUY #221" },
];
const ENTERTAINMENT: MerchantPool = [
  { name: "AMC Theatres", desc: "AMC ONLINE 3391" },
  { name: "Steam", desc: "STEAM GAMES PURCHASE" },
  { name: "Ticketmaster", desc: "TICKETMASTER EVENT" },
];
const HEALTH: MerchantPool = [
  { name: "CVS", desc: "CVS/PHARMACY #4471" },
  { name: "Walgreens", desc: "WALGREENS 2201" },
  { name: "Bright Dental", desc: "BRIGHT DENTAL CARE" },
];

function pick<T>(pool: T[], r: number): T {
  return pool[Math.floor(r * pool.length) % pool.length];
}
function amt(min: number, max: number, r: number): number {
  return -Math.round((min + r * (max - min)) * 100);
}

/**
 * Generate lifelike demo accounts + transactions.
 * @param now the "current" date; the latest month is only filled up to `now`.
 */
export function generateDemoFinancials(opts?: {
  months?: number;
  seed?: number;
  now?: Date;
}): { accounts: NormalizedAccount[]; transactions: NormalizedTransaction[] } {
  const months = opts?.months ?? 9;
  const now = opts?.now ?? new Date();
  const rnd = mulberry32(opts?.seed ?? 20260722);
  const txns: NormalizedTransaction[] = [];
  let n = 0;

  const push = (
    account: string,
    day: Date,
    amountCents: number,
    merchant: string,
    desc: string,
    isTransfer = false,
  ) => {
    txns.push({
      externalId: `demo-tx-${n++}`,
      accountExternalId: account,
      date: day,
      amountCents,
      merchant,
      rawDescription: desc,
      pending: false,
      isTransfer,
    });
  };

  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();

  for (let back = months - 1; back >= 0; back--) {
    const monthStart = new Date(Date.UTC(y, m - back, 1));
    const mm = monthStart.getUTCMonth();
    const yy = monthStart.getUTCFullYear();
    const isCurrent = back === 0;
    const lastDay = isCurrent ? now.getUTCDate() : new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
    const day = (d: number) => new Date(Date.UTC(yy, mm, Math.min(d, lastDay), 12));

    // --- Fixed income: two paychecks ---
    push(ACC.checking, day(15), 420_000, "Acme Corp", "ACME CORP PAYROLL DIRECT DEPOSIT", false);
    if (lastDay >= 28) {
      push(ACC.checking, day(lastDay), 420_000, "Acme Corp", "ACME CORP PAYROLL DIRECT DEPOSIT", false);
    }
    // Savings interest
    push(ACC.savings, day(3), Math.round((8 + rnd() * 16) * 100), "Ally Bank", "ALLY INTEREST PAID", false);
    // Quarterly dividend
    if (mm % 3 === 2) {
      push(ACC.brokerage, day(20), Math.round((35 + rnd() * 25) * 100), "Vanguard", "VANGUARD DIVIDEND REINVEST", false);
    }

    // --- Fixed essentials ---
    if (lastDay >= 1) push(ACC.checking, day(1), -185_000, "Greenleaf Apartments", "GREENLEAF LANDLORD RENT", false);
    if (lastDay >= 5) push(ACC.checking, day(5), -Math.round((95 + rnd() * 60) * 100), "PG&E", "PG&E UTILITY BILL", false);
    if (lastDay >= 6) push(ACC.credit, day(6), -9_000, "Comcast", "COMCAST XFINITY INTERNET", false);
    if (lastDay >= 8) push(ACC.credit, day(8), -7_000, "Verizon", "VERIZON WIRELESS", false);
    if (lastDay >= 12) push(ACC.checking, day(12), -14_200, "Geico", "GEICO INSURANCE PREMIUM", false);
    if (lastDay >= 10) push(ACC.credit, day(10), -3_900, "Planet Fitness", "PLANET FITNESS MEMBERSHIP", false);

    // --- Subscriptions ---
    if (lastDay >= 14) push(ACC.credit, day(14), -1_549, "Netflix", "NETFLIX.COM", false);
    if (lastDay >= 16) push(ACC.credit, day(16), -1_199, "Spotify", "SPOTIFY USA", false);
    if (lastDay >= 18 && rnd() > 0.4) push(ACC.credit, day(18), -1_399, "Disney+", "DISNEY PLUS", false);

    // --- Savings & investing (transfers, excluded from spend) ---
    if (lastDay >= 16) {
      push(ACC.checking, day(16), -50_000, "Transfer", "TRANSFER TO SAVINGS", true);
      push(ACC.savings, day(16), 50_000, "Transfer", "TRANSFER FROM CHECKING", true);
    }
    if (lastDay >= 17) push(ACC.checking, day(17), -60_000, "Vanguard", "VANGUARD INVESTMENT CONTRIB", true);

    // --- Variable spending ---
    const scatter = (count: number, pool: MerchantPool, min: number, max: number, acc: string) => {
      for (let i = 0; i < count; i++) {
        const d = 1 + Math.floor(rnd() * lastDay);
        const mch = pick(pool, rnd());
        push(acc, day(d), amt(min, max, rnd()), mch.name, mch.desc, false);
      }
    };
    scatter(4 + Math.floor(rnd() * 3), GROCERS, 38, 135, ACC.credit);
    scatter(6 + Math.floor(rnd() * 6), DINING, 12, 64, ACC.credit);
    scatter(8 + Math.floor(rnd() * 10), COFFEE, 4, 7, ACC.credit);
    scatter(4 + Math.floor(rnd() * 4), TRANSPORT, 14, 58, ACC.credit);
    scatter(2 + Math.floor(rnd() * 3), SHOPPING, 18, 180, ACC.credit);
    if (rnd() > 0.4) scatter(1 + Math.floor(rnd() * 2), ENTERTAINMENT, 14, 60, ACC.credit);
    if (rnd() > 0.6) scatter(1, HEALTH, 15, 120, ACC.credit);
    // A rare uncategorizable purchase, so the UI shows an "uncategorized" state.
    if (rnd() > 0.75) push(ACC.credit, day(2 + Math.floor(rnd() * 20)), amt(9, 45, rnd()), "Sunrise Mkt", "SQ *SUNRISE MKT", false);
  }

  return { accounts: DEMO_ACCOUNTS, transactions: txns };
}

/** DemoProvider implements the same interface real providers will. */
export class DemoProvider implements AggregationProvider {
  readonly id = "demo";
  readonly label = "Demo data";
  private now: Date;
  constructor(now: Date = new Date()) {
    this.now = now;
  }
  async getAccounts(): Promise<NormalizedAccount[]> {
    return DEMO_ACCOUNTS;
  }
  async getTransactions(opts?: { months?: number }): Promise<NormalizedTransaction[]> {
    return generateDemoFinancials({ months: opts?.months ?? 9, now: this.now }).transactions;
  }
}
