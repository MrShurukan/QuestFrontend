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
import { AlertBox, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Divider, EmptyState, Input, JsonBlock, KeyValue, LoadingScreen, PageHeader, StatCard, TagChip, Textarea } from '@/shared/ui/ui'
import { formatDateTime, formatShortDateTime } from '@/shared/utils/time'

const tagSchema = z.object({
  code: z.string().trim().min(1, 'Code is required'),
  name: z.string().trim().min(2, 'Name is required'),
  color: z.string().trim().min(4, 'Color is required'),
  isActive: z.boolean(),
  sortOrder: z.coerce.number(),
  description: z.string().optional(),
})

const questionSchema = z.object({
  tagId: z.string().min(1, 'Select a tag'),
  title: z.string().trim().min(2, 'Title is required'),
  bodyRichText: z.string().trim().min(1, 'Question body is required'),
  footerHint: z.string().trim().min(1, 'Footer hint is required'),
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
  tagId: z.string().min(1, 'Select a tag'),
  name: z.string().trim().min(2, 'Name is required'),
  isActive: z.boolean(),
  isArchived: z.boolean(),
  description: z.string().optional(),
  sortOrder: z.coerce.number(),
  entries: z.array(
    z.object({
      questionId: z.string().min(1, 'Select a question'),
      position: z.coerce.number(),
      isEnabled: z.boolean(),
      notes: z.string().optional(),
    }),
  ),
})

const qrSchema = z.object({
  tagId: z.string().min(1, 'Select a tag'),
  slug: z.string().trim().min(4, 'Slug is required'),
  label: z.string().trim().min(2, 'Label is required'),
  slotIndex: z.coerce.number(),
  isActive: z.boolean(),
  notes: z.string().optional(),
})

const routingSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
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
  qrCodeId: z.string().min(1, 'Select QR'),
  questionId: z.string().min(1, 'Select question'),
  scopeProfileId: z.string().optional(),
  isActive: z.boolean(),
  reason: z.string().optional(),
})

const enigmaSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  mode: z.enum(['HistoricalLike', 'SimpleCombination']),
  isActive: z.boolean(),
  attemptCooldownMinutes: z.coerce.number().min(0),
  successMessage: z.string().trim().min(1, 'Success message is required'),
  failureMessage: z.string().trim().min(1, 'Failure message is required'),
  rotors: z.array(
    z.object({
      tagId: z.string().min(1, 'Select a tag'),
      label: z.string().trim().min(1, 'Label is required'),
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

const rewardAdjustSchema = z.object({
  tagId: z.string().min(1, 'Select a tag'),
  sourceQuestionId: z.string().optional(),
  revoke: z.boolean(),
  rewardType: z.string().trim().min(1, 'Reward type is required'),
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
type RewardAdjustInput = z.input<typeof rewardAdjustSchema>
type RewardAdjustValues = z.output<typeof rewardAdjustSchema>

function normalizeOptional(value?: string | null) {
  return value && value.trim().length > 0 ? value.trim() : null
}

function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string
  error?: string
  hint?: string
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
  label: string
  description?: string
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

function SearchField({ value, onChange, placeholder = 'Filter...' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
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
          {typeof isActive === 'boolean' ? <Badge tone={isActive ? 'success' : 'warning'}>{isActive ? 'Active' : 'Inactive'}</Badge> : null}
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
      acceptedAnswers: (values.acceptedAnswersText ?? '')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      expectedNumericValue: normalizeOptional(values.expectedNumericValue) ? Number(values.expectedNumericValue) : null,
      numericTolerance: normalizeOptional(values.numericTolerance) ? Number(values.numericTolerance) : null,
      trimWhitespace: values.trimWhitespace,
      ignoreCase: values.ignoreCase,
      collapseInnerWhitespace: values.collapseInnerWhitespace,
      removePunctuation: values.removePunctuation,
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
      position: entry.position ?? index,
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
      isEnabled: true,
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
    tagStates: values.tagStates.map((state) => ({
      tagId: state.tagId,
      activePoolId: normalizeOptional(state.activePoolId),
      rotationOffset: state.rotationOffset,
      selectionMode: state.selectionMode,
      isEnabled: state.isEnabled,
    })),
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
      colorOverride: '',
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
    successMessage: 'Success',
    failureMessage: 'Failure',
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
    rotors: values.rotors.map((rotor) => ({
      tagId: rotor.tagId,
      label: rotor.label.trim(),
      colorOverride: normalizeOptional(rotor.colorOverride),
      displayOrder: rotor.displayOrder,
      positionMin: rotor.positionMin,
      positionMax: rotor.positionMax,
      isActive: rotor.isActive,
    })),
  }
}

function defaultSettingsForm(settings?: GlobalSettingsResponse): SettingsFormValues {
  return {
    answerCooldownMinutes: settings?.answerCooldownMinutes ?? 5,
    enigmaCooldownMinutes: settings?.enigmaCooldownMinutes ?? 5,
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
    return <LoadingScreen label="Собираю admin overview..." />
  }

  return (
    <section className="space-y-6">
      <PageHeader title="Admin Overview" description="Сводка по configuration и операционным зонам backend." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Quest day" value={questDay.data?.status ?? 'n/a'} hint={questDay.data?.message} />
        <StatCard label="Tags" value={tags.data?.length ?? 0} />
        <StatCard label="Questions" value={questions.data?.length ?? 0} />
        <StatCard label="QR codes" value={qr.data?.length ?? 0} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Routing</CardTitle>
            <CardDescription>{routing.data?.length ?? 0} profiles configured.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {routing.data?.slice(0, 3).map((profile) => (
              <div key={profile.id} className="flex items-center justify-between rounded-2xl border border-border p-3 text-sm">
                <span>{profile.name}</span>
                <Badge tone={profile.isActive ? 'success' : 'default'}>{profile.isActive ? 'Active' : 'Inactive'}</Badge>
              </div>
            ))}
            <Button asChild variant="outline" className="w-full">
              <Link to="/admin/routing">Открыть routing</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Enigma</CardTitle>
            <CardDescription>{enigma.data?.length ?? 0} profiles configured.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {enigma.data?.slice(0, 3).map((profile) => (
              <div key={profile.id} className="flex items-center justify-between rounded-2xl border border-border p-3 text-sm">
                <span>{profile.name}</span>
                <Badge tone={profile.isActive ? 'success' : 'default'}>{profile.isActive ? 'Active' : 'Inactive'}</Badge>
              </div>
            ))}
            <Button asChild variant="outline" className="w-full">
              <Link to="/admin/enigma">Открыть Enigma profiles</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Support & Audit</CardTitle>
            <CardDescription>Ручные корректировки и журнал изменений.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button asChild variant="outline">
              <Link to="/admin/support/teams">Support teams</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/audit">Audit explorer</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/quest-day">Quest day console</Link>
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

  const selected = tags.data?.find((item) => item.id === selectedId)

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
      toast.success(selected ? 'Tag updated' : 'Tag created')
      setSelectedId(result.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminTags })
    },
    onError: (error) => handleMutationError(error, 'Failed to save tag'),
  })

  const filtered = useMemo(
    () =>
      (tags.data ?? []).filter((item) =>
        `${item.code} ${item.name} ${item.description ?? ''}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [search, tags.data],
  )

  if (tags.isPending) {
    return <LoadingScreen label="Loading tags..." />
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <PageHeader title="Tags" description="Базовый словарь игровых цветов и категорий вопросов." actions={<Button onClick={() => setSelectedId('new')}>Новый tag</Button>} />
        <SearchField value={search} onChange={setSearch} placeholder="Filter tags..." />
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
          <CardTitle>{selected ? 'Edit tag' : 'Create tag'}</CardTitle>
          <CardDescription>Tag color затем используется в вопросах, QR и роторах Enigma.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit((values) => saveTag.mutate(values))}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Code" error={form.formState.errors.code?.message}>
                <Input {...form.register('code')} placeholder="red" />
              </Field>
              <Field label="Name" error={form.formState.errors.name?.message}>
                <Input {...form.register('name')} placeholder="Red rotor" />
              </Field>
              <Field label="Color" error={form.formState.errors.color?.message}>
                <Input {...form.register('color')} placeholder="#ef4444" />
              </Field>
              <Field label="Sort order" error={form.formState.errors.sortOrder?.message}>
                <Input type="number" {...form.register('sortOrder')} />
              </Field>
            </div>
            <Field label="Description" error={form.formState.errors.description?.message}>
              <Textarea rows={4} {...form.register('description')} />
            </Field>
            <ToggleField label="Active tag" description="Inactive tags do not participate in routing." {...form.register('isActive')} checked={form.watch('isActive')} />
            <Button type="submit" className="w-full" disabled={saveTag.isPending}>
              <Save className="h-4 w-4" />
              {saveTag.isPending ? 'Saving...' : selected ? 'Update tag' : 'Create tag'}
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
  const form = useForm<QuestionFormInput, undefined, QuestionFormValues>({
    resolver: zodResolver(questionSchema),
    defaultValues: defaultQuestionForm(),
  })

  const selected = questions.data?.find((item) => item.id === selectedId)

  useEffect(() => {
    form.reset(selected ? questionToForm(selected) : defaultQuestionForm())
  }, [form, selected])

  const saveQuestion = useMutation({
    mutationFn: (values: QuestionFormValues) => (selected ? adminApi.updateQuestion(selected.id, toQuestionPayload(values)) : adminApi.createQuestion(toQuestionPayload(values))),
    onSuccess: async (result) => {
      toast.success(selected ? 'Question updated' : 'Question created')
      setSelectedId(result.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminQuestions })
    },
    onError: (error) => handleMutationError(error, 'Failed to save question'),
  })

  const duplicateQuestion = useMutation({
    mutationFn: (id: Id) => adminApi.duplicateQuestion(id),
    onSuccess: async (result) => {
      toast.success('Question duplicated')
      setSelectedId(result.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminQuestions })
    },
    onError: (error) => handleMutationError(error, 'Failed to duplicate question'),
  })

  const filtered = useMemo(
    () =>
      (questions.data ?? []).filter((item) =>
        `${item.title} ${item.status} ${item.supportNotes ?? ''}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [questions.data, search],
  )

  if (tags.isPending || questions.isPending) {
    return <LoadingScreen label="Loading questions..." />
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-4">
        <PageHeader title="Questions" description="Question bank, answer schema и soft-state flags." actions={<Button onClick={() => setSelectedId('new')}>Новый question</Button>} />
        <SearchField value={search} onChange={setSearch} placeholder="Filter questions..." />
        <div className="space-y-3">
          {filtered.map((question) => (
            <AdminListCard
              key={question.id}
              title={question.title}
              description={question.supportNotes}
              isActive={question.isActive}
              selected={selectedId === question.id}
              onSelect={() => setSelectedId(question.id)}
              badges={<Badge tone={question.isArchived ? 'warning' : 'info'}>{question.status}</Badge>}
            />
          ))}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{selected ? 'Edit question' : 'Create question'}</CardTitle>
          <CardDescription>Body and footer are rendered in the player UI as rich text.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit((values) => saveQuestion.mutate(values))}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Tag" error={form.formState.errors.tagId?.message}>
                <select className="flex h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm" {...form.register('tagId')}>
                  <option value="">Select tag</option>
                  {tags.data?.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status" error={form.formState.errors.status?.message}>
                <select className="flex h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm" {...form.register('status')}>
                  <option value="Draft">Draft</option>
                  <option value="Active">Active</option>
                  <option value="Disabled">Disabled</option>
                  <option value="Archived">Archived</option>
                </select>
              </Field>
            </div>
            <Field label="Title" error={form.formState.errors.title?.message}>
              <Input {...form.register('title')} />
            </Field>
            <Field label="Body rich text" error={form.formState.errors.bodyRichText?.message}>
              <Textarea rows={8} {...form.register('bodyRichText')} />
            </Field>
            <Field label="Footer hint" error={form.formState.errors.footerHint?.message}>
              <Textarea rows={4} {...form.register('footerHint')} />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Image URL" error={form.formState.errors.imageUrl?.message}>
                <Input {...form.register('imageUrl')} placeholder="https://..." />
              </Field>
              <Field label="Support notes" error={form.formState.errors.supportNotes?.message}>
                <Input {...form.register('supportNotes')} placeholder="Internal notes" />
              </Field>
            </div>
            <Divider />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Answer kind" error={form.formState.errors.answerKind?.message}>
                <select className="flex h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm" {...form.register('answerKind')}>
                  <option value="ExactText">ExactText</option>
                  <option value="NormalizedText">NormalizedText</option>
                  <option value="Numeric">Numeric</option>
                </select>
              </Field>
              <Field label="Accepted answers" hint="One answer per line" error={form.formState.errors.acceptedAnswersText?.message}>
                <Textarea rows={4} {...form.register('acceptedAnswersText')} />
              </Field>
              <Field label="Expected numeric value" error={form.formState.errors.expectedNumericValue?.message}>
                <Input {...form.register('expectedNumericValue')} placeholder="42" />
              </Field>
              <Field label="Numeric tolerance" error={form.formState.errors.numericTolerance?.message}>
                <Input {...form.register('numericTolerance')} placeholder="0.5" />
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ToggleField label="Question is active" {...form.register('isActive')} checked={form.watch('isActive')} />
              <ToggleField label="Question is archived" {...form.register('isArchived')} checked={form.watch('isArchived')} />
              <ToggleField label="Trim whitespace" {...form.register('trimWhitespace')} checked={form.watch('trimWhitespace')} />
              <ToggleField label="Ignore case" {...form.register('ignoreCase')} checked={form.watch('ignoreCase')} />
              <ToggleField label="Collapse inner whitespace" {...form.register('collapseInnerWhitespace')} checked={form.watch('collapseInnerWhitespace')} />
              <ToggleField label="Remove punctuation" {...form.register('removePunctuation')} checked={form.watch('removePunctuation')} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Button type="submit" disabled={saveQuestion.isPending}>
                <Save className="h-4 w-4" />
                {saveQuestion.isPending ? 'Saving...' : selected ? 'Update question' : 'Create question'}
              </Button>
              {selected ? (
                <Button type="button" variant="outline" onClick={() => duplicateQuestion.mutate(selected.id)} disabled={duplicateQuestion.isPending}>
                  <Copy className="h-4 w-4" />
                  Duplicate
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}

export function AdminPoolsPage() {
  const queryClient = useQueryClient()
  const tags = useQuery({ queryKey: queryKeys.adminTags, queryFn: adminApi.tags })
  const questions = useQuery({ queryKey: queryKeys.adminQuestions, queryFn: adminApi.questions })
  const pools = useQuery({ queryKey: queryKeys.adminPools, queryFn: adminApi.pools })
  const [selectedId, setSelectedId] = useState<Id | 'new'>('new')
  const form = useForm<PoolFormInput, undefined, PoolFormValues>({
    resolver: zodResolver(poolSchema),
    defaultValues: defaultPoolForm(),
  })
  const entriesArray = useFieldArray({ control: form.control, name: 'entries' })
  const selected = pools.data?.find((item) => item.id === selectedId)
  const currentTagId = form.watch('tagId')
  const availableQuestions = useMemo(
    () => (questions.data ?? []).filter((item) => (currentTagId ? item.tagId === currentTagId : true)),
    [currentTagId, questions.data],
  )

  useEffect(() => {
    form.reset(selected ? poolToForm(selected) : defaultPoolForm())
  }, [form, selected])

  const savePool = useMutation({
    mutationFn: (values: PoolFormValues) => (selected ? adminApi.updatePool(selected.id, toPoolPayload(values)) : adminApi.createPool(toPoolPayload(values))),
    onSuccess: async (result) => {
      toast.success(selected ? 'Pool updated' : 'Pool created')
      setSelectedId(result.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminPools })
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminRoutingPreview })
    },
    onError: (error) => handleMutationError(error, 'Failed to save pool'),
  })

  if (tags.isPending || questions.isPending || pools.isPending) {
    return <LoadingScreen label="Loading pools..." />
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-4">
        <PageHeader title="Question Pools" description="Pool entries полностью заменяются backend'ом при update, поэтому UI всегда refetch'ит список." actions={<Button onClick={() => setSelectedId('new')}>Новый pool</Button>} />
        <div className="space-y-3">
          {pools.data?.map((pool) => (
            <AdminListCard
              key={pool.id}
              title={pool.name}
              description={`${pool.entries.length} entries`}
              isActive={pool.isActive}
              selected={selectedId === pool.id}
              onSelect={() => setSelectedId(pool.id)}
              badges={<Badge tone={pool.isArchived ? 'warning' : 'default'}>{pool.isArchived ? 'Archived' : 'Live'}</Badge>}
            />
          ))}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{selected ? 'Edit pool' : 'Create pool'}</CardTitle>
          <CardDescription>Simple reorder UX: position field + up/down buttons per entry.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit((values) => savePool.mutate(values))}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Tag" error={form.formState.errors.tagId?.message}>
                <select className="flex h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm" {...form.register('tagId')}>
                  <option value="">Select tag</option>
                  {tags.data?.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Sort order" error={form.formState.errors.sortOrder?.message}>
                <Input type="number" {...form.register('sortOrder')} />
              </Field>
            </div>
            <Field label="Name" error={form.formState.errors.name?.message}>
              <Input {...form.register('name')} />
            </Field>
            <Field label="Description" error={form.formState.errors.description?.message}>
              <Textarea rows={4} {...form.register('description')} />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <ToggleField label="Pool is active" {...form.register('isActive')} checked={form.watch('isActive')} />
              <ToggleField label="Pool is archived" {...form.register('isArchived')} checked={form.watch('isArchived')} />
            </div>
            <Divider />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Entries</h3>
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
                  Добавить entry
                </Button>
              </div>
              {entriesArray.fields.length === 0 ? (
                <EmptyState title="Пока нет entries" description="Добавьте вопросы в нужном порядке, чтобы pool начал участвовать в routing." />
              ) : (
                entriesArray.fields.map((field, index) => (
                  <div key={field.id} className="rounded-3xl border border-border bg-background/70 p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Question">
                        <select className="flex h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm" {...form.register(`entries.${index}.questionId`)}>
                          <option value="">Select question</option>
                          {availableQuestions.map((question) => (
                            <option key={question.id} value={question.id}>
                              {question.title}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Position">
                        <Input type="number" {...form.register(`entries.${index}.position`)} />
                      </Field>
                    </div>
                    <Field label="Notes">
                      <Input {...form.register(`entries.${index}.notes`)} />
                    </Field>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ToggleField label="Enabled" {...form.register(`entries.${index}.isEnabled`)} checked={form.watch(`entries.${index}.isEnabled`)} />
                      <Button type="button" variant="outline" onClick={() => index > 0 && entriesArray.swap(index, index - 1)}>
                        Up
                      </Button>
                      <Button type="button" variant="outline" onClick={() => index < entriesArray.fields.length - 1 && entriesArray.swap(index, index + 1)}>
                        Down
                      </Button>
                      <Button type="button" variant="danger" onClick={() => entriesArray.remove(index)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <Button type="submit" className="w-full" disabled={savePool.isPending}>
              {savePool.isPending ? 'Saving...' : selected ? 'Update pool' : 'Create pool'}
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
  const form = useForm<QrFormInput, undefined, QrFormValues>({
    resolver: zodResolver(qrSchema),
    defaultValues: defaultQrForm(),
  })
  const selected = qrCodes.data?.find((item) => item.id === selectedId)
  const watchedSlug = form.watch('slug')

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
      toast.success(selected ? 'QR updated' : 'QR created')
      setSelectedId(result.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminQr })
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminRoutingPreview })
    },
    onError: (error) => handleMutationError(error, 'Failed to save QR code'),
  })

  if (tags.isPending || qrCodes.isPending) {
    return <LoadingScreen label="Loading QR codes..." />
  }

  const browserRoute = watchedSlug ? `/q/${watchedSlug}` : '/q/{slug}'

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-4">
        <PageHeader title="QR Management" description="Slug, slotIndex и client-side QR preview для печати." actions={<Button onClick={() => setSelectedId('new')}>Новый QR</Button>} />
        <div className="space-y-3">
          {qrCodes.data?.map((qrCode) => (
            <AdminListCard
              key={qrCode.id}
              title={qrCode.label}
              description={qrCode.slug}
              isActive={qrCode.isActive}
              selected={selectedId === qrCode.id}
              onSelect={() => setSelectedId(qrCode.id)}
              badges={<Badge>Slot {qrCode.slotIndex}</Badge>}
            />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{selected ? 'Edit QR code' : 'Create QR code'}</CardTitle>
          <CardDescription>Frontend owns browser route `/q/:slug`, while QR resolution JSON comes from backend API `/api/public/qr/:slug`.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => saveQr.mutate(values))}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Tag" error={form.formState.errors.tagId?.message}>
                  <select className="flex h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm" {...form.register('tagId')}>
                    <option value="">Select tag</option>
                    {tags.data?.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Slot index" error={form.formState.errors.slotIndex?.message}>
                  <Input type="number" {...form.register('slotIndex')} />
                </Field>
              </div>
              <Field label="Label" error={form.formState.errors.label?.message}>
                <Input {...form.register('label')} />
              </Field>
              <Field label="Slug" error={form.formState.errors.slug?.message}>
                <Input {...form.register('slug')} placeholder="red-a1" />
              </Field>
              <Field label="Notes" error={form.formState.errors.notes?.message}>
                <Textarea rows={4} {...form.register('notes')} />
              </Field>
              <ToggleField label="QR is active" {...form.register('isActive')} checked={form.watch('isActive')} />
              <Button type="submit" className="w-full" disabled={saveQr.isPending}>
                {saveQr.isPending ? 'Saving...' : selected ? 'Update QR' : 'Create QR'}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>QR Preview</CardTitle>
            <CardDescription>Client-side generated QR code pointing to the frontend browser route.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center rounded-3xl border border-border bg-white p-6">
              <QRCodeSVG value={browserRoute} size={200} />
            </div>
            <KeyValue label="Browser route" value={browserRoute} />
            <KeyValue label="Print label" value={form.watch('label') || 'n/a'} />
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

  useEffect(() => {
    const tagIds = (tags.data ?? []).map((tag) => tag.id)
    form.reset(selected ? routingProfileToForm(selected, tagIds) : defaultRoutingForm(tagIds))
  }, [form, selected, tags.data])

  const saveProfile = useMutation({
    mutationFn: (values: RoutingFormValues) => (selected ? adminApi.updateRoutingProfile(selected.id, toRoutingPayload(values)) : adminApi.createRoutingProfile(toRoutingPayload(values))),
    onSuccess: async (result) => {
      toast.success(selected ? 'Routing profile updated' : 'Routing profile created')
      setSelectedId(result.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminRoutingProfiles })
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminRoutingPreview })
    },
    onError: (error) => handleMutationError(error, 'Failed to save routing profile'),
  })

  const activateProfile = useMutation({
    mutationFn: (id: Id) => adminApi.activateRoutingProfile(id),
    onSuccess: async () => {
      toast.success('Routing profile activated')
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminRoutingProfiles })
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminRoutingPreview })
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminSettings })
    },
    onError: (error) => handleMutationError(error, 'Failed to activate routing profile'),
  })

  const rotateTag = useMutation({
    mutationFn: ({ tagId, step }: { tagId: Id; step: number }) => adminApi.rotateTag(tagId, step),
    onSuccess: async () => {
      toast.success('Rotation offset updated')
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminRoutingPreview })
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminRoutingProfiles })
    },
    onError: (error) => handleMutationError(error, 'Failed to rotate tag'),
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
      toast.success('Override created')
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
    onError: (error) => handleMutationError(error, 'Failed to create override'),
  })

  const clearOverride = useMutation({
    mutationFn: (id: Id) => adminApi.clearOverride(id),
    onSuccess: async (_, id) => {
      toast.success('Override cleared')
      setLocalOverrides((current) => current.filter((item) => item.id !== id))
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminRoutingPreview })
    },
    onError: (error) => handleMutationError(error, 'Failed to clear override'),
  })

  if ([tags, pools, qrCodes, questions, profiles, preview].some((item) => item.isPending)) {
    return <LoadingScreen label="Loading routing..." />
  }

  return (
    <section className="space-y-6">
      <PageHeader title="Routing" description="Profiles, preview matrix, pool rotation and QR overrides." />
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Profiles</h2>
            <Button onClick={() => setSelectedId('new')}>Новый profile</Button>
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
                  <Button type="button" size="sm" variant="outline" onClick={() => activateProfile.mutate(profile.id)}>
                    Activate
                  </Button>
                }
              />
            ))}
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{selected ? 'Edit routing profile' : 'Create routing profile'}</CardTitle>
            <CardDescription>Каждый tag получает свой active pool и rotation offset.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => saveProfile.mutate(values))}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Name" error={form.formState.errors.name?.message}>
                  <Input {...form.register('name')} />
                </Field>
                <Field label="Description" error={form.formState.errors.description?.message}>
                  <Input {...form.register('description')} />
                </Field>
              </div>
              <ToggleField label="Profile is active" {...form.register('isActive')} checked={form.watch('isActive')} />
              <Divider />
              <div className="space-y-3">
                {tagStatesArray.fields.map((field, index) => {
                  const tag = tags.data?.find((item) => item.id === field.tagId)
                  const tagPools = (pools.data ?? []).filter((item) => item.tagId === field.tagId)
                  return (
                    <div key={field.id} className="rounded-3xl border border-border bg-background/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <TagChip name={tag?.name ?? field.tagId} color={tag?.color ?? '#64748b'} />
                        <Badge>{form.watch(`tagStates.${index}.selectionMode`)}</Badge>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Field label="Active pool">
                          <select className="flex h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm" {...form.register(`tagStates.${index}.activePoolId`)}>
                            <option value="">No active pool</option>
                            {tagPools.map((pool) => (
                              <option key={pool.id} value={pool.id}>
                                {pool.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Rotation offset">
                          <Input type="number" {...form.register(`tagStates.${index}.rotationOffset`)} />
                        </Field>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <ToggleField label="Tag state enabled" {...form.register(`tagStates.${index}.isEnabled`)} checked={form.watch(`tagStates.${index}.isEnabled`)} />
                        <Field label="Selection mode">
                          <select className="flex h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm" {...form.register(`tagStates.${index}.selectionMode`)}>
                            <option value="PoolSlotRotation">PoolSlotRotation</option>
                          </select>
                        </Field>
                      </div>
                    </div>
                  )
                })}
              </div>
              <Button type="submit" className="w-full" disabled={saveProfile.isPending}>
                {saveProfile.isPending ? 'Saving...' : selected ? 'Update profile' : 'Create profile'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Routing Preview</CardTitle>
            <CardDescription>`GET /api/admin/routing/preview` is the main operational screen to verify live QR resolution.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-3xl border border-border">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">QR</th>
                    <th className="px-4 py-3">Slug</th>
                    <th className="px-4 py-3">Tag</th>
                    <th className="px-4 py-3">Question</th>
                    <th className="px-4 py-3">Resolution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.data?.map((row) => {
                    const tag = tags.data?.find((item) => item.id === row.tagId)
                    return (
                      <tr key={row.qrCodeId}>
                        <td className="px-4 py-3 font-medium text-foreground">{row.qrLabel}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.qrSlug}</td>
                        <td className="px-4 py-3">{tag ? <TagChip name={row.tagName} color={tag.color} /> : row.tagName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.questionTitle ?? 'n/a'}</td>
                        <td className="px-4 py-3">
                          <Badge tone={row.resolutionMode.includes('Override') ? 'warning' : 'info'}>{row.resolutionMode}</Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {tags.data?.map((tag) => (
                <Card key={tag.id} className="p-4">
                  <CardTitle className="flex items-center justify-between">
                    <TagChip name={tag.name} color={tag.color} />
                  </CardTitle>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => rotateTag.mutate({ tagId: tag.id, step: -1 })}>
                      -1
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => rotateTag.mutate({ tagId: tag.id, step: 1 })}>
                      +1
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>QR Override</CardTitle>
            <CardDescription>Backend currently does not expose a GET endpoint for all overrides, so only overrides created in this session are directly removable from UI.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-4" onSubmit={overrideForm.handleSubmit((values) => createOverride.mutate(values))}>
              <Field label="QR code">
                <select className="flex h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm" {...overrideForm.register('qrCodeId')}>
                  <option value="">Select QR</option>
                  {qrCodes.data?.map((qrCode) => (
                    <option key={qrCode.id} value={qrCode.id}>
                      {qrCode.label} ({qrCode.slug})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Question">
                <select className="flex h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm" {...overrideForm.register('questionId')}>
                  <option value="">Select question</option>
                  {questions.data?.map((question) => (
                    <option key={question.id} value={question.id}>
                      {question.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Scope profile">
                <select className="flex h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm" {...overrideForm.register('scopeProfileId')}>
                  <option value="">Global override</option>
                  {profiles.data?.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reason">
                <Textarea rows={3} {...overrideForm.register('reason')} />
              </Field>
              <ToggleField label="Override is active" {...overrideForm.register('isActive')} checked={overrideForm.watch('isActive')} />
              <Button type="submit" className="w-full" disabled={createOverride.isPending}>
                {createOverride.isPending ? 'Creating...' : 'Create override'}
              </Button>
            </form>
            <Divider />
            <div className="space-y-3">
              {localOverrides.length > 0 ? (
                localOverrides.map((override) => (
                  <div key={override.id} className="rounded-3xl border border-border bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">Override {override.id}</p>
                        <p className="text-xs text-muted-foreground">{override.reason || 'No reason'}</p>
                      </div>
                      <Button variant="danger" size="sm" onClick={() => clearOverride.mutate(override.id)}>
                        Clear
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title="No session overrides" description="Create an override to see it listed here and get a direct clear action." />
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

  useEffect(() => {
    form.reset(selected ? enigmaProfileToForm(selected) : defaultEnigmaForm())
  }, [form, selected])

  const saveProfile = useMutation({
    mutationFn: (values: EnigmaFormValues) => (selected ? adminApi.updateEnigmaProfile(selected.id, toEnigmaPayload(values)) : adminApi.createEnigmaProfile(toEnigmaPayload(values))),
    onSuccess: async (result) => {
      toast.success(selected ? 'Enigma profile updated' : 'Enigma profile created')
      setSelectedId(result.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminEnigmaProfiles })
    },
    onError: (error) => handleMutationError(error, 'Failed to save enigma profile'),
  })

  const activateProfile = useMutation({
    mutationFn: (id: Id) => adminApi.activateEnigmaProfile(id),
    onSuccess: async () => {
      toast.success('Enigma profile activated')
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminEnigmaProfiles })
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminSettings })
    },
    onError: (error) => handleMutationError(error, 'Failed to activate enigma profile'),
  })

  if (tags.isPending || profiles.isPending) {
    return <LoadingScreen label="Loading Enigma profiles..." />
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-4">
        <PageHeader title="Enigma Profiles" description="Configures Variant B player experience and secret combinations." actions={<Button onClick={() => setSelectedId('new')}>Новый profile</Button>} />
        <div className="space-y-3">
          {profiles.data?.map((profile) => (
            <AdminListCard
              key={profile.id}
              title={profile.name}
              description={`${profile.rotors.length} rotors`}
              isActive={profile.isActive}
              selected={selectedId === profile.id}
              onSelect={() => setSelectedId(profile.id)}
              badges={
                <Button size="sm" variant="outline" onClick={() => activateProfile.mutate(profile.id)}>
                  Activate
                </Button>
              }
            />
          ))}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{selected ? 'Edit enigma profile' : 'Create enigma profile'}</CardTitle>
          <CardDescription>Each rotor is linked to a tag and gets a secret position entry by `tagId`.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit((values) => saveProfile.mutate(values))}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name">
                <Input {...form.register('name')} />
              </Field>
              <Field label="Mode">
                <select className="flex h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm" {...form.register('mode')}>
                  <option value="SimpleCombination">SimpleCombination</option>
                  <option value="HistoricalLike">HistoricalLike</option>
                </select>
              </Field>
              <Field label="Cooldown minutes">
                <Input type="number" {...form.register('attemptCooldownMinutes')} />
              </Field>
              <ToggleField label="Profile is active" {...form.register('isActive')} checked={form.watch('isActive')} />
            </div>
            <Field label="Success message">
              <Textarea rows={3} {...form.register('successMessage')} />
            </Field>
            <Field label="Failure message">
              <Textarea rows={3} {...form.register('failureMessage')} />
            </Field>
            <Divider />
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Rotors</h3>
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
                Add rotor
              </Button>
            </div>
            {rotorsArray.fields.length === 0 ? (
              <EmptyState title="No rotors yet" description="Add rotors to define the player Enigma screen." />
            ) : (
              <div className="space-y-3">
                {rotorsArray.fields.map((field, index) => (
                  <div key={field.id} className="rounded-3xl border border-border bg-background/70 p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Tag">
                        <select className="flex h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm" {...form.register(`rotors.${index}.tagId`)}>
                          <option value="">Select tag</option>
                          {tags.data?.map((tag) => (
                            <option key={tag.id} value={tag.id}>
                              {tag.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Label">
                        <Input {...form.register(`rotors.${index}.label`)} />
                      </Field>
                      <Field label="Color override">
                        <Input {...form.register(`rotors.${index}.colorOverride`)} placeholder="#22c55e" />
                      </Field>
                      <Field label="Display order">
                        <Input type="number" {...form.register(`rotors.${index}.displayOrder`)} />
                      </Field>
                      <Field label="Position min">
                        <Input type="number" {...form.register(`rotors.${index}.positionMin`)} />
                      </Field>
                      <Field label="Position max">
                        <Input type="number" {...form.register(`rotors.${index}.positionMax`)} />
                      </Field>
                      <Field label="Secret position">
                        <Input type="number" {...form.register(`rotors.${index}.secretPosition`)} />
                      </Field>
                      <ToggleField label="Rotor is active" {...form.register(`rotors.${index}.isActive`)} checked={form.watch(`rotors.${index}.isActive`)} />
                    </div>
                    <div className="mt-3">
                      <Button type="button" variant="danger" onClick={() => rotorsArray.remove(index)}>
                        Remove rotor
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={saveProfile.isPending}>
              {saveProfile.isPending ? 'Saving...' : selected ? 'Update profile' : 'Create profile'}
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
      toast.success('Quest day messages updated')
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminQuestDay })
      await queryClient.invalidateQueries({ queryKey: queryKeys.questDayPublic })
    },
    onError: (error) => handleMutationError(error, 'Failed to update quest day messages'),
  })

  const startQuest = useMutation({
    mutationFn: adminApi.startQuestDay,
    onSuccess: async () => {
      toast.success('Quest started')
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminQuestDay })
      await queryClient.invalidateQueries({ queryKey: queryKeys.questDayPublic })
    },
    onError: (error) => handleMutationError(error, 'Failed to start quest'),
  })

  const finishQuest = useMutation({
    mutationFn: adminApi.finishQuestDay,
    onSuccess: async () => {
      toast.success('Quest day finished')
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminQuestDay })
      await queryClient.invalidateQueries({ queryKey: queryKeys.questDayPublic })
    },
    onError: (error) => handleMutationError(error, 'Failed to finish quest day'),
  })

  if (questDay.isPending) {
    return <LoadingScreen label="Loading quest day..." />
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <PageHeader title="Quest Day Lifecycle" description="Server-side buttons block scans, answers and Enigma attempts immediately." />
        <Card>
          <CardHeader>
            <CardTitle>Current state</CardTitle>
            <CardDescription>Start/finish actions are intentionally explicit and dangerous.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone={questDay.data?.status === 'Running' ? 'success' : 'warning'}>{questDay.data?.status}</Badge>
              {questDay.data?.startedAt ? <Badge>Started: {formatDateTime(questDay.data.startedAt)}</Badge> : null}
              {questDay.data?.endedAt ? <Badge>Ended: {formatDateTime(questDay.data.endedAt)}</Badge> : null}
            </div>
            <AlertBox tone="info" title="Active message" description={questDay.data?.message ?? 'n/a'} />
            <div className="grid gap-3 md:grid-cols-2">
              <Button
                variant="default"
                onClick={() => {
                  if (window.confirm('Start quest now?')) {
                    startQuest.mutate()
                  }
                }}
              >
                <Play className="h-4 w-4" />
                Start quest
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (window.confirm('Finish quest for the day?')) {
                    finishQuest.mutate()
                  }
                }}
              >
                <StopCircle className="h-4 w-4" />
                Finish day
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lifecycle messages</CardTitle>
          <CardDescription>Backend response does not currently expose both stored messages directly, so this form is the authoritative editor.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit((values) => updateMessages.mutate(values))}>
            <Field label="Pre-start message">
              <Textarea rows={5} {...form.register('preStartMessage')} />
            </Field>
            <Field label="Day-closed message">
              <Textarea rows={5} {...form.register('dayClosedMessage')} />
            </Field>
            <Button type="submit" className="w-full" disabled={updateMessages.isPending}>
              {updateMessages.isPending ? 'Saving...' : 'Update messages'}
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
  const form = useForm<SettingsFormInput, undefined, SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: defaultSettingsForm(),
  })

  useEffect(() => {
    form.reset(defaultSettingsForm(settings.data))
  }, [form, settings.data])

  const saveSettings = useMutation({
    mutationFn: (values: SettingsFormValues) =>
      adminApi.updateGlobalSettings({
        answerCooldownMinutes: values.answerCooldownMinutes,
        enigmaCooldownMinutes: values.enigmaCooldownMinutes,
        defaultAnswerNormalization: values.defaultAnswerNormalization,
        currentQuestDayStateId: normalizeOptional(values.currentQuestDayStateId),
        currentRoutingProfileId: normalizeOptional(values.currentRoutingProfileId),
        currentEnigmaProfileId: normalizeOptional(values.currentEnigmaProfileId),
        flagsJson: values.flagsJson,
        timezone: values.timezone,
      }),
    onSuccess: async () => {
      toast.success('Global settings updated')
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminSettings })
    },
    onError: (error) => handleMutationError(error, 'Failed to update settings'),
  })

  if (settings.isPending || routingProfiles.isPending || enigmaProfiles.isPending) {
    return <LoadingScreen label="Loading global settings..." />
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-4">
        <PageHeader title="Global Settings" description="JSON strings are stored as raw strings in backend, so the UI edits them as text areas." />
        <Card>
          <CardHeader>
            <CardTitle>Current references</CardTitle>
            <CardDescription>These identifiers point backend to live configuration objects.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <KeyValue label="Settings id" value={settings.data?.id ?? 'n/a'} />
            <KeyValue label="Current routing profile" value={settings.data?.currentRoutingProfileId ?? 'n/a'} />
            <KeyValue label="Current enigma profile" value={settings.data?.currentEnigmaProfileId ?? 'n/a'} />
            <KeyValue label="Current quest day state" value={settings.data?.currentQuestDayStateId ?? 'n/a'} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Edit settings</CardTitle>
          <CardDescription>Client-side validation only checks that values exist; semantic JSON correctness should still be reviewed carefully.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit((values) => saveSettings.mutate(values))}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Answer cooldown minutes">
                <Input type="number" {...form.register('answerCooldownMinutes')} />
              </Field>
              <Field label="Enigma cooldown minutes">
                <Input type="number" {...form.register('enigmaCooldownMinutes')} />
              </Field>
              <Field label="Routing profile">
                <select className="flex h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm" {...form.register('currentRoutingProfileId')}>
                  <option value="">Unspecified</option>
                  {routingProfiles.data?.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Enigma profile">
                <select className="flex h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm" {...form.register('currentEnigmaProfileId')}>
                  <option value="">Unspecified</option>
                  {enigmaProfiles.data?.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Current quest day state id">
              <Input {...form.register('currentQuestDayStateId')} />
            </Field>
            <Field label="Timezone">
              <Input {...form.register('timezone')} />
            </Field>
            <Field label="Default answer normalization">
              <Textarea rows={6} {...form.register('defaultAnswerNormalization')} />
            </Field>
            <Field label="Flags JSON">
              <Textarea rows={6} {...form.register('flagsJson')} />
            </Field>
            <Button type="submit" className="w-full" disabled={saveSettings.isPending}>
              {saveSettings.isPending ? 'Saving...' : 'Update settings'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}

export function AdminSupportTeamsPage() {
  const teams = useQuery({ queryKey: queryKeys.adminSupportTeams, queryFn: adminApi.supportTeams })
  const [search, setSearch] = useState('')

  if (teams.isPending) {
    return <LoadingScreen label="Loading support teams..." />
  }

  const filtered = (teams.data ?? []).filter((team) =>
    `${team.name} ${team.status}`.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <section className="space-y-6">
      <PageHeader title="Support Teams" description="Operational console for manual unlock/solve/revoke actions." />
      <SearchField value={search} onChange={setSearch} placeholder="Filter teams..." />
      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((team) => (
          <Card key={team.id}>
            <CardHeader>
              <CardTitle>{team.name}</CardTitle>
              <CardDescription>{team.members.length} participants</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge>{team.status}</Badge>
                {team.isLocked ? <Badge tone="warning">Locked</Badge> : null}
                {team.isDisqualified ? <Badge tone="danger">Disqualified</Badge> : null}
              </div>
              <Button asChild className="w-full">
                <Link to={`/admin/support/teams/${team.id}`}>Open support details</Link>
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
  const tags = useQuery({ queryKey: queryKeys.adminTags, queryFn: adminApi.tags })
  const rewardForm = useForm<RewardAdjustInput, undefined, RewardAdjustValues>({
    resolver: zodResolver(rewardAdjustSchema),
    defaultValues: {
      tagId: '',
      sourceQuestionId: '',
      revoke: false,
      rewardType: 'rotor',
    },
  })

  const adjustReward = useMutation({
    mutationFn: (values: RewardAdjustValues) =>
      adminApi.adjustReward(teamId, {
        tagId: values.tagId,
        sourceQuestionId: normalizeOptional(values.sourceQuestionId),
        revoke: values.revoke,
        rewardType: values.rewardType,
      }),
    onSuccess: async () => {
      toast.success('Reward adjusted')
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminSupportTeam(teamId) })
    },
    onError: (error) => handleMutationError(error, 'Failed to adjust reward'),
  })

  if (details.isPending || tags.isPending) {
    return <LoadingScreen label="Loading team support details..." />
  }

  if (!details.data) {
    return <EmptyState title="Team not found" description="The backend did not return support details for this team." />
  }

  const runQuestionAction = async (questionId: Id, action: 'unlock' | 'solve' | 'revoke-reward') => {
    const reason = window.prompt(`Reason for ${action}`, '') ?? ''
    if (!window.confirm(`Run ${action} for this team question?`)) {
      return
    }

    if (action === 'unlock') {
      await adminApi.unlockQuestion(teamId, questionId, { reason })
    }

    if (action === 'solve') {
      await adminApi.solveQuestion(teamId, questionId, { reason })
    }

    if (action === 'revoke-reward') {
      await adminApi.revokeReward(teamId, questionId, { reason })
    }

    toast.success(`Action ${action} completed`)
    await queryClient.invalidateQueries({ queryKey: queryKeys.adminSupportTeam(teamId) })
  }

  const removeMember = async (membershipId: Id) => {
    const reason = window.prompt('Reason for removal', '') ?? ''
    if (!window.confirm('Remove this member from the team?')) {
      return
    }

    await adminApi.removeMember(teamId, membershipId, { reason })
    toast.success('Member removed')
    await queryClient.invalidateQueries({ queryKey: queryKeys.adminSupportTeam(teamId) })
  }

  return (
    <section className="space-y-6">
      <PageHeader title={`Support: ${details.data.team.name}`} description="Dangerous operational actions always require explicit confirmation." />
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team state</CardTitle>
              <CardDescription>Current membership and flags.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge>{details.data.team.status}</Badge>
                {details.data.team.isLocked ? <Badge tone="warning">Locked</Badge> : null}
                {details.data.team.isDisqualified ? <Badge tone="danger">Disqualified</Badge> : null}
                {details.data.team.isHidden ? <Badge tone="info">Hidden</Badge> : null}
              </div>
              <div className="space-y-3">
                {details.data.team.members.map((member) => (
                  <div key={member.membershipId} className="rounded-2xl border border-border bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{member.displayName}</p>
                        <p className="text-xs text-muted-foreground">Joined {formatShortDateTime(member.joinedAt)}</p>
                      </div>
                      <Button variant="danger" size="sm" onClick={() => removeMember(member.membershipId)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Reward adjust</CardTitle>
              <CardDescription>Manual reward grant/revoke per tag.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={rewardForm.handleSubmit((values) => adjustReward.mutate(values))}>
                <Field label="Tag">
                  <select className="flex h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm" {...rewardForm.register('tagId')}>
                    <option value="">Select tag</option>
                    {tags.data?.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Source question id">
                  <select className="flex h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm" {...rewardForm.register('sourceQuestionId')}>
                    <option value="">Optional source question</option>
                    {details.data.questions.map((question) => (
                      <option key={question.id} value={question.id}>
                        {question.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Reward type">
                  <Input {...rewardForm.register('rewardType')} />
                </Field>
                <ToggleField label="Revoke reward instead of grant" {...rewardForm.register('revoke')} checked={rewardForm.watch('revoke')} />
                <Button type="submit" className="w-full" disabled={adjustReward.isPending}>
                  {adjustReward.isPending ? 'Applying...' : 'Apply reward adjustment'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Unlocked questions</CardTitle>
              <CardDescription>Support actions for individual team questions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {details.data.questions.map((question) => (
                <div key={question.id} className="rounded-3xl border border-border bg-background/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <p className="font-semibold text-foreground">{question.title}</p>
                      <div className="flex flex-wrap gap-2">
                        <TagChip name={question.tagName} color={question.tagColor} />
                        <Badge tone={question.isSolved ? 'success' : 'info'}>{question.isSolved ? 'Solved' : 'Open'}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => runQuestionAction(question.id, 'unlock')}>
                        Unlock
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => runQuestionAction(question.id, 'solve')}>
                        Solve
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => runQuestionAction(question.id, 'revoke-reward')}>
                        Revoke reward
                      </Button>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Unlocked {formatDateTime(question.firstUnlockedAt)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Team audit trail</CardTitle>
              <CardDescription>Latest audit entries already filtered by support service for this team context.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {details.data.auditTrail.map((entry) => (
                <div key={entry.id} className="rounded-3xl border border-border bg-background/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {entry.actionType} / {entry.entityType}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(entry.occurredAt)}</p>
                    </div>
                    <Badge>{entry.entityId}</Badge>
                  </div>
                  {entry.reason ? <p className="mt-3 text-sm text-muted-foreground">{entry.reason}</p> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

export function AdminAuditPage() {
  const [take, setTake] = useState(200)
  const [search, setSearch] = useState('')
  const audit = useQuery({ queryKey: queryKeys.adminAudit(take), queryFn: () => adminApi.audit(take) })

  if (audit.isPending) {
    return <LoadingScreen label="Loading audit log..." />
  }

  const filtered = (audit.data ?? []).filter((entry) =>
    `${entry.actionType} ${entry.entityType} ${entry.entityId} ${entry.reason ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <section className="space-y-6">
      <PageHeader title="Audit Explorer" description="Review config changes, support actions and lifecycle operations." />
      <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <Field label="Take">
          <Input type="number" value={take} onChange={(event) => setTake(Number(event.target.value || 0))} />
        </Field>
        <SearchField value={search} onChange={setSearch} placeholder="Filter audit entries..." />
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
              {entry.reason ? <AlertBox tone="info" title="Reason" description={entry.reason} /> : null}
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
          onClick={() =>
            logout.mutate(undefined, {
              onSuccess: () => {
                toast.success('Admin logged out')
                navigate('/admin/login')
              },
            })
          }
        >
          Logout
        </Button>
      </CardContent>
    </Card>
  )
}
