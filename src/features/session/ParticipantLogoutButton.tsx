import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useParticipantLogout, useParticipantSession } from '@/features/session/session-hooks'
import { cn } from '@/shared/lib/cn'
import { Button, ConfirmDialog } from '@/shared/ui/ui'

export function ParticipantLogoutButton({ className }: { className?: string }) {
  const session = useParticipantSession()
  const logout = useParticipantLogout()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (!session.data) {
    return null
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" className={cn('gap-1.5', className)} onClick={() => setOpen(true)}>
        <LogOut className="h-4 w-4" />
        Выйти
      </Button>
      <ConfirmDialog
        open={open}
        onCancel={() => setOpen(false)}
        title="Выйти из аккаунта?"
        description="Вы уверены, что хотите выйти? Понадобится снова войти, чтобы продолжить игру."
        cancelLabel="Отмена"
        confirmLabel="Выйти"
        onConfirm={async () => {
          setOpen(false)
          try {
            await logout.mutateAsync()
            toast.success('Вы вышли')
            navigate('/', { replace: true })
          } catch {
            toast.error('Не удалось выйти')
          }
        }}
      />
    </>
  )
}
