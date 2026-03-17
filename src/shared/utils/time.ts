import { format } from 'date-fns'

export function toTime(value?: string | null) {
  return value ? new Date(value).getTime() : null
}

export function clampAtZero(value: number) {
  return value > 0 ? value : 0
}

export function getRemainingMs(
  targetIso?: string | null,
  serverTimeIso?: string | null,
  nowMs = Date.now(),
  receivedAtMs = nowMs,
) {
  const target = toTime(targetIso)
  const serverTime = toTime(serverTimeIso)

  if (target === null) {
    return 0
  }

  if (serverTime === null) {
    return clampAtZero(target - nowMs)
  }

  const initialRemaining = target - serverTime
  const elapsedSinceReceive = nowMs - receivedAtMs

  return clampAtZero(initialRemaining - elapsedSinceReceive)
}

export function formatRemainingMs(value: number) {
  const totalSeconds = Math.ceil(clampAtZero(value) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
  }

  return `${seconds}s`
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return 'n/a'
  }

  return format(new Date(value), 'dd.MM.yyyy HH:mm:ss')
}

export function formatShortDateTime(value?: string | null) {
  if (!value) {
    return 'n/a'
  }

  return format(new Date(value), 'dd.MM HH:mm')
}
