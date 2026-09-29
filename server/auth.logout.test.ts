import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import {
  archiveCsvFiles,
  buildBrandedSalesReceipt,
  calculateAutoSaleTotals,
  calculateBusinessAlerts,
  calculateBusinessPosition,
  calculateIntegrityMetrics,
  calculateInventoryPurchase,
  calculateInventoryValue,
  calculateNextBoxFund,
  calculateProfitSplit,
  calculateRetainedCashBalance,
  calculateSaleMetrics,
  calculateTransitionWithdrawal,
  calculateWeeklyReportHistory,
  calculateWeeklyUnitComparison,
  getMondayWeekRanges,
  inspectBackupArchive,
  makeRecordCode,
  rowsToCsv,
  startOfMondayUtc,
} from "./db";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = { name: string; options: Record<string, unknown> };
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): {
  ctx: TrpcContext;
  clearedCookies: CookieCall[];
} {
  const clearedCookies: CookieCall[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });
});

describe("required cigarette sale calculations", () => {
  it("calculates the requested 20-unit scenario accurately", () => {
    const sale = calculateSaleMetrics(20, 73_000, 70_000, 1_460_000);
    expect(sale.expectedRevenueCentavos).toBe(1_460_000); // ₱14,600
    expect(sale.cogsCentavos).toBe(1_400_000); // ₱14,000
    expect(sale.grossProfitCentavos).toBe(60_000); // ₱600
    expect(200 - 20).toBe(180);
    expect(calculateInventoryValue(180, 70_000)).toBe(12_600_000); // ₱126,000
  });

  it("recognizes one full box after 20 units plus another 30", () => {
    const firstSale = calculateSaleMetrics(20, 73_000, 70_000, 1_460_000);
    const secondSale = calculateSaleMetrics(30, 73_000, 70_000, 2_190_000);
    expect(20 + 30).toBe(50);
    expect(200 - 20 - 30).toBe(150);
    expect(
      firstSale.expectedRevenueCentavos + secondSale.expectedRevenueCentavos
    ).toBe(3_650_000); // ₱36,500
    expect(firstSale.cogsCentavos + secondSale.cogsCentavos).toBe(3_500_000); // ₱35,000
    expect(firstSale.grossProfitCentavos + secondSale.grossProfitCentavos).toBe(
      150_000
    ); // ₱1,500
  });

  it("keeps Gale's ₱70,000 capital return separate from actual 2-box profit", () => {
    const galeTwoBoxPerformance = calculateSaleMetrics(
      100,
      73_000,
      70_000,
      7_300_000
    );
    const withdrawal = calculateTransitionWithdrawal(
      7_000_000,
      galeTwoBoxPerformance.grossProfitCentavos
    );
    expect(galeTwoBoxPerformance.grossProfitCentavos).toBe(300_000); // ₱3,000 actual gross profit
    expect(withdrawal.capitalReturnCentavos).toBe(7_000_000); // ₱70,000 return of capital
    expect(withdrawal.profitDistributionCentavos).toBe(300_000); // ₱3,000 profit distribution
    expect(withdrawal.totalCentavos).toBe(7_300_000); // ₱73,000 total cash received
  });

  it("keeps an immediate-payment shortfall as variance, not receivable balance", () => {
    const sale = calculateSaleMetrics(17, 73_000, 70_000, 1_200_000);
    expect(sale.paymentStatus).toBe("paid");
    expect(sale.balanceCentavos).toBe(0);
    expect(sale.cashVarianceCentavos).toBe(-41_000); // ₱410 shortfall
  });

  it("allocates only the ₱600 gross profit from 20 packs as Gale 50%, Nikki 50%, and Nikki's Dad 0%", () => {
    const sale = calculateSaleMetrics(20, 73_000, 70_000, 1_460_000);
    const split = calculateProfitSplit(sale.grossProfitCentavos, [
      { ownerId: 1, shareBasisPoints: 5_000 }, // Gale
      { ownerId: 2, shareBasisPoints: 5_000 }, // Nikki
      { ownerId: 3, shareBasisPoints: 0 }, // Nikki's Dad is settled separately
    ]);
    expect(sale.cogsCentavos).toBe(1_400_000); // capital/COGS is retained by the business
    expect(split.map(item => item.amountCentavos)).toEqual([30_000, 30_000]);
    expect(split.reduce((total, item) => total + item.amountCentavos, 0)).toBe(
      sale.grossProfitCentavos
    );
  });

  it("splits the ₱30 gross profit from one unit as ₱15 to Gale and ₱15 to Nikki", () => {
    const sale = calculateSaleMetrics(1, 73_000, 70_000, 73_000);
    const split = calculateProfitSplit(sale.grossProfitCentavos, [
      { ownerId: 1, shareBasisPoints: 5_000 },
      { ownerId: 2, shareBasisPoints: 5_000 },
      { ownerId: 3, shareBasisPoints: 0 },
    ]);
    expect(sale.grossProfitCentavos).toBe(3_000);
    expect(split.map(item => item.amountCentavos)).toEqual([1_500, 1_500]);
  });

  it("auto-calculates cash as cost plus ₱30 profit per pack or ream", () => {
    const totals = calculateAutoSaleTotals(97, 70_000);
    expect(totals.sellingPriceCentavos).toBe(73_000);
    expect(totals.expectedRevenueCentavos).toBe(7_081_000); // ₱7,081
    expect(totals.cogsCentavos).toBe(6_790_000); // ₱6,790
    expect(totals.grossProfitCentavos).toBe(291_000); // ₱291
  });

  it("starts the reporting week on Monday", () => {
    expect(
      startOfMondayUtc(new Date("2026-09-23T12:00:00.000Z")).toISOString()
    ).toBe("2026-09-21T00:00:00.000Z");
    expect(
      startOfMondayUtc(new Date("2026-09-27T12:00:00.000Z")).toISOString()
    ).toBe("2026-09-21T00:00:00.000Z");
  });

  it("compares the current Monday-start week to the complete previous week", () => {
    const ranges = getMondayWeekRanges(new Date("2026-09-23T12:00:00.000Z"));
    expect(ranges.currentWeekStart.toISOString()).toBe(
      "2026-09-21T00:00:00.000Z"
    );
    expect(ranges.currentWeekEnd.toISOString()).toBe(
      "2026-09-24T00:00:00.000Z"
    );
    expect(ranges.previousWeekStart.toISOString()).toBe(
      "2026-09-14T00:00:00.000Z"
    );
    expect(ranges.previousWeekEnd.toISOString()).toBe(
      "2026-09-21T00:00:00.000Z"
    );
  });

  it("calculates week-over-week unit changes and handles zero prior-week sales", () => {
    expect(calculateWeeklyUnitComparison(40, 25)).toEqual({
      currentUnitsSold: 40,
      previousUnitsSold: 25,
      unitsDelta: 15,
      percentChange: 60,
    });
    expect(calculateWeeklyUnitComparison(12, 0)).toEqual({
      currentUnitsSold: 12,
      previousUnitsSold: 0,
      unitsDelta: 12,
      percentChange: null,
    });
    expect(calculateWeeklyUnitComparison(0, 0)).toEqual({
      currentUnitsSold: 0,
      previousUnitsSold: 0,
      unitsDelta: 0,
      percentChange: null,
    });
  });

  it("preserves Monday-week targets and aggregates Cash variance by week", () => {
    const history = calculateWeeklyReportHistory({
      now: new Date("2026-09-23T12:00:00.000Z"),
      currentTargetUnits: 50,
      weeks: 3,
      targets: [
        {
          weekStartDate: new Date("2026-09-21T00:00:00.000Z"),
          targetUnits: 50,
        },
        {
          weekStartDate: new Date("2026-09-14T00:00:00.000Z"),
          targetUnits: 30,
        },
      ],
      sales: [
        {
          saleDate: new Date("2026-09-21T12:00:00.000Z"),
          unitsSold: 40,
          cashVarianceCentavos: -10_000,
          isVoided: false,
        },
        {
          saleDate: new Date("2026-09-14T12:00:00.000Z"),
          unitsSold: 25,
          cashVarianceCentavos: 5_000,
          isVoided: false,
        },
        {
          saleDate: new Date("2026-09-15T12:00:00.000Z"),
          unitsSold: 99,
          cashVarianceCentavos: 99_000,
          isVoided: true,
        },
      ],
    });
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      weekStartDate: "2026-09-21",
      weekEndDate: "2026-09-27",
      isCurrent: true,
      targetUnits: 50,
      unitsSold: 40,
      unitsRemaining: 10,
      completionPercent: 80,
      targetReached: false,
      cashVarianceCentavos: -10_000,
    });
    expect(history[1]).toMatchObject({
      weekStartDate: "2026-09-14",
      weekEndDate: "2026-09-20",
      isCurrent: false,
      targetUnits: 30,
      unitsSold: 25,
      unitsRemaining: 5,
      targetReached: false,
      cashVarianceCentavos: 5_000,
    });
    expect(history[1]?.completionPercent).toBeCloseTo(83.33, 2);
  });

  it("alerts when the weekly goal is reached and recent active sales are short", () => {
    const alerts = calculateBusinessAlerts({
      now: new Date("2026-09-25T12:00:00.000Z"),
      currentWeekUnitsSold: 500,
      weeklyTargetUnits: 500,
      sales: [
        {
          saleDate: new Date("2026-09-25T10:00:00.000Z"),
          cashVarianceCentavos: -41_000,
          isVoided: false,
        },
        {
          saleDate: new Date("2026-09-24T10:00:00.000Z"),
          cashVarianceCentavos: -9_000,
          isVoided: false,
        },
        {
          saleDate: new Date("2026-09-23T10:00:00.000Z"),
          cashVarianceCentavos: -99_000,
          isVoided: true,
        },
        {
          saleDate: new Date("2026-08-20T10:00:00.000Z"),
          cashVarianceCentavos: -80_000,
          isVoided: false,
        },
      ],
    });
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toMatchObject({
      kind: "cash_shortage",
      tone: "warning",
      title: "Cash shortage needs review",
      date: "2026-09-25",
    });
    expect(alerts[0]?.message).toContain("2 active sales are short by ₱500");
    expect(alerts[1]).toMatchObject({
      kind: "goal_reached",
      tone: "success",
      title: "Weekly goal reached",
      date: "2026-09-25",
    });
    expect(alerts[1]?.message).toContain("500 packs/reams sold");
  });

  it("shows no business alert while the goal is pending and cash reconciles", () => {
    expect(
      calculateBusinessAlerts({
        now: new Date("2026-09-25T12:00:00.000Z"),
        currentWeekUnitsSold: 326,
        weeklyTargetUnits: 500,
        sales: [],
      })
    ).toEqual([]);
  });

  it("converts purchased boxes into inventory units and cost", () => {
    const purchase = calculateInventoryPurchase(2, 50, 3_500_000);
    expect(purchase.unitsAdded).toBe(100);
    expect(purchase.totalCostCentavos).toBe(7_000_000);
    expect(purchase.costPerUnitCentavos).toBe(70_000);
  });

  it("calculates operating cash after recorded purchases and distributions", () => {
    const cash = calculateRetainedCashBalance({
      sales: [
        { cashCollectedCentavos: 7_300_000, isVoided: false },
        { cashCollectedCentavos: 730_000, isVoided: true },
      ],
      expenses: [{ amountCentavos: 50_000 }],
      inventory: [
        {
          transactionType: "purchase",
          fundingSource: "retained_cash",
          description: "Purchased 1 box",
          unitsDelta: 50,
          costPerUnitCentavos: 70_000,
        },
      ],
      capital: [
        {
          transactionType: "capital_contribution",
          status: "posted",
          amountCentavos: 1_000_000,
        },
        {
          transactionType: "capital_withdrawal",
          status: "posted",
          amountCentavos: 100_000,
        },
      ],
      profitLedger: [{ entryType: "distributed", amountCentavos: 150_000 }],
    });
    expect(cash.availableCentavos).toBe(3_500_000);
    expect(cash.retainedCashPurchasesCentavos).toBe(3_500_000);
  });

  it("keeps ₱210,000 owner capital separate from 300 units of physical inventory", () => {
    const position = calculateBusinessPosition({
      inventoryUnits: 300,
      unitsPerBox: 50,
      costPerUnitCentavos: 70_000,
      ownerCapitalCentavos: 21_000_000,
    });
    expect(position).toEqual({
      inventoryUnits: 300,
      inventoryBoxes: 6,
      inventoryValueCentavos: 21_000_000,
      ownerCapitalCentavos: 21_000_000,
      capitalDeployedCentavos: 21_000_000,
      capitalDeploymentPercent: 100,
    });
  });
  it("calculates the next box fund after profit distributions and posted capital withdrawals", () => {
    expect(calculateNextBoxFund(21_000_000, 1_986_000, 0)).toBe(19_014_000); // ₱190,140
  });
});

