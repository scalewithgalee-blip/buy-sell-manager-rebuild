CREATE TABLE `separateInventoryTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordCode` varchar(64) NOT NULL,
	`transactionDate` timestamp NOT NULL,
	`separateInventoryTransactionType` enum('purchase','sale','adjustment','loss','cash_adjustment') NOT NULL,
	`unitsDelta` int NOT NULL DEFAULT 0,
	`costPerUnitCentavos` int NOT NULL DEFAULT 0,
	`sellingPriceCentavos` int NOT NULL DEFAULT 0,
	`revenueCentavos` int NOT NULL DEFAULT 0,
	`cashCollectedCentavos` int NOT NULL DEFAULT 0,
	`description` varchar(255) NOT NULL,
	`notes` text,
	`createdBy` int,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `separateInventoryTransactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `separateInventoryTransactions_recordCode_unique` UNIQUE(`recordCode`)
);
--> statement-breakpoint
CREATE INDEX `separate_inventory_date_idx` ON `separateInventoryTransactions` (`transactionDate`);--> statement-breakpoint
CREATE INDEX `separate_inventory_type_idx` ON `separateInventoryTransactions` (`separateInventoryTransactionType`);--> statement-breakpoint
CREATE INDEX `separate_inventory_created_at_idx` ON `separateInventoryTransactions` (`createdAt`);