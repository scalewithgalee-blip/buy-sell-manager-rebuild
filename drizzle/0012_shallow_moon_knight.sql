CREATE TABLE `dailyReportSummaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`summaryDate` timestamp NOT NULL,
	`unitsSold` int NOT NULL DEFAULT 0,
	`revenueCentavos` int NOT NULL DEFAULT 0,
	`cogsCentavos` int NOT NULL DEFAULT 0,
	`grossProfitCentavos` int NOT NULL DEFAULT 0,
	`cashCollectedCentavos` int NOT NULL DEFAULT 0,
	`cashVarianceCentavos` int NOT NULL DEFAULT 0,
	`expensesCentavos` int NOT NULL DEFAULT 0,
	`inventoryUnitsDelta` int NOT NULL DEFAULT 0,
	`retainedCashPurchasesCentavos` int NOT NULL DEFAULT 0,
	`profitDistributedCentavos` int NOT NULL DEFAULT 0,
	`capitalContributionsCentavos` int NOT NULL DEFAULT 0,
	`capitalWithdrawalsCentavos` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dailyReportSummaries_id` PRIMARY KEY(`id`),
	CONSTRAINT `dailyReportSummaries_summaryDate_unique` UNIQUE(`summaryDate`)
);
--> statement-breakpoint
CREATE INDEX `daily_reports_date_idx` ON `dailyReportSummaries` (`summaryDate`);