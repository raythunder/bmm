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

async function runNonInteractivePush() {
  // drizzle-kit 在某些变更下会弹交互确认（例如新增 unique 约束到非空表）。
  // 生产容器里没有人工输入，这里通过持续回车来选择默认项，避免启动卡死。
  // 注意：默认选项通常是安全项（不截断/不破坏），若因此导致变更被中止，会在下方显式报错退出。
  const result = await $`sh -lc "yes '' | pnpm drizzle-kit push --verbose"`.nothrow()
  if (result.stdout) echo(result.stdout)
  if (result.stderr) echo(result.stderr)

  if (result.stdout?.includes('All changes were aborted')) {
    throw new Error(
      '数据库变更被安全策略中止（未执行破坏性变更）。请先手动处理对应数据后重启应用。'
    )
  }
  if (result.exitCode !== 0) {
    throw new Error(`drizzle-kit push 执行失败，退出码: ${result.exitCode}`)
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
    echo(chalk.yellow('未检测到迁移文件，回退执行 drizzle-kit push（非交互模式）'))
    await runNonInteractivePush()
  }

  return exitWithDbClose()
}

main()
