import { ShieldAlert, Users } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { isUnauthorized, useAdminSession, useParticipantSession } from '@/features/session/session-hooks'
import { AlertBox, LoadingScreen } from '@/shared/ui/ui'

export function RequireParticipant() {
  const location = useLocation()
  const session = useParticipantSession()

  if (session.isPending) {
    return <LoadingScreen label="Проверяю профиль участника..." />
  }

  if (session.error && !isUnauthorized(session.error)) {
    return <LoadingScreen label="Backend недоступен. Попробуйте обновить страницу." />
  }

  if (!session.data) {
    return <Navigate replace to={`/player/login?from=${encodeURIComponent(location.pathname)}`} />
  }

  return <Outlet />
}

export function RequireAdmin() {
  const location = useLocation()
  const session = useAdminSession()

  if (session.isPending) {
    return <LoadingScreen label="Проверяю сессию администратора..." />
  }

  if (session.error && !isUnauthorized(session.error)) {
    return <LoadingScreen label="Backend недоступен. Попробуйте обновить страницу." />
  }

  if (!session.data) {
    return <Navigate replace to={`/admin/login?from=${encodeURIComponent(location.pathname)}`} />
  }

  return <Outlet />
}

export function SessionRoleNotice() {
  const admin = useAdminSession()
  const participant = useParticipantSession()

  if (admin.data && participant.data) {
    return (
      <AlertBox
        tone="warning"
        title="Одновременно открыты админка и участник"
        description={
          <span className="inline-flex items-center gap-2">
            <Users className="h-4 w-4" />
            Backend отдаёт приоритет сессии администратора. Чтобы работать как участник, выйдите из админки или откройте отдельное окно / режим инкогнито.
          </span>
        }
      />
    )
  }

  if (admin.data) {
    return (
      <AlertBox
        tone="warning"
        title="Админ-cookie активна"
        description={
          <span className="inline-flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Backend предпочитает сессию администратора. Для входа как участник выйдите из админки или откройте отдельный профиль браузера.
          </span>
        }
      />
    )
  }

  const adminSessionFailed = Boolean(admin.error && !isUnauthorized(admin.error))
  const participantSessionFailed = Boolean(participant.error && !isUnauthorized(participant.error))

  if (adminSessionFailed || participantSessionFailed) {
    return (
      <AlertBox
        tone="danger"
        title="Не удалось проверить текущую сессию"
        description="Backend недоступен или вернул ошибку. Проверьте, что API запущен и Vite proxy смотрит на правильный адрес."
      />
    )
  }

  return null
}
