CREATE TABLE `backupRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordCode` varchar(64) NOT NULL,
	`backupType` enum('daily','weekly','monthly','manual') NOT NULL,
	`backupStatus` enum('started','successful','failed','verified') NOT NULL,
	`storageKey` varchar(500),
	`downloadUrl` varchar(600),
	`checksum` varchar(128),
	`sizeBytes` int,
	`recordCount` int,
	`retentionUntil` timestamp,
	`errorMessage` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`verifiedAt` timestamp,
	CONSTRAINT `backupRecords_id` PRIMARY KEY(`id`),
	CONSTRAINT `backupRecords_recordCode_unique` UNIQUE(`recordCode`)
);
--> statement-breakpoint
CREATE TABLE `backupSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`lastSuccessfulBackupAt` timestamp,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `backupSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `backupSettings_scheduleCronTaskUid_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
CREATE TABLE `integrityChecks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordCode` varchar(64) NOT NULL,
	`integrityStatus` enum('passed','warning','failed') NOT NULL,
	`inventoryVarianceUnits` int NOT NULL,
	`cashVarianceCentavos` int NOT NULL,
	`ownershipVarianceBasisPoints` int NOT NULL,
	`capitalVarianceCentavos` int NOT NULL,
	`details` text NOT NULL,
	`checkedBy` int,
	`checkedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integrityChecks_id` PRIMARY KEY(`id`),
	CONSTRAINT `integrityChecks_recordCode_unique` UNIQUE(`recordCode`)
);
--> statement-breakpoint
DROP INDEX `sales_saleDate_idx` ON `sales`;--> statement-breakpoint
ALTER TABLE `auditEvents` ADD `previousValue` text;--> statement-breakpoint
ALTER TABLE `auditEvents` ADD `newValue` text;--> statement-breakpoint
ALTER TABLE `businessPeriods` ADD `recordCode` varchar(64);--> statement-breakpoint
ALTER TABLE `businessPeriods` ADD `updatedBy` int;--> statement-breakpoint
ALTER TABLE `businessPeriods` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `businessSettings` ADD `scheduleCronTaskUid` varchar(65);--> statement-breakpoint
ALTER TABLE `capitalTransactions` ADD `recordCode` varchar(64);--> statement-breakpoint
ALTER TABLE `capitalTransactions` ADD `updatedBy` int;--> statement-breakpoint
ALTER TABLE `capitalTransactions` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `dailyClosings` ADD `recordCode` varchar(64);--> statement-breakpoint
ALTER TABLE `dailyClosings` ADD `updatedBy` int;--> statement-breakpoint
ALTER TABLE `dailyClosings` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `expenses` ADD `recordCode` varchar(64);--> statement-breakpoint
ALTER TABLE `expenses` ADD `updatedBy` int;--> statement-breakpoint
ALTER TABLE `expenses` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `guaranteedReturns` ADD `recordCode` varchar(64);--> statement-breakpoint
ALTER TABLE `guaranteedReturns` ADD `updatedBy` int;--> statement-breakpoint
ALTER TABLE `guaranteedReturns` ADD `createdAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD `recordCode` varchar(64);--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD `updatedBy` int;--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `payments` ADD `recordCode` varchar(64);--> statement-breakpoint
ALTER TABLE `payments` ADD `updatedBy` int;--> statement-breakpoint
ALTER TABLE `payments` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `sales` ADD `recordCode` varchar(64);--> statement-breakpoint
ALTER TABLE `sales` ADD `updatedBy` int;--> statement-breakpoint
ALTER TABLE `sales` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `businessPeriods` ADD CONSTRAINT `businessPeriods_recordCode_unique` UNIQUE(`recordCode`);--> statement-breakpoint
ALTER TABLE `capitalTransactions` ADD CONSTRAINT `capitalTransactions_recordCode_unique` UNIQUE(`recordCode`);--> statement-breakpoint
ALTER TABLE `dailyClosings` ADD CONSTRAINT `dailyClosings_recordCode_unique` UNIQUE(`recordCode`);--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_recordCode_unique` UNIQUE(`recordCode`);--> statement-breakpoint
ALTER TABLE `guaranteedReturns` ADD CONSTRAINT `guaranteedReturns_recordCode_unique` UNIQUE(`recordCode`);--> statement-breakpoint
ALTER TABLE `inventoryTransactions` ADD CONSTRAINT `inventoryTransactions_recordCode_unique` UNIQUE(`recordCode`);--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_recordCode_unique` UNIQUE(`recordCode`);--> statement-breakpoint
ALTER TABLE `sales` ADD CONSTRAINT `sales_recordCode_unique` UNIQUE(`recordCode`);--> statement-breakpoint
CREATE INDEX `backups_type_created_idx` ON `backupRecords` (`backupType`,`createdAt`);--> statement-breakpoint
CREATE INDEX `backups_status_idx` ON `backupRecords` (`backupStatus`);--> statement-breakpoint
CREATE INDEX `integrity_checked_at_idx` ON `integrityChecks` (`checkedAt`);--> statement-breakpoint
CREATE INDEX `integrity_status_idx` ON `integrityChecks` (`integrityStatus`);--> statement-breakpoint
CREATE INDEX `audit_event_time_idx` ON `auditEvents` (`eventAt`);--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `auditEvents` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `audit_user_idx` ON `auditEvents` (`userId`);--> statement-breakpoint
CREATE INDEX `business_periods_start_idx` ON `businessPeriods` (`startDate`);--> statement-breakpoint
CREATE INDEX `business_periods_status_idx` ON `businessPeriods` (`businessPeriodStatus`);--> statement-breakpoint
CREATE INDEX `capital_created_at_idx` ON `capitalTransactions` (`createdAt`);--> statement-breakpoint
CREATE INDEX `capital_period_idx` ON `capitalTransactions` (`periodId`);--> statement-breakpoint
CREATE INDEX `daily_closings_date_idx` ON `dailyClosings` (`closingDate`);--> statement-breakpoint
CREATE INDEX `expenses_created_at_idx` ON `expenses` (`createdAt`);--> statement-breakpoint
CREATE INDEX `inventory_created_at_idx` ON `inventoryTransactions` (`createdAt`);--> statement-breakpoint
CREATE INDEX `inventory_sale_idx` ON `inventoryTransactions` (`saleId`);--> statement-breakpoint
CREATE INDEX `ownership_rules_owner_effective_idx` ON `ownershipRules` (`ownerId`,`effectiveFrom`);--> statement-breakpoint
CREATE INDEX `payments_sale_date_idx` ON `payments` (`saleId`,`paymentDate`);--> statement-breakpoint
CREATE INDEX `payments_created_at_idx` ON `payments` (`createdAt`);--> statement-breakpoint
CREATE INDEX `period_tranche_period_owner_idx` ON `periodOwnerTranches` (`periodId`,`ownerId`);--> statement-breakpoint
CREATE INDEX `profit_allocations_sale_owner_idx` ON `profitAllocations` (`saleId`,`ownerId`);--> statement-breakpoint
CREATE INDEX `sales_sale_date_idx` ON `sales` (`saleDate`);--> statement-breakpoint
CREATE INDEX `sales_created_at_idx` ON `sales` (`createdAt`);--> statement-breakpoint
CREATE INDEX `sales_period_idx` ON `sales` (`periodId`);--> statement-breakpoint
CREATE INDEX `sales_payment_status_idx` ON `sales` (`paymentStatus`);--> statement-breakpoint
CREATE INDEX `sales_operator_idx` ON `sales` (`operatorId`);