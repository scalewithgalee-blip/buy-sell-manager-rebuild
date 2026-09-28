import { and, asc, count, desc, eq, gte, isNull, like, lt, or, sql } from "drizzle-orm";
import { createHash } from "crypto";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { drizzle } from "drizzle-orm/mysql2";
import {
  auditEvents,
  backupRecords,
  backupSettings,
  businessSettings,
  businessPeriods,
  capitalTransactions,
  customers,
  dailyClosings,
  expenses,
  guaranteedReturns,
  inventoryTransactions,
  integrityChecks,
  operators,
  owners,
  ownershipRules,
  payments,
  periodOwnerTranches,
  products,
  profitAllocations,
  profitLedgerEntries,
  sales,
  type InsertUser,
  users,
  weeklyTargetSnapshots,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { storageGetSignedUrl, storagePut } from "./storage";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

const pesoToCentavos = (value: number) => Math.round(value * 100);
const dateAtNoonUtc = (value: string) => new Date(`${value}T12:00:00.000Z`);
const dayStart = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const nextDay = (date: Date) => new Date(dayStart(date).getTime() + 86_400_000);
const dayKey = (date: Date) => date.toISOString().slice(0, 10);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

const recordPrefix: Record<string, string> = {
  sale: "SALE", inventory: "INV", payment: "PAY", capital: "CAP", expense: "EXP", closing: "CLOSE",
  backup: "BKP", integrity: "CHECK", period: "PERIOD", guarantee: "GUAR", profit: "PROFIT",
};

export function makeRecordCode(kind: keyof typeof recordPrefix, date: Date, id: number) {
  const compactDate = date.toISOString().slice(0, 10).replaceAll("-", "");
  return `${recordPrefix[kind]}-${compactDate}-${String(id).padStart(5, "0")}`;
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const normalized = value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

export function rowsToCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  return [columns.join(","), ...rows.map(row => columns.map(column => csvCell(row[column])).join(","))].join("\n");
}

export function archiveCsvFiles(files: Record<string, string>) {
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, content]) => [name, strToU8(content)])), { level: 6 });
}

export function parseCsvRows(csv: string) {
  if (!csv.trim()) return [] as Array<Record<string, string>>;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some(value => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell);
  if (row.some(value => value.length > 0)) rows.push(row);
  const headers = rows[0] ?? [];
  return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

export function inspectBackupArchive(archive: Uint8Array, expectedChecksum?: string | null) {
  const checksum = createHash("sha256").update(archive).digest("hex");
  const extracted = unzipSync(archive);
  const fileNames = Object.keys(extracted).sort();
  const manifestBytes = extracted["manifest.json"];
  if (!manifestBytes) throw new Error("Backup manifest.json is missing.");
  const manifest = JSON.parse(strFromU8(manifestBytes)) as {
    format?: string;
    version?: number;
    createdAt?: string;
    backupType?: string;
    brand?: string;
    tables?: Record<string, number>;
  };
  const expectedTables = manifest.tables ?? {};
  const warnings: string[] = [];
  const dateValues: number[] = [];
  const tables = Object.entries(expectedTables).map(([table, expectedRows]) => {
    const fileName = `${table}.csv`;
    const bytes = extracted[fileName];
    if (!bytes) {
      warnings.push(`${fileName} is missing from the archive.`);
      return { table, fileName, expectedRows: Number(expectedRows), actualRows: 0, matchesManifest: false };
    }
    const rows = parseCsvRows(strFromU8(bytes));
    for (const record of rows) {
      for (const [column, value] of Object.entries(record)) {
        if (!/(?:date|at)$/i.test(column) || !value) continue;
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) dateValues.push(parsed);
      }
    }
    const actualRows = rows.length;
    const matchesManifest = actualRows === Number(expectedRows);
    if (!matchesManifest) warnings.push(`${fileName} contains ${actualRows} rows but the manifest lists ${expectedRows}.`);
    return { table, fileName, expectedRows: Number(expectedRows), actualRows, matchesManifest };
  }).sort((left, right) => right.actualRows - left.actualRows || left.table.localeCompare(right.table));
  const checksumValid = !expectedChecksum || checksum === expectedChecksum;
  if (!checksumValid) warnings.unshift("The archive checksum does not match the backup registry.");
  const manifestValid = manifest.format === "buy-sell-manager-logical-backup" && manifest.version === 1;
  if (!manifestValid) warnings.unshift("The backup format or version is not supported.");
  const totalExpectedRecords = tables.reduce((total, table) => total + table.expectedRows, 0);
  const totalActualRecords = tables.reduce((total, table) => total + table.actualRows, 0);
  return {
    checksum,
    checksumValid,
    manifestValid,
    readyForImport: checksumValid && manifestValid && warnings.length === 0,
    warnings,
    manifest,
    fileNames,
    tables,
    summary: {
      tableCount: tables.length,
      fileCount: fileNames.length,
      totalExpectedRecords,
      totalActualRecords,
      earliestBusinessDate: dateValues.length ? new Date(Math.min(...dateValues)) : null,
      latestBusinessDate: dateValues.length ? new Date(Math.max(...dateValues)) : null,
    },
  };
}

export function buildBrandedSalesReceipt(salesRows: Array<Record<string, any>>, allocationRows: Array<Record<string, any>>, generatedAt = new Date()) {
  const activeSales = salesRows.filter(sale => !sale.isVoided);
  const totalUnits = sum(activeSales.map(sale => Number(sale.unitsSold ?? 0)));
  const totalRevenue = sum(activeSales.map(sale => Number(sale.expectedRevenueCentavos ?? 0)));
  const totalProfit = sum(activeSales.map(sale => Number(sale.grossProfitCentavos ?? 0)));
  const lines = [
    "# Buy & Sell Manager",
    "",
    "![Delivery-box logo](/manus-storage/buy-sell-delivery-logo-cropped_aea9dcd1.webp)",
    "",
    "## Sales Receipt Export",
    "Immediate-payment business ledger",
    `Generated: ${generatedAt.toISOString()}`,
    "",
    `**Summary:** ${activeSales.length} sales | ${totalUnits} units | ₱${(totalRevenue / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })} revenue | ₱${(totalProfit / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })} gross profit`,
    "",
    "| Date | Record | Units | Revenue | Cash collected | Gross profit | Owner shares |",
    "| --- | --- | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const sale of activeSales) {
    const shares = allocationRows.filter(allocation => Number(allocation.saleId) === Number(sale.id)).map(allocation => `${allocation.ownerId}: ₱${(Number(allocation.allocatedProfitCentavos ?? 0) / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`).join("; ");
    const date = sale.saleDate instanceof Date ? sale.saleDate.toISOString().slice(0, 10) : String(sale.saleDate ?? "").slice(0, 10);
    lines.push(`| ${date} | ${sale.recordCode ?? `SALE-${sale.id}`} | ${sale.unitsSold} | ₱${(Number(sale.expectedRevenueCentavos ?? 0) / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })} | ₱${(Number(sale.cashCollectedCentavos ?? 0) / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })} | ₱${(Number(sale.grossProfitCentavos ?? 0) / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })} | ${shares || "none"} |`);
  }
  if (!activeSales.length) lines.push("No active sales recorded.");
  return lines.join("\n");
}

export function calculateIntegrityMetrics(input: {
  inventoryUnits: number;
  ledgerInventoryUnits: number;
  expectedRevenueCentavos: number;
  collectedCashCentavos: number;
  ownershipBasisPoints: number;
  capitalContributedCentavos: number;
  capitalWithdrawnCentavos: number;
  displayedCapitalCentavos: number;
}) {
  const inventoryVarianceUnits = input.inventoryUnits - input.ledgerInventoryUnits;
  const cashVarianceCentavos = input.expectedRevenueCentavos - input.collectedCashCentavos;
  const ownershipVarianceBasisPoints = input.ownershipBasisPoints - 10_000;
  const capitalVarianceCentavos = (input.capitalContributedCentavos - input.capitalWithdrawnCentavos) - input.displayedCapitalCentavos;
  const status = inventoryVarianceUnits === 0 && cashVarianceCentavos === 0 && ownershipVarianceBasisPoints === 0 && capitalVarianceCentavos === 0
    ? "passed" as const
    : "warning" as const;
  return { status, inventoryVarianceUnits, cashVarianceCentavos, ownershipVarianceBasisPoints, capitalVarianceCentavos };
}

export const DAILY_PROFIT_PER_UNIT_CENTAVOS = 3_000;

export function calculateAutoSaleTotals(unitsSold: number, costPerUnitCentavos: number) {
  const sellingPriceCentavos = costPerUnitCentavos + DAILY_PROFIT_PER_UNIT_CENTAVOS;
  return {
    sellingPriceCentavos,
    expectedRevenueCentavos: unitsSold * sellingPriceCentavos,
    cogsCentavos: unitsSold * costPerUnitCentavos,
    grossProfitCentavos: unitsSold * DAILY_PROFIT_PER_UNIT_CENTAVOS,
  };
}

/** Pure transaction math, retained separately so the critical business rules are testable. */
export function calculateSaleMetrics(unitsSold: number, sellingPriceCentavos: number, costPerUnitCentavos: number, cashCollectedCentavos: number) {
  const expectedRevenueCentavos = unitsSold * sellingPriceCentavos;
  const cogsCentavos = unitsSold * costPerUnitCentavos;
  const grossProfitCentavos = expectedRevenueCentavos - cogsCentavos;
  const amountCollectedCentavos = Math.max(cashCollectedCentavos, 0);
  // Customers pay immediately. Any mismatch remains a cash variance, never an accounts-receivable balance.
  const balanceCentavos = 0;
  const paymentStatus: "paid" = "paid";
  return {
    expectedRevenueCentavos,
    cogsCentavos,
    grossProfitCentavos,
    cashVarianceCentavos: cashCollectedCentavos - expectedRevenueCentavos,
    amountCollectedCentavos,
    balanceCentavos,
    paymentStatus,
  };
}

export function calculateInventoryValue(units: number, costPerUnitCentavos: number) {
  return Math.max(units, 0) * costPerUnitCentavos;
}

export function calculateInventoryPurchase(boxes: number, unitsPerBox: number, costPerBoxCentavos: number) {
  const unitsAdded = boxes * unitsPerBox;
  return {
    unitsAdded,
    totalCostCentavos: boxes * costPerBoxCentavos,
    costPerUnitCentavos: Math.round(costPerBoxCentavos / unitsPerBox),
  };
}

export function calculateRetainedCashBalance(input: {
  sales: Array<{ cashCollectedCentavos: number; isVoided: boolean }>;
  expenses: Array<{ amountCentavos: number }>;
  inventory: Array<{ transactionType: string; fundingSource?: string | null; description?: string | null; unitsDelta: number; costPerUnitCentavos: number }>;
  capital: Array<{ transactionType: string; status: string; amountCentavos: number }>;
  profitLedger: Array<{ entryType: string; amountCentavos: number }>;
}) {
  const salesCashCentavos = sum(input.sales.filter(sale => !sale.isVoided).map(sale => sale.cashCollectedCentavos));
  const operatingExpensesCentavos = sum(input.expenses.map(expense => expense.amountCentavos));
  // Only user-entered purchases are deducted. Historical opening/transition setup rows are not cash reinvestments.
  const retainedCashPurchasesCentavos = sum(input.inventory.filter(item => item.transactionType === "purchase" && item.fundingSource === "retained_cash" && item.description?.startsWith("Purchased ")).map(item => Math.abs(item.unitsDelta) * item.costPerUnitCentavos));
  const postedCapital = input.capital.filter(item => item.status === "posted");
  const capitalWithdrawalsCentavos = sum(postedCapital.filter(item => item.transactionType === "capital_withdrawal" || item.transactionType === "expense").map(item => item.amountCentavos));
  const profitDistributionsCentavos = sum(input.profitLedger.filter(entry => entry.entryType === "distributed").map(entry => entry.amountCentavos));
  return {
    salesCashCentavos,
    operatingExpensesCentavos,
    retainedCashPurchasesCentavos,
    capitalWithdrawalsCentavos,
    profitDistributionsCentavos,
    availableCentavos: salesCashCentavos - operatingExpensesCentavos - retainedCashPurchasesCentavos - capitalWithdrawalsCentavos - profitDistributionsCentavos,
  };
}

/** Allocates gross profit only; capital/COGS is never included in owner profit. */
export function calculateProfitSplit(grossProfitCentavos: number, rules: Array<{ ownerId: number; shareBasisPoints: number }>) {
  const ordered = rules.filter(rule => rule.shareBasisPoints > 0).sort((a, b) => a.ownerId - b.ownerId);
  const allocations = ordered.map(rule => ({ ...rule, amountCentavos: Math.floor(grossProfitCentavos * rule.shareBasisPoints / 10_000) }));
  const remainder = grossProfitCentavos - sum(allocations.map(item => item.amountCentavos));
  if (allocations.length && remainder) allocations[0]!.amountCentavos += remainder;
  return allocations;
}

