// Dependency-free CSV importer for bank/brokerage statement exports.
// Parses raw CSV text and maps user-selected columns into transactions.

export type ParsedCsv = { headers: string[]; rows: string[][] };

/** RFC-4180-ish parser: handles quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    // Skip fully-empty trailing rows.
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n") {
      pushRow();
    } else if (c === "\r") {
      // handled by \n; ignore
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) pushRow();

  const headers = rows.shift() ?? [];
  return { headers: headers.map((h) => h.trim()), rows };
}

export type ColumnMapping = {
  date: number;
  description: number;
  amount?: number; // single signed column
  debit?: number; // separate outflow column
  credit?: number; // separate inflow column
  // For amount-only files, whether positive means outflow (some banks do this).
  invert?: boolean;
};

export type ImportedRow = {
  date: Date;
  amountCents: number; // signed: negative = outflow
  merchant: string;
  rawDescription: string;
};

export function parseAmountToCents(raw: string): number {
  if (!raw) return 0;
  let s = raw.trim();
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.includes("-")) negative = true;
  s = s.replace(/[^0-9.]/g, "");
  const value = parseFloat(s);
  if (Number.isNaN(value)) return 0;
  return Math.round(value * 100) * (negative ? -1 : 1);
}

/** Derive a clean merchant name from a raw bank description. */
export function cleanMerchant(desc: string): string {
  const cleaned = desc
    // Drop payment-processor prefixes ("SQ *", "TST* ", "PP*", "POS DEBIT" …),
    // keeping the actual merchant name that follows.
    .replace(/\b(SQ|TST|SP|PP|PAYPAL|POS|ACH|DEBIT|CREDIT|PURCHASE|PAYMENT)\b\s*\*?/gi, " ")
    .replace(/\*/g, " ")
    .replace(/#\S*/g, " ") // store numbers like "#0912"
    .replace(/\b\d{3,}\b/g, " ") // long numeric runs
    .replace(/\bID:?\s*\d+/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean).slice(0, 3).join(" ");
  return words || desc.trim();
}

export function mapRows(rows: string[][], m: ColumnMapping): ImportedRow[] {
  const out: ImportedRow[] = [];
  for (const cells of rows) {
    const rawDate = cells[m.date]?.trim();
    const desc = cells[m.description]?.trim() ?? "";
    if (!rawDate) continue;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) continue;

    let cents = 0;
    if (m.amount != null) {
      cents = parseAmountToCents(cells[m.amount] ?? "");
      if (m.invert) cents = -cents;
    } else {
      const debit = m.debit != null ? Math.abs(parseAmountToCents(cells[m.debit] ?? "")) : 0;
      const credit = m.credit != null ? Math.abs(parseAmountToCents(cells[m.credit] ?? "")) : 0;
      cents = credit - debit;
    }
    if (cents === 0 && !desc) continue;

    out.push({
      date,
      amountCents: cents,
      merchant: cleanMerchant(desc),
      rawDescription: desc,
    });
  }
  return out;
}

/** Best-effort guess of a column mapping from header names. */
export function guessMapping(headers: string[]): Partial<ColumnMapping> {
  const idx = (re: RegExp) => headers.findIndex((h) => re.test(h.toLowerCase()));
  const guess: Partial<ColumnMapping> = {};
  const date = idx(/date|posted/);
  const desc = idx(/desc|name|memo|payee|merchant/);
  const amount = idx(/amount|value/);
  const debit = idx(/debit|withdraw|outflow/);
  const credit = idx(/credit|deposit|inflow/);
  if (date >= 0) guess.date = date;
  if (desc >= 0) guess.description = desc;
  if (amount >= 0) guess.amount = amount;
  if (debit >= 0) guess.debit = debit;
  if (credit >= 0) guess.credit = credit;
  return guess;
}
