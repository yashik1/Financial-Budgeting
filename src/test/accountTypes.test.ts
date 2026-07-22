import { describe, it, expect } from "vitest";
import {
  subtypesForCountry,
  subtypesFor,
  kindForSubtype,
  isAssetForKind,
  accountTypeLabel,
  kindLabel,
} from "@/lib/accountTypes";

describe("subtypesForCountry", () => {
  it("returns generics plus the country's own products", () => {
    const ca = subtypesForCountry("CA").map((s) => s.code);
    expect(ca).toContain("tfsa");
    expect(ca).toContain("rrsp");
    expect(ca).toContain("brokerage"); // generic
    expect(ca).not.toContain("401k"); // US-only
  });

  it("is case-insensitive and defaults to generics only", () => {
    expect(subtypesForCountry("us").map((s) => s.code)).toContain("401k");
    const none = subtypesForCountry(null).map((s) => s.code);
    expect(none).toContain("brokerage");
    expect(none).not.toContain("tfsa");
  });
});

describe("subtypesFor (country + kind)", () => {
  it("narrows to a single kind for the cascading picker", () => {
    const caInvest = subtypesFor("CA", "investment").map((s) => s.code);
    expect(caInvest).toContain("tfsa");
    expect(subtypesFor("CA", "checking")).toHaveLength(0);
  });
});

describe("kindForSubtype", () => {
  it("maps a product to its universal kind", () => {
    expect(kindForSubtype("roth_ira")).toBe("investment");
    expect(kindForSubtype("hsa")).toBe("savings");
    expect(kindForSubtype("unknown")).toBeUndefined();
  });
});

describe("isAssetForKind", () => {
  it("treats credit and loan as liabilities", () => {
    expect(isAssetForKind("checking")).toBe(true);
    expect(isAssetForKind("investment")).toBe(true);
    expect(isAssetForKind("credit")).toBe(false);
    expect(isAssetForKind("loan")).toBe(false);
  });
});

describe("accountTypeLabel", () => {
  it("shows the short product name when a subtype is set, else the kind", () => {
    expect(accountTypeLabel({ type: "investment", subtype: "tfsa" })).toBe("TFSA");
    expect(accountTypeLabel({ type: "checking", subtype: null })).toBe("Checking");
    expect(kindLabel("credit")).toBe("Credit card");
  });
});