/** Keeps the return of capital distinct from actual operating profit in a withdrawal. */
export function calculateTransitionWithdrawal(capitalReturnCentavos: number, actualGrossProfitCentavos: number) {
  const profitDistributionCentavos = Math.max(actualGrossProfitCentavos, 0);
  return {
    capitalReturnCentavos,
    profitDistributionCentavos,
    totalCentavos: capitalReturnCentavos + profitDistributionCentavos,
  };
}

async function recordAudit(userId: number | null, action: string, entityType: string, entityId?: number | string, details?: string, previousValue?: unknown, newValue?: unknown) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditEvents).values({
    userId,
    action,
    entityType,
    entityId: entityId === undefined ? null : String(entityId),
    previousValue: previousValue === undefined ? null : JSON.stringify(previousValue),
    newValue: newValue === undefined ? null : JSON.stringify(newValue),
    details: details ?? null,
  });
}

async function ensureDailyProfitSplit(userId: number | null = null) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const required = [
    { name: "Gale", shareBasisPoints: 5_000 },
    { name: "Nikki", shareBasisPoints: 5_000 },
    { name: "Nikki's Dad", shareBasisPoints: 0 },
  ];
  for (const item of required) {
    const [owner] = await db.select().from(owners).where(eq(owners.name, item.name)).limit(1);
    if (!owner) await db.insert(owners).values({ name: item.name, active: true });
  }
  const ownerRows = await db.select().from(owners).where(eq(owners.active, true));
  const ownerByName = new Map(ownerRows.map(owner => [owner.name, owner]));
  const effectiveFrom = new Date("2026-09-22T12:00:00.000Z");
  const ruleRows = await db.select().from(ownershipRules).where(eq(ownershipRules.effectiveFrom, effectiveFrom));
  const existing = new Map(ruleRows.map(rule => [rule.ownerId, rule.shareBasisPoints]));
  const needsSnapshot = required.some(item => {
    const owner = ownerByName.get(item.name);
    return !owner || existing.get(owner.id) !== item.shareBasisPoints;
  });
  if (needsSnapshot) {
    await db.insert(ownershipRules).values(required.map(item => ({
      ownerId: ownerByName.get(item.name)!.id,
      shareBasisPoints: item.shareBasisPoints,
      effectiveFrom,
      createdBy: userId,
    })));
    await recordAudit(userId, "configured", "profit_sharing", undefined, "Configured future daily gross-profit split: Gale 50%, Nikki 50%, Nikki's Dad 0%. Existing profit ledger entries remain unchanged.");
  }
}

async function getProfitRulesForSaleDate(saleDate: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const rows = await db.select().from(ownershipRules).where(lt(ownershipRules.effectiveFrom, nextDay(saleDate))).orderBy(desc(ownershipRules.effectiveFrom));
  const latestByOwner = new Map<number, typeof rows[number]>();
  rows.forEach(rule => { if (!latestByOwner.has(rule.ownerId)) latestByOwner.set(rule.ownerId, rule); });
  const rules = Array.from(latestByOwner.values());
  const total = sum(rules.map(rule => rule.shareBasisPoints));
  if (!rules.length || total !== 10_000) throw new Error("Active profit-sharing configuration must total exactly 100%.");
  return rules;
}

