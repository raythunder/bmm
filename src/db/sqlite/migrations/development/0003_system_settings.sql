CREATE TABLE IF NOT EXISTS `appSettings` (
  `id` integer PRIMARY KEY NOT NULL,
  `allowRegister` integer NOT NULL DEFAULT true,
  `updatedAt` integer NOT NULL
);

INSERT OR IGNORE INTO `appSettings` (`id`, `allowRegister`, `updatedAt`)
VALUES (1, true, CAST(strftime('%s', 'now') AS integer) * 1000);
