ALTER TABLE "publicBookmarks" ADD COLUMN IF NOT EXISTS "isPublic" boolean DEFAULT true;
UPDATE "publicBookmarks" SET "isPublic" = true WHERE "isPublic" IS NULL;
ALTER TABLE "publicBookmarks" ALTER COLUMN "isPublic" SET NOT NULL;
