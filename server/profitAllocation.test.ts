import { describe, expect, it } from "vitest";
import {
  buildCapitalHistoryTimeline,
  calculateCapitalBasedProfitShares,
  calculateNextBoxFundBalance,
  calculateProfitSplit,
} from "./db";

describe("capital-based daily profit allocation", () => {
  it.each([
    [70_000, 70_000, 5_000, 5_000],
    [140_000, 70_000, 6_667, 3_333],
    [210_000, 70_000, 7_500, 2_500],
    [280_000, 70_000, 8_000, 2_000],
    [280_000, 140_000, 6_667, 3_333],
  ])(
    "calculates %s/%s capital as %s/%s basis points",
    (gale, nikki, expectedGale, expectedNikki) => {
      const result = calculateCapitalBasedProfitShares(gale, nikki);
      expect(result.galeShareBasisPoints).toBe(expectedGale);
      expect(result.nikkiShareBasisPoints).toBe(expectedNikki);
      expect(result.galeShareBasisPoints + result.nikkiShareBasisPoints).toBe(
        10_000
      );
      expect(result.dadShareBasisPoints).toBe(0);
    }
  );

  it("allocates gross profit only to Gale and Nikki, preserving the stored ratio", () => {
    const allocation = calculateProfitSplit(10_000_00, [
      { ownerId: 1, shareBasisPoints: 6_667 },
      { ownerId: 2, shareBasisPoints: 3_333 },
      { ownerId: 3, shareBasisPoints: 0 },
    ]);
    expect(allocation).toEqual([
      { ownerId: 1, shareBasisPoints: 6_667, amountCentavos: 666_700 },
      { ownerId: 2, shareBasisPoints: 3_333, amountCentavos: 333_300 },
    ]);
    expect(allocation.reduce((sum, item) => sum + item.amountCentavos, 0)).toBe(
      1_000_000
    );
  });

  it("rejects a zero-capital investor pool instead of inventing a profit split", () => {
    expect(() => calculateCapitalBasedProfitShares(0, 0)).toThrow(
      /positive current capital/
    );
  });

  it("recovers COGS into Next Box Fund and keeps distributions separate", () => {
    const beforeReplacement = calculateNextBoxFundBalance({
      sales: [{ cogsCentavos: 3_500_000, isVoided: false }],
      inventory: [],
    });
    expect(beforeReplacement.availableCentavos).toBe(3_500_000);

    const afterReplacement = calculateNextBoxFundBalance({
      sales: [{ cogsCentavos: 3_500_000, isVoided: false }],
      inventory: [
        {
          transactionType: "purchase",
          fundingSource: "retained_cash",
          unitsDelta: 50,
          costPerUnitCentavos: 70_000,
        },
      ],
    });
    expect(afterReplacement.availableCentavos).toBe(0);
    expect(afterReplacement.cogsRecoveredCentavos).toBe(3_500_000);
    expect(afterReplacement.replacementPurchasesCentavos).toBe(3_500_000);
  });

  it("records each posted capital change that changes the future split", () => {
    const timeline = buildCapitalHistoryTimeline(
      [
        {
          id: 1,
          transactionDate: new Date("2026-09-22T00:00:00Z"),
          ownerId: 1,
          transactionType: "capital_contribution",
          amountCentavos: 14_000_000,
        },
        {
          id: 2,
          transactionDate: new Date("2026-09-22T00:00:00Z"),
          ownerId: 2,
          transactionType: "capital_contribution",
          amountCentavos: 7_000_000,
        },
        {
          id: 3,
          transactionDate: new Date("2026-09-23T00:00:00Z"),
          ownerId: 1,
          transactionType: "capital_withdrawal",
          amountCentavos: 7_000_000,
        },
      ],
      1,
      2
    );
    expect(
      timeline.map(entry => [
        entry.galeShareBasisPoints,
        entry.nikkiShareBasisPoints,
      ])
    ).toEqual([
      [10_000, 0],
      [6_667, 3_333],
      [5_000, 5_000],
    ]);
    expect(timeline.at(-1)).toMatchObject({
      changedOwnerName: "Gale",
      galeCurrentCapitalCentavos: 7_000_000,
      nikkiCurrentCapitalCentavos: 7_000_000,
      dadShareBasisPoints: 0,
    });
  });
});
