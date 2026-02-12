import { db, schema } from '@/db'
import {
  createDefaultSystemSettings,
  normalizeSystemSettings,
  systemSettingsSchema,
} from '@/lib/system-settings'
import { eq } from 'drizzle-orm'

const SYSTEM_SETTINGS_ROW_ID = 1

function isAppSettingsTableMissingError(error: unknown) {
  if (!(error instanceof Error)) return false

  let current: unknown = error
  while (current instanceof Error) {
    const message = current.message
    if (
      message.includes('appSettings') &&
      (message.includes('no such table') || message.includes('does not exist'))
    ) {
      return true
    }
    current = (current as { cause?: unknown }).cause
  }
  return false
}

async function ensureAppSettingsTable() {
  const client = db.$client as any
  const runRawSql = async (statement: string) => {
    if (typeof client.execute === 'function') {
      await client.execute(statement)
      return
    }
    if (typeof client.unsafe === 'function') {
      await client.unsafe(statement)
      return
    }
    throw new Error('当前数据库驱动不支持执行原始 SQL')
  }

  if (process.env.DB_DRIVER === 'postgresql') {
    await runRawSql(`
      CREATE TABLE IF NOT EXISTS "appSettings" (
        "id" integer PRIMARY KEY DEFAULT 1,
        "allowRegister" boolean NOT NULL DEFAULT true,
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `)
    return
  }

  await runRawSql(`
    CREATE TABLE IF NOT EXISTS "appSettings" (
      "id" integer PRIMARY KEY NOT NULL,
      "allowRegister" integer NOT NULL DEFAULT 1,
      "updatedAt" integer NOT NULL
    )
  `)
}

async function upsertSystemSettings(allowRegister: boolean) {
  const now = new Date()
  const [row] = await db
    .insert(schema.appSettings)
    .values({
      id: SYSTEM_SETTINGS_ROW_ID,
      allowRegister,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.appSettings.id,
      set: {
        allowRegister,
        updatedAt: now,
      },
    })
    .returning()

  return normalizeSystemSettings(row || { allowRegister })
}

const SystemSettingsController = {
  async get() {
    try {
      const row = await db.query.appSettings.findFirst({
        where: eq(schema.appSettings.id, SYSTEM_SETTINGS_ROW_ID),
      })
      return normalizeSystemSettings(row)
    } catch (error) {
      if (isAppSettingsTableMissingError(error)) {
        return createDefaultSystemSettings()
      }
      throw error
    }
  },
  async save(input: unknown) {
    const settings = systemSettingsSchema.parse(input)
    try {
      return await upsertSystemSettings(settings.allowRegister)
    } catch (error) {
      if (!isAppSettingsTableMissingError(error)) throw error
      await ensureAppSettingsTable()
      return upsertSystemSettings(settings.allowRegister)
    }
  },
}

export default SystemSettingsController
