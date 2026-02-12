CREATE TYPE "public"."role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TYPE "public"."userAiBatchJobStatus" AS ENUM('running', 'pausing', 'paused', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "appSettings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"allowRegister" boolean DEFAULT true NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authenticator" (
	"credentialID" text NOT NULL,
	"userId" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"credentialPublicKey" text NOT NULL,
	"counter" integer NOT NULL,
	"credentialDeviceType" text NOT NULL,
	"credentialBackedUp" boolean NOT NULL,
	"transports" text,
	CONSTRAINT "authenticator_userId_credentialID_pk" PRIMARY KEY("userId","credentialID"),
	CONSTRAINT "authenticator_credentialID_unique" UNIQUE("credentialID")
);
--> statement-breakpoint
CREATE TABLE "credential" (
	"userId" text PRIMARY KEY NOT NULL,
	"password" text NOT NULL,
	"salt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text,
	"role" "role" DEFAULT 'user',
	"aiModelSettings" text,
	"createdAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "publicBookmarkToTag" (
	"bId" serial NOT NULL,
	"tId" serial NOT NULL,
	CONSTRAINT "publicBookmarkToTag_bId_tId_pk" PRIMARY KEY("bId","tId")
);
--> statement-breakpoint
CREATE TABLE "publicBookmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"url" varchar(1000) NOT NULL,
	"icon" varchar(1000),
	"pinyin" varchar(100),
	"description" varchar(200),
	"isPinned" boolean,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "publicBookmarks_name_unique" UNIQUE("name"),
	CONSTRAINT "publicBookmarks_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "publicTagToTag" (
	"a" serial NOT NULL,
	"b" serial NOT NULL,
	CONSTRAINT "publicTagToTag_a_b_pk" PRIMARY KEY("a","b")
);
--> statement-breakpoint
CREATE TABLE "publicTags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(20) NOT NULL,
	"icon" varchar(100),
	"color" varchar(100),
	"pinyin" varchar(100),
	"isMain" boolean,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "publicTags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "userAiBatchJobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" varchar NOT NULL,
	"status" "userAiBatchJobStatus" DEFAULT 'running' NOT NULL,
	"targetTagName" varchar(20) NOT NULL,
	"concurrency" integer DEFAULT 3 NOT NULL,
	"totalCount" integer DEFAULT 0 NOT NULL,
	"processedCount" integer DEFAULT 0 NOT NULL,
	"successCount" integer DEFAULT 0 NOT NULL,
	"failedCount" integer DEFAULT 0 NOT NULL,
	"pauseRequested" boolean DEFAULT false NOT NULL,
	"lastError" varchar(500),
	"startedAt" timestamp,
	"finishedAt" timestamp,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userBookmarkToTag" (
	"bId" integer NOT NULL,
	"tId" integer NOT NULL,
	CONSTRAINT "userBookmarkToTag_bId_tId_pk" PRIMARY KEY("bId","tId")
);
--> statement-breakpoint
CREATE TABLE "userBookmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"url" varchar(1000) NOT NULL,
	"icon" varchar(1000),
	"pinyin" varchar(100),
	"description" varchar(200),
	"isPinned" boolean,
	"aiHtmlFetchFailed" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"userId" varchar NOT NULL,
	CONSTRAINT "userBookmarks_name_userId_unique" UNIQUE("name","userId"),
	CONSTRAINT "userBookmarks_userId_url_unique" UNIQUE("userId","url")
);
--> statement-breakpoint
CREATE TABLE "userTagToTag" (
	"a" serial NOT NULL,
	"b" serial NOT NULL,
	CONSTRAINT "userTagToTag_a_b_pk" PRIMARY KEY("a","b")
);
--> statement-breakpoint
CREATE TABLE "userTags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(20) NOT NULL,
	"icon" varchar(200),
	"color" varchar(200),
	"pinyin" varchar(200),
	"isMain" boolean,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"userId" varchar NOT NULL,
	CONSTRAINT "userTags_name_userId_unique" UNIQUE("name","userId")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authenticator" ADD CONSTRAINT "authenticator_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential" ADD CONSTRAINT "credential_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicBookmarkToTag" ADD CONSTRAINT "publicBookmarkToTag_bId_publicBookmarks_id_fk" FOREIGN KEY ("bId") REFERENCES "public"."publicBookmarks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicBookmarkToTag" ADD CONSTRAINT "publicBookmarkToTag_tId_publicTags_id_fk" FOREIGN KEY ("tId") REFERENCES "public"."publicTags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicTagToTag" ADD CONSTRAINT "publicTagToTag_a_publicTags_id_fk" FOREIGN KEY ("a") REFERENCES "public"."publicTags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicTagToTag" ADD CONSTRAINT "publicTagToTag_b_publicTags_id_fk" FOREIGN KEY ("b") REFERENCES "public"."publicTags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userAiBatchJobs" ADD CONSTRAINT "userAiBatchJobs_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userBookmarkToTag" ADD CONSTRAINT "userBookmarkToTag_bId_userBookmarks_id_fk" FOREIGN KEY ("bId") REFERENCES "public"."userBookmarks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userBookmarkToTag" ADD CONSTRAINT "userBookmarkToTag_tId_userTags_id_fk" FOREIGN KEY ("tId") REFERENCES "public"."userTags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userBookmarks" ADD CONSTRAINT "userBookmarks_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userTagToTag" ADD CONSTRAINT "userTagToTag_a_userTags_id_fk" FOREIGN KEY ("a") REFERENCES "public"."userTags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userTagToTag" ADD CONSTRAINT "userTagToTag_b_userTags_id_fk" FOREIGN KEY ("b") REFERENCES "public"."userTags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userTags" ADD CONSTRAINT "userTags_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;