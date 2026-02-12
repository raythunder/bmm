import SystemSettingsController from '@/controllers/SystemSettings.controller'
import UserAiModelController from '@/controllers/UserAiModel.controller'
import { auth } from '@/lib/auth'
import { withAuthExpiredRedirect } from '@/lib/auth/redirect-on-auth-expired'
import ClientPage from './ClientPage'

export const metadata = {
  title: '系统设置',
}

export default async function Page() {
  const [aiModelSettings, systemSettings, session] = await withAuthExpiredRedirect(async () => {
    return Promise.all([UserAiModelController.get(), SystemSettingsController.get(), auth()])
  })
  return (
    <ClientPage
      initialSettings={aiModelSettings}
      initialSystemSettings={systemSettings}
      isAdmin={!!session?.user?.isAdmin}
    />
  )
}
