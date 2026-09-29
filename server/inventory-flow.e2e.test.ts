import { describe, expect, it } from "vitest";
import {
  calculateAutoSaleTotals,
  calculateInventoryPurchase,
  calculateNextBoxFundBalance,
  calculateTodayNextBoxFundBalance,
} from "./db";

describe("inventory funding flow: sale to replacement purchase", () => {
  it("recovers today’s sale COGS, then consumes only the replacement purchase", () => {
    const sale = calculateAutoSaleTotals(72, 70_000);
    expect(sale.expectedRevenueCentavos).toBe(5_256_000);
    expect(sale.cogsCentavos).toBe(5_040_000);
    expect(sale.grossProfitCentavos).toBe(216_000);

    const beforeSale = calculateNextBoxFundBalance({
      sales: [],
      inventory: [
        {
          transactionType: "purchase",
          fundingSource: "retained_cash",
          description: "Transition setup — additional 2 boxes",
          unitsDelta: 100,
          costPerUnitCentavos: 70_000,
        },
      ],
    });
    expect(beforeSale.availableCentavos).toBe(0);

    const afterSale = calculateNextBoxFundBalance({
      sales: [{ cogsCentavos: sale.cogsCentavos, isVoided: false }],
      inventory: [
        {
          transactionType: "purchase",
          fundingSource: "retained_cash",
          description: "Transition setup — additional 2 boxes",
          unitsDelta: 100,
          costPerUnitCentavos: 70_000,
        },
      ],
    });
    expect(afterSale.availableCentavos).toBe(5_040_000);

    const replacement = calculateInventoryPurchase(1, 50, 3_500_000);
    const afterReplacement = calculateNextBoxFundBalance({
      sales: [{ cogsCentavos: sale.cogsCentavos, isVoided: false }],
      inventory: [
        {
          transactionType: "purchase",
          fundingSource: "retained_cash",
          description: "Purchased 1 box — Next Box Fund replacement",
          unitsDelta: replacement.unitsAdded,
          costPerUnitCentavos: replacement.costPerUnitCentavos,
        },
      ],
    });
    expect(afterReplacement.replacementPurchasesCentavos).toBe(3_500_000);
    expect(afterReplacement.availableCentavos).toBe(1_540_000);
  });

  it("keeps an owner-funded inventory purchase out of the replacement fund", () => {
    const purchase = calculateInventoryPurchase(2, 50, 3_500_000);
    const result = calculateNextBoxFundBalance({
      sales: [{ cogsCentavos: 5_040_000, isVoided: false }],
      inventory: [
        {
          transactionType: "purchase",
          fundingSource: "new_capital",
          description: "Purchased 2 boxes — owner capital contribution",
          unitsDelta: purchase.unitsAdded,
          costPerUnitCentavos: purchase.costPerUnitCentavos,
        },
      ],
    });

    expect(purchase.totalCostCentavos).toBe(7_000_000);
    expect(result.replacementPurchasesCentavos).toBe(0);
    expect(result.availableCentavos).toBe(5_040_000);
  });

  it("deducts a replacement purchase made after today’s sale", () => {
    const todayStart = new Date("2026-09-29T00:00:00.000Z");
    const todayEnd = new Date("2026-09-30T00:00:00.000Z");
    const result = calculateTodayNextBoxFundBalance({
      todayCogsRecoveredCentavos: 5_040_000,
      todayStart,
      todayEnd,
      sales: [
        {
          saleDate: new Date("2026-09-29T12:00:00.000Z"),
          createdAt: "2026-09-29 09:31:55",
          isVoided: false,
        },
      ],
      inventory: [
        {
          transactionDate: new Date("2026-09-29T12:00:00.000Z"),
          createdAt: "2026-09-29 02:17:36",
          transactionType: "purchase",
          fundingSource: "retained_cash",
          description: "Purchased 2 boxes",
          unitsDelta: 100,
          costPerUnitCentavos: 70_000,
        },
        {
          transactionDate: new Date("2026-09-29T12:00:00.000Z"),
          createdAt: "2026-09-29 09:51:51",
          transactionType: "purchase",
          fundingSource: "retained_cash",
          description: "Purchased 1 box",
          unitsDelta: 50,
          costPerUnitCentavos: 70_000,
        },
      ],
    });
    expect(result.cogsRecoveredCentavos).toBe(5_040_000);
    expect(result.replacementPurchasesCentavos).toBe(3_500_000);
    expect(result.availableCentavos).toBe(1_540_000);
  });
});
