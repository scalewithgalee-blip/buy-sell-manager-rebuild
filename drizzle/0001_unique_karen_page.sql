CREATE TABLE `auditEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventAt` timestamp NOT NULL DEFAULT (now()),
	`userId` int,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(100) NOT NULL,
	`entityId` varchar(100),
	`details` text,
	CONSTRAINT `auditEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `businessSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessName` varchar(160) NOT NULL,
	`boxCostCentavos` int NOT NULL,
	`unitsPerBox` int NOT NULL,
	`defaultCostPerUnitCentavos` int NOT NULL,
	`defaultSellingPriceCentavos` int NOT NULL,
	`minimumInventoryUnits` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `businessSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `capitalTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionDate` timestamp NOT NULL,
	`ownerId` int,
	`capitalTransactionType` enum('capital_contribution','capital_withdrawal','profit_distribution','expense','adjustment') NOT NULL,
	`capitalTransactionStatus` enum('pending','posted','voided') NOT NULL DEFAULT 'posted',
	`amountCentavos` int NOT NULL,
	`description` varchar(255) NOT NULL,
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `capitalTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`phone` varchar(48),
	`notes` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `dailyClosings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`closingDate` timestamp NOT NULL,
	`beginningInventoryUnits` int NOT NULL,
	`receivedUnits` int NOT NULL,
	`soldUnits` int NOT NULL,
	`lossUnits` int NOT NULL,
	`expectedEndingInventoryUnits` int NOT NULL,
	`expectedRevenueCentavos` int NOT NULL,
	`cashCollectedCentavos` int NOT NULL,
	`creditOutstandingCentavos` int NOT NULL,
	`reconciliationGapCentavos` int NOT NULL,
	`closingStatus` enum('reconciled','needs_review') NOT NULL,
	`notes` text,
	`closedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dailyClosings_id` PRIMARY KEY(`id`),
	CONSTRAINT `dailyClosings_closingDate_unique` UNIQUE(`closingDate`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`expenseDate` timestamp NOT NULL,
	`expenseCategory` enum('transportation','delivery','packaging','communication','operating','other') NOT NULL,
	`amountCentavos` int NOT NULL,
	`paidBy` varchar(160),
	`description` varchar(255) NOT NULL,
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionDate` timestamp NOT NULL,
	`productId` int NOT NULL,
	`inventoryTransactionType` enum('initial','purchase','sale','loss','adjustment','reversal') NOT NULL,
	`unitsDelta` int NOT NULL,
	`costPerUnitCentavos` int NOT NULL,
	`saleId` int,
	`description` varchar(255),
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operators` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operators_id` PRIMARY KEY(`id`),
	CONSTRAINT `operators_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `owners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `owners_id` PRIMARY KEY(`id`),
	CONSTRAINT `owners_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `ownershipRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`shareBasisPoints` int NOT NULL,
	`effectiveFrom` timestamp NOT NULL,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ownershipRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`paymentDate` timestamp NOT NULL,
	`amountCentavos` int NOT NULL,
	`note` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`supplier` varchar(160),
	`costPerUnitCentavos` int NOT NULL,
	`sellingPriceCentavos` int NOT NULL,
	`unitsPerBox` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `profitAllocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleId` int NOT NULL,
	`ownerId` int NOT NULL,
	`shareBasisPoints` int NOT NULL,
	`allocatedProfitCentavos` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `profitAllocations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleDate` timestamp NOT NULL,
	`operatorId` int NOT NULL,
	`productId` int NOT NULL,
	`customerId` int,
	`unitsSold` int NOT NULL,
	`sellingPriceCentavos` int NOT NULL,
	`costPerUnitCentavos` int NOT NULL,
	`expectedRevenueCentavos` int NOT NULL,
	`cogsCentavos` int NOT NULL,
	`grossProfitCentavos` int NOT NULL,
	`cashCollectedCentavos` int NOT NULL,
	`cashVarianceCentavos` int NOT NULL,
	`paymentStatus` enum('paid','partially_paid','unpaid') NOT NULL,
	`amountDueCentavos` int NOT NULL,
	`amountCollectedCentavos` int NOT NULL,
	`balanceCentavos` int NOT NULL,
	`dueDate` timestamp,
	`notes` text,
	`isVoided` boolean NOT NULL DEFAULT false,
	`voidedAt` timestamp,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `capital_owner_date_idx` ON `capitalTransactions` (`ownerId`,`transactionDate`);--> statement-breakpoint
CREATE INDEX `expenses_date_idx` ON `expenses` (`expenseDate`);--> statement-breakpoint
CREATE INDEX `inventory_product_date_idx` ON `inventoryTransactions` (`productId`,`transactionDate`);--> statement-breakpoint
CREATE INDEX `sales_saleDate_idx` ON `sales` (`saleDate`);--> statement-breakpoint
CREATE INDEX `sales_customer_idx` ON `sales` (`customerId`);