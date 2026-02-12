import { faker } from '@faker-js/faker'
import { describe, expect, test } from 'vitest'
import CredentialsController from '../Credentials.controller'
import SystemSettingsController from '../SystemSettings.controller'

describe('G: Credentials Controller', () => {
  const email = faker.internet.email()
  const password = 'abc123456'

  test('create', async () => {
    await CredentialsController.create({ email, password })
  })

  test('verify', async () => {
    const user = await CredentialsController.verify({ email, password })
    console.log({ user })
  })
})

describe('G: 创建账户时的各种异常', { sequential: true }, () => {
  const email = faker.internet.email()
  const password = 'abc123456'

  test('用户名必须是邮箱', async () => {
    await expect(CredentialsController.create({ email: '123', password })).rejects.toThrowError()
  })

  test('密码至少为 6 个字符', async () => {
    await expect(
      CredentialsController.create({ email: email, password: '123' })
    ).rejects.toThrowError()
  })

  test('用户名已存在', async () => {
    await CredentialsController.create({ email: email, password })
    await expect(CredentialsController.create({ email: email, password })).rejects.toThrowError(
      '邮箱已被注册使用'
    )
    await CredentialsController.delete(email)
  })

  test('密码错误', async () => {
    await CredentialsController.create({ email: email, password })
    await expect(
      CredentialsController.verify({ email: email, password: 'abc123457' })
    ).rejects.toThrowError('邮箱或密码错误，请检查后重试')
    await CredentialsController.delete(email)
  })
})

describe('G: 系统注册开关', { sequential: true }, () => {
  const email = faker.internet.email()
  const password = 'abc123456'

  test('关闭注册后，创建账户会被拒绝', async () => {
    await SystemSettingsController.save({ allowRegister: false })
    try {
      await expect(CredentialsController.create({ email, password })).rejects.toThrowError(
        '当前站点已关闭注册'
      )
    } finally {
      await SystemSettingsController.save({ allowRegister: true })
    }
  })
})