async function writeProfitLedgerEntries(input: { userId: number | null; saleId?: number; periodId?: number | null; entryDate: Date; entryType: "earned" | "distributed" | "adjustment"; allocations: Array<{ ownerId: number; amountCentavos: number; shareBasisPoints?: number | null }>; description: string; notes?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const created = [] as Array<{ id: number; ownerId: number; amountCentavos: number; recordCode: string }>;
  for (const allocation of input.allocations) {
    const pendingCode = `PROFIT-PENDING-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const inserted = await db.insert(profitLedgerEntries).values({
      recordCode: pendingCode,
      ownerId: allocation.ownerId,
      saleId: input.saleId ?? null,
      periodId: input.periodId ?? null,
      entryType: input.entryType,
      amountCentavos: allocation.amountCentavos,
      shareBasisPoints: allocation.shareBasisPoints ?? null,
      entryDate: input.entryDate,
      description: input.description,
      notes: input.notes ?? null,
      createdBy: input.userId,
    });
    const id = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
    const recordCode = makeRecordCode("profit", input.entryDate, id);
    await db.update(profitLedgerEntries).set({ recordCode }).where(eq(profitLedgerEntries.id, id));
    created.push({ id, ownerId: allocation.ownerId, amountCentavos: allocation.amountCentavos, recordCode });
  }
  return created;
}

async function backfillTransactionCodes() {
  const db = await getDb();
  if (!db) return;
  const backfill = async (table: any, dateColumn: any, kind: keyof typeof recordPrefix) => {
    const rows = await db.select().from(table).where(isNull(table.recordCode));
    for (const row of rows as Array<any>) {
      await db.update(table).set({ recordCode: makeRecordCode(kind, row[dateColumn.name] ?? row.createdAt ?? new Date(), row.id) }).where(eq(table.id, row.id));
    }
  };
  await backfill(sales, sales.saleDate, "sale");
  await backfill(inventoryTransactions, inventoryTransactions.transactionDate, "inventory");
  await backfill(payments, payments.paymentDate, "payment");
  await backfill(capitalTransactions, capitalTransactions.transactionDate, "capital");
  await backfill(expenses, expenses.expenseDate, "expense");
  await backfill(dailyClosings, dailyClosings.closingDate, "closing");
  await backfill(businessPeriods, businessPeriods.startDate, "period");
  await backfill(guaranteedReturns, guaranteedReturns.createdAt, "guarantee");
  const [settings] = await db.select().from(backupSettings).limit(1);
  if (!settings) await db.insert(backupSettings).values({});
}

/** Seeds only immutable opening records; it never modifies existing financial history. */
export async function ensureBusinessSetup(userId: number | null = null) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const existing = await db.select().from(businessSettings).limit(1);
  if (existing[0]) {
    await backfillTransactionCodes();
    await ensureDailyProfitSplit(userId);
    await saveCurrentWeeklyTargetSnapshot(userId, existing[0].weeklyUnitsTarget);
    return;
  }

  await db.insert(businessSettings).values({
    businessName: "Buy & Sell Manager",
    boxCostCentavos: 3_500_000,
    unitsPerBox: 50,
    defaultCostPerUnitCentavos: 70_000,
    defaultSellingPriceCentavos: 73_000,
    minimumInventoryUnits: 50,
    weeklyUnitsTarget: 100,
    monthlyProfitTargetCentavos: 5_000_000,
  });
  await db.insert(owners).values([{ name: "Gale" }, { name: "Nikki" }, { name: "Nikki's Dad" }]);
  await db.insert(operators).values({ name: "Nikki's Dad" });
  await db.insert(products).values({
    name: "Cigarettes",
    supplier: null,
    costPerUnitCentavos: 70_000,
    sellingPriceCentavos: 73_000,
    unitsPerBox: 50,
    active: true,
  });

  const [gale] = await db.select().from(owners).where(eq(owners.name, "Gale")).limit(1);
  const [nikki] = await db.select().from(owners).where(eq(owners.name, "Nikki")).limit(1);
  const [product] = await db.select().from(products).orderBy(asc(products.id)).limit(1);
  if (!gale || !nikki || !product) throw new Error("Initial business setup could not be completed.");

  const openingDate = new Date("2026-09-22T00:00:00.000Z");
  await db.insert(ownershipRules).values([
    { ownerId: gale.id, shareBasisPoints: 2_500, effectiveFrom: openingDate, createdBy: userId },
    { ownerId: nikki.id, shareBasisPoints: 2_500, effectiveFrom: openingDate, createdBy: userId },
  ]);
  await db.insert(inventoryTransactions).values({
    transactionDate: openingDate,
    productId: product.id,
    transactionType: "initial",
    unitsDelta: 200,
    costPerUnitCentavos: 70_000,
    description: "Opening inventory  -  4 boxes",
    notes: "Recorded as the opening balance.",
    createdBy: userId,
  });
  await db.insert(capitalTransactions).values([
    {
      transactionDate: openingDate,
      ownerId: gale.id,
      transactionType: "capital_contribution",
      status: "posted",
      amountCentavos: 14_000_000,
      description: "Initial capital contribution  -  4 boxes",
      notes: "Historical opening contribution.",
      createdBy: userId,
    },
    {
      transactionDate: new Date("2026-09-29T00:00:00.000Z"),
      ownerId: gale.id,
      transactionType: "capital_withdrawal",
      status: "pending",
      amountCentavos: 7_000_000,
      description: "Initial capital withdrawal",
      notes: "Planned; not yet posted.",
      createdBy: userId,
    },
  ]);
  await recordAudit(userId, "seeded", "business_setup", undefined, "Created opening settings, 200 units, owners, and initial capital ledger.");
  await backfillTransactionCodes();
  await ensureDailyProfitSplit(userId);
  await saveCurrentWeeklyTargetSnapshot(userId, 100);
}

async function ensureTransitionPeriod(userId: number | null = null) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const existing = await db.select().from(businessPeriods).where(and(
    eq(businessPeriods.totalStartingBoxes, 6),
    eq(businessPeriods.totalStartingUnits, 300),
  )).orderBy(asc(businessPeriods.id)).limit(1);
  if (existing[0]) {
    await normalizeTransitionRecords(userId, existing[0].id);
    return existing[0];
  }
  const [gale] = await db.select().from(owners).where(eq(owners.name, "Gale")).limit(1);
  const [nikki] = await db.select().from(owners).where(eq(owners.name, "Nikki")).limit(1);
  const [settings] = await db.select().from(businessSettings).limit(1);
  if (!gale || !nikki || !settings) throw new Error("Owners and settings must exist before creating the transition period.");
  const [periodInsert] = await db.insert(businessPeriods).values({
    name: "Period 1  -  Initial 6-Box Cycle",
    status: "open",
    startDate: new Date("2026-09-22T00:00:00.000Z"),
    totalStartingBoxes: 6,
    totalStartingUnits: 300,
    totalStartingCapitalCentavos: 21_000_000,
    notes: "Temporary first-week tracking period. Gale has 4 boxes; Nikki has 2 boxes.",
    createdBy: userId,
  });
  const periodId = Number((periodInsert as any)[0]?.insertId ?? (periodInsert as any).insertId);
  await db.insert(periodOwnerTranches).values([
    { periodId, ownerId: gale.id, label: "Gale  -  2-box performance", trancheType: "performance", startingBoxes: 2, startingUnits: 100, startingCapitalCentavos: 7_000_000 },
    { periodId, ownerId: nikki.id, label: "Nikki  -  2-box performance", trancheType: "performance", startingBoxes: 2, startingUnits: 100, startingCapitalCentavos: 7_000_000 },
    { periodId, ownerId: gale.id, label: "Gale  -  2-box guaranteed arrangement", trancheType: "guarantee", startingBoxes: 2, startingUnits: 100, startingCapitalCentavos: 7_000_000 },
  ]);
  const tranches = await db.select().from(periodOwnerTranches).where(eq(periodOwnerTranches.periodId, periodId)).orderBy(asc(periodOwnerTranches.id));
  const guaranteeTranche = tranches.find(tranche => tranche.trancheType === "guarantee");
  if (!guaranteeTranche) throw new Error("Could not create Gale's guaranteed-return tranche.");
  await db.insert(guaranteedReturns).values({
    periodId,
    trancheId: guaranteeTranche.id,
    ownerId: gale.id,
    amountCentavos: 300_000,
    status: "pending",
    notes: "Separate from actual operating gross profit.",
    createdBy: userId,
  });
  const [nikkiCapital] = await db.select().from(capitalTransactions).where(and(eq(capitalTransactions.ownerId, nikki.id), eq(capitalTransactions.transactionType, "capital_contribution"))).limit(1);
  if (!nikkiCapital) {
    await db.insert(capitalTransactions).values({
      transactionDate: new Date("2026-09-22T00:00:00.000Z"),
      ownerId: nikki.id,
      periodId,
      transactionType: "capital_contribution",
      status: "posted",
      amountCentavos: 7_000_000,
      description: "Initial 2-box capital contribution",
      notes: "Temporary Period 1 contribution.",
      createdBy: userId,
    });
  }
  const [salesCount] = await db.select({ id: sales.id }).from(sales).limit(1);
  if (!salesCount) {
    const [product] = await db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.id)).limit(1);
    if (product) {
      await db.insert(inventoryTransactions).values({
        transactionDate: new Date("2026-09-22T00:00:00.000Z"),
        productId: product.id,
        transactionType: "purchase",
        unitsDelta: 100,
        costPerUnitCentavos: settings.defaultCostPerUnitCentavos,
        description: "Transition setup  -  additional 2 boxes",
        notes: "Brings current opening stock from 4 boxes to 6 boxes without rewriting the historical opening record.",
        createdBy: userId,
      });
    }
  }
  await recordAudit(userId, "created", "business_period", periodId, "Created Period 1 transition tracking with 4-box performance scope and Gale guarantee.");
  return { id: periodId, name: "Period 1  -  Initial 6-Box Cycle", status: "open" as const };
}

async function normalizeTransitionRecords(userId: number | null, canonicalPeriodId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const duplicatePeriods = await db.select().from(businessPeriods).where(and(
    eq(businessPeriods.status, "open"),
    eq(businessPeriods.totalStartingBoxes, 6),
    eq(businessPeriods.totalStartingUnits, 300),
  )).orderBy(asc(businessPeriods.id));
  for (const duplicate of duplicatePeriods.filter(period => period.id !== canonicalPeriodId)) {
    const notes = `${duplicate.notes ?? ""}${duplicate.notes ? "\n" : ""}Superseded duplicate setup record; retained for audit history.`;
    await db.update(businessPeriods).set({ status: "closed", endDate: new Date(), notes, updatedBy: userId }).where(eq(businessPeriods.id, duplicate.id));
    await recordAudit(userId, "superseded", "business_period", duplicate.id, "Superseded duplicate 6-box setup record without deleting historical rows.");
  }
  const [correction] = await db.select().from(inventoryTransactions).where(eq(inventoryTransactions.description, "Correction - remove duplicated transition setup stock")).limit(1);
  if (correction) return;
  const [product] = await db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.id)).limit(1);
  if (!product) throw new Error("Active product is unavailable while correcting inventory.");
  const correctionDate = new Date("2026-09-22T12:00:00.000Z");
  const inserted = await db.insert(inventoryTransactions).values({
    transactionDate: correctionDate,
    productId: product.id,
    transactionType: "adjustment",
    unitsDelta: -100,
    costPerUnitCentavos: product.costPerUnitCentavos,
    description: "Correction - remove duplicated transition setup stock",
    notes: "Retained adjustment correcting a duplicate transition setup purchase. Current stock is 6 boxes / 300 units.",
    createdBy: userId,
  });
  const id = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
  await db.update(inventoryTransactions).set({ recordCode: makeRecordCode("inventory", correctionDate, id), updatedBy: userId }).where(eq(inventoryTransactions.id, id));
  await recordAudit(userId, "corrected", "inventory", id, "Corrected duplicate transition stock. Current inventory is 6 boxes / 300 units; original rows were retained.");
}

async function ensureOngoingPeriodPlan(userId: number | null = null) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [existing] = await db.select().from(businessPeriods).where(eq(businessPeriods.name, "Period 2  -  Ongoing 4-Box Cycle")).limit(1);
  if (existing) {
    await ensureScheduledFourBoxTransition(userId);
    return existing;
  }
  const [gale] = await db.select().from(owners).where(eq(owners.name, "Gale")).limit(1);
  const [nikki] = await db.select().from(owners).where(eq(owners.name, "Nikki")).limit(1);
  if (!gale || !nikki) throw new Error("Owners are unavailable.");
  const startDate = new Date("2026-09-29T00:00:00.000Z");
  const [inserted] = await db.insert(businessPeriods).values({
    name: "Period 2  -  Ongoing 4-Box Cycle",
    status: "planned",
    startDate,
    totalStartingBoxes: 4,
    totalStartingUnits: 200,
    totalStartingCapitalCentavos: 14_000_000,
    notes: "Starts Monday after the temporary 6-box period. Gale: 2 boxes. Nikki: 2 boxes.",
    createdBy: userId,
  });
  const periodId = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
  await db.insert(periodOwnerTranches).values([
    { periodId, ownerId: gale.id, label: "Gale  -  ongoing 2-box cycle", trancheType: "ongoing", startingBoxes: 2, startingUnits: 100, startingCapitalCentavos: 7_000_000 },
    { periodId, ownerId: nikki.id, label: "Nikki  -  ongoing 2-box cycle", trancheType: "ongoing", startingBoxes: 2, startingUnits: 100, startingCapitalCentavos: 7_000_000 },
  ]);
  await ensureScheduledFourBoxTransition(userId);
  await recordAudit(userId, "planned", "business_period", periodId, "Planned Monday transition from 6 boxes to an ongoing 4-box cycle: Gale 2 boxes and Nikki 2 boxes.");
  return { id: periodId, name: "Period 2  -  Ongoing 4-Box Cycle", status: "planned" as const };
}

async function ensureScheduledFourBoxTransition(userId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [existing] = await db.select().from(inventoryTransactions).where(eq(inventoryTransactions.description, "Monday transition - reduce inventory to 4 boxes")).limit(1);
  if (existing) return;
  const [product] = await db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.id)).limit(1);
  if (!product) throw new Error("Active product is unavailable while planning the 4-box transition.");
  const transitionDate = new Date("2026-09-29T12:00:00.000Z");
  const inserted = await db.insert(inventoryTransactions).values({
    transactionDate: transitionDate,
    productId: product.id,
    transactionType: "adjustment",
    unitsDelta: -100,
    costPerUnitCentavos: product.costPerUnitCentavos,
    description: "Monday transition - reduce inventory to 4 boxes",
    notes: "Scheduled after the temporary 6-box period. Remaining inventory: Gale 2 boxes and Nikki 2 boxes.",
    createdBy: userId,
  });
  const id = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
  await db.update(inventoryTransactions).set({ recordCode: makeRecordCode("inventory", transitionDate, id), updatedBy: userId }).where(eq(inventoryTransactions.id, id));
}

export async function getSetupData(userId: number) {
  await ensureBusinessSetup(userId);
  await ensureTransitionPeriod(userId);
  await ensureOngoingPeriodPlan(userId);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [settingsRows, ownerRows, operatorRows, productRows, ruleRows, periodRows, trancheRows, returnRows] = await Promise.all([
    db.select().from(businessSettings).limit(1),
    db.select().from(owners).orderBy(asc(owners.id)),
    db.select().from(operators).where(eq(operators.active, true)).orderBy(asc(operators.name)),
    db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.id)),
    db.select().from(ownershipRules).orderBy(desc(ownershipRules.effectiveFrom)),
    db.select().from(businessPeriods).orderBy(desc(businessPeriods.startDate)),
    db.select().from(periodOwnerTranches).orderBy(asc(periodOwnerTranches.id)),
    db.select().from(guaranteedReturns).orderBy(desc(guaranteedReturns.updatedAt)),
  ]);
  return { settings: settingsRows[0], owners: ownerRows, operators: operatorRows, products: productRows, ownershipRules: ruleRows, businessPeriods: periodRows, periodOwnerTranches: trancheRows, guaranteedReturns: returnRows };
}

export function startOfMondayUtc(value: Date) {
  const today = dayStart(value);
  const day = today.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return new Date(today.getTime() + mondayOffset * 86_400_000);
}

export function getMondayWeekRanges(value: Date) {
  const currentWeekStart = startOfMondayUtc(value);
  const currentWeekEnd = nextDay(dayStart(value));
  const previousWeekEnd = currentWeekStart;
  const previousWeekStart = new Date(previousWeekEnd.getTime() - 7 * 86_400_000);
  return { currentWeekStart, currentWeekEnd, previousWeekStart, previousWeekEnd };
}

export function calculateWeeklyUnitComparison(currentUnitsSold: number, previousUnitsSold: number) {
  const unitsDelta = currentUnitsSold - previousUnitsSold;
  return {
    currentUnitsSold,
    previousUnitsSold,
    unitsDelta,
    percentChange: previousUnitsSold === 0 ? null : (unitsDelta / previousUnitsSold) * 100,
  };
}

async function saveCurrentWeeklyTargetSnapshot(userId: number | null, targetUnits: number, now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const weekStartDate = startOfMondayUtc(now);
  const [existing] = await db.select().from(weeklyTargetSnapshots).where(eq(weeklyTargetSnapshots.weekStartDate, weekStartDate)).limit(1);
  if (!existing) {
    await db.insert(weeklyTargetSnapshots).values({ weekStartDate, targetUnits, createdBy: userId, updatedBy: userId });
  } else if (existing.targetUnits !== targetUnits) {
    await db.update(weeklyTargetSnapshots).set({ targetUnits, updatedBy: userId }).where(eq(weeklyTargetSnapshots.id, existing.id));
  }
}

type WeeklyReportSale = Pick<typeof sales.$inferSelect, "saleDate" | "unitsSold" | "cashVarianceCentavos" | "isVoided">;
type WeeklyTargetSnapshot = Pick<typeof weeklyTargetSnapshots.$inferSelect, "weekStartDate" | "targetUnits">;

export function calculateWeeklyReportHistory(input: { now: Date; sales: WeeklyReportSale[]; targets: WeeklyTargetSnapshot[]; currentTargetUnits: number; weeks?: number }) {
  const currentWeekStart = startOfMondayUtc(input.now);
  const currentDataEnd = nextDay(dayStart(input.now));
  const weekCount = Math.min(52, Math.max(1, input.weeks ?? 12));
  const targetsByWeek = new Map(input.targets.map(target => [dayKey(startOfMondayUtc(target.weekStartDate)), target.targetUnits]));
  return Array.from({ length: weekCount }, (_, index) => {
    const weekStartDate = new Date(currentWeekStart.getTime() - index * 7 * 86_400_000);
    const weekEndExclusive = new Date(weekStartDate.getTime() + 7 * 86_400_000);
    const dataEndExclusive = index === 0 ? currentDataEnd : weekEndExclusive;
    const weekSales = input.sales.filter(sale => !sale.isVoided && sale.saleDate >= weekStartDate && sale.saleDate < dataEndExclusive);
    const unitsSold = sum(weekSales.map(sale => sale.unitsSold));
    const targetUnits = targetsByWeek.get(dayKey(weekStartDate)) ?? (index === 0 ? input.currentTargetUnits : null);
    const completionPercent = targetUnits ? unitsSold / targetUnits * 100 : null;
    return {
      weekStartDate: dayKey(weekStartDate),
      weekEndDate: dayKey(new Date(weekEndExclusive.getTime() - 86_400_000)),
      isCurrent: index === 0,
      targetUnits,
      unitsSold,
      unitsRemaining: targetUnits === null ? null : Math.max(0, targetUnits - unitsSold),
      completionPercent,
      targetReached: targetUnits === null ? null : unitsSold >= targetUnits,
      cashVarianceCentavos: sum(weekSales.map(sale => sale.cashVarianceCentavos)),
    };
  }).filter(week => week.isCurrent || week.targetUnits !== null || week.unitsSold !== 0 || week.cashVarianceCentavos !== 0);
}

type BusinessAlertSale = Pick<typeof sales.$inferSelect, "saleDate" | "cashVarianceCentavos" | "isVoided">;

export function calculateBusinessAlerts(input: { now: Date; sales: BusinessAlertSale[]; currentWeekUnitsSold: number; weeklyTargetUnits: number }) {
  const recentStart = new Date(dayStart(input.now).getTime() - 29 * 86_400_000);
  const recentEnd = nextDay(dayStart(input.now));
  const shortageSales = input.sales
    .filter(sale => !sale.isVoided && sale.cashVarianceCentavos < 0 && sale.saleDate >= recentStart && sale.saleDate < recentEnd)
    .sort((left, right) => right.saleDate.getTime() - left.saleDate.getTime());
  const alerts: Array<{ id: string; kind: "cash_shortage" | "goal_reached"; tone: "warning" | "success"; title: string; message: string; date: string }> = [];
  if (shortageSales.length) {
    const shortageCentavos = sum(shortageSales.map(sale => Math.abs(sale.cashVarianceCentavos)));
    const formattedShortage = (shortageCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    alerts.push({
      id: `cash-shortage-${dayKey(shortageSales[0].saleDate)}-${shortageSales.length}`,
      kind: "cash_shortage",
      tone: "warning",
      title: "Cash shortage needs review",
      message: `${shortageSales.length} active ${shortageSales.length === 1 ? "sale is" : "sales are"} short by ₱${formattedShortage} in the last 30 days.`,
      date: dayKey(shortageSales[0].saleDate),
    });
  }
  if (input.weeklyTargetUnits > 0 && input.currentWeekUnitsSold >= input.weeklyTargetUnits) {
    alerts.push({
      id: `goal-reached-${dayKey(startOfMondayUtc(input.now))}`,
      kind: "goal_reached",
      tone: "success",
      title: "Weekly goal reached",
      message: `${input.currentWeekUnitsSold.toLocaleString("en-PH")} packs/rims sold against the ${input.weeklyTargetUnits.toLocaleString("en-PH")} target.`,
      date: dayKey(input.now),
    });
  }
  return alerts;
}

function rangeFor(period: "today" | "week" | "month" | "quarter" | "year", now = new Date()) {
  const today = dayStart(now);
  if (period === "today") return { start: today, end: nextDay(today) };
  if (period === "week") {
    const start = startOfMondayUtc(today);
    return { start, end: nextDay(today) };
  }
  if (period === "month") return { start: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), end: nextDay(today) };
  if (period === "quarter") {
    const firstMonth = Math.floor(today.getUTCMonth() / 3) * 3;
    return { start: new Date(Date.UTC(today.getUTCFullYear(), firstMonth, 1)), end: nextDay(today) };
  }
  return { start: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)), end: nextDay(today) };
}

function periodMetrics(saleRows: Array<typeof sales.$inferSelect>, expenseRows: Array<typeof expenses.$inferSelect>, start: Date, end: Date) {
  const scopedSales = saleRows.filter(sale => !sale.isVoided && sale.saleDate >= start && sale.saleDate < end);
  const scopedExpenses = expenseRows.filter(expense => expense.expenseDate >= start && expense.expenseDate < end);
  const revenueCentavos = sum(scopedSales.map(sale => sale.expectedRevenueCentavos));
  const cogsCentavos = sum(scopedSales.map(sale => sale.cogsCentavos));
  const grossProfitCentavos = sum(scopedSales.map(sale => sale.grossProfitCentavos));
  const unitsSold = sum(scopedSales.map(sale => sale.unitsSold));
  const expensesCentavos = sum(scopedExpenses.map(expense => expense.amountCentavos));
  const dayCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
  const byDay = new Map<string, number>();
  scopedSales.forEach(sale => byDay.set(dayKey(sale.saleDate), (byDay.get(dayKey(sale.saleDate)) ?? 0) + sale.unitsSold));
  const dailyUnits = Array.from(byDay.values());
  return {
    unitsSold,
    revenueCentavos,
    cogsCentavos,
    grossProfitCentavos,
    expensesCentavos,
    netProfitCentavos: grossProfitCentavos - expensesCentavos,
    cashCollectedCentavos: sum(scopedSales.map(sale => sale.cashCollectedCentavos)),
    cashVarianceCentavos: sum(scopedSales.map(sale => sale.cashVarianceCentavos)),
    averageUnitsPerDay: unitsSold / dayCount,
    averageRevenuePerDay: revenueCentavos / dayCount,
    averageProfitPerDay: grossProfitCentavos / dayCount,
    grossMarginPercent: revenueCentavos === 0 ? 0 : (grossProfitCentavos / revenueCentavos) * 100,
    bestDayUnits: dailyUnits.length ? Math.max(...dailyUnits) : 0,
    worstDayUnits: dailyUnits.length ? Math.min(...dailyUnits) : 0,
  };
}

function dailyPeriodSeries(saleRows: Array<typeof sales.$inferSelect>, start: Date, endExclusive: Date) {
  const days = Math.max(1, Math.ceil((endExclusive.getTime() - start.getTime()) / 86_400_000));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * 86_400_000);
    const daySales = saleRows.filter(sale => !sale.isVoided && dayKey(sale.saleDate) === dayKey(date));
    return { date: dayKey(date), units: sum(daySales.map(sale => sale.unitsSold)), revenueCentavos: sum(daySales.map(sale => sale.expectedRevenueCentavos)) };
  });
}

export async function getDashboardRangeData(userId: number, startDateValue: string, endDateValue: string) {
  await ensureBusinessSetup(userId);
  const start = dayStart(dateAtNoonUtc(startDateValue));
  const endDate = dayStart(dateAtNoonUtc(endDateValue));
  const endExclusive = nextDay(endDate);
  const dayCount = Math.ceil((endExclusive.getTime() - start.getTime()) / 86_400_000);
  if (start > endDate) throw new Error("The custom range must end on or after its start date.");
  if (dayCount > 366) throw new Error("Custom ranges can cover up to 366 days.");
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [saleRows, expenseRows] = await Promise.all([
    db.select().from(sales).where(and(gte(sales.saleDate, start), lt(sales.saleDate, endExclusive))).orderBy(asc(sales.saleDate)),
    db.select().from(expenses).where(and(gte(expenses.expenseDate, start), lt(expenses.expenseDate, endExclusive))).orderBy(asc(expenses.expenseDate)),
  ]);
  return {
    startDate: dayKey(start),
    endDate: dayKey(endDate),
    metrics: periodMetrics(saleRows, expenseRows, start, endExclusive),
    salesByDay: dailyPeriodSeries(saleRows, start, endExclusive),
  };
}

export async function getDashboardData(userId: number) {
  await ensureBusinessSetup(userId);
  await ensureTransitionPeriod(userId);
  await ensureOngoingPeriodPlan(userId);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [settingsRows, salesRows, inventoryRows, expenseRows, ownerRows, capitalRows, allocationRows, profitLedgerRows, productRows, closingRows, periodRows, weeklyTargetRows] = await Promise.all([
    db.select().from(businessSettings).limit(1),
    db.select().from(sales).orderBy(desc(sales.saleDate)),
    db.select().from(inventoryTransactions).orderBy(desc(inventoryTransactions.transactionDate)),
    db.select().from(expenses).orderBy(desc(expenses.expenseDate)),
    db.select().from(owners).orderBy(asc(owners.id)),
    db.select().from(capitalTransactions).orderBy(desc(capitalTransactions.transactionDate)),
    db.select().from(profitAllocations),
    db.select().from(profitLedgerEntries).orderBy(desc(profitLedgerEntries.entryDate)),
    db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.id)),
    db.select().from(dailyClosings).orderBy(desc(dailyClosings.closingDate)).limit(10),
    db.select().from(businessPeriods).orderBy(asc(businessPeriods.startDate)),
    db.select().from(weeklyTargetSnapshots).orderBy(desc(weeklyTargetSnapshots.weekStartDate)).limit(52),
  ]);
  const settings = settingsRows[0];
  const product = productRows[0];
  if (!settings || !product) throw new Error("Business settings are incomplete.");
  const now = new Date();
  const todayRange = rangeFor("today", now);
  const weekRanges = getMondayWeekRanges(now);
  const weekRange = { start: weekRanges.currentWeekStart, end: weekRanges.currentWeekEnd };
  const monthRange = rangeFor("month", now);
  const quarterRange = rangeFor("quarter", now);
  const yearRange = rangeFor("year", now);
  const currentInventoryRows = inventoryRows.filter(row => row.transactionDate < nextDay(dayStart(now)));
  const inventoryUnits = sum(currentInventoryRows.map(row => row.unitsDelta));
  const inventoryValueCentavos = calculateInventoryValue(inventoryUnits, settings.defaultCostPerUnitCentavos);
  const retainedCash = calculateRetainedCashBalance({ sales: salesRows, expenses: expenseRows, inventory: currentInventoryRows, capital: capitalRows, profitLedger: profitLedgerRows });
  const receivables: never[] = [];
  const outstandingReceivablesCentavos = 0;
  const weekMetrics = periodMetrics(salesRows, expenseRows, weekRange.start, weekRange.end);
  const previousWeekMetrics = periodMetrics(salesRows, expenseRows, weekRanges.previousWeekStart, weekRanges.previousWeekEnd);
  const weeklyComparison = calculateWeeklyUnitComparison(weekMetrics.unitsSold, previousWeekMetrics.unitsSold);
  const weeklyReportHistory = calculateWeeklyReportHistory({ now, sales: salesRows, targets: weeklyTargetRows, currentTargetUnits: settings.weeklyUnitsTarget, weeks: 12 });
  const alerts = calculateBusinessAlerts({ now, sales: salesRows, currentWeekUnitsSold: weekMetrics.unitsSold, weeklyTargetUnits: settings.weeklyUnitsTarget });
  const monthMetrics = periodMetrics(salesRows, expenseRows, monthRange.start, monthRange.end);
  const recent30 = periodMetrics(salesRows, expenseRows, new Date(todayRange.start.getTime() - 29 * 86_400_000), todayRange.end);
  const salesByWeek = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekRange.start.getTime() + index * 86_400_000);
    const daySales = salesRows.filter(sale => !sale.isVoided && dayKey(sale.saleDate) === dayKey(date));
    return { date: dayKey(date), units: sum(daySales.map(sale => sale.unitsSold)), revenueCentavos: sum(daySales.map(sale => sale.expectedRevenueCentavos)) };
  });
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const salesByMonth = Array.from({ length: 12 }, (_, monthIndex) => {
    const start = new Date(Date.UTC(now.getUTCFullYear(), monthIndex, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), monthIndex + 1, 1));
    const monthSales = salesRows.filter(sale => !sale.isVoided && sale.saleDate >= start && sale.saleDate < end);
    return { date: dayKey(start), label: monthLabels[monthIndex], units: sum(monthSales.map(sale => sale.unitsSold)), revenueCentavos: sum(monthSales.map(sale => sale.expectedRevenueCentavos)) };
  });
  const ownerSummaries = ownerRows.map(owner => {
    const ownerCapital = capitalRows.filter(item => item.ownerId === owner.id && item.status === "posted");
    const contributions = sum(ownerCapital.filter(item => item.transactionType === "capital_contribution").map(item => item.amountCentavos));
    const withdrawals = sum(ownerCapital.filter(item => item.transactionType === "capital_withdrawal").map(item => item.amountCentavos));
    const ledgerEntries = profitLedgerRows.filter(item => item.ownerId === owner.id);
    const earnedProfit = sum(ledgerEntries.filter(item => item.entryType === "earned" || item.entryType === "adjustment").map(item => item.amountCentavos));
    const distributedProfit = sum(ledgerEntries.filter(item => item.entryType === "distributed").map(item => item.amountCentavos));
    const legacyAllocatedProfit = sum(allocationRows.filter(item => item.ownerId === owner.id).map(item => item.allocatedProfitCentavos));
    const allocatedProfit = earnedProfit || legacyAllocatedProfit;
    const distributions = distributedProfit;
    return {
      ...owner,
      capitalContributedCentavos: contributions,
      capitalWithdrawnCentavos: withdrawals,
      currentCapitalCentavos: contributions - withdrawals,
      allocatedProfitCentavos: allocatedProfit,
      profitDistributedCentavos: distributions,
      undistributedProfitCentavos: allocatedProfit - distributions,
      totalReceivedCentavos: withdrawals + distributions,
      economicInterestCentavos: contributions - withdrawals + allocatedProfit - distributions,
    };
  });
  const salesVelocity = recent30.unitsSold / 30;
  const estimatedDaysUntilStockout = salesVelocity > 0 ? inventoryUnits / salesVelocity : null;
  const insights: Array<{ tone: "good" | "watch" | "neutral"; text: string }> = [];
  const plannedFourBoxCycle = periodRows.find(period => period.status === "planned" && period.totalStartingBoxes === 4);
  if (plannedFourBoxCycle) insights.push({ tone: "neutral", text: `Current stock is ${inventoryUnits} units / ${inventoryUnits / settings.unitsPerBox} boxes. The 4-box cycle begins on ${plannedFourBoxCycle.startDate.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}: Gale 2 boxes and Nikki 2 boxes.` });
  if (inventoryUnits <= settings.minimumInventoryUnits) insights.push({ tone: "watch", text: `RESTOCK NEEDED  -  ${inventoryUnits} units remain, at or below your ${settings.minimumInventoryUnits}-unit minimum.` });
  if (estimatedDaysUntilStockout !== null) insights.push({ tone: estimatedDaysUntilStockout < 7 ? "watch" : "neutral", text: `At the recent pace of ${salesVelocity.toFixed(1)} units/day, inventory may last about ${estimatedDaysUntilStockout.toFixed(1)} days.` });
  if (monthMetrics.cashVarianceCentavos !== 0) insights.push({ tone: "watch", text: `This month’s cash collected differs from expected sales by ${monthMetrics.cashVarianceCentavos < 0 ? "−" : "+"}₱${(Math.abs(monthMetrics.cashVarianceCentavos) / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}. Review the cash variance note.` });
  if (!insights.length) insights.push({ tone: "good", text: "Your opening inventory and ledgers are reconciled. Record the next daily sale to begin tracking performance." });

  return {
    settings,
    product,
    inventoryUnits,
    inventoryBoxes: inventoryUnits / settings.unitsPerBox,
    inventoryValueCentavos,
    retainedCash,
    outstandingReceivablesCentavos,
    salesVelocity,
    estimatedDaysUntilStockout,
    periods: {
      today: periodMetrics(salesRows, expenseRows, todayRange.start, todayRange.end),
      week: weekMetrics,
      previousWeek: previousWeekMetrics,
      month: monthMetrics,
      quarter: periodMetrics(salesRows, expenseRows, quarterRange.start, quarterRange.end),
      year: periodMetrics(salesRows, expenseRows, yearRange.start, yearRange.end),
    },
    weeklyComparison: {
      ...weeklyComparison,
      currentWeekStartDate: dayKey(weekRanges.currentWeekStart),
      currentWeekEndDate: dayKey(new Date(weekRanges.currentWeekEnd.getTime() - 86_400_000)),
      previousWeekStartDate: dayKey(weekRanges.previousWeekStart),
      previousWeekEndDate: dayKey(new Date(weekRanges.previousWeekEnd.getTime() - 86_400_000)),
    },
    weeklyReportHistory,
    alerts,
    ownerSummaries,
    salesByDay: salesByWeek,
    salesByWeek,
    salesByMonth,
    insights,
    recentSales: salesRows.slice(0, 12),
    recentInventory: currentInventoryRows.slice(0, 12),
    receivables,
    capitalTransactions: capitalRows.slice(0, 12),
    recentProfitEntries: profitLedgerRows.slice(0, 18),
    expenses: expenseRows.slice(0, 12),
    recentClosings: closingRows,
  };
}

export async function getTransitionReport(userId: number) {
  await ensureBusinessSetup(userId);
  const period = await ensureTransitionPeriod(userId);
  await ensureOngoingPeriodPlan(userId);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [periodRows, trancheRows, ownerRows, saleRows, capitalRows, returnRows, inventoryRows] = await Promise.all([
    db.select().from(businessPeriods).where(eq(businessPeriods.id, period.id)).limit(1),
    db.select().from(periodOwnerTranches).where(eq(periodOwnerTranches.periodId, period.id)).orderBy(asc(periodOwnerTranches.id)),
    db.select().from(owners).orderBy(asc(owners.id)),
    db.select().from(sales).where(eq(sales.periodId, period.id)).orderBy(asc(sales.saleDate)),
    db.select().from(capitalTransactions).where(eq(capitalTransactions.periodId, period.id)).orderBy(asc(capitalTransactions.transactionDate)),
    db.select().from(guaranteedReturns).where(eq(guaranteedReturns.periodId, period.id)).orderBy(desc(guaranteedReturns.updatedAt)),
    db.select().from(inventoryTransactions).orderBy(asc(inventoryTransactions.transactionDate)),
  ]);
  const currentPeriod = periodRows[0];
  if (!currentPeriod) throw new Error("Transition period is unavailable.");
  const performanceTranches = trancheRows.filter(tranche => tranche.trancheType === "performance");
  const summarize = (trancheIds: number[], ownerId?: number) => {
    const scopedSales = saleRows.filter(sale => !sale.isVoided && trancheIds.includes(sale.periodTrancheId ?? -1));
    const scopedCapital = capitalRows.filter(item => ownerId === undefined || item.ownerId === ownerId);
    const startingBoxes = sum(trancheRows.filter(tranche => trancheIds.includes(tranche.id)).map(tranche => tranche.startingBoxes));
    const startingUnits = sum(trancheRows.filter(tranche => trancheIds.includes(tranche.id)).map(tranche => tranche.startingUnits));
    const startingCapitalCentavos = sum(trancheRows.filter(tranche => trancheIds.includes(tranche.id)).map(tranche => tranche.startingCapitalCentavos));
    const capitalWithdrawnCentavos = sum(scopedCapital.filter(item => item.transactionType === "capital_withdrawal" && item.status === "posted").map(item => item.amountCentavos));
    const profitDistributedCentavos = sum(scopedCapital.filter(item => item.transactionType === "profit_distribution" && item.status === "posted").map(item => item.amountCentavos));
    const unitsSold = sum(scopedSales.map(sale => sale.unitsSold));
    return {
      startingBoxes,
      startingCapitalCentavos,
      startingUnits,
      unitsSold,
      revenueCentavos: sum(scopedSales.map(sale => sale.expectedRevenueCentavos)),
      cogsCentavos: sum(scopedSales.map(sale => sale.cogsCentavos)),
      grossProfitCentavos: sum(scopedSales.map(sale => sale.grossProfitCentavos)),
      cashCollectedCentavos: sum(scopedSales.map(sale => sale.cashCollectedCentavos)),
      outstandingReceivablesCentavos: 0,
      capitalWithdrawnCentavos,
      profitDistributedCentavos,
      remainingInventoryUnits: Math.max(startingUnits - unitsSold, 0),
    };
  };
  const galeTranche = performanceTranches.find(tranche => ownerRows.find(owner => owner.id === tranche.ownerId)?.name === "Gale");
  const nikkiTranche = performanceTranches.find(tranche => ownerRows.find(owner => owner.id === tranche.ownerId)?.name === "Nikki");
  const gale = galeTranche ? summarize([galeTranche.id], galeTranche.ownerId) : summarize([]);
  const nikki = nikkiTranche ? summarize([nikkiTranche.id], nikkiTranche.ownerId) : summarize([]);
  const combined = summarize(performanceTranches.map(tranche => tranche.id));
  const guarantee = returnRows[0] ? { ...returnRows[0], ownerName: ownerRows.find(owner => owner.id === returnRows[0].ownerId)?.name ?? "" } : null;
  const actualApplicableProfitCentavos = gale.grossProfitCentavos;
  const withdrawal = calculateTransitionWithdrawal(gale.startingCapitalCentavos, actualApplicableProfitCentavos);
  const now = new Date();
  const currentInventoryUnits = sum(inventoryRows.filter(row => row.transactionDate < nextDay(dayStart(now))).map(row => row.unitsDelta));
  return {
    period: currentPeriod,
    tranches: trancheRows,
    guarantee,
    rows: { gale, nikki, combined },
    currentInventoryUnits,
    withdrawalPreview: {
      ...withdrawal,
      actualApplicableProfitCentavos,
    },
  };
}

export async function closeInitialPeriodAndStartOngoing(userId: number, dateValue: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const transition = await getTransitionReport(userId);
  if (transition.period.status === "closed") throw new Error("The initial period is already closed.");
  if (transition.rows.gale.capitalWithdrawnCentavos < transition.withdrawalPreview.capitalReturnCentavos) {
    throw new Error("Post Gale's separate capital withdrawal before closing the initial cycle.");
  }
  const closeDate = dateAtNoonUtc(dateValue);
  await db.update(businessPeriods).set({ status: "closed", endDate: closeDate }).where(eq(businessPeriods.id, transition.period.id));
  const [existing] = await db.select().from(businessPeriods).where(eq(businessPeriods.name, "Period 2  -  Ongoing 4-Box Cycle")).limit(1);
  if (existing) {
    await db.update(businessPeriods).set({ status: "open", endDate: null, updatedBy: userId }).where(eq(businessPeriods.id, existing.id));
    await recordAudit(userId, "activated", "business_period", existing.id, "Activated the planned Monday ongoing 4-box cycle after closing the temporary 6-box period.");
    return { ...existing, status: "open" as const };
  }
  const [gale] = await db.select().from(owners).where(eq(owners.name, "Gale")).limit(1);
  const [nikki] = await db.select().from(owners).where(eq(owners.name, "Nikki")).limit(1);
  if (!gale || !nikki) throw new Error("Owners are unavailable.");
  const [inserted] = await db.insert(businessPeriods).values({
    name: "Period 2  -  Ongoing 4-Box Cycle",
    status: "open",
    startDate: closeDate,
    totalStartingBoxes: 4,
    totalStartingUnits: 200,
    totalStartingCapitalCentavos: 14_000_000,
    notes: "Ongoing structure after Gale's 2-box capital return: Gale 2 boxes, Nikki 2 boxes.",
    createdBy: userId,
  });
  const periodId = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
  await db.insert(periodOwnerTranches).values([
    { periodId, ownerId: gale.id, label: "Gale  -  ongoing 2-box cycle", trancheType: "ongoing", startingBoxes: 2, startingUnits: 100, startingCapitalCentavos: 7_000_000 },
    { periodId, ownerId: nikki.id, label: "Nikki  -  ongoing 2-box cycle", trancheType: "ongoing", startingBoxes: 2, startingUnits: 100, startingCapitalCentavos: 7_000_000 },
  ]);
  await recordAudit(userId, "closed_and_started", "business_period", periodId, "Closed the initial 6-box cycle and opened the ongoing 4-box cycle.");
  return { id: periodId, name: "Period 2  -  Ongoing 4-Box Cycle", status: "open" as const };
}

export async function recordGaleTransitionWithdrawal(userId: number, dateValue: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const transition = await getTransitionReport(userId);
  const [gale] = await db.select().from(owners).where(eq(owners.name, "Gale")).limit(1);
  const galeTranche = transition.tranches.find(tranche => tranche.trancheType === "performance" && tranche.ownerId === gale?.id);
  if (!gale || !galeTranche) throw new Error("Gale's initial performance tranche is unavailable.");
  const alreadyPosted = await db.select().from(capitalTransactions).where(and(
    eq(capitalTransactions.periodId, transition.period.id),
    eq(capitalTransactions.periodTrancheId, galeTranche.id),
    eq(capitalTransactions.status, "posted"),
  ));
  if (alreadyPosted.some(item => item.transactionType === "capital_withdrawal")) throw new Error("Gale's capital withdrawal has already been posted for this period.");
  const withdrawalDate = dateAtNoonUtc(dateValue);
  const capitalReturnCentavos = transition.withdrawalPreview.capitalReturnCentavos;
  const profitDistributionCentavos = transition.withdrawalPreview.profitDistributionCentavos;
  await db.insert(capitalTransactions).values({
    transactionDate: withdrawalDate,
    ownerId: gale.id,
    periodId: transition.period.id,
    periodTrancheId: galeTranche.id,
    transactionType: "capital_withdrawal",
    status: "posted",
    amountCentavos: capitalReturnCentavos,
    description: "Gale  -  return of initial 2-box capital",
    notes: "Separate from profit distribution.",
    createdBy: userId,
  });
  if (profitDistributionCentavos > 0) {
    await writeProfitLedgerEntries({
      userId,
      periodId: transition.period.id,
      entryDate: withdrawalDate,
      entryType: "distributed",
      allocations: [{ ownerId: gale.id, amountCentavos: profitDistributionCentavos }],
      description: "Gale  -  actual profit distribution from 2-box performance",
      notes: "Recorded separately from capital withdrawal and guaranteed return.",
    });
  }
  await recordAudit(userId, "posted", "gale_transition_withdrawal", transition.period.id, JSON.stringify({ capitalReturnCentavos, profitDistributionCentavos }));
  return { capitalReturnCentavos, profitDistributionCentavos, totalCentavos: capitalReturnCentavos + profitDistributionCentavos };
}

export async function updateGuaranteedReturnStatus(userId: number, input: { guaranteedReturnId: number; status: "pending" | "earned" | "paid" | "cancelled" }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [record] = await db.select().from(guaranteedReturns).where(eq(guaranteedReturns.id, input.guaranteedReturnId)).limit(1);
  if (!record) throw new Error("Guaranteed return record was not found.");
  await db.update(guaranteedReturns).set({ status: input.status }).where(eq(guaranteedReturns.id, record.id));
  await recordAudit(userId, "updated", "guaranteed_return", record.id, JSON.stringify({ status: input.status }));
  return { id: record.id, status: input.status };
}

export async function addSaleRecord(userId: number, input: { date: string; operatorId: number; unitsSold: number; cashCollectedPesos: number; autoCalculateCash?: boolean; periodId?: number; periodTrancheId?: number; notes?: string; confirmDuplicate?: boolean }) {
  await ensureBusinessSetup(userId);
  await ensureTransitionPeriod(userId);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [product] = await db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.id)).limit(1);
  const [settings] = await db.select().from(businessSettings).limit(1);
  if (!product || !settings) throw new Error("Set up an active product before recording sales.");
  const inventoryRows = await db.select().from(inventoryTransactions).where(eq(inventoryTransactions.productId, product.id));
  const saleDate = dateAtNoonUtc(input.date);
  const availableUnits = sum(inventoryRows.filter(row => row.transactionDate < nextDay(dayStart(saleDate))).map(row => row.unitsDelta));
  if (input.unitsSold > availableUnits) throw new Error(`Only ${availableUnits} units are available in inventory.`);
  const autoTotals = input.autoCalculateCash ? calculateAutoSaleTotals(input.unitsSold, product.costPerUnitCentavos) : null;
  const sellingPriceCentavos = autoTotals?.sellingPriceCentavos ?? product.sellingPriceCentavos;
  const cashCollectedCentavos = autoTotals?.expectedRevenueCentavos ?? pesoToCentavos(input.cashCollectedPesos);
  const metrics = calculateSaleMetrics(input.unitsSold, sellingPriceCentavos, product.costPerUnitCentavos, cashCollectedCentavos);
  const [possibleDuplicate] = await db.select().from(sales).where(and(
    eq(sales.saleDate, saleDate),
    eq(sales.operatorId, input.operatorId),
    eq(sales.unitsSold, input.unitsSold),
    eq(sales.cashCollectedCentavos, cashCollectedCentavos),
    eq(sales.isVoided, false),
  )).limit(1);
  if (possibleDuplicate && !input.confirmDuplicate) {
    throw new Error(`Possible duplicate daily sales entry (${possibleDuplicate.recordCode ?? `sale #${possibleDuplicate.id}`}). Review it or confirm this is a separate transaction.`);
  }
  const inserted = await db.insert(sales).values({
    saleDate,
    operatorId: input.operatorId,
    productId: product.id,
    periodId: input.periodId ?? null,
    periodTrancheId: input.periodTrancheId ?? null,
    customerId: null,
    unitsSold: input.unitsSold,
    sellingPriceCentavos,
    costPerUnitCentavos: product.costPerUnitCentavos,
    expectedRevenueCentavos: metrics.expectedRevenueCentavos,
    cogsCentavos: metrics.cogsCentavos,
    grossProfitCentavos: metrics.grossProfitCentavos,
    cashCollectedCentavos,
    cashVarianceCentavos: metrics.cashVarianceCentavos,
    paymentStatus: metrics.paymentStatus,
    amountDueCentavos: metrics.expectedRevenueCentavos,
    amountCollectedCentavos: metrics.amountCollectedCentavos,
    balanceCentavos: metrics.balanceCentavos,
    dueDate: null,
    notes: input.notes?.trim() || null,
    createdBy: userId,
  });
  const saleId = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
  const saleCode = makeRecordCode("sale", saleDate, saleId);
  await db.update(sales).set({ recordCode: saleCode, updatedBy: userId }).where(eq(sales.id, saleId));
  const inventoryInsert = await db.insert(inventoryTransactions).values({
    transactionDate: saleDate,
    productId: product.id,
    transactionType: "sale",
    unitsDelta: -input.unitsSold,
    costPerUnitCentavos: product.costPerUnitCentavos,
    saleId,
    description: `Sale of ${input.unitsSold} units`,
    notes: input.notes?.trim() || null,
    createdBy: userId,
  });
  const inventoryId = Number((inventoryInsert as any)[0]?.insertId ?? (inventoryInsert as any).insertId);
  await db.update(inventoryTransactions).set({ recordCode: makeRecordCode("inventory", saleDate, inventoryId), updatedBy: userId }).where(eq(inventoryTransactions.id, inventoryId));
  if (metrics.amountCollectedCentavos > 0) {
    const paymentInsert = await db.insert(payments).values({ saleId, paymentDate: saleDate, amountCentavos: metrics.amountCollectedCentavos, note: "Immediate payment", createdBy: userId });
    const paymentId = Number((paymentInsert as any)[0]?.insertId ?? (paymentInsert as any).insertId);
    await db.update(payments).set({ recordCode: makeRecordCode("payment", saleDate, paymentId), updatedBy: userId }).where(eq(payments.id, paymentId));
  }
  const activeRules = await getProfitRulesForSaleDate(saleDate);
  const profitSplit = calculateProfitSplit(metrics.grossProfitCentavos, activeRules);
  await db.insert(profitAllocations).values(profitSplit.map(rule => ({
    saleId,
    ownerId: rule.ownerId,
    shareBasisPoints: rule.shareBasisPoints,
    allocatedProfitCentavos: rule.amountCentavos,
  })));
  const profitEntries = await writeProfitLedgerEntries({
    userId,
    saleId,
    periodId: input.periodId ?? null,
    entryDate: saleDate,
    entryType: "earned",
    allocations: profitSplit,
    description: `Earned gross-profit share from ${saleCode}`,
    notes: "Calculated automatically from sale gross profit only; COGS/capital is excluded.",
  });
  const ownerRows = await db.select().from(owners);
  const profitDistribution = profitSplit.map(split => ({
    ownerId: split.ownerId,
    ownerName: ownerRows.find(owner => owner.id === split.ownerId)?.name ?? "Owner",
    shareBasisPoints: split.shareBasisPoints,
    amountCentavos: split.amountCentavos,
    recordCode: profitEntries.find(entry => entry.ownerId === split.ownerId)?.recordCode,
  }));
  await recordAudit(userId, "created", "sale", saleCode, "Created paid sale, inventory/payment records, and automatic gross-profit ledger entries.", undefined, { unitsSold: input.unitsSold, expectedRevenueCentavos: metrics.expectedRevenueCentavos, cogsCentavos: metrics.cogsCentavos, grossProfitCentavos: metrics.grossProfitCentavos, cashCollectedCentavos, profitDistribution });
  return { saleId, saleCode, ...metrics, profitDistribution };
}

export async function recordCustomerPayment(userId: number, input: { saleId: number; amountPesos: number; paymentDate: string; note?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [sale] = await db.select().from(sales).where(eq(sales.id, input.saleId)).limit(1);
  if (!sale || sale.isVoided) throw new Error("This sale is unavailable for payment.");
  const amountCentavos = pesoToCentavos(input.amountPesos);
  if (amountCentavos <= 0 || amountCentavos > sale.balanceCentavos) throw new Error("Payment must be greater than zero and no more than the outstanding balance.");
  const amountCollectedCentavos = sale.amountCollectedCentavos + amountCentavos;
  const balanceCentavos = sale.amountDueCentavos - amountCollectedCentavos;
  await db.insert(payments).values({ saleId: sale.id, paymentDate: dateAtNoonUtc(input.paymentDate), amountCentavos, note: input.note?.trim() || null, createdBy: userId });
  await db.update(sales).set({
    amountCollectedCentavos,
    balanceCentavos,
    paymentStatus: balanceCentavos === 0 ? "paid" : "partially_paid",
  }).where(eq(sales.id, sale.id));
  await recordAudit(userId, "created", "payment", sale.id, JSON.stringify({ amountCentavos }));
  return { saleId: sale.id, balanceCentavos };
}

export async function addExpenseRecord(userId: number, input: { date: string; category: "transportation" | "delivery" | "packaging" | "communication" | "operating" | "other"; amountPesos: number; paidBy?: string; description: string; notes?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const inserted = await db.insert(expenses).values({
    expenseDate: dateAtNoonUtc(input.date), category: input.category, amountCentavos: pesoToCentavos(input.amountPesos),
    paidBy: input.paidBy?.trim() || null, description: input.description.trim(), notes: input.notes?.trim() || null, createdBy: userId,
  });
  const id = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
  const recordCode = makeRecordCode("expense", dateAtNoonUtc(input.date), id);
  await db.update(expenses).set({ recordCode, updatedBy: userId }).where(eq(expenses.id, id));
  await recordAudit(userId, "created", "expense", recordCode, "Created immutable expense entry.", undefined, { amountPesos: input.amountPesos, description: input.description.trim() });
  return { id, recordCode };
}

export async function addCapitalTransaction(userId: number, input: { date: string; ownerId?: number; periodId?: number; periodTrancheId?: number; transactionType: "capital_contribution" | "capital_withdrawal" | "profit_distribution" | "expense" | "adjustment"; status: "pending" | "posted"; amountPesos: number; description: string; notes?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  if (input.transactionType === "profit_distribution") throw new Error("Use the separate profit distribution ledger; profit settlements do not change capital.");
  const inserted = await db.insert(capitalTransactions).values({
    transactionDate: dateAtNoonUtc(input.date), ownerId: input.ownerId ?? null, periodId: input.periodId ?? null, periodTrancheId: input.periodTrancheId ?? null, transactionType: input.transactionType,
    status: input.status, amountCentavos: pesoToCentavos(input.amountPesos), description: input.description.trim(), notes: input.notes?.trim() || null, createdBy: userId,
  });
  const id = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
  const recordCode = makeRecordCode("capital", dateAtNoonUtc(input.date), id);
  await db.update(capitalTransactions).set({ recordCode, updatedBy: userId }).where(eq(capitalTransactions.id, id));
  await recordAudit(userId, "created", "capital_transaction", recordCode, "Created immutable capital ledger entry.", undefined, { transactionType: input.transactionType, amountPesos: input.amountPesos });
  return { id, recordCode };
}

export async function addInventoryPurchase(userId: number, input: { date: string; boxes: number; unitsPerBox: number; costPerBoxPesos: number; fundingSource: "retained_cash" | "new_capital" | "other"; notes?: string }) {
  await ensureBusinessSetup(userId);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [product] = await db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.id)).limit(1);
  if (!product) throw new Error("Set up an active product before recording inventory purchases.");
  const purchase = calculateInventoryPurchase(input.boxes, input.unitsPerBox, pesoToCentavos(input.costPerBoxPesos));
  const transactionDate = dateAtNoonUtc(input.date);
  const inserted = await db.insert(inventoryTransactions).values({
    transactionDate,
    productId: product.id,
    transactionType: "purchase",
    fundingSource: input.fundingSource,
    unitsDelta: purchase.unitsAdded,
    costPerUnitCentavos: purchase.costPerUnitCentavos,
    description: `Purchased ${input.boxes} ${input.boxes === 1 ? "box" : "boxes"}`,
    notes: input.notes?.trim() || `Added ${purchase.unitsAdded} units to inventory at ₱${input.costPerBoxPesos.toLocaleString("en-PH")} per box.`,
    createdBy: userId,
  });
  const id = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
  const recordCode = makeRecordCode("inventory", transactionDate, id);
  await db.update(inventoryTransactions).set({ recordCode, updatedBy: userId }).where(eq(inventoryTransactions.id, id));
  await recordAudit(userId, "created", "inventory_purchase", recordCode, input.fundingSource === "retained_cash" ? "Reinvested retained business cash from prior sales into additional inventory; no new owner capital was added." : "Added purchased boxes to the inventory ledger.", undefined, { boxes: input.boxes, unitsAdded: purchase.unitsAdded, totalCostCentavos: purchase.totalCostCentavos, fundingSource: input.fundingSource });
  return { id, recordCode, boxes: input.boxes, unitsAdded: purchase.unitsAdded, totalCostCentavos: purchase.totalCostCentavos };
}

export async function closeBusinessDay(userId: number, dateValue: string, notes?: string) {
  await ensureBusinessSetup(userId);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const date = dateAtNoonUtc(dateValue);
  const start = dayStart(date);
  const end = nextDay(start);
  const [inventoryRows, saleRows, expenseRows, settingsRows] = await Promise.all([db.select().from(inventoryTransactions), db.select().from(sales), db.select().from(expenses), db.select().from(businessSettings).limit(1)]);
  const beforeRows = inventoryRows.filter(row => row.transactionDate < start);
  const dayRows = inventoryRows.filter(row => row.transactionDate >= start && row.transactionDate < end);
  const daySales = saleRows.filter(sale => !sale.isVoided && sale.saleDate >= start && sale.saleDate < end);
  const beginningInventoryUnits = sum(beforeRows.map(row => row.unitsDelta));
  const receivedUnits = sum(dayRows.filter(row => row.transactionType === "purchase" || row.transactionType === "initial").map(row => row.unitsDelta));
  const soldUnits = Math.abs(sum(dayRows.filter(row => row.transactionType === "sale").map(row => row.unitsDelta)));
  const lossUnits = Math.abs(sum(dayRows.filter(row => row.transactionType === "loss").map(row => row.unitsDelta)));
  const expectedEndingInventoryUnits = beginningInventoryUnits + receivedUnits - soldUnits - lossUnits;
  const expectedRevenueCentavos = sum(daySales.map(sale => sale.expectedRevenueCentavos));
  const cogsCentavos = sum(daySales.map(sale => sale.cogsCentavos));
  const grossProfitCentavos = sum(daySales.map(sale => sale.grossProfitCentavos));
  const expensesCentavos = sum(expenseRows.filter(expense => expense.expenseDate >= start && expense.expenseDate < end).map(expense => expense.amountCentavos));
  const cashCollectedCentavos = sum(daySales.map(sale => sale.cashCollectedCentavos));
  const creditOutstandingCentavos = 0;
  const reconciliationGapCentavos = expectedRevenueCentavos - cashCollectedCentavos;
  const status = reconciliationGapCentavos === 0 ? "reconciled" as const : "needs_review" as const;
  const inventoryValueCentavos = calculateInventoryValue(expectedEndingInventoryUnits, settingsRows[0]?.defaultCostPerUnitCentavos ?? 0);
  const [existingClosing] = await db.select().from(dailyClosings).where(eq(dailyClosings.closingDate, start)).limit(1);
  if (existingClosing && existingClosing.status !== "reopened") {
    throw new Error("This day is already closed. Reopen it before replacing the reconciliation snapshot.");
  }
  await db.insert(dailyClosings).values({
    closingDate: start, beginningInventoryUnits, receivedUnits, soldUnits, lossUnits, expectedEndingInventoryUnits,
    expectedRevenueCentavos, cogsCentavos, grossProfitCentavos, expensesCentavos, cashCollectedCentavos, creditOutstandingCentavos, reconciliationGapCentavos, inventoryValueCentavos, status, notes: notes?.trim() || null, closedBy: userId, updatedBy: userId,
  }).onDuplicateKeyUpdate({ set: { beginningInventoryUnits, receivedUnits, soldUnits, lossUnits, expectedEndingInventoryUnits, expectedRevenueCentavos, cogsCentavos, grossProfitCentavos, expensesCentavos, cashCollectedCentavos, creditOutstandingCentavos, reconciliationGapCentavos, inventoryValueCentavos, status, notes: notes?.trim() || null, closedBy: userId, updatedBy: userId } });
  const [closing] = await db.select().from(dailyClosings).where(eq(dailyClosings.closingDate, start)).limit(1);
  if (closing && !closing.recordCode) await db.update(dailyClosings).set({ recordCode: makeRecordCode("closing", start, closing.id), updatedBy: userId }).where(eq(dailyClosings.id, closing.id));
  await recordAudit(userId, "closed", "daily_closing", closing?.recordCode ?? dateValue, "Saved daily close snapshot. Any later reopen action is retained in the audit history.", undefined, { status, reconciliationGapCentavos, cogsCentavos, grossProfitCentavos, expensesCentavos, inventoryValueCentavos });
  return { beginningInventoryUnits, receivedUnits, soldUnits, lossUnits, expectedEndingInventoryUnits, expectedRevenueCentavos, cogsCentavos, grossProfitCentavos, expensesCentavos, cashCollectedCentavos, creditOutstandingCentavos, reconciliationGapCentavos, inventoryValueCentavos, status };
}

/** Reopens only the latest closing. Sales and other ledgers are never deleted or rewritten. */
export async function reopenBusinessDay(userId: number, dateValue: string, reason?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const closingDate = dayStart(dateAtNoonUtc(dateValue));
  const [closing, latestClosing] = await Promise.all([
    db.select().from(dailyClosings).where(eq(dailyClosings.closingDate, closingDate)).limit(1),
    db.select().from(dailyClosings).orderBy(desc(dailyClosings.closingDate), desc(dailyClosings.id)).limit(1),
  ]);
  const record = closing[0];
  const latest = latestClosing[0];
  if (!record) throw new Error("No daily close was found for this date.");
  if (record.status === "reopened") throw new Error("This day is already open for corrections.");
  if (!latest || latest.id !== record.id) throw new Error("Only the latest closed day can be reopened. Reopen newer days first to preserve the audit sequence.");
  const reopenNote = `REOPENED: ${reason?.trim() || "Correction requested"}`;
  const updatedNotes = `${record.notes ?? ""}${record.notes ? "\n" : ""}${reopenNote}`;
  await db.update(dailyClosings).set({ status: "reopened", notes: updatedNotes, updatedBy: userId }).where(eq(dailyClosings.id, record.id));
  await recordAudit(userId, "reopened", "daily_closing", record.recordCode ?? record.id, "Reopened daily close for correction. Original snapshot and all transaction records were retained.", { ...record }, { status: "reopened", reason: reason?.trim() || null });
  return { id: record.id, recordCode: record.recordCode, closingDate: record.closingDate, status: "reopened" as const };
}

export async function updateOwnershipRules(userId: number, input: { ownerId: number; sharePercent: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const ownerRows = await db.select().from(owners).where(eq(owners.active, true));
  const expected = [
    { name: "Gale", shareBasisPoints: 5_000 },
    { name: "Nikki", shareBasisPoints: 5_000 },
    { name: "Nikki's Dad", shareBasisPoints: 0 },
  ];
  const expectedByOwnerId = new Map(expected.map(item => [ownerRows.find(owner => owner.name === item.name)?.id, item.shareBasisPoints]));
  if (input.length !== expected.length || input.some(item => expectedByOwnerId.get(item.ownerId) !== Math.round(item.sharePercent * 100))) {
    throw new Error("Daily sale profit is locked at 50% Gale, 50% Nikki, and 0% Nikki's Dad. Dad is settled separately.");
  }
  const effectiveFrom = new Date();
  await db.insert(ownershipRules).values(expected.map(item => ({
    ownerId: ownerRows.find(owner => owner.name === item.name)!.id,
    shareBasisPoints: item.shareBasisPoints,
    effectiveFrom,
    createdBy: userId,
  })));
  await recordAudit(userId, "locked", "ownership_rules", undefined, "Kept future daily gross-profit allocation at Gale 50%, Nikki 50%, and Nikki's Dad 0%.");
  return { success: true };
}

export async function updateBusinessSettings(userId: number, input: { minimumInventoryUnits: number; costPerUnitPesos: number; sellingPricePesos: number; unitsPerBox: number; boxCostPesos: number; weeklyUnitsTarget: number; monthlyProfitTargetPesos: number }) {
  await ensureBusinessSetup(userId);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [setting] = await db.select().from(businessSettings).limit(1);
  const [product] = await db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.id)).limit(1);
  if (!setting || !product) throw new Error("Business settings are incomplete.");
  const update = { minimumInventoryUnits: input.minimumInventoryUnits, defaultCostPerUnitCentavos: pesoToCentavos(input.costPerUnitPesos), defaultSellingPriceCentavos: pesoToCentavos(input.sellingPricePesos), unitsPerBox: input.unitsPerBox, boxCostCentavos: pesoToCentavos(input.boxCostPesos), weeklyUnitsTarget: input.weeklyUnitsTarget, monthlyProfitTargetCentavos: pesoToCentavos(input.monthlyProfitTargetPesos) };
  await db.update(businessSettings).set(update).where(eq(businessSettings.id, setting.id));
  await db.update(products).set({ costPerUnitCentavos: update.defaultCostPerUnitCentavos, sellingPriceCentavos: update.defaultSellingPriceCentavos, unitsPerBox: input.unitsPerBox }).where(eq(products.id, product.id));
  await saveCurrentWeeklyTargetSnapshot(userId, input.weeklyUnitsTarget);
  await recordAudit(userId, "updated", "settings", setting.id, "Updated defaults for future transactions only.", setting, update);
  return { success: true };
}


export async function getSalesHistory(userId: number, input: { page?: number; pageSize?: number; search?: string; status?: "all" | "active" | "voided" }) {
  await ensureBusinessSetup(userId);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, input.pageSize ?? 25));
  const filters: any[] = [];
  if (input.status === "active") filters.push(eq(sales.isVoided, false));
  if (input.status === "voided") filters.push(eq(sales.isVoided, true));
  if (input.search?.trim()) {
    const pattern = `%${input.search.trim()}%`;
    filters.push(or(like(sales.recordCode, pattern), like(sales.notes, pattern)));
  }
  const where = filters.length ? and(...filters) : undefined;
  const [rows, totals] = await Promise.all([
    db.select().from(sales).where(where).orderBy(desc(sales.saleDate), desc(sales.id)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: count() }).from(sales).where(where),
  ]);
  return { rows, page, pageSize, total: Number(totals[0]?.total ?? 0), totalPages: Math.max(1, Math.ceil(Number(totals[0]?.total ?? 0) / pageSize)) };
}

export async function voidSaleRecord(userId: number, input: { saleId: number; reason: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [sale] = await db.select().from(sales).where(eq(sales.id, input.saleId)).limit(1);
  if (!sale) throw new Error("Sale was not found.");
  if (sale.isVoided) throw new Error("This sale is already voided and cannot be deleted.");
  const [product] = await db.select().from(products).where(eq(products.id, sale.productId)).limit(1);
  if (!product) throw new Error("Sale product was not found.");
  const voidedAt = new Date();
  await db.update(sales).set({ isVoided: true, voidedAt, updatedBy: userId, notes: `${sale.notes ?? ""}${sale.notes ? "\n" : ""}VOID REASON: ${input.reason.trim()}` }).where(eq(sales.id, sale.id));
  const reversal = await db.insert(inventoryTransactions).values({
    transactionDate: voidedAt,
    productId: sale.productId,
    transactionType: "reversal",
    unitsDelta: sale.unitsSold,
    costPerUnitCentavos: sale.costPerUnitCentavos,
    saleId: sale.id,
    description: `Reversal of ${sale.recordCode ?? `sale #${sale.id}`}`,
    notes: input.reason.trim(),
    createdBy: userId,
    updatedBy: userId,
  });
  const reversalId = Number((reversal as any)[0]?.insertId ?? (reversal as any).insertId);
  await db.update(inventoryTransactions).set({ recordCode: makeRecordCode("inventory", voidedAt, reversalId) }).where(eq(inventoryTransactions.id, reversalId));
  const originalProfitEntries = await db.select().from(profitLedgerEntries).where(and(eq(profitLedgerEntries.saleId, sale.id), eq(profitLedgerEntries.entryType, "earned")));
  const profitAdjustments = originalProfitEntries.length ? await writeProfitLedgerEntries({
    userId,
    saleId: sale.id,
    periodId: sale.periodId,
    entryDate: voidedAt,
    entryType: "adjustment",
    allocations: originalProfitEntries.map(entry => ({ ownerId: entry.ownerId, amountCentavos: -entry.amountCentavos, shareBasisPoints: entry.shareBasisPoints })),
    description: `Profit reversal for voided ${sale.recordCode ?? `sale #${sale.id}`}`,
    notes: input.reason.trim(),
  }) : [];
  await recordAudit(userId, "voided", "sale", sale.recordCode ?? sale.id, "Voided sale, inventory, and profit allocation through retained reversal entries.", sale, { reason: input.reason.trim(), reversalInventoryId: reversalId, profitAdjustmentCodes: profitAdjustments.map(entry => entry.recordCode) });
  return { saleId: sale.id, recordCode: sale.recordCode, reversalInventoryCode: makeRecordCode("inventory", voidedAt, reversalId) };
}

function addUtcDays(date: Date, days: number) { return new Date(date.getTime() + days * 86_400_000); }
function backupRetentionDate(type: "daily" | "weekly" | "monthly" | "manual", createdAt: Date) {
  if (type === "daily") return addUtcDays(createdAt, 30);
  if (type === "weekly") return addUtcDays(createdAt, 84);
  if (type === "monthly") return addUtcDays(createdAt, 366);
  return addUtcDays(createdAt, 366);
}

async function collectBusinessData() {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [userRows, ownerRows, operatorRows, productRows, settingRows, targetRows, periodRows, trancheRows, guaranteeRows, customerRows, saleRows, allocationRows, profitLedgerRows, ruleRows, inventoryRows, paymentRows, capitalRows, expenseRows, closingRows, auditRows, backupRows, integrityRows] = await Promise.all([
    db.select().from(users), db.select().from(owners), db.select().from(operators), db.select().from(products), db.select().from(businessSettings),
    db.select().from(weeklyTargetSnapshots),
    db.select().from(businessPeriods), db.select().from(periodOwnerTranches), db.select().from(guaranteedReturns), db.select().from(customers),
    db.select().from(sales), db.select().from(profitAllocations), db.select().from(profitLedgerEntries), db.select().from(ownershipRules), db.select().from(inventoryTransactions),
    db.select().from(payments), db.select().from(capitalTransactions), db.select().from(expenses), db.select().from(dailyClosings),
    db.select().from(auditEvents), db.select().from(backupRecords), db.select().from(integrityChecks),
  ]);
  return {
    users: userRows, owners: ownerRows, operators: operatorRows, products: productRows, business_settings: settingRows, weekly_target_snapshots: targetRows,
    business_periods: periodRows, period_owner_tranches: trancheRows, guaranteed_returns: guaranteeRows, customers: customerRows,
    sales: saleRows, profit_allocations: allocationRows, profit_ledger_entries: profitLedgerRows, ownership_rules: ruleRows, inventory_transactions: inventoryRows,
    payments: paymentRows, capital_transactions: capitalRows, expenses: expenseRows, daily_closings: closingRows,
    audit_events: auditRows, backup_records: backupRows, integrity_checks: integrityRows,
  };
}

export async function createBusinessBackup(userId: number | null, type: "daily" | "weekly" | "monthly" | "manual" = "manual") {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await ensureBusinessSetup(userId);
  const now = new Date();
  const start = dayStart(now);
  const end = nextDay(start);
  const [existing] = await db.select().from(backupRecords).where(and(eq(backupRecords.backupType, type), gte(backupRecords.createdAt, start), lt(backupRecords.createdAt, end), eq(backupRecords.status, "successful"))).limit(1);
  if (existing) return { ...existing, reused: true };
  const pendingCode = `BKP-PENDING-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`;
  const inserted = await db.insert(backupRecords).values({ recordCode: pendingCode, backupType: type, status: "started", retentionUntil: backupRetentionDate(type, now), createdBy: userId });
  const backupId = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
  const recordCode = makeRecordCode("backup", now, backupId);
  await db.update(backupRecords).set({ recordCode }).where(eq(backupRecords.id, backupId));
  try {
    const dataset = await collectBusinessData();
    const manifest = { format: "buy-sell-manager-logical-backup", version: 1, createdAt: now.toISOString(), backupType: type, brand: "Buy & Sell Manager", logo: "/manus-storage/buy-sell-delivery-logo-cropped_aea9dcd1.webp", files: ["branded-sales-receipt.md"], tables: Object.fromEntries(Object.entries(dataset).map(([name, rows]) => [name, rows.length])), restore: "Import each CSV into the matching table in a separate test database before restoring production." };
    const files: Record<string, string> = { "manifest.json": JSON.stringify(manifest, null, 2), "branded-sales-receipt.md": buildBrandedSalesReceipt(dataset.sales as Array<Record<string, any>>, dataset.profit_allocations as Array<Record<string, any>>, now) };
    for (const [name, rows] of Object.entries(dataset)) files[`${name}.csv`] = rowsToCsv(rows as Array<Record<string, unknown>>);
    const archive = archiveCsvFiles(files);
    const checksum = createHash("sha256").update(archive).digest("hex");
    const stored = await storagePut(`business-backups/${type}/${recordCode}.zip`, archive, "application/zip");
    const recordCount = Object.values(dataset).reduce((total, rows) => total + rows.length, 0);
    await db.update(backupRecords).set({ status: "successful", storageKey: stored.key, downloadUrl: stored.url, checksum, sizeBytes: archive.byteLength, recordCount }).where(eq(backupRecords.id, backupId));
    const [setting] = await db.select().from(backupSettings).limit(1);
    if (setting) await db.update(backupSettings).set({ lastSuccessfulBackupAt: now, updatedBy: userId }).where(eq(backupSettings.id, setting.id));
    await recordAudit(userId, "created", "backup", recordCode, `Created offsite ${type} logical backup bundle.`, undefined, { recordCount, checksum, sizeBytes: archive.byteLength });
    return { id: backupId, recordCode, backupType: type, status: "successful" as const, url: stored.url, storageKey: stored.key, checksum, sizeBytes: archive.byteLength, recordCount, retentionUntil: backupRetentionDate(type, now), reused: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.update(backupRecords).set({ status: "failed", errorMessage: message }).where(eq(backupRecords.id, backupId));
    await recordAudit(userId, "failed", "backup", recordCode, message);
    throw error;
  }
}

export async function runAutomaticBackupCycle() {
  const now = new Date();
  const created: unknown[] = [await createBusinessBackup(null, "daily")];
  if (now.getUTCDay() === 0) created.push(await createBusinessBackup(null, "weekly"));
  if (now.getUTCDate() === 1) created.push(await createBusinessBackup(null, "monthly"));
  return created;
}

export async function runIntegrityCheck(userId: number | null) {
  await ensureBusinessSetup(userId);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [inventoryRows, saleRows, ruleRows, capitalRows, closingRows] = await Promise.all([
    db.select().from(inventoryTransactions), db.select().from(sales), db.select().from(ownershipRules), db.select().from(capitalTransactions), db.select().from(dailyClosings).orderBy(desc(dailyClosings.closingDate)).limit(1),
  ]);
  const latestClose = closingRows[0];
  const activeSales = saleRows.filter(sale => !sale.isVoided);
  const now = new Date();
  const ledgerInventoryUnits = sum(inventoryRows.filter(row => row.transactionDate < nextDay(dayStart(now))).map(row => row.unitsDelta));
  const inventoryUnitsAtLatestClose = latestClose ? sum(inventoryRows.filter(row => row.transactionDate < nextDay(latestClose.closingDate)).map(row => row.unitsDelta)) : ledgerInventoryUnits;
  const newestRuleByOwner = new Map<number, typeof ruleRows[number]>();
  ruleRows.sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime()).forEach(rule => { if (!newestRuleByOwner.has(rule.ownerId)) newestRuleByOwner.set(rule.ownerId, rule); });
  const capitalContributedCentavos = sum(capitalRows.filter(row => row.status === "posted" && row.transactionType === "capital_contribution").map(row => row.amountCentavos));
  const capitalWithdrawnCentavos = sum(capitalRows.filter(row => row.status === "posted" && (row.transactionType === "capital_withdrawal" || row.transactionType === "profit_distribution")).map(row => row.amountCentavos));
  const displayedCapitalCentavos = capitalContributedCentavos - capitalWithdrawnCentavos;
  const metrics = calculateIntegrityMetrics({
    inventoryUnits: latestClose?.expectedEndingInventoryUnits ?? ledgerInventoryUnits,
    ledgerInventoryUnits: inventoryUnitsAtLatestClose,
    expectedRevenueCentavos: sum(activeSales.map(row => row.expectedRevenueCentavos)),
    collectedCashCentavos: sum(activeSales.map(row => row.cashCollectedCentavos)),
    ownershipBasisPoints: sum(Array.from(newestRuleByOwner.values()).map(row => row.shareBasisPoints)),
    capitalContributedCentavos, capitalWithdrawnCentavos, displayedCapitalCentavos,
  });
  const pendingCode = `CHECK-PENDING-${now.getTime()}`;
  const details = {
    policy: "Inventory and capital are compared against stored ledgers; cash variance is flagged for review rather than silently corrected.",
    latestClosingCode: latestClose?.recordCode ?? null,
    checkedSales: activeSales.length,
  };
  const inserted = await db.insert(integrityChecks).values({ recordCode: pendingCode, ...metrics, details: JSON.stringify(details), checkedBy: userId });
  const id = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
  const recordCode = makeRecordCode("integrity", now, id);
  await db.update(integrityChecks).set({ recordCode }).where(eq(integrityChecks.id, id));
  await recordAudit(userId, "checked", "integrity", recordCode, "Ran non-destructive integrity check.", undefined, { ...metrics, details });
  return { id, recordCode, ...metrics, details };
}

export async function getDataResilienceOverview(userId: number) {
  await ensureBusinessSetup(userId);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [backupRows, backupSettingRows, integrityRows, auditRows, saleCountRows, inventoryCountRows, capitalCountRows, expenseCountRows, closeCountRows] = await Promise.all([
    db.select().from(backupRecords).orderBy(desc(backupRecords.createdAt)).limit(20), db.select().from(backupSettings).limit(1),
    db.select().from(integrityChecks).orderBy(desc(integrityChecks.checkedAt)).limit(10), db.select().from(auditEvents).orderBy(desc(auditEvents.eventAt)).limit(20),
    db.select({ total: count() }).from(sales), db.select({ total: count() }).from(inventoryTransactions), db.select({ total: count() }).from(capitalTransactions), db.select({ total: count() }).from(expenses), db.select({ total: count() }).from(dailyClosings),
  ]);
  const lastSuccessful = backupRows.find(row => row.status === "successful" || row.status === "verified") ?? null;
  const latestManual = backupRows.find(row => row.backupType === "manual" && (row.status === "successful" || row.status === "verified")) ?? null;
  const totalTransactions = [saleCountRows, inventoryCountRows, capitalCountRows, expenseCountRows].reduce((total, rows) => total + Number(rows[0]?.total ?? 0), 0);
  return {
    lastSuccessfulBackupAt: backupSettingRows[0]?.lastSuccessfulBackupAt ?? lastSuccessful?.createdAt ?? null,
    backupStatus: lastSuccessful?.status ?? "not_created",
    latestExportAt: latestManual?.createdAt ?? null,
    records: backupRows,
    integrityChecks: integrityRows,
    auditEvents: auditRows,
    totalSales: Number(saleCountRows[0]?.total ?? 0),
    totalTransactions,
    tableCounts: { sales: Number(saleCountRows[0]?.total ?? 0), inventory: Number(inventoryCountRows[0]?.total ?? 0), capital: Number(capitalCountRows[0]?.total ?? 0), expenses: Number(expenseCountRows[0]?.total ?? 0), closings: Number(closeCountRows[0]?.total ?? 0) },
    retention: { daily: "30 days", weekly: "12 weeks", monthly: "12 months", manual: "12 months" },
    backupScheduleTaskUid: backupSettingRows[0]?.scheduleCronTaskUid ?? null,
  };
}

export async function getBackupDownloadRecord(backupId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [record] = await db.select().from(backupRecords).where(eq(backupRecords.id, backupId)).limit(1);
  if (!record || (record.status !== "successful" && record.status !== "verified") || !record.storageKey) return null;
  return record;
}

export async function previewBusinessBackup(backupId: number) {
  const record = await getBackupDownloadRecord(backupId);
  if (!record) throw new Error("A successful backup with that identifier was not found.");
  const signedUrl = await storageGetSignedUrl(record.storageKey!);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error(`Backup storage returned ${response.status}.`);
  const statedSize = Number(response.headers.get("content-length") ?? record.sizeBytes ?? 0);
  if (statedSize > 50 * 1024 * 1024) throw new Error("This backup is too large for an in-app preview. Download it for offline inspection.");
  const archive = new Uint8Array(await response.arrayBuffer());
  if (archive.byteLength > 50 * 1024 * 1024) throw new Error("This backup is too large for an in-app preview. Download it for offline inspection.");
  const inspection = inspectBackupArchive(archive, record.checksum);
  const currentDataset = await collectBusinessData();
  const currentCounts = Object.fromEntries(Object.entries(currentDataset).map(([table, rows]) => [table, rows.length]));
  return {
    backup: {
      id: record.id,
      recordCode: record.recordCode,
      backupType: record.backupType,
      createdAt: record.createdAt,
      sizeBytes: record.sizeBytes,
      recordCount: record.recordCount,
      retentionUntil: record.retentionUntil,
      status: record.status,
    },
    ...inspection,
    tables: inspection.tables.map(table => ({
      ...table,
      currentRows: Number(currentCounts[table.table] ?? 0),
      rowDifference: table.actualRows - Number(currentCounts[table.table] ?? 0),
    })),
    summary: {
      ...inspection.summary,
      currentRegistryRecords: Object.values(currentCounts).reduce((total, count) => total + Number(count), 0),
    },
    importPerformed: false as const,
  };
}


export async function saveBackupSchedule(userId: number, taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await ensureBusinessSetup(userId);
  const [settings] = await db.select().from(backupSettings).limit(1);
  if (!settings) {
    await db.insert(backupSettings).values({ scheduleCronTaskUid: taskUid, updatedBy: userId });
  } else {
    await db.update(backupSettings).set({ scheduleCronTaskUid: taskUid, updatedBy: userId }).where(eq(backupSettings.id, settings.id));
  }
  await recordAudit(userId, "scheduled", "backup", taskUid, "Configured daily automatic backups; weekly and monthly backups are produced by the same idempotent run.");
  return { taskUid };
}

export async function runScheduledBackupForTask(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [settings] = await db.select().from(backupSettings).where(eq(backupSettings.scheduleCronTaskUid, taskUid)).limit(1);
  if (!settings) return { ok: true, skipped: "orphaned_backup_schedule" as const };
  const backups = await runAutomaticBackupCycle();
  return { ok: true, backups };
}


export async function recordProfitDistribution(userId: number, input: { ownerId: number; amountPesos: number; date: string; notes?: string }) {
  await ensureBusinessSetup(userId);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [owner] = await db.select().from(owners).where(eq(owners.id, input.ownerId)).limit(1);
  if (!owner) throw new Error("Owner was not found.");
  const entries = await db.select().from(profitLedgerEntries).where(eq(profitLedgerEntries.ownerId, owner.id));
  const earnedCentavos = sum(entries.filter(entry => entry.entryType === "earned" || entry.entryType === "adjustment").map(entry => entry.amountCentavos));
  const distributedCentavos = sum(entries.filter(entry => entry.entryType === "distributed").map(entry => entry.amountCentavos));
  const amountCentavos = pesoToCentavos(input.amountPesos);
  const owedCentavos = earnedCentavos - distributedCentavos;
  if (amountCentavos <= 0) throw new Error("Profit distribution must be greater than zero.");
  if (amountCentavos > owedCentavos) throw new Error(`${owner.name} has only ₱${(owedCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })} profit owed.`);
  const distributionDate = dateAtNoonUtc(input.date);
  const [entry] = await writeProfitLedgerEntries({
    userId,
    entryDate: distributionDate,
    entryType: "distributed",
    allocations: [{ ownerId: owner.id, amountCentavos }],
    description: `Profit distribution to ${owner.name}`,
    notes: input.notes?.trim() || "Recorded separately from capital.",
  });
  await recordAudit(userId, "distributed", "owner_profit", entry.recordCode, "Recorded profit distribution without changing capital balance.", undefined, { ownerId: owner.id, ownerName: owner.name, amountCentavos, owedBeforeCentavos: owedCentavos, owedAfterCentavos: owedCentavos - amountCentavos });
  return { ...entry, ownerName: owner.name, profitOwedCentavos: owedCentavos - amountCentavos };
}

export async function getProfitLedgerData(userId: number) {
  await ensureBusinessSetup(userId);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [ownerRows, entryRows, capitalRows, ruleRows] = await Promise.all([
    db.select().from(owners).where(eq(owners.active, true)).orderBy(asc(owners.id)),
    db.select().from(profitLedgerEntries).orderBy(desc(profitLedgerEntries.entryDate), desc(profitLedgerEntries.id)),
    db.select().from(capitalTransactions).where(eq(capitalTransactions.status, "posted")).orderBy(desc(capitalTransactions.transactionDate)),
    db.select().from(ownershipRules).orderBy(desc(ownershipRules.effectiveFrom)),
  ]);
  const latestByOwner = new Map<number, typeof ruleRows[number]>();
  ruleRows.forEach(rule => { if (!latestByOwner.has(rule.ownerId)) latestByOwner.set(rule.ownerId, rule); });
  const ownerSummaries = ownerRows.map(owner => {
    const entries = entryRows.filter(entry => entry.ownerId === owner.id);
    const earnedCentavos = sum(entries.filter(entry => entry.entryType === "earned" || entry.entryType === "adjustment").map(entry => entry.amountCentavos));
    const distributedCentavos = sum(entries.filter(entry => entry.entryType === "distributed").map(entry => entry.amountCentavos));
    const ownerCapital = capitalRows.filter(entry => entry.ownerId === owner.id);
    const contributedCentavos = sum(ownerCapital.filter(entry => entry.transactionType === "capital_contribution").map(entry => entry.amountCentavos));
    const withdrawnCentavos = sum(ownerCapital.filter(entry => entry.transactionType === "capital_withdrawal").map(entry => entry.amountCentavos));
    return {
      ...owner,
      shareBasisPoints: latestByOwner.get(owner.id)?.shareBasisPoints ?? 0,
      profitEarnedCentavos: earnedCentavos,
      profitDistributedCentavos: distributedCentavos,
      profitOwedCentavos: earnedCentavos - distributedCentavos,
      capitalContributedCentavos: contributedCentavos,
      capitalWithdrawnCentavos: withdrawnCentavos,
      currentCapitalCentavos: contributedCentavos - withdrawnCentavos,
    };
  });
  return { ownerSummaries, entries: entryRows.slice(0, 100) };
}
