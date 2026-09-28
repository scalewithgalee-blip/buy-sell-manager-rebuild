import { describe, expect, it } from "vitest";
import { summarizeSales } from "../shared/ledger";

describe("summarizeSales", () => {
  it("aggregates packs, revenue, and profit for the dashboard", () => {
    expect(summarizeSales([
      { packs: 12, revenue: 1380, profit: 420 },
      { packs: 26, revenue: 2860, profit: 920 },
    ])).toEqual({ packs: 38, revenue: 4240, profit: 1340 });
  });

  it("returns zero totals for an empty ledger", () => {
    expect(summarizeSales([])).toEqual({ packs: 0, revenue: 0, profit: 0 });
  });
});
