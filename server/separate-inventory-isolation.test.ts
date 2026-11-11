import { describe, expect, it } from "vitest";
import {
  calculateNextBoxFundBalance,
  calculateSeparateInventoryBalances,
  calculateSeparateInventoryPeriodMetrics,
  calculateSeparateSalesRhythm,
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

  it("reports personal gross profit by the same bounded weekly windows as shared reports", () => {
    const rows = [
      {
        transactionDate: new Date("2026-11-02T12:00:00.000Z"),
        transactionType: "sale",
        unitsDelta: -10,
        costPerUnitCentavos: 70_000,
        revenueCentavos: 1_000_000,
        cashCollectedCentavos: 1_000_000,
      },
      {
        transactionDate: new Date("2026-10-25T12:00:00.000Z"),
        transactionType: "sale",
        unitsDelta: -5,
        costPerUnitCentavos: 70_000,
        revenueCentavos: 450_000,
        cashCollectedCentavos: 450_000,
      },
      {
        transactionDate: new Date("2026-11-04T12:00:00.000Z"),
        transactionType: "personal_expense",
        unitsDelta: 0,
        costPerUnitCentavos: 0,
        revenueCentavos: 0,
        cashCollectedCentavos: -100_000,
      },
      {
        transactionDate: new Date("2026-11-05T12:00:00.000Z"),
        transactionType: "personal_profit_distribution",
        unitsDelta: 0,
        costPerUnitCentavos: 0,
        revenueCentavos: 0,
        cashCollectedCentavos: -100_000,
      },
    ];

    const thisWeek = calculateSeparateInventoryPeriodMetrics(
      rows,
      new Date("2026-11-02T00:00:00.000Z"),
      new Date("2026-11-06T00:00:00.000Z")
    );
    const lastWeek = calculateSeparateInventoryPeriodMetrics(
      rows,
      new Date("2026-10-26T00:00:00.000Z"),
      new Date("2026-11-02T00:00:00.000Z")
    );

    expect(thisWeek.grossProfitCentavos).toBe(300_000);
    expect(thisWeek.expensesCentavos).toBe(100_000);
    expect(thisWeek.netProfitCentavos).toBe(200_000);
    expect(thisWeek.distributedCentavos).toBe(100_000);
    expect(thisWeek.availableToDistributeCentavos).toBe(100_000);
    expect(thisWeek.unitsSold).toBe(10);
    expect(lastWeek.grossProfitCentavos).toBe(0);
    expect(lastWeek.unitsSold).toBe(0);
  });

  it("builds personal Sales Rhythm series with shared weekly and yearly boundaries", () => {
    const rows = [
      {
        transactionDate: new Date("2026-11-09T12:00:00.000Z"),
        transactionType: "sale",
        unitsDelta: -10,
        costPerUnitCentavos: 70_000,
        revenueCentavos: 1_000_000,
      },
      {
        transactionDate: new Date("2026-11-11T12:00:00.000Z"),
        transactionType: "sale",
        unitsDelta: -5,
        costPerUnitCentavos: 70_000,
        revenueCentavos: 450_000,
      },
      {
        transactionDate: new Date("2026-11-08T12:00:00.000Z"),
        transactionType: "sale",
        unitsDelta: -99,
        costPerUnitCentavos: 70_000,
        revenueCentavos: 9_900_000,
      },
    ];

    const rhythm = calculateSeparateSalesRhythm(
      rows,
      new Date("2026-11-11T12:00:00.000Z")
    );

    expect(rhythm.week.unitsSold).toBe(15);
    expect(rhythm.week.grossProfitCentavos).toBe(400_000);
    expect(rhythm.week.bestDayUnits).toBe(10);
    expect(rhythm.week.data).toHaveLength(7);
    expect(rhythm.month.unitsSold).toBe(114);
    expect(rhythm.month.data).toHaveLength(12);
  });
});
