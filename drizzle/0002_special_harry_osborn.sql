CREATE TABLE `businessPeriods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`businessPeriodStatus` enum('planned','open','closed') NOT NULL DEFAULT 'planned',
	`startDate` timestamp NOT NULL,
	`endDate` timestamp,
	`totalStartingBoxes` int NOT NULL,
	`totalStartingUnits` int NOT NULL,
	`totalStartingCapitalCentavos` int NOT NULL,
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `businessPeriods_id` PRIMARY KEY(`id`),
	CONSTRAINT `businessPeriods_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `guaranteedReturns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodId` int NOT NULL,
	`trancheId` int NOT NULL,
	`ownerId` int NOT NULL,
	`amountCentavos` int NOT NULL,
	`guaranteedReturnStatus` enum('pending','earned','paid','cancelled') NOT NULL DEFAULT 'pending',
	`notes` text,
	`createdBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `guaranteedReturns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `periodOwnerTranches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodId` int NOT NULL,
	`ownerId` int NOT NULL,
	`label` varchar(160) NOT NULL,
	`periodTrancheType` enum('performance','guarantee','ongoing') NOT NULL,
	`startingBoxes` int NOT NULL,
	`startingUnits` int NOT NULL,
	`startingCapitalCentavos` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `periodOwnerTranches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `capitalTransactions` ADD `periodId` int;--> statement-breakpoint
ALTER TABLE `capitalTransactions` ADD `periodTrancheId` int;--> statement-breakpoint
ALTER TABLE `sales` ADD `periodId` int;--> statement-breakpoint
ALTER TABLE `sales` ADD `periodTrancheId` int;