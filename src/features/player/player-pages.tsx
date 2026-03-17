import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { LogOut, WandSparkles } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { isApiError, participantApi } from '@/shared/api/client'
import { type EnigmaRotorDefinitionDto, type TeamSummaryResponse, queryKeys } from '@/shared/contracts/api'
import { useParticipantLogout, useParticipantSession } from '@/features/session/session-hooks'
import { AlertBox, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Input, KeyValue, LiveCountdown, LoadingScreen, PageHeader, RichText, StatCard, TagChip, Textarea } from '@/shared/ui/ui'
import { formatDateTime, formatShortDateTime } from '@/shared/utils/time'

const createTeamSchema = z.object({
  name: z.string().trim().min(2, 'Введите название команды'),
  joinSecret: z.string().trim().min(3, 'Нужен секрет для присоединения'),
})

const joinTeamSchema = z.object({
  teamId: z.string().uuid('Выберите команду'),
  joinSecret: z.string().trim().min(3, 'Введите секрет команды'),
})

const answerSchema = z.object({
  answer: z.string().trim().min(1, 'Введите ответ'),
})

async function getMyTeamOrNull() {
  try {
    return await participantApi.myTeam()
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null
    }

    throw error
  }
}

function MotionSection({ children }: { children: ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-6">
      {children}
    </motion.section>
  )
}

function FormField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {error ? <span className="text-sm text-danger">{error}</span> : null}
    </label>
  )
}

function useMyTeam() {
  return useQuery({
    queryKey: queryKeys.teamsMe,
    queryFn: getMyTeamOrNull,
    retry: false,
  })
}

