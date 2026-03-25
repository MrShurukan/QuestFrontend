export interface TimezoneOption {
  id: string
  label: string
}

const FALLBACK_TIMEZONES = ['UTC', 'Europe/Moscow', 'Europe/Warsaw', 'Asia/Yekaterinburg', 'Asia/Almaty']

function getSupportedTimezones() {
  const supportedValuesOf = (Intl as typeof Intl & {
    supportedValuesOf?: (key: 'timeZone') => string[]
  }).supportedValuesOf

  return supportedValuesOf ? supportedValuesOf('timeZone') : FALLBACK_TIMEZONES
}

function getOffsetLabel(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date())

    const offset = parts.find((part) => part.type === 'timeZoneName')?.value
    return (offset ?? timeZone).replace('GMT', 'UTC')
  } catch {
    return timeZone
  }
}

export function buildTimezoneOptions(currentValue?: string | null): TimezoneOption[] {
  const unique = Array.from(new Set([...getSupportedTimezones(), currentValue].filter(Boolean) as string[]))

  return unique
    .map((timeZone) => ({
      id: timeZone,
      label: `${getOffsetLabel(timeZone)} · ${timeZone}`,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'ru'))
}
