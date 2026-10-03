CREATE TABLE `cashReconciliations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordCode` varchar(64) NOT NULL,
	`reconciliationDate` timestamp NOT NULL,
	`amountCentavos` int NOT NULL,
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cashReconciliations_id` PRIMARY KEY(`id`),
	CONSTRAINT `cashReconciliations_recordCode_unique` UNIQUE(`recordCode`)
);
--> statement-breakpoint
CREATE INDEX `cash_reconciliations_date_idx` ON `cashReconciliations` (`reconciliationDate`);