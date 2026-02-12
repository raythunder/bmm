CREATE TABLE IF NOT EXISTS `userAiBatchJobs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `userId` text NOT NULL,
  `status` text NOT NULL DEFAULT 'running',
  `targetTagName` text NOT NULL,
  `concurrency` integer NOT NULL DEFAULT 3,
  `totalCount` integer NOT NULL DEFAULT 0,
  `processedCount` integer NOT NULL DEFAULT 0,
  `successCount` integer NOT NULL DEFAULT 0,
  `failedCount` integer NOT NULL DEFAULT 0,
  `pauseRequested` integer NOT NULL DEFAULT false,
  `lastError` text,
  `startedAt` integer,
  `finishedAt` integer,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL,
  FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `userAiBatchJobs_userId_createdAt_idx`
  ON `userAiBatchJobs` (`userId`, `createdAt`);