describe("data resilience utilities", () => {
  it("creates searchable immutable record codes", () => {
    expect(
      makeRecordCode("sale", new Date("2026-09-22T12:00:00.000Z"), 42)
    ).toBe("SALE-20260922-00042");
    expect(
      makeRecordCode("backup", new Date("2026-09-22T12:00:00.000Z"), 7)
    ).toBe("BKP-20260922-00007");
  });

  it("serializes complete CSV cells safely and packages archive bytes", () => {
    const csv = rowsToCsv([
      {
        recordCode: "SALE-20260922-00042",
        note: 'Cash "variance" reviewed',
        amount: 73000,
      },
    ]);
    expect(csv).toContain('"Cash ""variance"" reviewed"');
    const archive = archiveCsvFiles({
      "sales.csv": csv,
      "manifest.json": '{"version":1}',
    });
    expect(archive.byteLength).toBeGreaterThan(40);
  });

  it("previews a backup without importing and blocks checksum mismatches", () => {
    const salesCsv = rowsToCsv([
      {
        recordCode: "SALE-20260921-00001",
        saleDate: new Date("2026-09-21T12:00:00.000Z"),
        unitsSold: 97,
      },
    ]);
    const manifest = JSON.stringify({
      format: "buy-sell-manager-logical-backup",
      version: 1,
      createdAt: "2026-09-23T00:00:00.000Z",
      backupType: "manual",
      brand: "Buy & Sell Manager",
      tables: { sales: 1 },
    });
    const archive = archiveCsvFiles({
      "manifest.json": manifest,
      "sales.csv": salesCsv,
    });
    const preview = inspectBackupArchive(archive);
    expect(preview.readyForImport).toBe(true);
    expect(preview.summary.totalActualRecords).toBe(1);
    expect(preview.tables[0]).toMatchObject({
      table: "sales",
      expectedRows: 1,
      actualRows: 1,
      matchesManifest: true,
    });
    expect(preview.summary.earliestBusinessDate?.toISOString()).toBe(
      "2026-09-21T12:00:00.000Z"
    );

    const mismatch = inspectBackupArchive(archive, "incorrect-checksum");
    expect(mismatch.readyForImport).toBe(false);
    expect(mismatch.warnings[0]).toContain("checksum");
  });

  it("adds a branded sales receipt header to exports", () => {
    const receipt = buildBrandedSalesReceipt(
      [
        {
          id: 1,
          recordCode: "SALE-20260921-00001",
          saleDate: new Date("2026-09-21T12:00:00.000Z"),
          unitsSold: 97,
          expectedRevenueCentavos: 7_081_000,
          cashCollectedCentavos: 7_081_000,
          grossProfitCentavos: 291_000,
          isVoided: false,
        },
      ],
      [
        { saleId: 1, ownerId: 1, allocatedProfitCentavos: 145_500 },
        { saleId: 1, ownerId: 2, allocatedProfitCentavos: 145_500 },
      ],
      new Date("2026-09-23T00:00:00.000Z")
    );
    expect(receipt).toContain("# Buy & Sell Manager");
    expect(receipt).toContain("## Sales Receipt Export");
    expect(receipt).toContain("SALE-20260921-00001");
    expect(receipt).toContain("97 units");
  });

  it("passes only when inventory, cash, ownership, and capital reconcile", () => {
    const passed = calculateIntegrityMetrics({
      inventoryUnits: 150,
      ledgerInventoryUnits: 150,
      expectedRevenueCentavos: 3_650_000,
      collectedCashCentavos: 3_650_000,
      ownershipBasisPoints: 10_000,
      capitalContributedCentavos: 21_000_000,
      capitalWithdrawnCentavos: 7_000_000,
      displayedCapitalCentavos: 14_000_000,
    });
    expect(passed.status).toBe("passed");
    const variance = calculateIntegrityMetrics({
      inventoryUnits: 150,
      ledgerInventoryUnits: 149,
      expectedRevenueCentavos: 3_650_000,
      collectedCashCentavos: 3_640_000,
      ownershipBasisPoints: 9_900,
      capitalContributedCentavos: 21_000_000,
      capitalWithdrawnCentavos: 7_000_000,
      displayedCapitalCentavos: 14_000_000,
    });
    expect(variance.status).toBe("warning");
    expect(variance.inventoryVarianceUnits).toBe(1);
    expect(variance.cashVarianceCentavos).toBe(10_000);
  });
});