export function PlayerTeamPage() {
  const queryClient = useQueryClient()
  const session = useParticipantSession()
  const myTeam = useMyTeam()
  const availableTeams = useQuery({
    queryKey: queryKeys.teamsAvailable,
    queryFn: participantApi.availableTeams,
    retry: false,
  })

  const createForm = useForm<z.infer<typeof createTeamSchema>>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: {
      name: '',
      joinSecret: '',
    },
  })

  const joinForm = useForm<z.infer<typeof joinTeamSchema>>({
    resolver: zodResolver(joinTeamSchema),
    defaultValues: {
      teamId: '',
      joinSecret: '',
    },
  })

  const createTeam = useMutation({
    mutationFn: participantApi.createTeam,
    onSuccess: async () => {
      toast.success('Команда создана')
      createForm.reset()
      await queryClient.invalidateQueries({ queryKey: queryKeys.teamsMe })
      await queryClient.invalidateQueries({ queryKey: queryKeys.teamsAvailable })
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Не удалось создать команду'),
  })

  const joinTeam = useMutation({
    mutationFn: participantApi.joinTeam,
    onSuccess: async () => {
      toast.success('Вы присоединились к команде')
      joinForm.reset()
      await queryClient.invalidateQueries({ queryKey: queryKeys.teamsMe })
      await queryClient.invalidateQueries({ queryKey: queryKeys.teamsAvailable })
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Не удалось присоединиться к команде'),
  })

  if (session.isPending || myTeam.isPending || availableTeams.isPending) {
    return <LoadingScreen label="Собираю информацию о командах..." />
  }

  const team = myTeam.data

  return (
    <MotionSection>
      <PageHeader title="Команда" description="Участник должен быть в команде, прежде чем QR scans начнут открывать вопросы." />

      {session.data ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Вы вошли как</p>
              <p className="font-semibold text-foreground">{session.data.displayName}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>{session.data.provider}</Badge>
              {session.data.isBlocked ? <Badge tone="danger">Blocked</Badge> : <Badge tone="success">Active</Badge>}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {team ? (
        <TeamSummaryCard team={team} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Создать новую команду</CardTitle>
              <CardDescription>Создатель выбирает название и join secret, по которому остальные смогут присоединиться.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={createForm.handleSubmit((values) => createTeam.mutate(values))}>
                <FormField label="Название команды" error={createForm.formState.errors.name?.message}>
                  <Input {...createForm.register('name')} placeholder="Энигма 7Б" />
                </FormField>
                <FormField label="Join secret" error={createForm.formState.errors.joinSecret?.message}>
                  <Input {...createForm.register('joinSecret')} placeholder="red-rotor" />
                </FormField>
                <Button className="w-full" type="submit" disabled={createTeam.isPending}>
                  {createTeam.isPending ? 'Создаю...' : 'Создать команду'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Присоединиться к команде</CardTitle>
              <CardDescription>Backend возвращает только доступные команды. Скрытые и недоступные сюда не попадают.</CardDescription>
            </CardHeader>
            <CardContent>
              {availableTeams.data && availableTeams.data.length > 0 ? (
                <form className="space-y-4" onSubmit={joinForm.handleSubmit((values) => joinTeam.mutate(values))}>
                  <FormField label="Команда" error={joinForm.formState.errors.teamId?.message}>
                    <select
                      className="flex h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      {...joinForm.register('teamId')}
                    >
                      <option value="">Выберите команду</option>
                      {availableTeams.data.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.members.length} участников)
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Join secret" error={joinForm.formState.errors.joinSecret?.message}>
                    <Input {...joinForm.register('joinSecret')} placeholder="red-rotor" />
                  </FormField>
                  <Button className="w-full" type="submit" disabled={joinTeam.isPending}>
                    {joinTeam.isPending ? 'Подключаю...' : 'Присоединиться'}
                  </Button>
                </form>
              ) : (
                <EmptyState title="Нет доступных команд" description="Пока никто не создал команду или все доступные команды скрыты." />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </MotionSection>
  )
}

function TeamSummaryCard({ team }: { team: TeamSummaryResponse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{team.name}</CardTitle>
        <CardDescription>Текущая команда участника.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge>{team.status}</Badge>
          {team.isLocked ? <Badge tone="warning">Locked</Badge> : null}
          {team.isHidden ? <Badge tone="info">Hidden</Badge> : null}
          {team.isDisqualified ? <Badge tone="danger">Disqualified</Badge> : null}
        </div>

        {team.isLocked || team.isDisqualified ? (
          <AlertBox
            tone={team.isDisqualified ? 'danger' : 'warning'}
            title="На команде есть ограничения"
            description="Проверьте флаги команды или обратитесь к администратору для ручной корректировки."
          />
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {team.members.map((member) => (
            <div key={member.membershipId} className="rounded-2xl border border-border bg-background/70 p-4">
              <p className="font-medium text-foreground">{member.displayName}</p>
              <p className="mt-1 text-xs text-muted-foreground">Joined {formatShortDateTime(member.joinedAt)}</p>
              <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{member.status}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function PlayerQuestionsPage() {
  const myTeam = useMyTeam()
  const questions = useQuery({
    queryKey: queryKeys.questionsKnown,
    queryFn: participantApi.knownQuestions,
    enabled: Boolean(myTeam.data),
    retry: false,
  })

  if (myTeam.isPending || (myTeam.data ? questions.isPending : false)) {
    return <LoadingScreen label="Загружаю известные вопросы..." />
  }

  if (!myTeam.data) {
    return (
      <MotionSection>
        <PageHeader title="Вопросы" description="Список вопросов появляется только после вступления в команду и первого успешного QR scan." />
        <EmptyState title="Команда не выбрана" description="Создайте или выберите команду, чтобы открыть игровой flow." action={<Button asChild><Link to="/player/team">К странице команды</Link></Button>} />
      </MotionSection>
    )
  }

  return (
    <MotionSection>
      <PageHeader title="Открытые вопросы" description="Список уже известных команде вопросов. Повторный scan не требуется." />

      {questions.data && questions.data.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {questions.data.map((question) => (
            <motion.div key={question.id} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap gap-2">
                    <TagChip name={question.tagName} color={question.tagColor} />
                    <Badge tone={question.isSolved ? 'success' : 'info'}>{question.isSolved ? 'Solved' : 'Open'}</Badge>
                  </div>
                  <CardTitle>{question.title}</CardTitle>
                  <CardDescription>Unlocked {formatDateTime(question.firstUnlockedAt)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {question.nextAllowedAnswerAt ? (
                    <AlertBox
                      tone="warning"
                      title="Cooldown активен"
                      description={<LiveCountdown targetIso={question.nextAllowedAnswerAt} />}
                    />
                  ) : null}
                  <Button asChild className="w-full">
                    <Link to={`/player/questions/${question.id}`}>Открыть вопрос</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Пока нет открытых вопросов"
          description="Найдите QR-код на локации. Когда backend разрешит scan, вопрос появится здесь автоматически."
          action={
            <Button asChild>
              <Link to="/">Вернуться на главную</Link>
            </Button>
          }
        />
      )}
    </MotionSection>
  )
}

export function PlayerQuestionDetailsPage() {
  const { questionId = '' } = useParams()
  const queryClient = useQueryClient()
  const question = useQuery({
    queryKey: queryKeys.questionDetail(questionId),
    queryFn: () => participantApi.question(questionId),
    retry: false,
  })

  const form = useForm<z.infer<typeof answerSchema>>({
    resolver: zodResolver(answerSchema),
    defaultValues: {
      answer: '',
    },
  })

  const submitAnswer = useMutation({
    mutationFn: (values: z.infer<typeof answerSchema>) => participantApi.submitAnswer(questionId, values),
    onSuccess: async (result) => {
      toast.success(result.message)
      form.reset()
      await queryClient.invalidateQueries({ queryKey: queryKeys.questionsKnown })
      await queryClient.invalidateQueries({ queryKey: queryKeys.questionDetail(questionId) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.enigmaState })
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Не удалось отправить ответ'),
  })

  if (question.isPending) {
    return <LoadingScreen label="Загружаю вопрос..." />
  }

  if (!question.data) {
    return (
      <MotionSection>
        <PageHeader title="Вопрос не найден" description="Возможно, вопрос еще не открыт для команды." />
        <EmptyState title="Нет доступа к вопросу" description="Вернитесь к списку известных вопросов или повторите scan через QR route." action={<Button asChild><Link to="/player/questions">К списку вопросов</Link></Button>} />
      </MotionSection>
    )
  }

  const attemptResult = submitAnswer.data

  return (
    <MotionSection>
      <PageHeader
        title={question.data.title}
        description="Body rich text отображается как markdown-подобный текст. Все cooldown расчеты идут от serverTime backend."
        actions={<TagChip name={question.data.tagName} color={question.data.tagColor} />}
      />

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>Текст вопроса</CardTitle>
            <CardDescription>Вопрос открыт после QR scan и доступен без повторного сканирования.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RichText value={question.data.bodyRichText} />
            {question.data.imageUrl ? (
              <img
                src={question.data.imageUrl}
                alt={question.data.title}
                className="max-h-96 w-full rounded-3xl border border-border object-cover"
              />
            ) : null}
            <div className="rounded-2xl border border-border bg-muted/50 p-4 text-sm">
              <p className="font-medium text-foreground">Подсказка для ротора</p>
              <p className="mt-2 text-muted-foreground">{question.data.footerHint}</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <StatCard label="Статус" value={question.data.isSolved ? 'Solved' : 'Open'} hint={question.data.solvedAt ? `Solved at ${formatDateTime(question.data.solvedAt)}` : undefined} />
          <Card>
            <CardHeader>
              <CardTitle>Отправить ответ</CardTitle>
              <CardDescription>Backend возвращает domain result в `200 OK`, поэтому UI анализирует поле `result`, а не только HTTP status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {question.data.nextAllowedAnswerAt ? (
                <AlertBox
                  tone="warning"
                  title="Cooldown активен"
                  description={<LiveCountdown targetIso={question.data.nextAllowedAnswerAt} />}
                />
              ) : null}
              {attemptResult ? (
                <AlertBox
                  tone={attemptResult.result === 'correct' ? 'success' : attemptResult.result === 'wrong' ? 'danger' : 'info'}
                  title={`Результат: ${attemptResult.result}`}
                  description={attemptResult.message}
                />
              ) : null}
              <form className="space-y-4" onSubmit={form.handleSubmit((values) => submitAnswer.mutate(values))}>
                <FormField label="Ответ" error={form.formState.errors.answer?.message}>
                  <Textarea {...form.register('answer')} rows={4} placeholder="Введите ответ команды" />
                </FormField>
                <Button
                  className="w-full"
                  type="submit"
                  disabled={submitAnswer.isPending || question.data.isSolved}
                >
                  {submitAnswer.isPending ? 'Проверяю...' : question.data.isSolved ? 'Вопрос уже решен' : 'Отправить ответ'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </MotionSection>
  )
}

export function PlayerEnigmaPage() {
  const myTeam = useMyTeam()
  const queryClient = useQueryClient()
  const state = useQuery({
    queryKey: queryKeys.enigmaState,
    queryFn: participantApi.enigmaState,
    enabled: Boolean(myTeam.data),
    retry: false,
  })
  const [positions, setPositions] = useState<Record<string, number>>({})
  const defaultPositions = useMemo(
    () =>
      state.data
        ? Object.fromEntries(state.data.rotors.map((rotor) => [rotor.tagId, rotor.positionMin]))
        : {},
    [state.data],
  )
  const effectivePositions = useMemo(
    () => ({ ...defaultPositions, ...positions }),
    [defaultPositions, positions],
  )

  const attempt = useMutation({
    mutationFn: (payload: Record<string, number>) => participantApi.submitEnigmaAttempt({ rotorPositions: payload }),
    onSuccess: async (result) => {
      toast.success(result.message)
      await queryClient.invalidateQueries({ queryKey: queryKeys.enigmaState })
    },
    onError: (error) => toast.error(isApiError(error) ? error.message : 'Не удалось отправить попытку Enigma'),
  })

  if (myTeam.isPending || (myTeam.data ? state.isPending : false)) {
    return <LoadingScreen label="Подготавливаю Enigma..." />
  }

  if (!myTeam.data) {
    return (
      <MotionSection>
        <PageHeader title="Enigma" description="Экран роторов открывается только после вступления в команду." />
        <EmptyState title="Сначала команда" description="Соберите команду, затем решайте вопросы и возвращайтесь к Enigma." action={<Button asChild><Link to="/player/team">К команде</Link></Button>} />
      </MotionSection>
    )
  }

  if (!state.data) {
    return (
      <MotionSection>
        <PageHeader title="Enigma" description="Backend не вернул активный профиль Enigma." />
        <EmptyState title="Нет активной Enigma конфигурации" description="Попросите администратора активировать enigma profile." />
      </MotionSection>
    )
  }

  return (
    <MotionSection>
      <PageHeader title="Enigma" description="Variant B: rotors привязаны к tag colors, а попытка имеет отдельный global cooldown." />
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Роторы</CardTitle>
            <CardDescription>Для отправки попытки backend ожидает `rotorPositions`, где ключом надежнее использовать `tagId`.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {state.data.rotors.map((rotor) => (
              <RotorCard
                key={rotor.id}
                rotor={rotor}
                value={effectivePositions[rotor.tagId] ?? rotor.positionMin}
                onChange={(value) =>
                  setPositions((current) => ({
                    ...defaultPositions,
                    ...current,
                    [rotor.tagId]: value,
                  }))
                }
              />
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <StatCard label="Mode" value={state.data.mode} hint={`Cooldown ${state.data.attemptCooldownMinutes} minutes`} />
          <Card>
            <CardHeader>
              <CardTitle>Отправить попытку</CardTitle>
              <CardDescription>Последняя попытка всегда ограничивается server-side cooldown.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {state.data.nextAllowedAttemptAt ? (
                <AlertBox
                  tone="warning"
                  title="Cooldown активен"
                  description={<LiveCountdown targetIso={state.data.nextAllowedAttemptAt} serverTimeIso={state.data.serverTime} />}
                />
              ) : null}
              {attempt.data ? (
                <AlertBox
                  tone={attempt.data.result === 'success' ? 'success' : attempt.data.result === 'failure' ? 'danger' : 'info'}
                  title={`Результат: ${attempt.data.result}`}
                  description={attempt.data.message}
                />
              ) : null}
              <Button className="w-full" onClick={() => attempt.mutate(effectivePositions)} disabled={attempt.isPending}>
                <WandSparkles className="h-4 w-4" />
                {attempt.isPending ? 'Проверяю...' : 'Проверить комбинацию'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </MotionSection>
  )
}

function RotorCard({
  rotor,
  value,
  onChange,
}: {
  rotor: EnigmaRotorDefinitionDto
  value: number
  onChange: (value: number) => void
}) {
  const canDecrease = value > rotor.positionMin
  const canIncrease = value < rotor.positionMax

  return (
    <motion.div layout className="rounded-3xl border border-border bg-background/60 p-5" whileHover={{ y: -2 }}>
      <div className="flex items-center justify-between gap-3">
        <TagChip name={rotor.tagName} color={rotor.color} />
        <Badge>{rotor.rewardCount} rewards</Badge>
      </div>
      <p className="mt-4 text-lg font-semibold text-foreground">{rotor.label}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Диапазон {rotor.positionMin}..{rotor.positionMax}
      </p>
      <div className="mt-4 flex items-center gap-3">
        <Button variant="outline" onClick={() => canDecrease && onChange(value - 1)} disabled={!canDecrease}>
          -1
        </Button>
        <div className="flex-1 rounded-2xl border border-border bg-card px-4 py-3 text-center text-xl font-semibold text-foreground">{value}</div>
        <Button variant="outline" onClick={() => canIncrease && onChange(value + 1)} disabled={!canIncrease}>
          +1
        </Button>
      </div>
    </motion.div>
  )
}

export function PlayerProfilePage() {
  const session = useParticipantSession()
  const logout = useParticipantLogout()
  const navigate = useNavigate()

  if (session.isPending) {
    return <LoadingScreen label="Открываю профиль..." />
  }

  if (!session.data) {
    return (
      <MotionSection>
        <EmptyState title="Нет активной сессии" description="Войдите как участник, чтобы открыть профиль." action={<Button asChild><Link to="/player/login">К player login</Link></Button>} />
      </MotionSection>
    )
  }

  return (
    <MotionSection>
      <PageHeader title="Профиль участника" description="Здесь виден текущий dev profile и напоминание про будущую VK авторизацию." />
      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{session.data.displayName}</CardTitle>
            <CardDescription>Provider subject: {session.data.providerSubject}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <KeyValue label="Provider" value={session.data.provider} />
            <KeyValue label="Status" value={session.data.isBlocked ? 'Blocked' : 'Active'} />
            <KeyValue label="Avatar URL" value={session.data.avatarUrl || 'n/a'} />
            <KeyValue label="Participant Id" value={session.data.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Сессия и вход</CardTitle>
            <CardDescription>Backend использует cookie auth, а admin cookie имеет приоритет в одном browser context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <AlertBox
              tone="info"
              title="VK auth placeholder"
              description="Пока доступен только dev login. Для будущего VK flow место уже зарезервировано в архитектуре и UI."
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                logout.mutate(undefined, {
                  onSuccess: () => {
                    toast.success('Вы вышли из профиля участника')
                    navigate('/player/login')
                  },
                })
              }
            >
              <LogOut className="h-4 w-4" />
              Выйти
            </Button>
          </CardContent>
        </Card>
      </div>
    </MotionSection>
  )
}
