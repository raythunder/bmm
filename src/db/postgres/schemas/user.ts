import { FieldConstraints } from '@cfg'
import { relations } from 'drizzle-orm'
import {
  alias,
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'
import { users } from './auth'

/**
 * 用户标签表
 */
export const userTags = pgTable(
  'userTags',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: FieldConstraints.MaxLen.TAG_NAME }).notNull(),
    icon: varchar('icon', { length: FieldConstraints.MaxLen.BOOKMARK_DESC }),
    color: varchar('color', { length: FieldConstraints.MaxLen.BOOKMARK_DESC }),
    pinyin: varchar('pinyin', { length: FieldConstraints.MaxLen.BOOKMARK_DESC }),
    isMain: boolean('isMain'),
    sortOrder: integer('sortOrder').notNull().default(0),
    createdAt: timestamp('createdAt', { mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updatedAt', { mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    userId: varchar('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [unique().on(table.name, table.userId)]
)

/**
 * 标签之间的关系表
 * Tag : Tag = M : N
 */
export const userTagToTag = pgTable(
  'userTagToTag',
  {
    a: serial('a')
      .notNull()
      .references(() => userTags.id, { onDelete: 'cascade' }),
    b: serial('b')
      .notNull()
      .references(() => userTags.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.a, table.b] })]
)

/**
 * 用户书签表
 */
export const userBookmarks = pgTable(
  'userBookmarks',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: FieldConstraints.MaxLen.BOOKMARK_NAME }).notNull(),
    url: varchar('url', { length: FieldConstraints.MaxLen.URL }).notNull(),
    icon: varchar('icon', { length: FieldConstraints.MaxLen.URL }),
    pinyin: varchar('pinyin', { length: FieldConstraints.MaxLen.DEFAULT }),
    description: varchar('description', { length: FieldConstraints.MaxLen.BOOKMARK_DESC }),
    isPinned: boolean('isPinned'),
    createdAt: timestamp('createdAt', { mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp('updatedAt', { mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date()),
    userId: varchar('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [unique().on(table.name, table.userId), unique().on(table.userId, table.url)]
)

/**
 * 书签与标签的关系表
 * Bookmark : Tag = M : N
 */
export const userBookmarkToTag = pgTable(
  'userBookmarkToTag',
  {
    bId: integer('bId')
      .notNull()
      .references(() => userBookmarks.id, { onDelete: 'cascade' }),
    tId: integer('tId')
      .notNull()
      .references(() => userTags.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.bId, table.tId] })]
)

export const userAiBatchJobStatusEnum = pgEnum('userAiBatchJobStatus', [
  'running',
  'pausing',
  'paused',
  'completed',
  'failed',
])

export const userAiBatchJobs = pgTable('userAiBatchJobs', {
  id: serial('id').primaryKey(),
  userId: varchar('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: userAiBatchJobStatusEnum('status').notNull().default('running'),
  targetTagName: varchar('targetTagName', { length: FieldConstraints.MaxLen.TAG_NAME }).notNull(),
  concurrency: integer('concurrency').notNull().default(3),
  totalCount: integer('totalCount').notNull().default(0),
  processedCount: integer('processedCount').notNull().default(0),
  successCount: integer('successCount').notNull().default(0),
  failedCount: integer('failedCount').notNull().default(0),
  pauseRequested: boolean('pauseRequested').notNull().default(false),
  lastError: varchar('lastError', { length: 500 }),
  startedAt: timestamp('startedAt', { mode: 'date' }),
  finishedAt: timestamp('finishedAt', { mode: 'date' }),
  createdAt: timestamp('createdAt', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updatedAt', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
})

// relations() 不会创建数据表，只是用于类型推断

export const userTagRelations = relations(userTags, (ctx) => ({
  relatedTagIds: ctx.many(userTagToTag),
  relatedBookmarkIds: ctx.many(userBookmarkToTag),
}))

export const userTagToTagRelations = relations(userTagToTag, (ctx) => {
  const aliasPublicTags = alias(userTags, 'aliasPublicTags')
  return {
    tagA: ctx.one(userTags, {
      fields: [userTagToTag.a],
      references: [userTags.id],
    }),
    tagB: ctx.one(aliasPublicTags, {
      fields: [userTagToTag.b],
      references: [aliasPublicTags.id],
    }),
  }
})

export const userBookmarkRelations = relations(userBookmarks, (ctx) => ({
  relatedTagIds: ctx.many(userBookmarkToTag),
}))

export const userBookmarkToTagRelations = relations(userBookmarkToTag, (ctx) => ({
  bookmark: ctx.one(userBookmarks, {
    fields: [userBookmarkToTag.bId],
    references: [userBookmarks.id],
  }),
  tag: ctx.one(userTags, {
    fields: [userBookmarkToTag.tId],
    references: [userTags.id],
  }),
}))

export const userAiBatchJobRelations = relations(userAiBatchJobs, (ctx) => ({
  user: ctx.one(users, {
    fields: [userAiBatchJobs.userId],
    references: [users.id],
  }),
}))
