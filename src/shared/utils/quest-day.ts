import type { QuestDayStatus } from '@/shared/contracts/api'

export function questDayStatusLabel(status: QuestDayStatus): string {
  switch (status) {
    case 'Running':
      return 'Идёт'
    case 'NotStarted':
      return 'Не начат'
    case 'DayClosed':
      return 'День закрыт'
    default:
      return status
  }
}
