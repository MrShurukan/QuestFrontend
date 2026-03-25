import { CircleHelp } from 'lucide-react'
import { useState } from 'react'

import { Button, Modal } from '@/shared/ui/ui'

export type PlayerHelpStage = 'team' | 'questions' | 'enigma' | 'profile'

const copy: Record<PlayerHelpStage, { modalTitle: string; body: string }> = {
  team: {
    modalTitle: 'Этап: команда',
    body: 'Здесь вы создаёте новую команду или вступаете в существующую по секретному слову. Без команды вопросы по QR и прогресс квеста недоступны. Секрет знает капитан: им делятся только своими. Состав команды — общий: ответы и награды Enigma идут на всю команду.',
  },
  questions: {
    modalTitle: 'Этап: открытые вопросы',
    body: 'Сюда попадают вопросы после сканирования QR на локации. Откройте карточку, прочитайте условие и отправьте ответ. После неверного ответа на вопрос действует кулдаун — время до следующей попытки видно на карточке и в форме. Правильный ответ засчитывается команде и может открыть награду для роторов Enigma.',
  },
  enigma: {
    modalTitle: 'Этап: Enigma',
    body: 'Роторы с соответствующими тегами разблокируются, когда команда решит вопрос этого тега. Крутите диски в нужную комбинацию и отправляйте попытку. Позиции сохраняются на сервере. Между попытками — кулдаун; после успеха механика завершается для команды.',
  },
  profile: {
    modalTitle: 'Этап: профиль',
    body: 'Здесь отображаются ваши данные участника. Выход из аккаунта завершает сессию в браузере; для игры снова войдите. Смена команды обычно не делается из профиля — уточните у организаторов при необходимости.',
  },
}

export function PlayerStageHelp({ stage }: { stage: PlayerHelpStage }) {
  const [open, setOpen] = useState(false)
  const { modalTitle, body } = copy[stage]

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 w-9 shrink-0 rounded-xl p-0"
        aria-label="Справка по этому экрану"
        title="Справка по этому экрану"
        onClick={() => setOpen(true)}
      >
        <CircleHelp className="h-4 w-4" />
      </Button>
      <Modal open={open} title={modalTitle} onClose={() => setOpen(false)} className="max-w-md">
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </Modal>
    </>
  )
}
