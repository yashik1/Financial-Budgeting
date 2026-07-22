import { describe, it, expect } from "vitest";
import { categorize } from "@/lib/categorize";
import { DEFAULT_RULES } from "@/lib/categories";

describe("categorize", () => {
  it("matches a known merchant", () => {
    expect(categorize("STARBUCKS #0912", DEFAULT_RULES)).toBe("Coffee");
    expect(categorize("WHOLE FOODS MKT #221", DEFAULT_RULES)).toBe("Groceries");
    expect(categorize("ACME CORP PAYROLL DIRECT DEPOSIT", DEFAULT_RULES)).toBe("Paycheck");
  });

  it("is case-insensitive", () => {
    expect(categorize("netflix.com", DEFAULT_RULES)).toBe("Subscriptions");
  });

  it("returns null when nothing matches", () => {
    expect(categorize("QUANTUM WIDGETS LLC", DEFAULT_RULES)).toBeNull();
  });

  it("prefers the more specific (longer) match", () => {
    const rules = [
      { matcher: "air", category: "Generic" },
      { matcher: "united air", category: "Travel" },
    ];
    expect(categorize("UNITED AIR 123", rules)).toBe("Travel");
  });

  it("breaks ties by priority", () => {
    const rules = [
      { matcher: "shop", category: "A", priority: 1 },
      { matcher: "shop", category: "B", priority: 5 },
    ];
    expect(categorize("corner shop", rules)).toBe("B");
  });
});
