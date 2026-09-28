import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/** Core user table backing Manus OAuth. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const owners = mysqlTable("owners", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const operators = mysqlTable("operators", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  supplier: varchar("supplier", { length: 160 }),
  costPerUnitCentavos: int("costPerUnitCentavos").notNull(),
  sellingPriceCentavos: int("sellingPriceCentavos").notNull(),
  unitsPerBox: int("unitsPerBox").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** One active settings record controls defaults for future records only. */
export const businessSettings = mysqlTable("businessSettings", {
  id: int("id").autoincrement().primaryKey(),
  businessName: varchar("businessName", { length: 160 }).notNull(),
  boxCostCentavos: int("boxCostCentavos").notNull(),
  unitsPerBox: int("unitsPerBox").notNull(),
  defaultCostPerUnitCentavos: int("defaultCostPerUnitCentavos").notNull(),
  defaultSellingPriceCentavos: int("defaultSellingPriceCentavos").notNull(),
  minimumInventoryUnits: int("minimumInventoryUnits").notNull(),
  weeklyUnitsTarget: int("weeklyUnitsTarget").default(100).notNull(),
  monthlyProfitTargetCentavos: int("monthlyProfitTargetCentavos").default(5_000_000).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Keeps each Monday-to-Sunday target unchanged when later settings are edited. */
export const weeklyTargetSnapshots = mysqlTable("weeklyTargetSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  weekStartDate: timestamp("weekStartDate").notNull().unique(),
  targetUnits: int("targetUnits").notNull(),
  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const businessPeriods = mysqlTable("businessPeriods", {
  id: int("id").autoincrement().primaryKey(),
  recordCode: varchar("recordCode", { length: 64 }).unique(),
  name: varchar("name", { length: 160 }).notNull().unique(),
  status: mysqlEnum("businessPeriodStatus", ["planned", "open", "closed"]).default("planned").notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  totalStartingBoxes: int("totalStartingBoxes").notNull(),
  totalStartingUnits: int("totalStartingUnits").notNull(),
  totalStartingCapitalCentavos: int("totalStartingCapitalCentavos").notNull(),
  notes: text("notes"),
  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("business_periods_start_idx").on(table.startDate), index("business_periods_status_idx").on(table.status)]);

export const periodOwnerTranches = mysqlTable("periodOwnerTranches", {
  id: int("id").autoincrement().primaryKey(),
  periodId: int("periodId").notNull(),
  ownerId: int("ownerId").notNull(),
  label: varchar("label", { length: 160 }).notNull(),
  trancheType: mysqlEnum("periodTrancheType", ["performance", "guarantee", "ongoing"]).notNull(),
  startingBoxes: int("startingBoxes").notNull(),
  startingUnits: int("startingUnits").notNull(),
  startingCapitalCentavos: int("startingCapitalCentavos").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("period_tranche_period_owner_idx").on(table.periodId, table.ownerId)]);

export const guaranteedReturns = mysqlTable("guaranteedReturns", {
  id: int("id").autoincrement().primaryKey(),
  recordCode: varchar("recordCode", { length: 64 }).unique(),
  periodId: int("periodId").notNull(),
  trancheId: int("trancheId").notNull(),
  ownerId: int("ownerId").notNull(),
  amountCentavos: int("amountCentavos").notNull(),
  status: mysqlEnum("guaranteedReturnStatus", ["pending", "earned", "paid", "cancelled"]).default("pending").notNull(),
  notes: text("notes"),
  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull().unique(),
  phone: varchar("phone", { length: 48 }),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const sales = mysqlTable(
  "sales",
  {
    id: int("id").autoincrement().primaryKey(),
    recordCode: varchar("recordCode", { length: 64 }).unique(),
    saleDate: timestamp("saleDate").notNull(),
    operatorId: int("operatorId").notNull(),
    productId: int("productId").notNull(),
    periodId: int("periodId"),
    periodTrancheId: int("periodTrancheId"),
    customerId: int("customerId"),
    unitsSold: int("unitsSold").notNull(),
    sellingPriceCentavos: int("sellingPriceCentavos").notNull(),
    costPerUnitCentavos: int("costPerUnitCentavos").notNull(),
    expectedRevenueCentavos: int("expectedRevenueCentavos").notNull(),
    cogsCentavos: int("cogsCentavos").notNull(),
    grossProfitCentavos: int("grossProfitCentavos").notNull(),
    cashCollectedCentavos: int("cashCollectedCentavos").notNull(),
    cashVarianceCentavos: int("cashVarianceCentavos").notNull(),
    paymentStatus: mysqlEnum("paymentStatus", ["paid", "partially_paid", "unpaid"]).notNull(),
    amountDueCentavos: int("amountDueCentavos").notNull(),
    amountCollectedCentavos: int("amountCollectedCentavos").notNull(),
    balanceCentavos: int("balanceCentavos").notNull(),
    dueDate: timestamp("dueDate"),
    notes: text("notes"),
    isVoided: boolean("isVoided").default(false).notNull(),
    voidedAt: timestamp("voidedAt"),
    createdBy: int("createdBy"),
    updatedBy: int("updatedBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("sales_sale_date_idx").on(table.saleDate),
    index("sales_customer_idx").on(table.customerId),
    index("sales_created_at_idx").on(table.createdAt),
    index("sales_period_idx").on(table.periodId),
    index("sales_payment_status_idx").on(table.paymentStatus),
    index("sales_operator_idx").on(table.operatorId),
  ]
);

export const profitAllocations = mysqlTable("profitAllocations", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull(),
  ownerId: int("ownerId").notNull(),
  shareBasisPoints: int("shareBasisPoints").notNull(),
  allocatedProfitCentavos: int("allocatedProfitCentavos").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("profit_allocations_sale_owner_idx").on(table.saleId, table.ownerId)]);

/** Separate owner-profit ledger. Earned entries come from sales; distributed entries are later settlements. */
export const profitLedgerEntries = mysqlTable("profitLedgerEntries", {
  id: int("id").autoincrement().primaryKey(),
  recordCode: varchar("recordCode", { length: 64 }).notNull().unique(),
  ownerId: int("ownerId").notNull(),
  saleId: int("saleId"),
  periodId: int("periodId"),
  entryType: mysqlEnum("profitLedgerEntryType", ["earned", "distributed", "adjustment"]).notNull(),
  amountCentavos: int("amountCentavos").notNull(),
  shareBasisPoints: int("shareBasisPoints"),
  entryDate: timestamp("entryDate").notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  notes: text("notes"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("profit_ledger_owner_date_idx").on(table.ownerId, table.entryDate),
  index("profit_ledger_sale_idx").on(table.saleId),
  index("profit_ledger_type_idx").on(table.entryType),
]);

export const ownershipRules = mysqlTable("ownershipRules", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  shareBasisPoints: int("shareBasisPoints").notNull(),
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("ownership_rules_owner_effective_idx").on(table.ownerId, table.effectiveFrom)]);

export const inventoryTransactions = mysqlTable(
  "inventoryTransactions",
  {
    id: int("id").autoincrement().primaryKey(),
    recordCode: varchar("recordCode", { length: 64 }).unique(),
    transactionDate: timestamp("transactionDate").notNull(),
    productId: int("productId").notNull(),
    transactionType: mysqlEnum("inventoryTransactionType", ["initial", "purchase", "sale", "loss", "adjustment", "reversal"]).notNull(),
    fundingSource: mysqlEnum("inventoryFundingSource", ["retained_cash", "new_capital", "other"]).default("retained_cash").notNull(),
    unitsDelta: int("unitsDelta").notNull(),
    costPerUnitCentavos: int("costPerUnitCentavos").notNull(),
    saleId: int("saleId"),
    description: varchar("description", { length: 255 }),
    notes: text("notes"),
    createdBy: int("createdBy"),
    updatedBy: int("updatedBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("inventory_product_date_idx").on(table.productId, table.transactionDate), index("inventory_created_at_idx").on(table.createdAt), index("inventory_sale_idx").on(table.saleId)]
);

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  recordCode: varchar("recordCode", { length: 64 }).unique(),
  saleId: int("saleId").notNull(),
  paymentDate: timestamp("paymentDate").notNull(),
  amountCentavos: int("amountCentavos").notNull(),
  note: text("note"),
  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("payments_sale_date_idx").on(table.saleId, table.paymentDate), index("payments_created_at_idx").on(table.createdAt)]);

export const capitalTransactions = mysqlTable(
  "capitalTransactions",
  {
    id: int("id").autoincrement().primaryKey(),
    recordCode: varchar("recordCode", { length: 64 }).unique(),
    transactionDate: timestamp("transactionDate").notNull(),
    ownerId: int("ownerId"),
    periodId: int("periodId"),
    periodTrancheId: int("periodTrancheId"),
    transactionType: mysqlEnum("capitalTransactionType", ["capital_contribution", "capital_withdrawal", "profit_distribution", "expense", "adjustment"]).notNull(),
    status: mysqlEnum("capitalTransactionStatus", ["pending", "posted", "voided"]).default("posted").notNull(),
    amountCentavos: int("amountCentavos").notNull(),
    description: varchar("description", { length: 255 }).notNull(),
    notes: text("notes"),
    createdBy: int("createdBy"),
    updatedBy: int("updatedBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("capital_owner_date_idx").on(table.ownerId, table.transactionDate), index("capital_created_at_idx").on(table.createdAt), index("capital_period_idx").on(table.periodId)]
);

export const expenses = mysqlTable(
  "expenses",
  {
    id: int("id").autoincrement().primaryKey(),
    recordCode: varchar("recordCode", { length: 64 }).unique(),
    expenseDate: timestamp("expenseDate").notNull(),
    category: mysqlEnum("expenseCategory", ["transportation", "delivery", "packaging", "communication", "operating", "other"]).notNull(),
    amountCentavos: int("amountCentavos").notNull(),
    paidBy: varchar("paidBy", { length: 160 }),
    description: varchar("description", { length: 255 }).notNull(),
    notes: text("notes"),
    createdBy: int("createdBy"),
    updatedBy: int("updatedBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("expenses_date_idx").on(table.expenseDate), index("expenses_created_at_idx").on(table.createdAt)]
);

export const dailyClosings = mysqlTable("dailyClosings", {
  id: int("id").autoincrement().primaryKey(),
  recordCode: varchar("recordCode", { length: 64 }).unique(),
  closingDate: timestamp("closingDate").notNull().unique(),
  beginningInventoryUnits: int("beginningInventoryUnits").notNull(),
  receivedUnits: int("receivedUnits").notNull(),
  soldUnits: int("soldUnits").notNull(),
  lossUnits: int("lossUnits").notNull(),
  expectedEndingInventoryUnits: int("expectedEndingInventoryUnits").notNull(),
  expectedRevenueCentavos: int("expectedRevenueCentavos").notNull(),
  cogsCentavos: int("cogsCentavos").default(0).notNull(),
  grossProfitCentavos: int("grossProfitCentavos").default(0).notNull(),
  expensesCentavos: int("expensesCentavos").default(0).notNull(),
  cashCollectedCentavos: int("cashCollectedCentavos").notNull(),
  creditOutstandingCentavos: int("creditOutstandingCentavos").notNull(),
  reconciliationGapCentavos: int("reconciliationGapCentavos").notNull(),
  inventoryValueCentavos: int("inventoryValueCentavos").default(0).notNull(),
  status: mysqlEnum("closingStatus", ["reconciled", "needs_review", "reopened"]).notNull(),
  notes: text("notes"),
  closedBy: int("closedBy"),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("daily_closings_date_idx").on(table.closingDate)]);

export const auditEvents = mysqlTable("auditEvents", {
  id: int("id").autoincrement().primaryKey(),
  eventAt: timestamp("eventAt").defaultNow().notNull(),
  userId: int("userId"),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 100 }).notNull(),
  entityId: varchar("entityId", { length: 100 }),
  previousValue: text("previousValue"),
  newValue: text("newValue"),
  details: text("details"),
}, table => [index("audit_event_time_idx").on(table.eventAt), index("audit_entity_idx").on(table.entityType, table.entityId), index("audit_user_idx").on(table.userId)]);

export const backupSettings = mysqlTable("backupSettings", {
  id: int("id").autoincrement().primaryKey(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }).unique(),
  lastSuccessfulBackupAt: timestamp("lastSuccessfulBackupAt"),
  updatedBy: int("updatedBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const backupRecords = mysqlTable("backupRecords", {
  id: int("id").autoincrement().primaryKey(),
  recordCode: varchar("recordCode", { length: 64 }).notNull().unique(),
  backupType: mysqlEnum("backupType", ["daily", "weekly", "monthly", "manual"]).notNull(),
  status: mysqlEnum("backupStatus", ["started", "successful", "failed", "verified"]).notNull(),
  storageKey: varchar("storageKey", { length: 500 }),
  downloadUrl: varchar("downloadUrl", { length: 600 }),
  checksum: varchar("checksum", { length: 128 }),
  sizeBytes: int("sizeBytes"),
  recordCount: int("recordCount"),
  retentionUntil: timestamp("retentionUntil"),
  errorMessage: text("errorMessage"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  verifiedAt: timestamp("verifiedAt"),
}, table => [index("backups_type_created_idx").on(table.backupType, table.createdAt), index("backups_status_idx").on(table.status)]);

export const integrityChecks = mysqlTable("integrityChecks", {
  id: int("id").autoincrement().primaryKey(),
  recordCode: varchar("recordCode", { length: 64 }).notNull().unique(),
  status: mysqlEnum("integrityStatus", ["passed", "warning", "failed"]).notNull(),
  inventoryVarianceUnits: int("inventoryVarianceUnits").notNull(),
  cashVarianceCentavos: int("cashVarianceCentavos").notNull(),
  ownershipVarianceBasisPoints: int("ownershipVarianceBasisPoints").notNull(),
  capitalVarianceCentavos: int("capitalVarianceCentavos").notNull(),
  details: text("details").notNull(),
  checkedBy: int("checkedBy"),
  checkedAt: timestamp("checkedAt").defaultNow().notNull(),
}, table => [index("integrity_checked_at_idx").on(table.checkedAt), index("integrity_status_idx").on(table.status)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
