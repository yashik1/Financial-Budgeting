import { describe, it, expect } from "vitest";
import { parseCsv, parseAmountToCents, mapRows, guessMapping, cleanMerchant } from "@/lib/aggregation/csv";

describe("parseCsv", () => {
  it("parses headers and rows, honoring quotes", () => {
    const text = `Date,Description,Amount\n2026-07-01,"STORE, INC",-12.50\n2026-07-02,COFFEE,-5.00\n`;
    const { headers, rows } = parseCsv(text);
    expect(headers).toEqual(["Date", "Description", "Amount"]);
    expect(rows).toHaveLength(2);
    expect(rows[0][1]).toBe("STORE, INC");
  });
});

describe("parseAmountToCents", () => {
  it("handles symbols, commas, parentheses and signs", () => {
    expect(parseAmountToCents("$1,234.56")).toBe(123456);
    expect(parseAmountToCents("-12.50")).toBe(-1250);
    expect(parseAmountToCents("(9.99)")).toBe(-999);
    expect(parseAmountToCents("")).toBe(0);
  });
});

describe("guessMapping + mapRows", () => {
  it("guesses columns and maps a single signed amount", () => {
    const { headers, rows } = parseCsv(`Date,Description,Amount\n2026-07-01,WHOLE FOODS,-86.42\n`);
    const g = guessMapping(headers);
    expect(g.date).toBe(0);
    expect(g.description).toBe(1);
    expect(g.amount).toBe(2);
    const mapped = mapRows(rows, { date: g.date!, description: g.description!, amount: g.amount! });
    expect(mapped[0].amountCents).toBe(-8642);
    expect(mapped[0].merchant).toContain("WHOLE FOODS");
  });

  it("maps separate debit/credit columns", () => {
    const { rows } = parseCsv(`Date,Desc,Debit,Credit\n2026-07-01,PAY,,4200.00\n2026-07-02,RENT,1850.00,\n`);
    const mapped = mapRows(rows, { date: 0, description: 1, debit: 2, credit: 3 });
    expect(mapped[0].amountCents).toBe(420000); // credit → inflow
    expect(mapped[1].amountCents).toBe(-185000); // debit → outflow
  });
});

describe("cleanMerchant", () => {
  it("strips noise into a readable name", () => {
    expect(cleanMerchant("SQ *SUNRISE MKT 12345")).toBe("SUNRISE MKT");
  });
});
