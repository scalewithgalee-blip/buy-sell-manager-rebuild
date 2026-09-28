import { z } from "zod";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  addCapitalTransaction,
  addInventoryPurchase,
  addExpenseRecord,
  addSaleRecord,
  createBusinessBackup,
  closeBusinessDay,
  closeInitialPeriodAndStartOngoing,
  getDashboardData,
  getDashboardRangeData,
  getDataResilienceOverview,
  getProfitLedgerData,
  previewBusinessBackup,
  getSalesHistory,
  getSetupData,
  getTransitionReport,
  recordGaleTransitionWithdrawal,
  recordProfitDistribution,
  reopenBusinessDay,
  runIntegrityCheck,
  saveBackupSchedule,
  updateGuaranteedReturnStatus,
  updateOwnershipRules,
  updateBusinessSettings,
  voidSaleRecord,
} from "./db";
import { createHeartbeatJob } from "./_core/heartbeat";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  business: router({
    dashboard: publicProcedure.query(({ ctx }) => getDashboardData((ctx.user?.id ?? 0))),
    dashboardRange: publicProcedure
      .input(z.object({ startDate: day, endDate: day }))
      .query(({ ctx, input }) => getDashboardRangeData((ctx.user?.id ?? 0), input.startDate, input.endDate)),
    setup: publicProcedure.query(({ ctx }) => getSetupData((ctx.user?.id ?? 0))),
    profitLedger: publicProcedure.query(({ ctx }) => getProfitLedgerData((ctx.user?.id ?? 0))),
    transitionReport: publicProcedure.query(({ ctx }) => getTransitionReport((ctx.user?.id ?? 0))),
    salesHistory: publicProcedure
      .input(z.object({ page: z.number().int().min(1).optional(), pageSize: z.number().int().min(10).max(100).optional(), search: z.string().max(160).optional(), status: z.enum(["all", "active", "voided"]).optional() }))
      .query(({ ctx, input }) => getSalesHistory((ctx.user?.id ?? 0), input)),
    addSale: publicProcedure
      .input(z.object({
        date: day,
        operatorId: z.number().int().positive(),
        unitsSold: z.number().int().positive().max(10_000),
        cashCollectedPesos: z.number().positive().max(10_000_000),
        autoCalculateCash: z.boolean().optional(),
        periodId: z.number().int().positive().optional(),
        periodTrancheId: z.number().int().positive().optional(),
        notes: z.string().max(2_000).optional(),
        confirmDuplicate: z.boolean().optional(),
      }))
      .mutation(({ ctx, input }) => addSaleRecord((ctx.user?.id ?? 0), input)),
    voidSale: publicProcedure
      .input(z.object({ saleId: z.number().int().positive(), reason: z.string().min(4).max(1_000) }))
      .mutation(({ ctx, input }) => voidSaleRecord((ctx.user?.id ?? 0), input)),
    addExpense: publicProcedure
      .input(z.object({
        date: day,
        category: z.enum(["transportation", "delivery", "packaging", "communication", "operating", "other"]),
        amountPesos: z.number().positive(),
        paidBy: z.string().max(160).optional(),
        description: z.string().min(1).max(255),
        notes: z.string().max(2_000).optional(),
      }))
      .mutation(({ ctx, input }) => addExpenseRecord((ctx.user?.id ?? 0), input)),
    addCapitalTransaction: publicProcedure
      .input(z.object({
        date: day,
        ownerId: z.number().int().positive().optional(),
        periodId: z.number().int().positive().optional(),
        periodTrancheId: z.number().int().positive().optional(),
        transactionType: z.enum(["capital_contribution", "capital_withdrawal", "profit_distribution", "expense", "adjustment"]),
        status: z.enum(["pending", "posted"]),
        amountPesos: z.number().positive(),
        description: z.string().min(1).max(255),
        notes: z.string().max(2_000).optional(),
      }))
      .mutation(({ ctx, input }) => addCapitalTransaction((ctx.user?.id ?? 0), input)),
    addInventoryPurchase: publicProcedure
      .input(z.object({
        date: day,
        boxes: z.number().int().positive().max(1_000),
        unitsPerBox: z.number().int().positive().max(10_000),
        costPerBoxPesos: z.number().positive().max(10_000_000),
        fundingSource: z.enum(["retained_cash", "new_capital", "other"]),
        notes: z.string().max(2_000).optional(),
      }))
      .mutation(({ ctx, input }) => addInventoryPurchase((ctx.user?.id ?? 0), input)),
    recordProfitDistribution: publicProcedure
      .input(z.object({ ownerId: z.number().int().positive(), amountPesos: z.number().positive(), date: day, notes: z.string().max(2_000).optional() }))
      .mutation(({ ctx, input }) => recordProfitDistribution((ctx.user?.id ?? 0), input)),
    closeDay: publicProcedure
      .input(z.object({ date: day, notes: z.string().max(2_000).optional() }))
      .mutation(({ ctx, input }) => closeBusinessDay((ctx.user?.id ?? 0), input.date, input.notes)),
    reopenDay: publicProcedure
      .input(z.object({ date: day, reason: z.string().max(2_000).optional() }))
      .mutation(({ ctx, input }) => reopenBusinessDay((ctx.user?.id ?? 0), input.date, input.reason)),
    closeInitialPeriod: publicProcedure
      .input(z.object({ date: day }))
      .mutation(({ ctx, input }) => closeInitialPeriodAndStartOngoing((ctx.user?.id ?? 0), input.date)),
    recordGaleTransitionWithdrawal: publicProcedure
      .input(z.object({ date: day }))
      .mutation(({ ctx, input }) => recordGaleTransitionWithdrawal((ctx.user?.id ?? 0), input.date)),
    updateGuaranteedReturnStatus: publicProcedure
      .input(z.object({ guaranteedReturnId: z.number().int().positive(), status: z.enum(["pending", "earned", "paid", "cancelled"]) }))
      .mutation(({ ctx, input }) => updateGuaranteedReturnStatus((ctx.user?.id ?? 0), input)),
    updateOwnershipRules: publicProcedure
      .input(z.array(z.object({ ownerId: z.number().int().positive(), sharePercent: z.number().min(0).max(100) })).min(1))
      .mutation(({ ctx, input }) => updateOwnershipRules((ctx.user?.id ?? 0), input)),
    updateSettings: publicProcedure
      .input(z.object({
        minimumInventoryUnits: z.number().int().min(0).max(1_000_000),
        costPerUnitPesos: z.number().positive(),
        sellingPricePesos: z.number().positive(),
        unitsPerBox: z.number().int().positive().max(100_000),
        boxCostPesos: z.number().positive(),
        weeklyUnitsTarget: z.number().int().positive().max(1_000_000),
        monthlyProfitTargetPesos: z.number().positive().max(1_000_000_000),
      }))
      .mutation(({ ctx, input }) => updateBusinessSettings((ctx.user?.id ?? 0), input)),
    dataResilience: publicProcedure.query(({ ctx }) => getDataResilienceOverview((ctx.user?.id ?? 0))),
    runIntegrityCheck: publicProcedure.mutation(({ ctx }) => runIntegrityCheck((ctx.user?.id ?? 0))),
    createBackup: publicProcedure
      .input(z.object({ type: z.enum(["manual", "daily", "weekly", "monthly"]).default("manual") }))
      .mutation(({ ctx, input }) => createBusinessBackup((ctx.user?.id ?? 0), input.type)),
    restorePreview: publicProcedure
      .input(z.object({ backupId: z.number().int().positive() }))
      .query(({ input }) => previewBusinessBackup(input.backupId)),
    configureAutomaticBackups: publicProcedure.mutation(async ({ ctx }) => {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const overview = await getDataResilienceOverview((ctx.user?.id ?? 0));
      if (overview.backupScheduleTaskUid) return { taskUid: overview.backupScheduleTaskUid, alreadyConfigured: true };
      const job = await createHeartbeatJob({
        name: "buy-sell-manager-daily-backup",
        cron: "0 15 0 * * *",
        path: "/api/scheduled/business-backup",
        description: "Daily offsite data backup; weekly and monthly retention bundles are created when due.",
      }, sessionToken);
      await saveBackupSchedule((ctx.user?.id ?? 0), job.taskUid);
      return { taskUid: job.taskUid, nextExecutionAt: job.nextExecutionAt, alreadyConfigured: false };
    }),
  }),
});

export type AppRouter = typeof appRouter;
