import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Play, Save, Search, StopCircle } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { adminApi, isApiError } from '@/shared/api/client'
import {
  type EnigmaProfileResponse,
  type EnigmaProfileUpsertRequest,
  type GlobalSettingsResponse,
  type Id,
  type QuestionPoolResponse,
  type QuestionPoolUpsertRequest,
  type QuestionResponse,
  type QuestionUpsertRequest,
  type QrBindingOverrideResponse,
  type QrCodeUpsertRequest,
  type RoutingProfileResponse,
  type RoutingProfileUpsertRequest,
  queryKeys,
} from '@/shared/contracts/api'
import { useAdminLogout, useAdminSession } from '@/features/session/session-hooks'
import { AlertBox, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Divider, EmptyState, HelpBadge, Input, JsonBlock, KeyValue, LoadingScreen, MemberAvatar, Modal, PageHeader, Select, StatCard, TagChip, Textarea } from '@/shared/ui/ui'
import { questDayStatusLabel } from '@/shared/utils/quest-day'
import { formatDateTime, formatShortDateTime } from '@/shared/utils/time'
import { buildTimezoneOptions } from '@/shared/utils/timezone'

const tagSchema = z.object({
  code: z.string().trim().min(1, 'Укажите код'),
  name: z.string().trim().min(2, 'Укажите название'),
  color: z.string().trim().min(4, 'Укажите цвет'),
  isActive: z.boolean(),
  sortOrder: z.coerce.number(),
  description: z.string().optional(),
})

const questionSchema = z.object({
  tagId: z.string().min(1, 'Выберите тег'),
  title: z.string().trim().min(2, 'Укажите заголовок'),
  bodyRichText: z.string().trim().min(1, 'Введите текст вопроса'),
  footerHint: z.string().trim().min(1, 'Введите подсказку'),
  imageUrl: z.string().optional(),
  status: z.enum(['Draft', 'Active', 'Disabled', 'Archived']),
  isActive: z.boolean(),
  isArchived: z.boolean(),
  supportNotes: z.string().optional(),
  answerKind: z.enum(['ExactText', 'NormalizedText', 'Numeric']),
  acceptedAnswersText: z.string().optional(),
  expectedNumericValue: z.string().optional(),
  numericTolerance: z.string().optional(),
  trimWhitespace: z.boolean(),
  ignoreCase: z.boolean(),
  collapseInnerWhitespace: z.boolean(),
  removePunctuation: z.boolean(),
})

const poolSchema = z.object({
  tagId: z.string().min(1, 'Выберите тег'),
  name: z.string().trim().min(2, 'Укажите название'),
  isActive: z.boolean(),
  isArchived: z.boolean(),
  description: z.string().optional(),
  sortOrder: z.coerce.number(),
  entries: z.array(
    z.object({
      questionId: z.string().min(1, 'Выберите вопрос'),
      position: z.coerce.number(),
      isEnabled: z.boolean(),
      notes: z.string().optional(),
    }),
  ),
})

const qrSchema = z.object({
  tagId: z.string().min(1, 'Выберите тег'),
  slug: z.string().trim().min(4, 'Укажите slug'),
  label: z.string().trim().min(2, 'Укажите подпись'),
  slotIndex: z.coerce.number(),
  isActive: z.boolean(),
  notes: z.string().optional(),
})

const routingSchema = z.object({
  name: z.string().trim().min(2, 'Укажите название'),
  isActive: z.boolean(),
  description: z.string().optional(),
  tagStates: z.array(
    z.object({
      tagId: z.string(),
      activePoolId: z.string().optional(),
      rotationOffset: z.coerce.number(),
      selectionMode: z.enum(['PoolSlotRotation']),
      isEnabled: z.boolean(),
    }),
  ),
})

const overrideSchema = z.object({
  qrCodeId: z.string().min(1, 'Выберите QR'),
  questionId: z.string().min(1, 'Выберите вопрос'),
  scopeProfileId: z.string().optional(),
  isActive: z.boolean(),
  reason: z.string().optional(),
})

const enigmaSchema = z.object({
  name: z.string().trim().min(2, 'Укажите название'),
  mode: z.enum(['HistoricalLike', 'SimpleCombination']),
  isActive: z.boolean(),
  attemptCooldownMinutes: z.coerce.number().min(0),
  successMessage: z.string().trim().min(1, 'Укажите сообщение при успехе'),
  failureMessage: z.string().trim().min(1, 'Укажите сообщение при неудаче'),
  rotors: z.array(
    z.object({
      tagId: z.string().min(1, 'Выберите тег'),
      label: z.string().trim().min(1, 'Укажите подпись'),
      colorOverride: z.string().optional(),
      displayOrder: z.coerce.number(),
      positionMin: z.coerce.number(),
      positionMax: z.coerce.number(),
      isActive: z.boolean(),
      secretPosition: z.coerce.number(),
    }),
  ),
})

const settingsSchema = z.object({
  answerCooldownMinutes: z.coerce.number().min(0),
  enigmaCooldownMinutes: z.coerce.number().min(0),
  maxTeamMembers: z.coerce.number().int().min(1).max(100),
  defaultAnswerNormalization: z.string().trim().min(1),
  currentQuestDayStateId: z.string().optional(),
  currentRoutingProfileId: z.string().optional(),
  currentEnigmaProfileId: z.string().optional(),
  flagsJson: z.string().trim().min(1),
  timezone: z.string().trim().min(1),
})

const questDayMessagesSchema = z.object({
  preStartMessage: z.string().trim().min(1),
  dayClosedMessage: z.string().trim().min(1),
})

const participantPasswordResetSchema = z
  .object({
    newPassword: z.string().min(8, 'Не короче 8 символов'),
    confirmPassword: z.string(),
    reason: z.string().optional(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })

const adminProfileSchema = z
  .object({
    currentPassword: z.string().min(1, 'Введите текущий пароль'),
    newLogin: z.string().optional(),
    newPassword: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (d) => {
      const login = d.newLogin?.trim()
      const hasLogin = Boolean(login && login.length > 0)
      const hasPw = Boolean(d.newPassword && d.newPassword.length > 0)
      return hasLogin || hasPw
    },
    { message: 'Укажите новый логин и/или пароль', path: ['newLogin'] },
  )
  .refine((d) => !d.newPassword || d.newPassword.length >= 8, {
    message: 'Не короче 8 символов',
    path: ['newPassword'],
  })
  .refine((d) => !d.newPassword || d.newPassword === d.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })

const createAdminSchema = z
  .object({
    login: z.string().trim().min(1, 'Укажите логин').max(100),
    password: z.string().min(8, 'Не короче 8 символов'),
    confirmPassword: z.string(),
    role: z.enum(['SuperAdmin', 'Editor', 'Support']),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })

type TagFormInput = z.input<typeof tagSchema>
type TagFormValues = z.output<typeof tagSchema>
type QuestionFormInput = z.input<typeof questionSchema>
type QuestionFormValues = z.output<typeof questionSchema>
type PoolFormInput = z.input<typeof poolSchema>
type PoolFormValues = z.output<typeof poolSchema>
type QrFormInput = z.input<typeof qrSchema>
type QrFormValues = z.output<typeof qrSchema>
type RoutingFormInput = z.input<typeof routingSchema>
type RoutingFormValues = z.output<typeof routingSchema>
type OverrideFormInput = z.input<typeof overrideSchema>
type OverrideFormValues = z.output<typeof overrideSchema>
type EnigmaFormInput = z.input<typeof enigmaSchema>
type EnigmaFormValues = z.output<typeof enigmaSchema>
type SettingsFormInput = z.input<typeof settingsSchema>
type SettingsFormValues = z.output<typeof settingsSchema>
type QuestDayMessagesFormInput = z.input<typeof questDayMessagesSchema>
type QuestDayMessagesFormValues = z.output<typeof questDayMessagesSchema>
type ParticipantPasswordResetFormValues = z.infer<typeof participantPasswordResetSchema>
type AdminProfileFormInput = z.input<typeof adminProfileSchema>
type AdminProfileFormValues = z.output<typeof adminProfileSchema>
type CreateAdminFormInput = z.input<typeof createAdminSchema>
type CreateAdminFormValues = z.output<typeof createAdminSchema>

function normalizeOptional(value?: string | null) {
  return value && value.trim().length > 0 ? value.trim() : null
}

const HELP_TEXTS = {
  tagCode:
    'Короткий служебный идентификатор тега. Он нужен для стабильных внутренних связей и не зависит от отображаемого названия, поэтому переименование тега не ломает маршрутизацию и связанные настройки.',
  questionArchived:
    'Архивный вопрос сохраняется для истории и запасных сценариев, но не должен участвовать в живой игре. Это способ убрать вопрос из работы без удаления данных.',
  questionActive:
    'Активный вопрос может использоваться в пулах и ротации. Если выключить вопрос, новые открытия через живую конфигурацию происходить не должны.',
  poolActive:
    'Активный пул можно выбрать в текущей ротации. Неактивный пул хранится как заготовка или резерв, но не должен использоваться в рабочем профиле.',
  poolArchived:
    'Архивный пул оставляется для истории или старого сценария. Обычно его не используют в текущей игре.',
  poolEntryEnabled:
    'Включённая запись участвует в выборе вопроса внутри пула. Если выключить запись, вопрос останется в составе пула, но ротация будет его пропускать.',
  qrSlotIndex:
    'Это постоянный номер QR внутри своего тега. Сам QR никуда не сдвигается: система берёт его индекс слота, прибавляет текущую ротацию тега и по этому результату выбирает позицию вопроса в активном пуле.',
  qrActive:
    'Неактивный QR остаётся в базе и предпросмотре, но не должен открывать вопрос участникам.',
  rotationProfileActive:
    'Именно этот профиль управляет живой ротацией для новых QR-сканов. Переключение профиля меняет только будущие открытия, а не уже открытые вопросы команд.',
  rotationOffset:
    'Смещение ротации определяет, с какого места активного пула начинается выдача вопросов для QR этого тега. При изменении смещения QR остаются теми же, но начинают открывать другие вопросы из того же пула.',
  rotationSelectionMode:
    'Сейчас в проекте реализован только один режим: PoolSlotRotation. Он выбирает вопрос по формуле slotIndex + rotationOffset внутри активного пула.',
  rotationPreview:
    'Показывает, какой вопрос откроет каждый QR прямо сейчас. Это основной экран проверки перед запуском и во время живой ротации.',
  rotationOverride:
    'Позволяет вручную назначить конкретный вопрос отдельному QR поверх обычной ротации. Используется для точечных исключений и аварийных правок.',
  settingsQuestDayStateId:
    'Это техническая ссылка на текущую запись игрового дня. Она нужна системе для связи с runtime-состоянием, но редактировать её вручную администратору обычно не нужно.',
  settingsTimezone:
    'Это часовой пояс мероприятия. Он нужен, чтобы в интерфейсе использовать понятную для организаторов временную зону, например UTC+3 или Europe/Moscow. Серверные логи и внутренние таймеры продолжают работать в UTC.',
  settingsFlags:
    'Служебные JSON-переключатели для редких или аварийных настроек. Это расширенная зона для технических сценариев, а не повседневная настройка мероприятия.',
} as const

const SUPPORT_QUESTION_STATE_META = {
  closed: { label: 'Закрыт', tone: 'warning' },
  open: { label: 'Открыт', tone: 'info' },
  solved: { label: 'Решён', tone: 'success' },
} as const

function labelWithHelp(label: string, helpText?: string) {
  return helpText ? (
    <span className="inline-flex items-center gap-2">
      <span>{label}</span>
      <HelpBadge text={helpText} />
    </span>
  ) : (
    label
  )
}

function questionStatusLabel(status: QuestionResponse['status']) {
  const labels: Record<QuestionResponse['status'], string> = {
    Draft: 'Черновик',
    Active: 'Активен',
    Disabled: 'Отключён',
    Archived: 'Архив',
  }

  return labels[status]
}

function adminRoleLabel(role: string) {
  const labels: Record<string, string> = {
    SuperAdmin: 'Суперадмин',
    Editor: 'Редактор',
    Support: 'Поддержка',
  }

  return labels[role] ?? role
}

function teamStatusLabel(status: string) {
  const labels: Record<string, string> = {
    Active: 'Активна',
    Locked: 'Заблокирована',
    Archived: 'Архивная',
  }

  return labels[status] ?? status
}

function routingResolutionLabel(mode: string) {
  if (mode.includes('Override')) {
    return 'Переопределение'
  }

  if (mode === 'Resolved') {
    return 'Ротация'
  }

  if (mode === 'InactiveQr') {
    return 'QR выключен'
  }

  if (mode === 'InactiveTag') {
    return 'Тег выключен'
  }

  if (mode === 'NoPoolMatch') {
    return 'Нет вопроса'
  }

  return mode
}

function selectionModeLabel(mode: string) {
  if (mode === 'PoolSlotRotation') {
    return 'Ротация по слотам пула'
  }

  return mode
}

function timelineKindLabel(kind: string) {
  const labels: Record<string, string> = {
    'team-created': 'Создание команды',
    'member-joined': 'Вступление',
    'member-removed': 'Исключение',
    'question-opened': 'Открытие вопроса',
    'question-attempt': 'Попытка ответа',
    'question-solved': 'Решение вопроса',
    'enigma-attempt': 'Попытка Enigma',
    'enigma-solved': 'Решение Enigma',
    'final-photo-uploaded': 'Финальное фото',
    'support-action': 'Действие поддержки',
  }

  return labels[kind] ?? kind
}

function timelineKindTone(kind: string): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  if (kind === 'question-solved' || kind === 'enigma-solved' || kind === 'final-photo-uploaded') {
    return 'success'
  }

  if (kind === 'member-removed' || kind === 'support-action') {
    return 'warning'
  }

  return 'info'
}

