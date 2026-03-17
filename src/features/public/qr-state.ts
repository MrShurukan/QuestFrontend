import type { QrResolutionState } from '@/shared/contracts/api'

export interface QrStateDescriptor {
  title: string
  tone: 'info' | 'warning' | 'danger' | 'success'
}

export function describeQrState(state: QrResolutionState): QrStateDescriptor {
  switch (state) {
    case 'resolved':
      return {
        title: 'Вопрос открыт',
        tone: 'success',
      }
    case 'requires_auth':
      return {
        title: 'Нужен вход участника',
        tone: 'warning',
      }
    case 'requires_team':
      return {
        title: 'Сначала нужна команда',
        tone: 'warning',
      }
    case 'not_started':
      return {
        title: 'Квест еще не начался',
        tone: 'info',
      }
    case 'day_closed':
      return {
        title: 'Игровой день завершен',
        tone: 'info',
      }
    case 'not_found':
      return {
        title: 'QR не найден',
        tone: 'danger',
      }
    case 'unavailable':
      return {
        title: 'QR сейчас недоступен',
        tone: 'danger',
      }
    default:
      return {
        title: 'Состояние QR неизвестно',
        tone: 'info',
      }
  }
}
