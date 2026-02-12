CREATE TABLE `account` (
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `providerAccountId`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `authenticator` (
	`credentialID` text NOT NULL,
	`userId` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`credentialPublicKey` text NOT NULL,
	`counter` integer NOT NULL,
	`credentialDeviceType` text NOT NULL,
	`credentialBackedUp` integer NOT NULL,
	`transports` text,
	PRIMARY KEY(`userId`, `credentialID`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authenticator_credentialID_unique` ON `authenticator` (`credentialID`);--> statement-breakpoint
CREATE TABLE `credential` (
	`userId` text PRIMARY KEY NOT NULL,
	`password` text NOT NULL,
	`salt` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`sessionToken` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`emailVerified` integer,
	`image` text,
	`role` text DEFAULT 'user',
	`createdAt` integer
);
--> statement-breakpoint
CREATE TABLE `verificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
--> statement-breakpoint
CREATE TABLE `publicBookmarkToTag` (
	`bId` integer NOT NULL,
	`tId` integer NOT NULL,
	PRIMARY KEY(`bId`, `tId`),
	FOREIGN KEY (`bId`) REFERENCES `publicBookmarks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tId`) REFERENCES `publicTags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `publicBookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`icon` text,
	`pinyin` text,
	`description` text,
	`isPinned` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `publicBookmarks_name_unique` ON `publicBookmarks` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `publicBookmarks_url_unique` ON `publicBookmarks` (`url`);--> statement-breakpoint
CREATE TABLE `publicTagToTag` (
	`a` integer NOT NULL,
	`b` integer NOT NULL,
	PRIMARY KEY(`a`, `b`),
	FOREIGN KEY (`a`) REFERENCES `publicTags`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`b`) REFERENCES `publicTags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `publicTags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`icon` text,
	`color` text,
	`pinyin` text,
	`isMain` integer,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `publicTags_name_unique` ON `publicTags` (`name`);--> statement-breakpoint
CREATE TABLE `userBookmarkToTag` (
	`bId` integer NOT NULL,
	`tId` integer NOT NULL,
	PRIMARY KEY(`bId`, `tId`),
	FOREIGN KEY (`bId`) REFERENCES `userBookmarks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tId`) REFERENCES `userTags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `userBookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`icon` text,
	`pinyin` text,
	`description` text,
	`isPinned` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `userBookmarks_url_userId_unique` ON `userBookmarks` (`url`,`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `userBookmarks_name_userId_unique` ON `userBookmarks` (`name`,`userId`);--> statement-breakpoint
CREATE TABLE `userTagToTag` (
	`a` integer NOT NULL,
	`b` integer NOT NULL,
	PRIMARY KEY(`a`, `b`),
	FOREIGN KEY (`a`) REFERENCES `userTags`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`b`) REFERENCES `userTags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `userTags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`icon` text,
	`color` text,
	`isMain` integer,
	`pinyin` text DEFAULT '',
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `userTags_name_userId_unique` ON `userTags` (`name`,`userId`);