function Field({
  label,
  error,
  children,
  hint,
}: {
  label: ReactNode
  error?: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      {error ? <span className="block text-sm text-danger">{error}</span> : null}
    </label>
  )
}

function ToggleField({
  label,
  description,
  ...props
}: {
  label: ReactNode
  description?: ReactNode
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-border bg-background/70 px-4 py-3">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" {...props} />
      <span className="space-y-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description ? <span className="block text-xs text-muted-foreground">{description}</span> : null}
      </span>
    </label>
  )
}

function SearchField({ value, onChange, placeholder = 'Поиск...' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
      <Input value={value} onChange={(event) => onChange(event.target.value)} className="pl-10" placeholder={placeholder} />
    </label>
  )
}

function AdminListCard({
  title,
  description,
  isActive,
  selected,
  onSelect,
  badges,
}: {
  title: string
  description?: string | null
  isActive?: boolean
  selected?: boolean
  onSelect: () => void
  badges?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-3xl border p-4 text-left transition-colors ${
        selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">{title}</p>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {typeof isActive === 'boolean' ? <Badge tone={isActive ? 'success' : 'warning'}>{isActive ? 'Активен' : 'Неактивен'}</Badge> : null}
          {badges}
        </div>
      </div>
    </button>
  )
}

function handleMutationError(error: unknown, fallback: string) {
  toast.error(isApiError(error) ? error.message : fallback)
}

function toQuestionPayload(values: QuestionFormValues): QuestionUpsertRequest {
  const isNumeric = values.answerKind === 'Numeric'
  const isNormalizedText = values.answerKind === 'NormalizedText'
  const acceptedAnswers = (values.acceptedAnswersText ?? '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)

  return {
    tagId: values.tagId,
    title: values.title.trim(),
    bodyRichText: values.bodyRichText.trim(),
    footerHint: values.footerHint.trim(),
    imageUrl: normalizeOptional(values.imageUrl),
    status: values.status,
    isActive: values.isActive,
    isArchived: values.isArchived,
    supportNotes: normalizeOptional(values.supportNotes),
    answerSchema: {
      kind: values.answerKind,
      acceptedAnswers: isNumeric ? [] : acceptedAnswers,
      expectedNumericValue: isNumeric && normalizeOptional(values.expectedNumericValue) ? Number(values.expectedNumericValue) : null,
      numericTolerance: isNumeric && normalizeOptional(values.numericTolerance) ? Number(values.numericTolerance) : null,
      trimWhitespace: isNormalizedText ? values.trimWhitespace : false,
      ignoreCase: isNormalizedText ? values.ignoreCase : false,
      collapseInnerWhitespace: isNormalizedText ? values.collapseInnerWhitespace : false,
      removePunctuation: isNormalizedText ? values.removePunctuation : false,
    },
  }
}

function defaultQuestionForm(): QuestionFormValues {
  return {
    tagId: '',
    title: '',
    bodyRichText: '',
    footerHint: '',
    imageUrl: '',
    status: 'Active',
    isActive: true,
    isArchived: false,
    supportNotes: '',
    answerKind: 'NormalizedText',
    acceptedAnswersText: '',
    expectedNumericValue: '',
    numericTolerance: '',
    trimWhitespace: true,
    ignoreCase: true,
    collapseInnerWhitespace: true,
    removePunctuation: false,
  }
}

function questionToForm(question: QuestionResponse): QuestionFormValues {
  return {
    tagId: question.tagId,
    title: question.title,
    bodyRichText: question.bodyRichText,
    footerHint: question.footerHint,
    imageUrl: question.imageUrl ?? '',
    status: question.status,
    isActive: question.isActive,
    isArchived: question.isArchived,
    supportNotes: question.supportNotes ?? '',
    answerKind: question.answerSchema.kind,
    acceptedAnswersText: question.answerSchema.acceptedAnswers.join('\n'),
    expectedNumericValue: question.answerSchema.expectedNumericValue?.toString() ?? '',
    numericTolerance: question.answerSchema.numericTolerance?.toString() ?? '',
    trimWhitespace: question.answerSchema.trimWhitespace,
    ignoreCase: question.answerSchema.ignoreCase,
    collapseInnerWhitespace: question.answerSchema.collapseInnerWhitespace,
    removePunctuation: question.answerSchema.removePunctuation,
  }
}

function defaultPoolForm(): PoolFormValues {
  return {
    tagId: '',
    name: '',
    isActive: true,
    isArchived: false,
    description: '',
    sortOrder: 0,
    entries: [],
  }
}

function poolToForm(pool: QuestionPoolResponse): PoolFormValues {
  return {
    tagId: pool.tagId,
    name: pool.name,
    isActive: pool.isActive,
    isArchived: pool.isArchived,
    description: pool.description ?? '',
    sortOrder: pool.sortOrder,
    entries: pool.entries.map((entry) => ({
      questionId: entry.questionId,
      position: entry.position,
      isEnabled: entry.isEnabled,
      notes: entry.notes ?? '',
    })),
  }
}

function toPoolPayload(values: PoolFormValues): QuestionPoolUpsertRequest {
  return {
    tagId: values.tagId,
    name: values.name.trim(),
    isActive: values.isActive,
    isArchived: values.isArchived,
    description: normalizeOptional(values.description),
    sortOrder: values.sortOrder,
    entries: values.entries.map((entry, index) => ({
      questionId: entry.questionId,
      position: index,
      isEnabled: entry.isEnabled,
      notes: normalizeOptional(entry.notes),
    })),
  }
}

function defaultQrForm(): QrFormValues {
  return {
    tagId: '',
    slug: '',
    label: '',
    slotIndex: 0,
    isActive: true,
    notes: '',
  }
}

function defaultRoutingForm(tagIds: Id[]): RoutingFormValues {
  return {
    name: '',
    isActive: false,
    description: '',
    tagStates: tagIds.map((tagId) => ({
      tagId,
      activePoolId: '',
      rotationOffset: 0,
      selectionMode: 'PoolSlotRotation',
      isEnabled: false,
    })),
  }
}

function routingProfileToForm(profile: RoutingProfileResponse, tagIds: Id[]): RoutingFormValues {
  const statesByTag = new Map(profile.tagStates.map((state) => [state.tagId, state]))
  return {
    name: profile.name,
    isActive: profile.isActive,
    description: profile.description ?? '',
    tagStates: tagIds.map((tagId) => {
      const state = statesByTag.get(tagId)
      return {
        tagId,
        activePoolId: state?.activePoolId ?? '',
        rotationOffset: state?.rotationOffset ?? 0,
        selectionMode: state?.selectionMode ?? 'PoolSlotRotation',
        isEnabled: state?.isEnabled ?? true,
      }
    }),
  }
}

function toRoutingPayload(values: RoutingFormValues): RoutingProfileUpsertRequest {
  return {
    name: values.name.trim(),
    isActive: values.isActive,
    description: normalizeOptional(values.description),
    tagStates: values.tagStates.map((state) => {
      const activePoolId = normalizeOptional(state.activePoolId)

      return {
        tagId: state.tagId,
        activePoolId,
        rotationOffset: activePoolId ? state.rotationOffset : 0,
        selectionMode: state.selectionMode,
        isEnabled: Boolean(activePoolId),
      }
    }),
  }
}

function enigmaProfileToForm(profile: EnigmaProfileResponse): EnigmaFormValues {
  return {
    name: profile.name,
    mode: profile.mode,
    isActive: profile.isActive,
    attemptCooldownMinutes: profile.attemptCooldownMinutes,
    successMessage: profile.successMessage,
    failureMessage: profile.failureMessage,
    rotors: profile.rotors.map((rotor) => ({
      tagId: rotor.tagId,
      label: rotor.label,
      colorOverride: rotor.colorOverride ?? '',
      displayOrder: rotor.displayOrder,
      positionMin: rotor.positionMin,
      positionMax: rotor.positionMax,
      isActive: rotor.isActive,
      secretPosition: profile.secretCombination[rotor.tagId] ?? rotor.positionMin,
    })),
  }
}

function defaultEnigmaForm(): EnigmaFormValues {
  return {
    name: '',
    mode: 'SimpleCombination',
    isActive: false,
    attemptCooldownMinutes: 5,
    successMessage: 'Успех',
    failureMessage: 'Неудача',
    rotors: [],
  }
}

function toEnigmaPayload(values: EnigmaFormValues): EnigmaProfileUpsertRequest {
  return {
    name: values.name.trim(),
    mode: values.mode,
    isActive: values.isActive,
    attemptCooldownMinutes: values.attemptCooldownMinutes,
    successMessage: values.successMessage.trim(),
    failureMessage: values.failureMessage.trim(),
    secretCombination: Object.fromEntries(values.rotors.map((rotor) => [rotor.tagId, rotor.secretPosition])),
    rotors: values.rotors.map((rotor, index) => ({
      tagId: rotor.tagId,
      label: rotor.label.trim(),
      colorOverride: normalizeOptional(rotor.colorOverride),
      displayOrder: index,
      positionMin: rotor.positionMin,
      positionMax: rotor.positionMax,
      isActive: rotor.isActive,
    })),
  }
}

function defaultSettingsForm(settings?: GlobalSettingsResponse): SettingsFormValues {
  return {
    answerCooldownMinutes: settings?.answerCooldownMinutes ?? 5,
    enigmaCooldownMinutes: settings?.enigmaCooldownMinutes ?? 0,
    maxTeamMembers: settings?.maxTeamMembers ?? 4,
    defaultAnswerNormalization: settings?.defaultAnswerNormalization ?? '{"trimWhitespace":true}',
    currentQuestDayStateId: settings?.currentQuestDayStateId ?? '',
    currentRoutingProfileId: settings?.currentRoutingProfileId ?? '',
    currentEnigmaProfileId: settings?.currentEnigmaProfileId ?? '',
    flagsJson: settings?.flagsJson ?? '{}',
    timezone: settings?.timezone ?? 'UTC',
  }
}

function defaultQuestDayMessagesForm() {
  return {
    preStartMessage: 'Игра еще не началась.',
    dayClosedMessage: 'Игровой день завершен.',
  }
}

export function AdminDashboardPage() {
  const tags = useQuery({ queryKey: queryKeys.adminTags, queryFn: adminApi.tags })
  const questions = useQuery({ queryKey: queryKeys.adminQuestions, queryFn: adminApi.questions })
  const qr = useQuery({ queryKey: queryKeys.adminQr, queryFn: adminApi.qrCodes })
  const routing = useQuery({ queryKey: queryKeys.adminRoutingProfiles, queryFn: adminApi.routingProfiles })
  const enigma = useQuery({ queryKey: queryKeys.adminEnigmaProfiles, queryFn: adminApi.enigmaProfiles })
  const questDay = useQuery({ queryKey: queryKeys.adminQuestDay, queryFn: adminApi.questDay })

  if ([tags, questions, qr, routing, enigma, questDay].some((item) => item.isPending)) {
    return <LoadingScreen label="Загружаю обзор..." />
  }

  return (
    <section className="space-y-6">
      <PageHeader title="Обзор" description="Сводка по конфигурации и операциям." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Игровой день"
          value={questDay.data?.status ? questDayStatusLabel(questDay.data.status) : '—'}
          hint={questDay.data?.message}
        />
        <StatCard label="Теги" value={tags.data?.length ?? 0} />
        <StatCard label="Вопросы" value={questions.data?.length ?? 0} />
        <StatCard label="QR-коды" value={qr.data?.length ?? 0} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Ротация</CardTitle>
            <CardDescription>Профилей: {routing.data?.length ?? 0}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {routing.data?.slice(0, 3).map((profile) => (
              <div key={profile.id} className="flex items-center justify-between rounded-2xl border border-border p-3 text-sm">
                <span>{profile.name}</span>
                <Badge tone={profile.isActive ? 'success' : 'default'}>{profile.isActive ? 'Активен' : 'Неактивен'}</Badge>
              </div>
            ))}
            <Button asChild variant="outline" className="w-full">
              <Link to="/admin/routing">Открыть маршрутизацию</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Enigma</CardTitle>
            <CardDescription>Профилей: {enigma.data?.length ?? 0}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {enigma.data?.slice(0, 3).map((profile) => (
              <div key={profile.id} className="flex items-center justify-between rounded-2xl border border-border p-3 text-sm">
                <span>{profile.name}</span>
                <Badge tone={profile.isActive ? 'success' : 'default'}>{profile.isActive ? 'Активен' : 'Неактивен'}</Badge>
              </div>
            ))}
            <Button asChild variant="outline" className="w-full">
              <Link to="/admin/enigma">Профили Enigma</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Команды и аудит</CardTitle>
            <CardDescription>Ручные правки и журнал.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button asChild variant="outline">
              <Link to="/admin/support/teams">Команды</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/audit">Аудит</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/quest-day">Игровой день</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

export function AdminTagsPage() {
  const queryClient = useQueryClient()
  const tags = useQuery({ queryKey: queryKeys.adminTags, queryFn: adminApi.tags })
  const [selectedId, setSelectedId] = useState<Id | 'new'>('new')
  const [search, setSearch] = useState('')
  const form = useForm<TagFormInput, undefined, TagFormValues>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      code: '',
      name: '',
      color: '#7c3aed',
      isActive: true,
      sortOrder: 0,
      description: '',
    },
  })

  const sortedTags = useMemo(
    () => [...(tags.data ?? [])].sort((left, right) => left.name.localeCompare(right.name, 'ru')),
    [tags.data],
  )
  const selected = sortedTags.find((item) => item.id === selectedId)
  const watchedColor = form.watch('color')
  const safeColor = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(watchedColor ?? '') ? watchedColor : '#7c3aed'

  useEffect(() => {
    if (selected) {
      form.reset({
        code: selected.code,
        name: selected.name,
        color: selected.color,
        isActive: selected.isActive,
        sortOrder: selected.sortOrder,
        description: selected.description ?? '',
      })
    } else {
      form.reset({
        code: '',
        name: '',
        color: '#7c3aed',
        isActive: true,
        sortOrder: 0,
        description: '',
      })
    }
  }, [form, selected])

  const saveTag = useMutation({
    mutationFn: (values: TagFormValues) =>
      selected ? adminApi.updateTag(selected.id, { ...values, description: normalizeOptional(values.description) }) : adminApi.createTag({ ...values, description: normalizeOptional(values.description) }),
    onSuccess: async (result) => {
      toast.success(selected ? 'Тег обновлён' : 'Тег создан')
      setSelectedId(result.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminTags })
    },
    onError: (error) => handleMutationError(error, 'Не удалось сохранить тег'),
  })

  const filtered = useMemo(
    () =>
      sortedTags.filter((item) =>
        `${item.code} ${item.name} ${item.description ?? ''}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [search, sortedTags],
  )

  if (tags.isPending) {
    return <LoadingScreen label="Загружаю теги..." />
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <PageHeader
          title="Теги"
          description="Теги задают цвет и смысловую группу вопросов, QR, пулов и роторов Enigma."
          actions={
            <Button onClick={() => setSelectedId('new')} disabled={selectedId === 'new'}>
              Новый тег
            </Button>
          }
        />
        <SearchField value={search} onChange={setSearch} placeholder="Поиск по тегам..." />
        <div className="space-y-3">
          {filtered.map((tag) => (
            <AdminListCard
              key={tag.id}
              title={tag.name}
              description={tag.description}
              isActive={tag.isActive}
              selected={selectedId === tag.id}
              onSelect={() => setSelectedId(tag.id)}
              badges={<TagChip name={tag.code} color={tag.color} />}
            />
          ))}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{selected ? 'Редактировать тег' : 'Новый тег'}</CardTitle>
          <CardDescription>Цвет тега используется в вопросах, QR и роторах Enigma.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit((values) => saveTag.mutate(values))}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={labelWithHelp('Код', HELP_TEXTS.tagCode)} error={form.formState.errors.code?.message}>
                <Input {...form.register('code')} placeholder="red" />
              </Field>
              <Field label="Название" error={form.formState.errors.name?.message}>
                <Input {...form.register('name')} placeholder="Красный ротор" />
              </Field>
              <Field label="Цвет" error={form.formState.errors.color?.message}>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={safeColor}
                    onChange={(event) => form.setValue('color', event.target.value, { shouldDirty: true, shouldValidate: true })}
                    className="h-11 w-16 rounded-2xl border border-border bg-background p-1"
                  />
                  <Input
                    value={watchedColor}
                    onChange={(event) => form.setValue('color', event.target.value, { shouldDirty: true, shouldValidate: true })}
                    placeholder="#ef4444"
                  />
                </div>
              </Field>
            </div>
            <Field label="Описание" error={form.formState.errors.description?.message}>
              <Textarea rows={4} {...form.register('description')} />
            </Field>
            <ToggleField label="Тег активен" description="Неактивные теги не участвуют в маршрутизации." {...form.register('isActive')} checked={form.watch('isActive')} />
            <Button type="submit" className="w-full" disabled={saveTag.isPending}>
              <Save className="h-4 w-4" />
              {saveTag.isPending ? 'Сохранение...' : selected ? 'Сохранить тег' : 'Создать тег'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}

export function AdminQuestionsPage() {
  const queryClient = useQueryClient()
  const tags = useQuery({ queryKey: queryKeys.adminTags, queryFn: adminApi.tags })
  const questions = useQuery({ queryKey: queryKeys.adminQuestions, queryFn: adminApi.questions })
  const [selectedId, setSelectedId] = useState<Id | 'new'>('new')
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false)
  const form = useForm<QuestionFormInput, undefined, QuestionFormValues>({
    resolver: zodResolver(questionSchema),
    defaultValues: defaultQuestionForm(),
  })
  const sortedTags = useMemo(
    () => [...(tags.data ?? [])].sort((left, right) => left.name.localeCompare(right.name, 'ru')),
    [tags.data],
  )
  const selected = questions.data?.find((item) => item.id === selectedId)
  const answerKind = form.watch('answerKind')
  const currentImageUrl = form.watch('imageUrl')

  useEffect(() => {
    form.reset(selected ? questionToForm(selected) : defaultQuestionForm())
  }, [form, selected])

  const uploadQuestionImage = useMutation({
    mutationFn: (file: File) => adminApi.uploadQuestionImage(file),
    onSuccess: ({ imageUrl }) => {
      form.setValue('imageUrl', imageUrl, { shouldDirty: true, shouldValidate: true })
      toast.success('Изображение загружено')
    },
    onError: (error) => handleMutationError(error, 'Не удалось загрузить изображение'),
  })

  const saveQuestion = useMutation({
    mutationFn: (values: QuestionFormValues) => (selected ? adminApi.updateQuestion(selected.id, toQuestionPayload(values)) : adminApi.createQuestion(toQuestionPayload(values))),
    onSuccess: async (result) => {
      toast.success(selected ? 'Вопрос обновлён' : 'Вопрос создан')
      setSelectedId(result.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminQuestions })
    },
    onError: (error) => handleMutationError(error, 'Не удалось сохранить вопрос'),
  })

  const duplicateQuestion = useMutation({
    mutationFn: (id: Id) => adminApi.duplicateQuestion(id),
    onSuccess: async (result) => {
      toast.success('Вопрос скопирован')
      setSelectedId(result.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminQuestions })
    },
    onError: (error) => handleMutationError(error, 'Не удалось скопировать вопрос'),
  })

  const filtered = useMemo(
    () =>
      [...(questions.data ?? [])]
        .filter((item) => (!tagFilter || item.tagId === tagFilter) && `${item.title} ${item.status} ${item.supportNotes ?? ''}`.toLowerCase().includes(search.toLowerCase()))
        .sort((left, right) => {
          const leftTag = sortedTags.find((tag) => tag.id === left.tagId)?.name ?? ''
          const rightTag = sortedTags.find((tag) => tag.id === right.tagId)?.name ?? ''
          return `${leftTag} ${left.title}`.localeCompare(`${rightTag} ${right.title}`, 'ru')
        }),
    [questions.data, search, sortedTags, tagFilter],
  )

  if (tags.isPending || questions.isPending) {
    return <LoadingScreen label="Загружаю вопросы..." />
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-4">
        <PageHeader
          title="Вопросы"
          description="Банк вопросов, изображения, схема ответов и игровые флаги."
          actions={
            <Button onClick={() => setSelectedId('new')} disabled={selectedId === 'new'}>
              Новый вопрос
            </Button>
          }
        />
        <div className="grid gap-3 md:grid-cols-[1fr_240px]">
          <SearchField value={search} onChange={setSearch} placeholder="Поиск по вопросам..." />
          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">Тег</span>
            <Select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
              <option value="">Все теги</option>
              {sortedTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="space-y-3">
          {filtered.map((question) => (
            <AdminListCard
              key={question.id}
              title={question.title}
              description={question.supportNotes}
              isActive={question.isActive}
              selected={selectedId === question.id}
              onSelect={() => setSelectedId(question.id)}
              badges={
                <>
                  {sortedTags.find((tag) => tag.id === question.tagId) ? (
                    <TagChip
                      name={sortedTags.find((tag) => tag.id === question.tagId)?.name ?? 'Тег'}
                      color={sortedTags.find((tag) => tag.id === question.tagId)?.color ?? '#64748b'}
                    />
                  ) : null}
                  <Badge tone={question.isArchived ? 'warning' : 'info'}>{questionStatusLabel(question.status)}</Badge>
                </>
              }
            />
          ))}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{selected ? 'Редактировать вопрос' : 'Новый вопрос'}</CardTitle>
          <CardDescription>Текст и подсказка отображаются участникам как форматированный текст.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit((values) => saveQuestion.mutate(values))}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Тег" error={form.formState.errors.tagId?.message}>
                <Select {...form.register('tagId')}>
                  <option value="">Выберите тег</option>
                  {sortedTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Статус" error={form.formState.errors.status?.message}>
                <Select {...form.register('status')}>
                  <option value="Draft">Черновик</option>
                  <option value="Active">Активен</option>
                  <option value="Disabled">Отключён</option>
                  <option value="Archived">Архив</option>
                </Select>
              </Field>
            </div>
            <Field label="Заголовок" error={form.formState.errors.title?.message}>
              <Input {...form.register('title')} />
            </Field>
            <Field label="Текст вопроса" error={form.formState.errors.bodyRichText?.message}>
              <Textarea rows={8} {...form.register('bodyRichText')} />
            </Field>
            <Field label="Подсказка в футере" error={form.formState.errors.footerHint?.message}>
              <Textarea rows={4} {...form.register('footerHint')} />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Изображение вопроса" error={form.formState.errors.imageUrl?.message}>
                <div className="space-y-3">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploadQuestionImage.isPending}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (!file) {
                        return
                      }

                      uploadQuestionImage.mutate(file)
                      event.target.value = ''
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" disabled={!currentImageUrl} onClick={() => setImagePreviewOpen(true)}>
                      Просмотреть текущее изображение
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!currentImageUrl}
                      onClick={() => form.setValue('imageUrl', '', { shouldDirty: true, shouldValidate: true })}
                    >
                      Убрать изображение
                    </Button>
                  </div>
                  {uploadQuestionImage.isPending ? <p className="text-xs text-muted-foreground">Загружаю изображение...</p> : null}
                  {currentImageUrl ? <p className="text-xs text-muted-foreground">{currentImageUrl}</p> : <p className="text-xs text-muted-foreground">Изображение ещё не загружено.</p>}
                </div>
              </Field>
              <Field label="Заметки для организаторов" error={form.formState.errors.supportNotes?.message}>
                <Textarea rows={4} {...form.register('supportNotes')} placeholder="Внутренние заметки для команды организаторов" />
              </Field>
            </div>
            <Divider />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Тип ответа" error={form.formState.errors.answerKind?.message}>
                <Select {...form.register('answerKind')}>
                  <option value="ExactText">Точный текст</option>
                  <option value="NormalizedText">Текст с нормализацией</option>
                  <option value="Numeric">Число</option>
                </Select>
              </Field>
              {answerKind === 'Numeric' ? (
                <Field label="Ожидаемое число" error={form.formState.errors.expectedNumericValue?.message}>
                  <Input {...form.register('expectedNumericValue')} placeholder="42" />
                </Field>
              ) : (
                <Field label="Правильные ответы" hint="Один ответ на строку" error={form.formState.errors.acceptedAnswersText?.message}>
                  <Textarea rows={4} {...form.register('acceptedAnswersText')} />
                </Field>
              )}
              {answerKind === 'Numeric' ? (
                <Field label="Допуск" error={form.formState.errors.numericTolerance?.message}>
                  <Input {...form.register('numericTolerance')} placeholder="0.5" />
                </Field>
              ) : null}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ToggleField label={labelWithHelp('Вопрос активен', HELP_TEXTS.questionActive)} {...form.register('isActive')} checked={form.watch('isActive')} />
              <ToggleField label={labelWithHelp('Вопрос в архиве', HELP_TEXTS.questionArchived)} {...form.register('isArchived')} checked={form.watch('isArchived')} />
              {answerKind === 'NormalizedText' ? (
                <>
                  <ToggleField label="Убирать пробелы по краям" {...form.register('trimWhitespace')} checked={form.watch('trimWhitespace')} />
                  <ToggleField label="Не учитывать регистр" {...form.register('ignoreCase')} checked={form.watch('ignoreCase')} />
                  <ToggleField label="Схлопывать пробелы внутри" {...form.register('collapseInnerWhitespace')} checked={form.watch('collapseInnerWhitespace')} />
                  <ToggleField label="Убирать знаки препинания" {...form.register('removePunctuation')} checked={form.watch('removePunctuation')} />
                </>
              ) : null}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Button type="submit" disabled={saveQuestion.isPending}>
                <Save className="h-4 w-4" />
                {saveQuestion.isPending ? 'Сохранение...' : selected ? 'Сохранить вопрос' : 'Создать вопрос'}
              </Button>
              {selected ? (
                <Button type="button" variant="outline" onClick={() => duplicateQuestion.mutate(selected.id)} disabled={duplicateQuestion.isPending}>
                  <Copy className="h-4 w-4" />
                  {duplicateQuestion.isPending ? 'Копирую...' : 'Дублировать'}
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
      <Modal open={imagePreviewOpen} onClose={() => setImagePreviewOpen(false)} title="Текущее изображение вопроса">
        {currentImageUrl ? (
          <img
            src={currentImageUrl}
            alt="Изображение вопроса"
            className="max-h-[70vh] w-full rounded-2xl border border-border object-contain"
          />
        ) : (
          <p className="text-sm text-muted-foreground">Изображение не загружено.</p>
        )}
      </Modal>
    </section>
  )
}

export function AdminPoolsPage() {
  const queryClient = useQueryClient()
  const tags = useQuery({ queryKey: queryKeys.adminTags, queryFn: adminApi.tags })
  const questions = useQuery({ queryKey: queryKeys.adminQuestions, queryFn: adminApi.questions })
  const pools = useQuery({ queryKey: queryKeys.adminPools, queryFn: adminApi.pools })
  const [selectedId, setSelectedId] = useState<Id | 'new'>('new')
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const form = useForm<PoolFormInput, undefined, PoolFormValues>({
    resolver: zodResolver(poolSchema),
    defaultValues: defaultPoolForm(),
  })
  const entriesArray = useFieldArray({ control: form.control, name: 'entries' })
  const selected = pools.data?.find((item) => item.id === selectedId)
  const sortedTags = useMemo(
    () => [...(tags.data ?? [])].sort((left, right) => left.name.localeCompare(right.name, 'ru')),
    [tags.data],
  )
  const currentTagId = form.watch('tagId')
  const availableQuestions = useMemo(
    () =>
      [...(questions.data ?? [])]
        .filter((item) => (currentTagId ? item.tagId === currentTagId : true))
        .sort((left, right) => left.title.localeCompare(right.title, 'ru')),
    [currentTagId, questions.data],
  )

  useEffect(() => {
    form.reset(selected ? poolToForm(selected) : defaultPoolForm())
  }, [form, selected])

  const savePool = useMutation({
    mutationFn: (values: PoolFormValues) => (selected ? adminApi.updatePool(selected.id, toPoolPayload(values)) : adminApi.createPool(toPoolPayload(values))),
    onSuccess: async (result) => {
      toast.success(selected ? 'Пул обновлён' : 'Пул создан')
      setSelectedId(result.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminPools })
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminRoutingPreview })
    },
    onError: (error) => handleMutationError(error, 'Не удалось сохранить пул'),
  })

  const filteredPools = useMemo(
    () =>
      [...(pools.data ?? [])]
        .filter(
          (pool) =>
            (!tagFilter || pool.tagId === tagFilter)
            && `${pool.name} ${pool.description ?? ''}`.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((left, right) => {
          const leftTag = sortedTags.find((tag) => tag.id === left.tagId)?.name ?? ''
          const rightTag = sortedTags.find((tag) => tag.id === right.tagId)?.name ?? ''
          return `${leftTag} ${left.name}`.localeCompare(`${rightTag} ${right.name}`, 'ru')
        }),
    [pools.data, search, sortedTags, tagFilter],
  )

  if (tags.isPending || questions.isPending || pools.isPending) {
    return <LoadingScreen label="Загружаю пулы..." />
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-4">
        <PageHeader
          title="Пулы вопросов"
          description="Пулы собирают вопросы одного тега и задают их порядок для ротации."
          actions={
            <Button onClick={() => setSelectedId('new')} disabled={selectedId === 'new'}>
              Новый пул
            </Button>
          }
        />
        <div className="grid gap-3 md:grid-cols-[1fr_240px]">
          <SearchField value={search} onChange={setSearch} placeholder="Поиск по пулам..." />
          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">Тег</span>
            <Select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
              <option value="">Все теги</option>
              {sortedTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="space-y-3">
          {filteredPools.map((pool) => (
            <AdminListCard
              key={pool.id}
              title={pool.name}
              description={`${pool.entries.length} записей`}
              isActive={pool.isActive}
              selected={selectedId === pool.id}
              onSelect={() => setSelectedId(pool.id)}
              badges={
                <>
                  {sortedTags.find((tag) => tag.id === pool.tagId) ? (
                    <TagChip
                      name={sortedTags.find((tag) => tag.id === pool.tagId)?.name ?? 'Тег'}
                      color={sortedTags.find((tag) => tag.id === pool.tagId)?.color ?? '#64748b'}
                    />
                  ) : null}
                  <Badge tone={pool.isArchived ? 'warning' : 'default'}>{pool.isArchived ? 'Архив' : 'Рабочий'}</Badge>
                </>
              }
            />
          ))}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{selected ? 'Редактировать пул' : 'Новый пул'}</CardTitle>
          <CardDescription>Порядок элементов меняется только кнопками «Вверх» и «Вниз».</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit((values) => savePool.mutate(values))}>
            <div className="grid gap-4 md:grid-cols-1">
              <Field label="Тег" error={form.formState.errors.tagId?.message}>
                <Select {...form.register('tagId')}>
                  <option value="">Выберите тег</option>
                  {sortedTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Название" error={form.formState.errors.name?.message}>
              <Input {...form.register('name')} />
            </Field>
            <Field label="Описание" error={form.formState.errors.description?.message}>
              <Textarea rows={4} {...form.register('description')} />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <ToggleField label={labelWithHelp('Пул активен', HELP_TEXTS.poolActive)} {...form.register('isActive')} checked={form.watch('isActive')} />
              <ToggleField label={labelWithHelp('Пул в архиве', HELP_TEXTS.poolArchived)} {...form.register('isArchived')} checked={form.watch('isArchived')} />
            </div>
            <Divider />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Записи пула</h3>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    entriesArray.append({
                      questionId: '',
                      position: entriesArray.fields.length,
                      isEnabled: true,
                      notes: '',
                    })
                  }
                >
                  Добавить вопрос
                </Button>
              </div>
              {entriesArray.fields.length === 0 ? (
                <EmptyState title="Пока нет записей" description="Добавьте вопросы в нужном порядке — тогда пул начнёт участвовать в маршрутизации." />
              ) : (
                entriesArray.fields.map((field, index) => (
                  <div key={field.id} className="rounded-3xl border border-border bg-background/70 p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Вопрос">
                        <Select {...form.register(`entries.${index}.questionId`)}>
                          <option value="">Выберите вопрос</option>
                          {availableQuestions.map((question) => (
                            <option key={question.id} value={question.id}>
                              {question.title}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Позиция вопроса" hint="Это место в порядке пула. Оно меняется кнопками ниже.">
                        <Input value={String(index + 1)} readOnly />
                      </Field>
                    </div>
                    <Field label="Заметки">
                      <Input {...form.register(`entries.${index}.notes`)} />
                    </Field>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ToggleField
                        label={labelWithHelp('Запись включена', HELP_TEXTS.poolEntryEnabled)}
                        {...form.register(`entries.${index}.isEnabled`)}
                        checked={form.watch(`entries.${index}.isEnabled`)}
                      />
                      <Button type="button" variant="outline" onClick={() => index > 0 && entriesArray.swap(index, index - 1)} disabled={index === 0}>
                        Вверх
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => index < entriesArray.fields.length - 1 && entriesArray.swap(index, index + 1)}
                        disabled={index === entriesArray.fields.length - 1}
                      >
                        Вниз
                      </Button>
                      <Button type="button" variant="danger" onClick={() => entriesArray.remove(index)}>
                        Удалить
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <Button type="submit" className="w-full" disabled={savePool.isPending}>
              {savePool.isPending ? 'Сохранение...' : selected ? 'Сохранить пул' : 'Создать пул'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}

export function AdminQrPage() {
  const queryClient = useQueryClient()
  const tags = useQuery({ queryKey: queryKeys.adminTags, queryFn: adminApi.tags })
  const qrCodes = useQuery({ queryKey: queryKeys.adminQr, queryFn: adminApi.qrCodes })
  const [selectedId, setSelectedId] = useState<Id | 'new'>('new')
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const form = useForm<QrFormInput, undefined, QrFormValues>({
    resolver: zodResolver(qrSchema),
    defaultValues: defaultQrForm(),
  })
  const selected = qrCodes.data?.find((item) => item.id === selectedId)
  const watchedSlug = form.watch('slug')
  const sortedTags = useMemo(
    () => [...(tags.data ?? [])].sort((left, right) => left.name.localeCompare(right.name, 'ru')),
    [tags.data],
  )

  useEffect(() => {
    form.reset(
      selected
        ? {
            tagId: selected.tagId,
            slug: selected.slug,
            label: selected.label,
            slotIndex: selected.slotIndex,
            isActive: selected.isActive,
            notes: selected.notes ?? '',
          }
        : defaultQrForm(),
    )
  }, [form, selected])

  const saveQr = useMutation({
    mutationFn: (values: QrFormValues) => {
      const payload: QrCodeUpsertRequest = {
        tagId: values.tagId,
        slug: values.slug.trim(),
        label: values.label.trim(),
        slotIndex: values.slotIndex,
        isActive: values.isActive,
        notes: normalizeOptional(values.notes),
      }
      return selected ? adminApi.updateQrCode(selected.id, payload) : adminApi.createQrCode(payload)
    },
    onSuccess: async (result) => {
      toast.success(selected ? 'QR обновлён' : 'QR создан')
      setSelectedId(result.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminQr })
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminRoutingPreview })
    },
    onError: (error) => handleMutationError(error, 'Не удалось сохранить QR-код'),
  })

  if (tags.isPending || qrCodes.isPending) {
    return <LoadingScreen label="Загружаю QR..." />
  }

  const filteredQrCodes = [...(qrCodes.data ?? [])]
    .filter(
      (qrCode) =>
        (!tagFilter || qrCode.tagId === tagFilter)
        && `${qrCode.label} ${qrCode.slug} ${qrCode.notes ?? ''}`.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((left, right) => {
      const leftTag = sortedTags.find((tag) => tag.id === left.tagId)?.name ?? ''
      const rightTag = sortedTags.find((tag) => tag.id === right.tagId)?.name ?? ''
      return `${leftTag} ${left.label}`.localeCompare(`${rightTag} ${right.label}`, 'ru')
    })

  const browserRoute = watchedSlug ? `/q/${watchedSlug}` : '/q/{slug}'

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-4">
        <PageHeader
          title="QR-коды"
          description="QR связывают физические точки маршрута с текущей ротацией вопросов."
          actions={
            <Button onClick={() => setSelectedId('new')} disabled={selectedId === 'new'}>
              Новый QR
            </Button>
          }
        />
        <div className="grid gap-3 md:grid-cols-[1fr_240px]">
          <SearchField value={search} onChange={setSearch} placeholder="Поиск по QR..." />
          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">Тег</span>
            <Select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
              <option value="">Все теги</option>
              {sortedTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="space-y-3">
          {filteredQrCodes.map((qrCode) => (
            <AdminListCard
              key={qrCode.id}
              title={qrCode.label}
              description={qrCode.slug}
              isActive={qrCode.isActive}
              selected={selectedId === qrCode.id}
              onSelect={() => setSelectedId(qrCode.id)}
              badges={
                <>
                  {sortedTags.find((tag) => tag.id === qrCode.tagId) ? (
                    <TagChip
                      name={sortedTags.find((tag) => tag.id === qrCode.tagId)?.name ?? 'Тег'}
                      color={sortedTags.find((tag) => tag.id === qrCode.tagId)?.color ?? '#64748b'}
                    />
                  ) : null}
                  <Badge>Слот {qrCode.slotIndex}</Badge>
                </>
              }
            />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{selected ? 'Редактировать QR' : 'Новый QR'}</CardTitle>
            <CardDescription>Участники открывают QR по адресу `/q/:slug`.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => saveQr.mutate(values))}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Тег" error={form.formState.errors.tagId?.message}>
                  <Select {...form.register('tagId')}>
                    <option value="">Выберите тег</option>
                    {sortedTags.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={labelWithHelp('Индекс слота', HELP_TEXTS.qrSlotIndex)} error={form.formState.errors.slotIndex?.message}>
                  <Input type="number" {...form.register('slotIndex')} />
                </Field>
              </div>
              <Field label="Подпись" error={form.formState.errors.label?.message}>
                <Input {...form.register('label')} />
              </Field>
              <Field label="Slug (короткий URL)" error={form.formState.errors.slug?.message}>
                <Input {...form.register('slug')} placeholder="red-a1" />
              </Field>
              <Field label="Заметки" error={form.formState.errors.notes?.message}>
                <Textarea rows={4} {...form.register('notes')} />
              </Field>
              <ToggleField label={labelWithHelp('QR активен', HELP_TEXTS.qrActive)} {...form.register('isActive')} checked={form.watch('isActive')} />
              <Button type="submit" className="w-full" disabled={saveQr.isPending}>
                {saveQr.isPending ? 'Сохранение...' : selected ? 'Сохранить QR' : 'Создать QR'}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Предпросмотр QR</CardTitle>
            <CardDescription>QR формируется на клиенте и ведёт на страницу сканирования во фронтенде.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center rounded-3xl border border-border bg-white p-6">
              <QRCodeSVG value={browserRoute} size={200} />
            </div>
            <KeyValue label="Адрес для перехода" value={browserRoute} />
            <KeyValue label="Подпись для печати" value={form.watch('label') || '—'} />
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

export function AdminRoutingPage() {
  const queryClient = useQueryClient()
  const tags = useQuery({ queryKey: queryKeys.adminTags, queryFn: adminApi.tags })
  const pools = useQuery({ queryKey: queryKeys.adminPools, queryFn: adminApi.pools })
  const qrCodes = useQuery({ queryKey: queryKeys.adminQr, queryFn: adminApi.qrCodes })
  const questions = useQuery({ queryKey: queryKeys.adminQuestions, queryFn: adminApi.questions })
  const profiles = useQuery({ queryKey: queryKeys.adminRoutingProfiles, queryFn: adminApi.routingProfiles })
  const preview = useQuery({ queryKey: queryKeys.adminRoutingPreview, queryFn: adminApi.routingPreview })
  const [selectedId, setSelectedId] = useState<Id | 'new'>('new')
  const [localOverrides, setLocalOverrides] = useState<QrBindingOverrideResponse[]>([])

  const form = useForm<RoutingFormInput, undefined, RoutingFormValues>({
    resolver: zodResolver(routingSchema),
    defaultValues: defaultRoutingForm([]),
  })
  const tagStatesArray = useFieldArray({ control: form.control, name: 'tagStates' })
  const overrideForm = useForm<OverrideFormInput, undefined, OverrideFormValues>({
    resolver: zodResolver(overrideSchema),
    defaultValues: {
      qrCodeId: '',
      questionId: '',
      scopeProfileId: '',
      isActive: true,
      reason: '',
    },
  })

  const selected = profiles.data?.find((item) => item.id === selectedId)
  const sortedTags = useMemo(
    () => [...(tags.data ?? [])].sort((left, right) => left.name.localeCompare(right.name, 'ru')),
    [tags.data],
  )
  const questionById = useMemo(() => new Map((questions.data ?? []).map((question) => [question.id, question])), [questions.data])

  useEffect(() => {
    const tagIds = (tags.data ?? []).map((tag) => tag.id)
    form.reset(selected ? routingProfileToForm(selected, tagIds) : defaultRoutingForm(tagIds))
  }, [form, selected, tags.data])

  const saveProfile = useMutation({
    mutationFn: (values: RoutingFormValues) => (selected ? adminApi.updateRoutingProfile(selected.id, toRoutingPayload(values)) : adminApi.createRoutingProfile(toRoutingPayload(values))),
    onSuccess: async (result) => {
      toast.success(selected ? 'Профиль ротации обновлён' : 'Профиль ротации создан')
      setSelectedId(result.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminRoutingProfiles })
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminRoutingPreview })
    },
    onError: (error) => handleMutationError(error, 'Не удалось сохранить профиль ротации'),
  })

  const activateProfile = useMutation({
    mutationFn: (id: Id) => adminApi.activateRoutingProfile(id),
    onSuccess: async () => {
      toast.success('Профиль ротации активирован')
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminRoutingProfiles })
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminRoutingPreview })
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminSettings })
    },
    onError: (error) => handleMutationError(error, 'Не удалось активировать профиль ротации'),
  })

  const createOverride = useMutation({
    mutationFn: (values: OverrideFormValues) =>
      adminApi.createOverride({
        qrCodeId: values.qrCodeId,
        questionId: values.questionId,
        scopeProfileId: normalizeOptional(values.scopeProfileId),
        isActive: values.isActive,
        reason: normalizeOptional(values.reason),
      }),
    onSuccess: async (result) => {
      toast.success('Переопределение создано')
      setLocalOverrides((current) => [result, ...current])
      overrideForm.reset({
        qrCodeId: '',
        questionId: '',
        scopeProfileId: '',
        isActive: true,
        reason: '',
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminRoutingPreview })
    },
    onError: (error) => handleMutationError(error, 'Не удалось создать переопределение'),
  })

  const clearOverride = useMutation({
    mutationFn: (id: Id) => adminApi.clearOverride(id),
    onSuccess: async (_, id) => {
      toast.success('Переопределение сброшено')
      setLocalOverrides((current) => current.filter((item) => item.id !== id))
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminRoutingPreview })
    },
    onError: (error) => handleMutationError(error, 'Не удалось сбросить переопределение'),
  })

  if ([tags, pools, qrCodes, questions, profiles, preview].some((item) => item.isPending)) {
    return <LoadingScreen label="Загружаю маршрутизацию..." />
  }

  return (
    <section className="space-y-6">
      <PageHeader title="Ротация" description="Профили, живой предпросмотр и точечные переопределения QR." />
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Профили ротации</h2>
            <Button onClick={() => setSelectedId('new')} disabled={selectedId === 'new'}>
              Новый профиль
            </Button>
          </div>
          <div className="space-y-3">
            {profiles.data?.map((profile) => (
              <AdminListCard
                key={profile.id}
                title={profile.name}
                description={profile.description}
                isActive={profile.isActive}
                selected={selectedId === profile.id}
                onSelect={() => setSelectedId(profile.id)}
                badges={
                  <Button type="button" size="sm" variant="outline" onClick={() => activateProfile.mutate(profile.id)} disabled={profile.isActive}>
                    {profile.isActive ? 'Текущий профиль' : 'Сделать текущим'}
                  </Button>
                }
              />
            ))}
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{selected ? 'Профиль ротации' : 'Новый профиль ротации'}</CardTitle>
            <CardDescription>Для каждого тега выбирается активный пул и стартовая точка выдачи.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => saveProfile.mutate(values))}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Название" error={form.formState.errors.name?.message}>
                  <Input {...form.register('name')} />
                </Field>
                <Field label="Описание" error={form.formState.errors.description?.message}>
                  <Input {...form.register('description')} />
                </Field>
              </div>
              <ToggleField label={labelWithHelp('Профиль активен', HELP_TEXTS.rotationProfileActive)} {...form.register('isActive')} checked={form.watch('isActive')} />
              <Divider />
              <div className="space-y-3">
                {tagStatesArray.fields.map((field, index) => {
                  const tag = sortedTags.find((item) => item.id === field.tagId)
                  const tagPools = [...(pools.data ?? [])]
                    .filter((item) => item.tagId === field.tagId)
                    .sort((left, right) => left.name.localeCompare(right.name, 'ru'))
                  const selectedPoolId = form.watch(`tagStates.${index}.activePoolId`)
                  const selectedPool = tagPools.find((pool) => pool.id === selectedPoolId)
                  const availablePoolQuestions = (selectedPool?.entries ?? [])
                    .slice()
                    .sort((left, right) => left.position - right.position)
                    .map((entry) => ({ entry, question: questionById.get(entry.questionId) }))
                    .filter(
                      (item): item is { entry: QuestionPoolResponse['entries'][number]; question: QuestionResponse } => Boolean(item.question),
                    )
                    .filter(
                      (item) => item.entry.isEnabled && item.question.isActive && !item.question.isArchived,
                    )
                  const rotationChoices = availablePoolQuestions.map((item, questionIndex) => ({
                    value: String(questionIndex),
                    label: `Начать с: ${item.question.title}`,
                  }))
                  const currentOffset = Number(form.watch(`tagStates.${index}.rotationOffset`) ?? 0)
                  const normalizedOffset =
                    rotationChoices.length > 0 ? ((currentOffset % rotationChoices.length) + rotationChoices.length) % rotationChoices.length : 0

                  return (
                    <div key={field.id} className="rounded-3xl border border-border bg-background/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <TagChip name={tag?.name ?? field.tagId} color={tag?.color ?? '#64748b'} />
                        <div className="flex flex-wrap gap-2">
                          <Badge>{selectionModeLabel(form.watch(`tagStates.${index}.selectionMode`))}</Badge>
                          {tag && !tag.isActive ? <Badge tone="warning">Тег выключен глобально</Badge> : null}
                          {!selectedPoolId ? <Badge tone="warning">Пул не выбран</Badge> : null}
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Field label="Активный пул">
                          <Select {...form.register(`tagStates.${index}.activePoolId`)}>
                            <option value="">Нет активного пула</option>
                            {tagPools.map((pool) => (
                              <option key={pool.id} value={pool.id}>
                                {pool.name}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label={labelWithHelp('Смещение ротации', HELP_TEXTS.rotationOffset)}>
                          <Select
                            value={rotationChoices.length > 0 ? String(normalizedOffset) : ''}
                            onChange={(event) =>
                              form.setValue(`tagStates.${index}.rotationOffset`, Number(event.target.value), {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                            disabled={rotationChoices.length === 0}
                          >
                            {rotationChoices.length === 0 ? (
                              <option value="">{selectedPoolId ? 'В пуле нет доступных вопросов' : 'Сначала выберите пул'}</option>
                            ) : null}
                            {rotationChoices.map((choice) => (
                              <option key={choice.value} value={choice.value}>
                                {choice.label}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <Field label="Участие тега">
                          <Input value={selectedPoolId ? 'Тег участвует через выбранный пул' : 'Тег не участвует в этом профиле'} readOnly />
                        </Field>
                        <Field label={labelWithHelp('Режим выбора', HELP_TEXTS.rotationSelectionMode)}>
                          <Select {...form.register(`tagStates.${index}.selectionMode`)}>
                            <option value="PoolSlotRotation">Ротация по слотам пула</option>
                          </Select>
                        </Field>
                      </div>
                    </div>
                  )
                })}
              </div>
              <Button type="submit" className="w-full" disabled={saveProfile.isPending}>
                {saveProfile.isPending ? 'Сохранение...' : selected ? 'Сохранить профиль' : 'Создать профиль'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <span>Предпросмотр ротации</span>
              <HelpBadge text={HELP_TEXTS.rotationPreview} />
            </CardTitle>
            <CardDescription>Показывает, какой вопрос откроет каждый QR по текущей конфигурации.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-3xl border border-border">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">QR</th>
                    <th className="px-4 py-3">Слаг</th>
                    <th className="px-4 py-3">Тег</th>
                    <th className="px-4 py-3">Вопрос</th>
                    <th className="px-4 py-3">Решение</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.data?.map((row) => {
                    const tag = sortedTags.find((item) => item.id === row.tagId)
                    return (
                      <tr key={row.qrCodeId}>
                        <td className="px-4 py-3 font-medium text-foreground">{row.qrLabel}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.qrSlug}</td>
                        <td className="px-4 py-3">{tag ? <TagChip name={row.tagName} color={tag.color} /> : row.tagName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.questionTitle ?? '—'}</td>
                        <td className="px-4 py-3">
                          <Badge tone={row.resolutionMode.includes('Override') ? 'warning' : 'info'}>{routingResolutionLabel(row.resolutionMode)}</Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <span>Переопределение QR</span>
              <HelpBadge text={HELP_TEXTS.rotationOverride} />
            </CardTitle>
            <CardDescription>Удалить из списка можно только переопределения, созданные в этой сессии.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-4" onSubmit={overrideForm.handleSubmit((values) => createOverride.mutate(values))}>
              <Field label="QR-код">
                <Select {...overrideForm.register('qrCodeId')}>
                  <option value="">Выберите QR</option>
                  {qrCodes.data?.map((qrCode) => (
                    <option key={qrCode.id} value={qrCode.id}>
                      {qrCode.label} ({qrCode.slug})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Вопрос">
                <Select {...overrideForm.register('questionId')}>
                  <option value="">Выберите вопрос</option>
                  {questions.data?.map((question) => (
                    <option key={question.id} value={question.id}>
                      {question.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Профиль действия">
                <Select {...overrideForm.register('scopeProfileId')}>
                  <option value="">Глобальное переопределение</option>
                  {profiles.data?.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Причина">
                <Textarea rows={3} {...overrideForm.register('reason')} />
              </Field>
              <ToggleField label="Переопределение активно" {...overrideForm.register('isActive')} checked={overrideForm.watch('isActive')} />
              <Button type="submit" className="w-full" disabled={createOverride.isPending}>
                {createOverride.isPending ? 'Создание...' : 'Создать переопределение'}
              </Button>
            </form>
            <Divider />
            <div className="space-y-3">
              {localOverrides.length > 0 ? (
                localOverrides.map((override) => (
                  <div key={override.id} className="rounded-3xl border border-border bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">Переопределение {override.id}</p>
                        <p className="text-xs text-muted-foreground">{override.reason || 'Причина не указана'}</p>
                      </div>
                      <Button variant="danger" size="sm" onClick={() => clearOverride.mutate(override.id)}>
                        Сбросить
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title="Нет переопределений" description="Создайте переопределение — оно появится в списке." />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

export function AdminEnigmaPage() {
  const queryClient = useQueryClient()
  const tags = useQuery({ queryKey: queryKeys.adminTags, queryFn: adminApi.tags })
  const profiles = useQuery({ queryKey: queryKeys.adminEnigmaProfiles, queryFn: adminApi.enigmaProfiles })
  const [selectedId, setSelectedId] = useState<Id | 'new'>('new')
  const form = useForm<EnigmaFormInput, undefined, EnigmaFormValues>({
    resolver: zodResolver(enigmaSchema),
    defaultValues: defaultEnigmaForm(),
  })
  const rotorsArray = useFieldArray({ control: form.control, name: 'rotors' })
  const selected = profiles.data?.find((item) => item.id === selectedId)
  const sortedTags = useMemo(
    () => [...(tags.data ?? [])].sort((left, right) => left.name.localeCompare(right.name, 'ru')),
    [tags.data],
  )

  useEffect(() => {
    form.reset(selected ? enigmaProfileToForm(selected) : defaultEnigmaForm())
  }, [form, selected])

  const saveProfile = useMutation({
    mutationFn: (values: EnigmaFormValues) => (selected ? adminApi.updateEnigmaProfile(selected.id, toEnigmaPayload(values)) : adminApi.createEnigmaProfile(toEnigmaPayload(values))),
    onSuccess: async (result) => {
      toast.success(selected ? 'Профиль Enigma обновлён' : 'Профиль Enigma создан')
      setSelectedId(result.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminEnigmaProfiles })
    },
    onError: (error) => handleMutationError(error, 'Не удалось сохранить профиль Enigma'),
  })

  const activateProfile = useMutation({
    mutationFn: (id: Id) => adminApi.activateEnigmaProfile(id),
    onSuccess: async () => {
      toast.success('Профиль Enigma активирован')
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminEnigmaProfiles })
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminSettings })
    },
    onError: (error) => handleMutationError(error, 'Не удалось активировать профиль Enigma'),
  })

  if (tags.isPending || profiles.isPending) {
    return <LoadingScreen label="Загружаю профили Enigma..." />
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-4">
        <PageHeader
          title="Профили Enigma"
          description="Здесь настраиваются роторы, секретная комбинация и единый кулдаун попыток."
          actions={
            <Button onClick={() => setSelectedId('new')} disabled={selectedId === 'new'}>
              Новый профиль
            </Button>
          }
        />
        <div className="space-y-3">
          {profiles.data?.map((profile) => (
            <AdminListCard
              key={profile.id}
              title={profile.name}
              description={`${profile.rotors.length} роторов`}
              isActive={profile.isActive}
              selected={selectedId === profile.id}
              onSelect={() => setSelectedId(profile.id)}
              badges={
                <Button size="sm" variant="outline" onClick={() => activateProfile.mutate(profile.id)} disabled={profile.isActive}>
                  {profile.isActive ? 'Текущий профиль' : 'Сделать текущим'}
                </Button>
              }
            />
          ))}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{selected ? 'Профиль Enigma' : 'Новый профиль Enigma'}</CardTitle>
            <CardDescription>Кулдаун живой игры берётся из активного профиля Enigma, а не из глобальных настроек.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit((values) => saveProfile.mutate(values))}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Название">
                <Input {...form.register('name')} />
              </Field>
              <Field label="Режим">
                  <Select {...form.register('mode')}>
                  <option value="SimpleCombination">Простая комбинация</option>
                  <option value="HistoricalLike">Исторический</option>
                  </Select>
              </Field>
                <Field label="Кулдаун попытки (минуты)">
                <Input type="number" {...form.register('attemptCooldownMinutes')} />
              </Field>
              <ToggleField label="Профиль активен" {...form.register('isActive')} checked={form.watch('isActive')} />
            </div>
            <Field
              label="Текст расшифровки (успех)"
              hint="Показывается на «бумаге»: при верной комбинации — как есть; при ошибке — в замаскированном виде (игроки не видят настоящий текст)."
            >
              <Textarea rows={3} {...form.register('successMessage')} />
            </Field>
            <Field
              label="Текст уведомления после ошибки"
              hint="Короткий текст для всплывающего уведомления после анимации (на бумаге не используется)."
            >
              <Textarea rows={3} {...form.register('failureMessage')} />
            </Field>
            <Divider />
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Роторы</h3>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  rotorsArray.append({
                    tagId: '',
                    label: '',
                    colorOverride: '',
                    displayOrder: rotorsArray.fields.length,
                    positionMin: 0,
                    positionMax: 9,
                    isActive: true,
                    secretPosition: 0,
                  })
                }
              >
                Добавить ротор
              </Button>
            </div>
            {rotorsArray.fields.length === 0 ? (
              <EmptyState title="Роторов пока нет" description="Добавьте роторы для экрана Enigma у участников." />
            ) : (
              <div className="space-y-3">
                {rotorsArray.fields.map((field, index) => (
                  <div key={field.id} className="rounded-3xl border border-border bg-background/70 p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Тег">
                        <Select {...form.register(`rotors.${index}.tagId`)}>
                          <option value="">Выберите тег</option>
                          {sortedTags.map((tag) => (
                            <option key={tag.id} value={tag.id}>
                              {tag.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Подпись">
                        <Input {...form.register(`rotors.${index}.label`)} />
                      </Field>
                      <Field label="Переопределение цвета">
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={
                              /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(form.watch(`rotors.${index}.colorOverride`) ?? '')
                                ? form.watch(`rotors.${index}.colorOverride`)
                                : '#64748b'
                            }
                            onChange={(event) =>
                              form.setValue(`rotors.${index}.colorOverride`, event.target.value, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                            className="h-11 w-16 rounded-2xl border border-border bg-background p-1"
                          />
                          <Input
                            value={form.watch(`rotors.${index}.colorOverride`) ?? ''}
                            onChange={(event) =>
                              form.setValue(`rotors.${index}.colorOverride`, event.target.value, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                            placeholder="#22c55e"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              form.setValue(`rotors.${index}.colorOverride`, '', {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                          >
                            Очистить
                          </Button>
                        </div>
                      </Field>
                      <Field label="Порядок отображения">
                        <Input value={String(index + 1)} readOnly />
                      </Field>
                      <Field label="Позиция мин">
                        <Input type="number" {...form.register(`rotors.${index}.positionMin`)} />
                      </Field>
                      <Field label="Позиция макс">
                        <Input type="number" {...form.register(`rotors.${index}.positionMax`)} />
                      </Field>
                      <Field label="Секретная позиция">
                        <Input type="number" {...form.register(`rotors.${index}.secretPosition`)} />
                      </Field>
                      <ToggleField label="Ротор активен" {...form.register(`rotors.${index}.isActive`)} checked={form.watch(`rotors.${index}.isActive`)} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => index > 0 && rotorsArray.swap(index, index - 1)} disabled={index === 0}>
                        Вверх
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => index < rotorsArray.fields.length - 1 && rotorsArray.swap(index, index + 1)}
                        disabled={index === rotorsArray.fields.length - 1}
                      >
                        Вниз
                      </Button>
                      <Button type="button" variant="danger" onClick={() => rotorsArray.remove(index)}>
                        Удалить
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={saveProfile.isPending}>
              {saveProfile.isPending ? 'Сохранение...' : selected ? 'Сохранить профиль' : 'Создать профиль'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}

export function AdminQuestDayPage() {
  const queryClient = useQueryClient()
  const questDay = useQuery({ queryKey: queryKeys.adminQuestDay, queryFn: adminApi.questDay })
  const form = useForm<QuestDayMessagesFormInput, undefined, QuestDayMessagesFormValues>({
    resolver: zodResolver(questDayMessagesSchema),
    defaultValues: defaultQuestDayMessagesForm(),
  })

  useEffect(() => {
    if (!questDay.data) {
      return
    }

    form.reset({
      preStartMessage: questDay.data.status === 'NotStarted' ? questDay.data.message : 'Игра еще не началась.',
      dayClosedMessage: questDay.data.status === 'DayClosed' ? questDay.data.message : 'Игровой день завершен.',
    })
  }, [form, questDay.data])

  const updateMessages = useMutation({
    mutationFn: (values: QuestDayMessagesFormValues) => adminApi.updateQuestDayMessages(values),
    onSuccess: async () => {
      toast.success('Сообщения игрового дня обновлены')
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminQuestDay })
      await queryClient.invalidateQueries({ queryKey: queryKeys.questDayPublic })
    },
    onError: (error) => handleMutationError(error, 'Не удалось обновить сообщения игрового дня'),
  })

  const startQuest = useMutation({
    mutationFn: adminApi.startQuestDay,
    onSuccess: async () => {
      toast.success('Квест начат')
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminQuestDay })
      await queryClient.invalidateQueries({ queryKey: queryKeys.questDayPublic })
    },
    onError: (error) => handleMutationError(error, 'Не удалось начать квест'),
  })

  const finishQuest = useMutation({
    mutationFn: adminApi.finishQuestDay,
    onSuccess: async () => {
      toast.success('Игровой день завершён')
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminQuestDay })
      await queryClient.invalidateQueries({ queryKey: queryKeys.questDayPublic })
    },
    onError: (error) => handleMutationError(error, 'Не удалось завершить игровой день'),
  })

  if (questDay.isPending) {
    return <LoadingScreen label="Загружаю состояние дня..." />
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <PageHeader title="Игровой день" description="Кнопки на сервере сразу блокируют сканирования, ответы и попытки Enigma." />
        <Card>
          <CardHeader>
            <CardTitle>Текущее состояние</CardTitle>
            <CardDescription>Запуск и завершение дня — ответственные действия.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone={questDay.data?.status === 'Running' ? 'success' : 'warning'}>
                {questDay.data?.status ? questDayStatusLabel(questDay.data.status) : '—'}
              </Badge>
              {questDay.data?.startedAt ? <Badge>Старт: {formatDateTime(questDay.data.startedAt)}</Badge> : null}
              {questDay.data?.endedAt ? <Badge>Конец: {formatDateTime(questDay.data.endedAt)}</Badge> : null}
            </div>
            <AlertBox tone="info" title="Сообщение для участников" description={questDay.data?.message ?? '—'} />
            <div className="grid gap-3 md:grid-cols-2">
              <Button
                variant="default"
                onClick={() => {
                  if (window.confirm('Запустить квест сейчас?')) {
                    startQuest.mutate()
                  }
                }}
              >
                <Play className="h-4 w-4" />
                Запустить квест
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (window.confirm('Завершить игровой день?')) {
                    finishQuest.mutate()
                  }
                }}
              >
                <StopCircle className="h-4 w-4" />
                Завершить день
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Сообщения для участников</CardTitle>
          <CardDescription>Тексты до старта и после закрытия дня.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit((values) => updateMessages.mutate(values))}>
            <Field label="Сообщение до старта">
              <Textarea rows={5} {...form.register('preStartMessage')} />
            </Field>
            <Field label="Сообщение после закрытия">
              <Textarea rows={5} {...form.register('dayClosedMessage')} />
            </Field>
            <Button type="submit" className="w-full" disabled={updateMessages.isPending}>
              {updateMessages.isPending ? 'Сохранение...' : 'Сохранить сообщения'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}

export function AdminSettingsPage() {
  const queryClient = useQueryClient()
  const settings = useQuery({ queryKey: queryKeys.adminSettings, queryFn: adminApi.globalSettings })
  const routingProfiles = useQuery({ queryKey: queryKeys.adminRoutingProfiles, queryFn: adminApi.routingProfiles })
  const enigmaProfiles = useQuery({ queryKey: queryKeys.adminEnigmaProfiles, queryFn: adminApi.enigmaProfiles })
  const questDay = useQuery({ queryKey: queryKeys.adminQuestDay, queryFn: adminApi.questDay })
  const form = useForm<SettingsFormInput, undefined, SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: defaultSettingsForm(),
  })
  const watchedTimezone = form.watch('timezone')
  const timezoneOptions = useMemo(() => buildTimezoneOptions(watchedTimezone), [watchedTimezone])
  const currentRoutingProfile = routingProfiles.data?.find((profile) => profile.id === settings.data?.currentRoutingProfileId)
  const currentEnigmaProfile = enigmaProfiles.data?.find((profile) => profile.id === settings.data?.currentEnigmaProfileId)

  useEffect(() => {
    form.reset(defaultSettingsForm(settings.data))
  }, [form, settings.data])

  const saveSettings = useMutation({
    mutationFn: (values: SettingsFormValues) =>
      adminApi.updateGlobalSettings({
        answerCooldownMinutes: values.answerCooldownMinutes,
        enigmaCooldownMinutes: settings.data?.enigmaCooldownMinutes ?? values.enigmaCooldownMinutes,
        maxTeamMembers: values.maxTeamMembers,
        defaultAnswerNormalization: values.defaultAnswerNormalization,
        currentQuestDayStateId: settings.data?.currentQuestDayStateId ?? normalizeOptional(values.currentQuestDayStateId),
        currentRoutingProfileId: normalizeOptional(values.currentRoutingProfileId),
        currentEnigmaProfileId: normalizeOptional(values.currentEnigmaProfileId),
        flagsJson: values.flagsJson,
        timezone: values.timezone,
      }),
    onSuccess: async () => {
      toast.success('Глобальные настройки обновлены')
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminSettings })
    },
    onError: (error) => handleMutationError(error, 'Не удалось обновить настройки'),
  })

  if (settings.isPending || routingProfiles.isPending || enigmaProfiles.isPending || questDay.isPending) {
    return <LoadingScreen label="Загружаю настройки..." />
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-4">
        <PageHeader title="Глобальные настройки" description="Глобальные параметры, технические ссылки и служебные флаги." />
        <Card>
          <CardHeader>
            <CardTitle>Текущие ссылки</CardTitle>
            <CardDescription>Здесь показано, какие конфигурации сейчас привязаны к живой игре.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <KeyValue label="ID настроек" value={settings.data?.id ?? '—'} />
            <KeyValue
              label="Текущий профиль ротации"
              value={currentRoutingProfile ? `${currentRoutingProfile.name} · ${currentRoutingProfile.id}` : 'Не выбран'}
            />
            <KeyValue
              label="Текущий профиль Enigma"
              value={currentEnigmaProfile ? `${currentEnigmaProfile.name} · ${currentEnigmaProfile.id}` : 'Не выбран'}
            />
            <KeyValue
              label="Игровой день"
              value={questDay.data ? `${questDayStatusLabel(questDay.data.status)} · ${questDay.data.id}` : settings.data?.currentQuestDayStateId ?? '—'}
            />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Редактирование настроек</CardTitle>
          <CardDescription>Проверяйте JSON-ввод внимательно: интерфейс проверяет только базовую форму данных.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit((values) => saveSettings.mutate(values))}>
            <AlertBox
              tone="info"
              title="Кулдаун Enigma"
              description="Кулдаун попыток Enigma теперь настраивается в активном профиле Enigma. Глобальное поле оставлено только для совместимости."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Кулдаун ответов (минуты)">
                <Input type="number" {...form.register('answerCooldownMinutes')} />
              </Field>
              <Field
                label="Макс. участников в команде"
                hint="Включая создателя; ограничивает вступление по секрету."
              >
                <Input type="number" min={1} max={100} {...form.register('maxTeamMembers')} />
              </Field>
              <Field label="Профиль ротации">
                <Select {...form.register('currentRoutingProfileId')}>
                  <option value="">Не указано</option>
                  {routingProfiles.data?.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Профиль Enigma">
                <Select {...form.register('currentEnigmaProfileId')}>
                  <option value="">Не указано</option>
                  {enigmaProfiles.data?.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label={labelWithHelp('ID состояния игрового дня', HELP_TEXTS.settingsQuestDayStateId)}>
              <Input value={settings.data?.currentQuestDayStateId ?? ''} readOnly />
            </Field>
            <Field label={labelWithHelp('Часовой пояс', HELP_TEXTS.settingsTimezone)}>
              <Select {...form.register('timezone')}>
                {timezoneOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Нормализация ответов по умолчанию">
              <Textarea rows={6} {...form.register('defaultAnswerNormalization')} />
            </Field>
            <Field label={labelWithHelp('Флаги (JSON)', HELP_TEXTS.settingsFlags)} hint="Редактируйте только для редких технических сценариев.">
              <Textarea rows={6} {...form.register('flagsJson')} />
            </Field>
            <Button type="submit" className="w-full" disabled={saveSettings.isPending}>
              {saveSettings.isPending ? 'Сохранение...' : 'Сохранить настройки'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}

export function AdminProfilePage() {
  const queryClient = useQueryClient()
  const session = useAdminSession()
  const isSuper = session.data?.role === 'SuperAdmin'

  const profileForm = useForm<AdminProfileFormInput, undefined, AdminProfileFormValues>({
    resolver: zodResolver(adminProfileSchema),
    defaultValues: {
      currentPassword: '',
      newLogin: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const createForm = useForm<CreateAdminFormInput, undefined, CreateAdminFormValues>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: {
      login: '',
      password: '',
      confirmPassword: '',
      role: 'Editor',
    },
  })

  const users = useQuery({
    queryKey: queryKeys.adminUsers,
    queryFn: adminApi.adminUsers,
    enabled: Boolean(isSuper),
    retry: false,
  })

  const updateProfile = useMutation({
    mutationFn: (values: AdminProfileFormValues) =>
      adminApi.updateAdminProfile({
        currentPassword: values.currentPassword,
        newLogin: normalizeOptional(values.newLogin),
        newPassword: normalizeOptional(values.newPassword),
      }),
    onSuccess: async () => {
      toast.success('Профиль обновлён')
      profileForm.reset({
        currentPassword: '',
        newLogin: '',
        newPassword: '',
        confirmPassword: '',
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminSession })
      if (isSuper) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers })
      }
    },
    onError: (error) => handleMutationError(error, 'Не удалось обновить профиль'),
  })

  const createAdmin = useMutation({
    mutationFn: (values: CreateAdminFormValues) =>
      adminApi.createAdminUser({
        login: values.login.trim(),
        password: values.password,
        role: values.role,
      }),
    onSuccess: async () => {
      toast.success('Администратор создан')
      createForm.reset({ login: '', password: '', confirmPassword: '', role: 'Editor' })
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers })
    },
    onError: (error) => handleMutationError(error, 'Не удалось создать администратора'),
  })

  if (session.isPending) {
    return <LoadingScreen label="Загружаю сессию..." />
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Профиль администратора"
        description="Смена логина и пароля. Создание учёток доступно только суперадминистратору."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Мой логин и пароль</CardTitle>
            <CardDescription>Текущий пароль обязателен. Можно изменить только логин, только пароль или оба поля.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={profileForm.handleSubmit((v) => updateProfile.mutate(v))}>
              <Field label="Текущий пароль" error={profileForm.formState.errors.currentPassword?.message}>
                <Input type="password" autoComplete="current-password" {...profileForm.register('currentPassword')} />
              </Field>
              <Field label="Новый логин (необязательно)" error={profileForm.formState.errors.newLogin?.message}>
                <Input autoComplete="username" {...profileForm.register('newLogin')} placeholder="оставьте пустым, если не меняете" />
              </Field>
              <Field label="Новый пароль (необязательно)" error={profileForm.formState.errors.newPassword?.message}>
                <Input type="password" autoComplete="new-password" {...profileForm.register('newPassword')} />
              </Field>
              <Field label="Повторите новый пароль" error={profileForm.formState.errors.confirmPassword?.message}>
                <Input type="password" autoComplete="new-password" {...profileForm.register('confirmPassword')} />
              </Field>
              <Button type="submit" className="w-full" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? 'Сохранение...' : 'Сохранить изменения'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {isSuper ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Новый администратор</CardTitle>
                <CardDescription>Логин должен быть уникальным. Пароль не короче 8 символов.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={createForm.handleSubmit((v) => createAdmin.mutate(v))}>
                  <Field label="Логин" error={createForm.formState.errors.login?.message}>
                    <Input autoComplete="off" {...createForm.register('login')} />
                  </Field>
                  <Field label="Роль">
                    <Select {...createForm.register('role')}>
                      <option value="Editor">Редактор</option>
                      <option value="Support">Поддержка</option>
                      <option value="SuperAdmin">Суперадмин</option>
                    </Select>
                  </Field>
                  <Field label="Пароль" error={createForm.formState.errors.password?.message}>
                    <Input type="password" autoComplete="new-password" {...createForm.register('password')} />
                  </Field>
                  <Field label="Повторите пароль" error={createForm.formState.errors.confirmPassword?.message}>
                    <Input type="password" autoComplete="new-password" {...createForm.register('confirmPassword')} />
                  </Field>
                  <Button type="submit" className="w-full" disabled={createAdmin.isPending}>
                    {createAdmin.isPending ? 'Создаю...' : 'Создать администратора'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Все администраторы</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {users.isPending ? <p className="text-sm text-muted-foreground">Загрузка...</p> : null}
                {users.error ? (
                  <AlertBox tone="danger" title="Не удалось загрузить список" description="Возможно, недостаточно прав." />
                ) : null}
                {users.data?.length === 0 ? <EmptyState title="Нет записей" description="Создайте первого администратора формой выше." /> : null}
                <ul className="space-y-2">
                  {(users.data ?? []).map((u) => (
                    <li
                      key={u.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border px-4 py-3 text-sm"
                    >
                      <span className="font-medium">{u.login}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={u.isActive ? 'success' : 'warning'}>{u.isActive ? 'Активен' : 'Выключен'}</Badge>
                        <Badge>{adminRoleLabel(u.role)}</Badge>
                      </div>
                      {u.lastLoginAt ? (
                        <span className="w-full text-xs text-muted-foreground">Последний вход: {formatDateTime(u.lastLoginAt)}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Управление администраторами</CardTitle>
              <CardDescription>Только суперадминистратор может создавать учётки и видеть полный список.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </section>
  )
}

export function AdminSupportTeamsPage() {
  const teams = useQuery({ queryKey: queryKeys.adminSupportTeams, queryFn: adminApi.supportTeams })
  const [search, setSearch] = useState('')

  if (teams.isPending) {
    return <LoadingScreen label="Загружаю команды..." />
  }

  const filtered = (teams.data ?? []).filter((team) =>
    `${team.name} ${team.status}`.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <section className="space-y-6">
      <PageHeader title="Команды" description="Ручные операции по вопросам команды, участникам и журналу событий." />
      <SearchField value={search} onChange={setSearch} placeholder="Поиск команд..." />
      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((team) => (
          <Card key={team.id}>
            <CardHeader>
              <CardTitle>{team.name}</CardTitle>
              <CardDescription>Участников: {team.members.length}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge>{teamStatusLabel(team.status)}</Badge>
                {team.isLocked ? <Badge tone="warning">Заблокирована</Badge> : null}
                {team.isDisqualified ? <Badge tone="danger">Дисквалифицирована</Badge> : null}
                {team.enigmaSolved ? (
                  <Badge tone="success">
                    Энигма пройдена
                    {team.enigmaSolvedAt ? ` · ${formatDateTime(team.enigmaSolvedAt)}` : ''}
                  </Badge>
                ) : null}
                {team.finalTaskPhotoUploadedAt || team.finalTaskPhotoUrl ? (
                  <Badge tone="info">Фотография выгружена</Badge>
                ) : null}
              </div>
              <Button asChild className="w-full">
                <Link to={`/admin/support/teams/${team.id}`}>Открыть команду</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

export function AdminSupportTeamDetailsPage() {
  const queryClient = useQueryClient()
  const { teamId = '' } = useParams()
  const details = useQuery({ queryKey: queryKeys.adminSupportTeam(teamId), queryFn: () => adminApi.supportTeam(teamId) })
  const [passwordResetTarget, setPasswordResetTarget] = useState<{ participantId: Id; displayName: string } | null>(null)
  const passwordResetForm = useForm<ParticipantPasswordResetFormValues>({
    resolver: zodResolver(participantPasswordResetSchema),
    defaultValues: { newPassword: '', confirmPassword: '', reason: '' },
  })

  const resetParticipantPassword = useMutation({
    mutationFn: (args: { participantId: Id; values: ParticipantPasswordResetFormValues }) =>
      adminApi.resetParticipantPassword(args.participantId, {
        newPassword: args.values.newPassword,
        reason: args.values.reason?.trim() || undefined,
      }),
    onSuccess: async () => {
      toast.success('Пароль участника обновлён')
      setPasswordResetTarget(null)
      passwordResetForm.reset()
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminSupportTeam(teamId) })
    },
    onError: (error) => handleMutationError(error, 'Не удалось сбросить пароль'),
  })

  if (details.isPending) {
    return <LoadingScreen label="Загружаю данные команды..." />
  }

  if (!details.data) {
    return <EmptyState title="Команда не найдена" description="Сервер не вернул данные по этой команде." />
  }

  const runQuestionAction = async (questionId: Id, title: string, action: 'unlock' | 'close' | 'solve' | 'unsolve') => {
    const actionCopy = {
      unlock: {
        prompt: `Причина для журнала при открытии вопроса «${title}» (необязательно):`,
        confirm: `Открыть вопрос «${title}» для команды?`,
        success: 'Вопрос открыт',
      },
      close: {
        prompt: `Причина для журнала при закрытии вопроса «${title}» (необязательно):`,
        confirm: `Закрыть вопрос «${title}»? Если вопрос был решён, решение тоже будет снято.`,
        success: 'Вопрос закрыт',
      },
      solve: {
        prompt: `Причина для журнала при зачёте решения вопроса «${title}» (необязательно):`,
        confirm: `Засчитать вопрос «${title}» решённым?`,
        success: 'Решение засчитано',
      },
      unsolve: {
        prompt: `Причина для журнала при отзыве решения вопроса «${title}» (необязательно):`,
        confirm: `Отозвать решение для вопроса «${title}»?`,
        success: 'Решение отозвано',
      },
    } as const

    const reason = window.prompt(actionCopy[action].prompt, '')
    if (reason === null) {
      return
    }
    if (!window.confirm(actionCopy[action].confirm)) {
      return
    }

    try {
      if (action === 'unlock') {
        await adminApi.unlockQuestion(teamId, questionId, { reason })
      }

      if (action === 'close') {
        await adminApi.closeQuestion(teamId, questionId, { reason })
      }

      if (action === 'solve') {
        await adminApi.solveQuestion(teamId, questionId, { reason })
      }

      if (action === 'unsolve') {
        await adminApi.unsolveQuestion(teamId, questionId, { reason })
      }

      toast.success(actionCopy[action].success)
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminSupportTeam(teamId) })
    } catch (error) {
      handleMutationError(error, 'Не удалось выполнить действие по вопросу')
    }
  }

  const removeMember = async (membershipId: Id, displayName: string) => {
    const reason = window.prompt(`Причина исключения участника «${displayName}» (необязательно):`, '')
    if (reason === null) {
      return
    }
    if (!window.confirm(`Исключить участника «${displayName}» из команды?`)) {
      return
    }

    try {
      await adminApi.removeMember(teamId, membershipId, { reason })
      toast.success('Участник удалён')
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminSupportTeam(teamId) })
    } catch (error) {
      handleMutationError(error, 'Не удалось исключить участника')
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader title={`Команда: ${details.data.team.name}`} description="Ручные действия выполняются сразу и попадают в журнал команды." />
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Состояние команды</CardTitle>
              <CardDescription>Состав и флаги.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge>{teamStatusLabel(details.data.team.status)}</Badge>
                {details.data.team.isLocked ? <Badge tone="warning">Заблокирована</Badge> : null}
                {details.data.team.isDisqualified ? <Badge tone="danger">Дисквалифицирована</Badge> : null}
                {details.data.team.isHidden ? <Badge tone="info">Скрыта</Badge> : null}
                {details.data.team.enigmaSolved ? (
                  <Badge tone="success">
                    Энигма пройдена
                    {details.data.team.enigmaSolvedAt ? ` · ${formatDateTime(details.data.team.enigmaSolvedAt)}` : ''}
                  </Badge>
                ) : null}
                {details.data.team.finalTaskPhotoUploadedAt || details.data.team.finalTaskPhotoUrl ? (
                  <Badge tone="info">Фотография выгружена</Badge>
                ) : null}
              </div>
              <div className="space-y-3">
                {details.data.team.members.map((member) => (
                  <div key={member.membershipId} className="rounded-2xl border border-border bg-background/70 p-4 sm:p-5">
                    <div className="flex min-w-0 items-start gap-3">
                        <MemberAvatar displayName={member.displayName} avatarUrl={member.avatarUrl} size="sm" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-start gap-2 font-medium text-foreground">
                            <span className="min-w-0 break-words">{member.displayName}</span>
                            {details.data.team.createdByParticipantId &&
                            member.participantId === details.data.team.createdByParticipantId ? (
                              <Badge tone="info">Капитан</Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Вступил {formatShortDateTime(member.joinedAt)}
                            {member.provider !== 'local' ? ` · ${member.provider}` : null}
                          </p>
                        </div>
                      </div>
                    <div className="mt-4 flex min-h-10 flex-wrap gap-2 sm:justify-end">
                        {member.provider === 'local' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() => {
                              passwordResetForm.reset({ newPassword: '', confirmPassword: '', reason: '' })
                              setPasswordResetTarget({ participantId: member.participantId, displayName: member.displayName })
                            }}
                          >
                            Сброс пароля
                          </Button>
                        ) : null}
                        <Button variant="danger" size="sm" className="shrink-0" onClick={() => removeMember(member.membershipId, member.displayName)}>
                          Удалить
                        </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Финальное фото</CardTitle>
              <CardDescription>Фотография после Enigma (одна на команду).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {details.data.team.finalTaskPhotoUrl ? (
                <>
                  <img
                    src={details.data.team.finalTaskPhotoUrl}
                    alt="Финальное фото команды"
                    className="max-h-80 w-full rounded-2xl border border-border object-contain"
                  />
                  <a
                    className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
                    href={details.data.team.finalTaskPhotoUrl}
                    download
                  >
                    Скачать
                  </a>
                  {details.data.team.finalTaskPhotoUploadedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Выгружено {formatDateTime(details.data.team.finalTaskPhotoUploadedAt)}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Фото не загружено.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Вопросы</CardTitle>
              <CardDescription>Все вопросы, доступные по текущей ротации, плюс уже открытые для этой команды.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {details.data.questions.length === 0 ? (
                <EmptyState title="Нет доступных вопросов" description="Сейчас для команды нет вопросов по текущей ротации и ранее открытых записей." />
              ) : (
                details.data.questions.map((question) => {
                  const stateMeta = SUPPORT_QUESTION_STATE_META[question.state]

                  return (
                    <div key={question.id} className="rounded-3xl border border-border bg-background/70 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <p className="font-semibold text-foreground">{question.title}</p>
                          <div className="flex flex-wrap gap-2">
                            <TagChip name={question.tagName} color={question.tagColor} />
                            <Badge tone={stateMeta.tone}>{stateMeta.label}</Badge>
                            {question.isAvailableNow ? <Badge tone="info">Доступен по текущей ротации</Badge> : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {question.state === 'closed' ? (
                            <Button variant="outline" size="sm" onClick={() => runQuestionAction(question.id, question.title, 'unlock')}>
                              Открыть
                            </Button>
                          ) : null}
                          {question.state === 'open' ? (
                            <>
                              <Button variant="outline" size="sm" onClick={() => runQuestionAction(question.id, question.title, 'solve')}>
                                Засчитать решённым
                              </Button>
                              <Button variant="danger" size="sm" onClick={() => runQuestionAction(question.id, question.title, 'close')}>
                                Закрыть
                              </Button>
                            </>
                          ) : null}
                          {question.state === 'solved' ? (
                            <>
                              <Button variant="outline" size="sm" onClick={() => runQuestionAction(question.id, question.title, 'unsolve')}>
                                Отозвать решение
                              </Button>
                              <Button variant="danger" size="sm" onClick={() => runQuestionAction(question.id, question.title, 'close')}>
                                Закрыть
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        {question.firstUnlockedAt ? <span>Открыт {formatDateTime(question.firstUnlockedAt)}</span> : null}
                        {question.lastAttemptAt ? <span>Последняя попытка {formatDateTime(question.lastAttemptAt)}</span> : null}
                        {question.nextAllowedAnswerAt ? <span>Кулдаун до {formatDateTime(question.nextAllowedAnswerAt)}</span> : null}
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Журнал по команде</CardTitle>
              <CardDescription>Собран из игровых событий и ручных действий администрации.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {details.data.timeline.length === 0 ? (
                <EmptyState title="Журнал пуст" description="Для этой команды пока нет зафиксированных событий." />
              ) : (
                details.data.timeline.map((entry) => (
                  <div key={entry.id} className="rounded-3xl border border-border bg-background/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{entry.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(entry.occurredAt)}</p>
                      </div>
                      <Badge tone={timelineKindTone(entry.kind)}>{timelineKindLabel(entry.kind)}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{entry.description}</p>
                    {entry.reason ? <p className="mt-2 text-xs text-muted-foreground">Причина: {entry.reason}</p> : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal
        open={passwordResetTarget !== null}
        onClose={() => {
          setPasswordResetTarget(null)
          passwordResetForm.reset()
        }}
        title={passwordResetTarget ? `Новый пароль: ${passwordResetTarget.displayName}` : undefined}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPasswordResetTarget(null)
                passwordResetForm.reset()
              }}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              form="support-participant-password-reset"
              disabled={resetParticipantPassword.isPending}
            >
              {resetParticipantPassword.isPending ? 'Сохраняю...' : 'Сохранить пароль'}
            </Button>
          </div>
        }
      >
        <form
          id="support-participant-password-reset"
          className="space-y-4"
          onSubmit={passwordResetForm.handleSubmit((values: ParticipantPasswordResetFormValues) => {
            if (!passwordResetTarget) {
              return
            }

            resetParticipantPassword.mutate({ participantId: passwordResetTarget.participantId, values })
          })}
        >
          <AlertBox
            tone="warning"
            title="Опасное действие"
            description="Сообщите участнику новый пароль отдельным безопасным каналом. Старый пароль перестанет работать сразу."
          />
          <Field label="Новый пароль" error={passwordResetForm.formState.errors.newPassword?.message}>
            <Input type="password" autoComplete="new-password" {...passwordResetForm.register('newPassword')} />
          </Field>
          <Field label="Повторите пароль" error={passwordResetForm.formState.errors.confirmPassword?.message}>
            <Input type="password" autoComplete="new-password" {...passwordResetForm.register('confirmPassword')} />
          </Field>
          <Field label="Причина (в журнал)" error={passwordResetForm.formState.errors.reason?.message}>
            <Input {...passwordResetForm.register('reason')} placeholder="например, запрос участника" />
          </Field>
        </form>
      </Modal>
    </section>
  )
}

export function AdminAuditPage() {
  const [take, setTake] = useState(200)
  const [search, setSearch] = useState('')
  const audit = useQuery({ queryKey: queryKeys.adminAudit(take), queryFn: () => adminApi.audit(take) })

  if (audit.isPending) {
    return <LoadingScreen label="Загружаю аудит..." />
  }

  const filtered = (audit.data ?? []).filter((entry) =>
    `${entry.actionType} ${entry.entityType} ${entry.entityId} ${entry.reason ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <section className="space-y-6">
      <PageHeader title="Аудит" description="Изменения конфигурации, операции поддержки и жизненный цикл." />
      <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <Field label="Записей">
          <Input type="number" value={take} onChange={(event) => setTake(Number(event.target.value || 0))} />
        </Field>
        <SearchField value={search} onChange={setSearch} placeholder="Фильтр записей..." />
      </div>
      <div className="space-y-4">
        {filtered.map((entry) => (
          <Card key={entry.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>
                    {entry.actionType} / {entry.entityType}
                  </CardTitle>
                  <CardDescription>{formatDateTime(entry.occurredAt)}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{entry.entityId}</Badge>
                  {entry.correlationId ? <Badge>{entry.correlationId}</Badge> : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {entry.reason ? <AlertBox tone="info" title="Причина" description={entry.reason} /> : null}
              <JsonBlock value={entry.diffJson} />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

export function AdminIdentityCard() {
  const session = useAdminSession()
  const logout = useAdminLogout()
  const navigate = useNavigate()

  if (!session.data) {
    return null
  }

  return (
    <Card className="border-dashed bg-background/60">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
        <div>
          <p className="font-medium text-foreground">{session.data.login}</p>
          <p className="text-xs text-muted-foreground">{session.data.role}</p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await logout.mutateAsync()
              toast.success('Вы вышли из админки')
              navigate('/', { replace: true })
            } catch {
              toast.error('Не удалось выйти')
            }
          }}
        >
          Выйти
        </Button>
      </CardContent>
    </Card>
  )
}
