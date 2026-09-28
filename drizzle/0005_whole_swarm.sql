CREATE TABLE `profitLedgerEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordCode` varchar(64) NOT NULL,
	`ownerId` int NOT NULL,
	`saleId` int,
	`periodId` int,
	`profitLedgerEntryType` enum('earned','distributed','adjustment') NOT NULL,
	`amountCentavos` int NOT NULL,
	`shareBasisPoints` int,
	`entryDate` timestamp NOT NULL,
	`description` varchar(255) NOT NULL,
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `profitLedgerEntries_id` PRIMARY KEY(`id`),
	CONSTRAINT `profitLedgerEntries_recordCode_unique` UNIQUE(`recordCode`)
);
--> statement-breakpoint
CREATE INDEX `profit_ledger_owner_date_idx` ON `profitLedgerEntries` (`ownerId`,`entryDate`);--> statement-breakpoint
CREATE INDEX `profit_ledger_sale_idx` ON `profitLedgerEntries` (`saleId`);--> statement-breakpoint
CREATE INDEX `profit_ledger_type_idx` ON `profitLedgerEntries` (`profitLedgerEntryType`);