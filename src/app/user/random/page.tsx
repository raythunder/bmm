import { UserBookmarkController } from '@/controllers'
import { withAuthExpiredRedirect } from '@/lib/auth/redirect-on-auth-expired'
import { Metadata } from 'next/types'
import UserHomeBody from '../components/UserHomeBody'

export const metadata: Metadata = {
  title: '随便看看',
}

export default async function Page() {
  const res = await withAuthExpiredRedirect(() => UserBookmarkController.random())
  return <UserHomeBody bookmarks={res.list} />
}
