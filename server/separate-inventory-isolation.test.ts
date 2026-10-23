import { describe, expect, it } from "vitest";
import {
  calculateNextBoxFundBalance,
  calculateSeparateInventoryBalances,
} from "./db";

describe("separate inventory ledger isolation", () => {
  it("tracks personal withdrawals without changing personal inventory units", () => {
    const personal = calculateSeparateInventoryBalances(
      [
        {
          transactionType: "purchase",
          withdrawalCategory: null,
          unitsDelta: 50,
          costPerUnitCentavos: 70_000,
          revenueCentavos: 0,
          cashCollectedCentavos: -3_500_000,
        },
        {
          transactionType: "personal_withdrawal",
          withdrawalCategory: "transport",
          unitsDelta: 0,
          costPerUnitCentavos: 0,
          revenueCentavos: 0,
          cashCollectedCentavos: -25_000,
        },
      ],
      50
    );

    expect(personal.currentUnits).toBe(50);
    expect(personal.inventoryValueCentavos).toBe(3_500_000);
    expect(personal.cashBalanceCentavos).toBe(-3_525_000);
    expect(personal.totalWithdrawalsCentavos).toBe(25_000);
    expect(personal.withdrawalTotalsByCategory).toEqual([
      { category: "transport", amountCentavos: 25_000 },
    ]);
  });

  it("does not feed personal entries into shared inventory or Next Box Fund totals", () => {
    const sharedBefore = calculateNextBoxFundBalance({
      sales: [{ cogsCentavos: 5_040_000, isVoided: false }],
      inventory: [],
    });
    const sharedAfterPersonalActivity = calculateNextBoxFundBalance({
      sales: [{ cogsCentavos: 5_040_000, isVoided: false }],
      inventory: [],
    });

    expect(sharedAfterPersonalActivity).toEqual(sharedBefore);
    expect(sharedAfterPersonalActivity.availableCentavos).toBe(5_040_000);
  });

  it("keeps personal sales and withdrawals out of shared profit inputs", () => {
    const personal = calculateSeparateInventoryBalances(
      [
        {
          transactionType: "sale",
          withdrawalCategory: null,
          unitsDelta: -10,
          costPerUnitCentavos: 70_000,
          revenueCentavos: 1_000_000,
          cashCollectedCentavos: 1_000_000,
        },
        {
          transactionType: "personal_withdrawal",
          withdrawalCategory: "personal_use",
          unitsDelta: 0,
          costPerUnitCentavos: 0,
          revenueCentavos: 0,
          cashCollectedCentavos: -500_000,
        },
      ],
      50
    );

    expect(personal.grossProfitCentavos).toBe(300_000);
    expect(personal.totalWithdrawalsCentavos).toBe(500_000);
    expect(
      calculateNextBoxFundBalance({ sales: [], inventory: [] }).availableCentavos
    ).toBe(0);
  });
});
