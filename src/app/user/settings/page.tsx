import UserAiModelController from '@/controllers/UserAiModel.controller'
import { withAuthExpiredRedirect } from '@/lib/auth/redirect-on-auth-expired'
import ClientPage from './ClientPage'

export const metadata = {
  title: '模型设置',
}

export default async function Page() {
  const settings = await withAuthExpiredRedirect(() => UserAiModelController.get())
  return <ClientPage initialSettings={settings} />
}
