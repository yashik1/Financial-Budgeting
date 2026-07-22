import { describe, it, expect } from "vitest";
import { addMonthsToKey, isMonthKey, lastMonths, safeMonthKey } from "@/lib/dates";

describe("addMonthsToKey", () => {
  it("moves forward and backward, crossing year boundaries", () => {
    expect(addMonthsToKey("2026-07", -1)).toBe("2026-06");
    expect(addMonthsToKey("2026-01", -1)).toBe("2025-12");
    expect(addMonthsToKey("2026-12", 1)).toBe("2027-01");
  });
});

describe("isMonthKey", () => {
  it("accepts YYYY-MM and rejects junk", () => {
    expect(isMonthKey("2026-07")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-00")).toBe(false);
    expect(isMonthKey("2026-7")).toBe(false);
    expect(isMonthKey("nope")).toBe(false);
  });
});

describe("safeMonthKey", () => {
  it("clamps to max (no browsing the future) and falls back on bad input", () => {
    expect(safeMonthKey("2026-03", "2026-07")).toBe("2026-03");
    expect(safeMonthKey("2026-09", "2026-07")).toBe("2026-07"); // future clamped
    expect(safeMonthKey(undefined, "2026-07")).toBe("2026-07");
    expect(safeMonthKey("garbage", "2026-07")).toBe("2026-07");
  });
});

describe("lastMonths", () => {
  it("returns count keys, oldest first, ending at end", () => {
    expect(lastMonths(3, "2026-07")).toEqual(["2026-05", "2026-06", "2026-07"]);
  });
});
