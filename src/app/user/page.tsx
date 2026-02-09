import { UserBookmarkController } from '@/controllers'
import { withAuthExpiredRedirect } from '@/lib/auth/redirect-on-auth-expired'
import { PageRoutes } from '@cfg'
import { redirect } from 'next/navigation'
import UserHomeBody from './components/UserHomeBody'

export default async function Page() {
  const res = await withAuthExpiredRedirect(() => UserBookmarkController.findMany())
  if (!res.total) {
    redirect(PageRoutes.User.WELCOME)
  }

  return <UserHomeBody bookmarks={res.list} />
}
