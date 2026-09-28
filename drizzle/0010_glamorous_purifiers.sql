CREATE TABLE `weeklyTargetSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`weekStartDate` timestamp NOT NULL,
	`targetUnits` int NOT NULL,
	`createdBy` int,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weeklyTargetSnapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `weeklyTargetSnapshots_weekStartDate_unique` UNIQUE(`weekStartDate`)
);
