#!/usr/bin/env zx

import fs from 'fs/promises'
import path from 'path'
import 'zx/globals'
import { declareLocalType, exitWithDbClose, loadEnv, testDbConnect } from './utils.mjs'

const dbFolderAlias = {
  postgresql: 'postgres',
  sqlite: 'sqlite',
}

function resolveMigrationDir() {
  const dbDriver = process.env.DB_DRIVER
  const folder = dbFolderAlias[dbDriver]
  if (!folder) return ''
  const envName = process.env.NODE_ENV || 'development'
  return path.resolve(`src/db/${folder}/migrations/${envName}`)
}

async function hasMigrationFiles() {
  const migrationDir = resolveMigrationDir()
  if (!migrationDir) return false
  try {
    const entries = await fs.readdir(migrationDir, { withFileTypes: true })
    return entries.some((entry) => entry.isFile() && entry.name.endsWith('.sql'))
  } catch {
    return false
  }
}

async function main() {
  await loadEnv()
  await declareLocalType()

  await spinner('数据库连接中...', async () => {
    if (!(await testDbConnect())) {
      echo(chalk.red('❌ 数据库连接失败'))
      process.exit(1)
    }
  })

  if (await hasMigrationFiles()) {
    echo(chalk.cyan('检测到迁移文件，执行 drizzle-kit migrate'))
    await $`pnpm drizzle-kit migrate`.pipe(process.stdout)
  } else {
    echo(chalk.yellow('未检测到迁移文件，回退执行 drizzle-kit push --strict --verbose'))
    await $`pnpm drizzle-kit push --strict --verbose`.pipe(process.stdout)
  }

  return exitWithDbClose()
}

main()
