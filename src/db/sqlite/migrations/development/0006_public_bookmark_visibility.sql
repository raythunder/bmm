ALTER TABLE `publicBookmarks` ADD `isPublic` integer DEFAULT 1;
UPDATE `publicBookmarks` SET `isPublic` = 1 WHERE `isPublic` IS NULL;
