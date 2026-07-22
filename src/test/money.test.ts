import { describe, it, expect } from "vitest";
import { formatCents, safeCurrency, isSupportedCurrency, currencySymbol } from "@/lib/money";

describe("safeCurrency", () => {
  it("keeps valid ISO codes and falls back to USD otherwise", () => {
    expect(safeCurrency("eur")).toBe("EUR");
    expect(safeCurrency("JPY")).toBe("JPY");
    expect(safeCurrency("nonsense")).toBe("USD");
    expect(safeCurrency(null)).toBe("USD");
    expect(safeCurrency("")).toBe("USD");
  });
});

describe("isSupportedCurrency", () => {
  it("accepts real currencies and rejects junk", () => {
    expect(isSupportedCurrency("GBP")).toBe(true);
    expect(isSupportedCurrency("ZZZ")).toBe(false);
    expect(isSupportedCurrency("US")).toBe(false);
  });
});

describe("formatCents across currencies", () => {
  it("formats USD with two decimals", () => {
    expect(formatCents(367000, { currency: "USD" })).toBe("$3,670.00");
  });

  it("respects zero-decimal currencies (JPY has no minor unit)", () => {
    const jpy = formatCents(367000, { currency: "JPY" });
    expect(jpy).toContain("3,670");
    expect(jpy).not.toContain(".00");
  });

  it("signs and negatives use the same minus glyph", () => {
    expect(formatCents(-500, { currency: "USD" }).startsWith("−")).toBe(true);
    expect(formatCents(500, { currency: "USD", signed: true }).startsWith("+")).toBe(true);
  });

  it("compact drops decimals and abbreviates large values", () => {
    expect(formatCents(4554210, { currency: "USD", compact: true })).not.toContain(".");
  });

  it("falls back to USD for an unknown code instead of throwing", () => {
    expect(() => formatCents(1000, { currency: "ZZZ" })).not.toThrow();
    expect(formatCents(1000, { currency: "ZZZ" })).toBe("$10.00");
  });
});

describe("currencySymbol", () => {
  it("returns the symbol for the currency", () => {
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("EUR")).toBe("€");
  });
});
