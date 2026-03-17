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

  if (admin.data) {
    return (
      <AlertBox
        tone="warning"
        title="Админ-cookie активна"
        description={
          <span className="inline-flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Backend предпочитает admin session. Для player flow лучше выйти из admin или открыть отдельный browser profile.
          </span>
        }
      />
    )
  }

  if (participant.data) {
    return (
      <AlertBox
        tone="info"
        title="Участник уже авторизован"
        description={
          <span className="inline-flex items-center gap-2">
            <Users className="h-4 w-4" />
            Для параллельной работы с админкой используйте logout или отдельное incognito окно.
          </span>
        }
      />
    )
  }

  if ((admin.error && !isUnauthorized(admin.error)) || (participant.error && !isUnauthorized(participant.error))) {
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
