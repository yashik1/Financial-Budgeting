import { describe, it, expect } from "vitest";
import { netWorthSeries } from "@/lib/networth";

describe("netWorthSeries", () => {
  it("reconstructs history by removing each month's net flow", () => {
    const series = netWorthSeries(1000, [
      { month: "2026-05", netCents: 200 },
      { month: "2026-06", netCents: 300 },
      { month: "2026-07", netCents: 500 },
    ]);
    // newest is the known current total
    expect(series[2]).toEqual({ month: "2026-07", cents: 1000 });
    // end of June = 1000 - July's 500
    expect(series[1].cents).toBe(500);
    // end of May = 500 - June's 300
    expect(series[0].cents).toBe(200);
  });

  it("handles empty input", () => {
    expect(netWorthSeries(1000, [])).toEqual([]);
  });
});
