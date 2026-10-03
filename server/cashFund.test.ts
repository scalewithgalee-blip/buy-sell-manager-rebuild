import { describe, expect, it } from "vitest";
import { calculateCashBasedNextBoxFund } from "./db";

const baseline = new Date("2026-10-03T10:00:00.000Z");
const after = (minutes: number) =>
  new Date(baseline.getTime() + minutes * 60_000);

const empty = {
  sales: [],
  inventory: [],
  expenses: [],
  profitLedger: [],
  capital: [],
};

describe("cash-based Next Box Fund", () => {
  it("starts from reconciled cash instead of owner capital", () => {
    const result = calculateCashBasedNextBoxFund({
      openingCashCentavos: 3_600_000,
      baselineCreatedAt: baseline,
      ...empty,
    });

    expect(result.availableCentavos).toBe(3_600_000);
  });

  it("carries cash through a purchase, sale, and profit payout", () => {
    const result = calculateCashBasedNextBoxFund({
      openingCashCentavos: 3_600_000,
      baselineCreatedAt: baseline,
      sales: [
        {
          saleDate: new Date("2026-10-03T12:00:00.000Z"),
          createdAt: after(30),
          cashCollectedCentavos: 3_650_000,
          isVoided: false,
        },
      ],
      inventory: [
        {
          transactionDate: new Date("2026-10-03T11:00:00.000Z"),
          createdAt: after(10),
          transactionType: "purchase",
          fundingSource: "retained_cash",
          unitsDelta: 50,
          costPerUnitCentavos: 70_000,
        },
      ],
      expenses: [],
      profitLedger: [
        {
          entryDate: new Date("2026-10-03T13:00:00.000Z"),
          createdAt: after(40),
          entryType: "distributed",
          amountCentavos: 150_000,
        },
      ],
      capital: [],
    });

    expect(result.openingCashCentavos).toBe(3_600_000);
    expect(result.retainedCashPurchasesCentavos).toBe(3_500_000);
    expect(result.salesCashCentavos).toBe(3_650_000);
    expect(result.profitDistributionsCentavos).toBe(150_000);
    expect(result.availableCentavos).toBe(3_600_000);
  });

  it("does not count pre-reconciliation history twice", () => {
    const result = calculateCashBasedNextBoxFund({
      openingCashCentavos: 3_600_000,
      baselineCreatedAt: baseline,
      sales: [
        {
          saleDate: new Date("2026-10-02T12:00:00.000Z"),
          createdAt: new Date("2026-10-02T12:00:00.000Z"),
          cashCollectedCentavos: 99_999_999,
          isVoided: false,
        },
      ],
      ...empty,
    });

    expect(result.salesCashCentavos).toBe(0);
    expect(result.availableCentavos).toBe(3_600_000);
  });
});
