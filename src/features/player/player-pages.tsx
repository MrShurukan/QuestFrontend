import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CircleHelp, LogOut } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { EnigmaPlayerExperience } from '@/features/player/enigma/EnigmaPlayerExperience'
import { PlayerStageHelp } from '@/features/player/PlayerStageHelp'
import { describeAnswerResult, isApiError, participantApi } from '@/shared/api/client'
import { type EnigmaStateResponse, type TeamSummaryResponse, queryKeys } from '@/shared/contracts/api'
import { useParticipantLogout, useParticipantSession } from '@/features/session/session-hooks'
import {
  AlertBox,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CooldownAlertBox,
  EmptyState,
  Input,
  KeyValue,
  LoadingScreen,
  MemberAvatar,
  Modal,
  PageHeader,
  RichText,
  TagChip,
} from '@/shared/ui/ui'
import { formatDateTime, formatShortDateTime, formatTimeOnly } from '@/shared/utils/time'

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
      <PageHeader
        title="Команда"
        description="Войдите в команду, чтобы получать вопросы по QR и участвовать в квесте."
        actions={<PlayerStageHelp stage="team" />}
      />

      {session.data ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/80 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <MemberAvatar displayName={session.data.displayName} avatarUrl={session.data.avatarUrl} size="sm" />
          <span className="font-medium text-foreground">{session.data.displayName}</span>
          <span className="hidden sm:inline">·</span>
          <Badge className="text-[10px]">{session.data.login ?? session.data.provider}</Badge>
          {session.data.isBlocked ? <Badge tone="danger">Заблокирован</Badge> : <Badge tone="success">Активен</Badge>}
        </div>
      ) : null}

      {team ? (
        <TeamSummaryCard team={team} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Присоединиться к команде</CardTitle>
              <CardDescription>Выберите команду из списка и введите секретное слово для вступления.</CardDescription>
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
                    <FormField label="Секрет команды" error={joinForm.formState.errors.joinSecret?.message}>
                      <Input {...joinForm.register('joinSecret')} placeholder="секретное-слово" />
                    </FormField>
                    <Button className="w-full" type="submit" disabled={joinTeam.isPending}>
                      {joinTeam.isPending ? 'Подключаю...' : 'Присоединиться'}
                    </Button>
                  </form>
              ) : (
                  <EmptyState
                    title="Нет команд для вступления"
                    description="Создайте свою команду, подождите новую команду или попробуйте позже — свободные слоты в уже созданных командах могут быть заняты."
                  />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Создать новую команду</CardTitle>
              <CardDescription>Придумайте название и секретное слово — по нему к вам смогут присоединиться другие.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={createForm.handleSubmit((values) => createTeam.mutate(values))}>
                <FormField label="Название команды" error={createForm.formState.errors.name?.message}>
                  <Input {...createForm.register('name')} placeholder="Энигма 7Б" />
                </FormField>
                <FormField label="Секрет для вступления" error={createForm.formState.errors.joinSecret?.message}>
                  <Input {...createForm.register('joinSecret')} placeholder="секретное-слово" />
                </FormField>
                <Button className="w-full" type="submit" disabled={createTeam.isPending}>
                  {createTeam.isPending ? 'Создаю...' : 'Создать команду'}
                </Button>
              </form>
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
          {team.isLocked ? <Badge tone="warning">Заблокирована</Badge> : null}
          {team.isHidden ? <Badge tone="info">Скрыта</Badge> : null}
          {team.isDisqualified ? <Badge tone="danger">Дисквалифицирована</Badge> : null}
        </div>

        {team.isLocked || team.isDisqualified ? (
          <AlertBox
            tone={team.isDisqualified ? 'danger' : 'warning'}
            title="На команде есть ограничения"
            description="Обратитесь к организаторам, чтобы выяснить причину ограничений."
          />
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {team.members.map((member) => (
            <div key={member.membershipId} className="flex gap-3 rounded-2xl border border-border bg-background/70 p-4">
              <MemberAvatar displayName={member.displayName} avatarUrl={member.avatarUrl} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{member.displayName}</p>
                <p className="mt-1 text-xs text-muted-foreground">Вступил {formatShortDateTime(member.joinedAt)}</p>
                <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{member.status}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function QuestionDetailModal({ questionId, onClose }: { questionId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const question = useQuery({
    queryKey: queryKeys.questionDetail(questionId),
    queryFn: () => participantApi.question(questionId),
    retry: false,
  })

  const form = useForm<z.infer<typeof answerSchema>>({
    resolver: zodResolver(answerSchema),
    defaultValues: { answer: '' },
  })

  const submitAnswer = useMutation({
    mutationFn: async (values: z.infer<typeof answerSchema>) => {
      const result = await participantApi.submitAnswer(questionId, values)
      await queryClient.invalidateQueries({ queryKey: queryKeys.questionsKnown })
      await queryClient.invalidateQueries({ queryKey: queryKeys.questionDetail(questionId) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.enigmaState })
      return result
    },
  })

  useEffect(() => {
    form.reset({ answer: '' })
    submitAnswer.reset()
    // только при смене вопроса
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId])

  const statusTooltip = question.data?.isSolved && question.data.solvedAt
    ? `Разгадано в ${formatTimeOnly(question.data.solvedAt)}`
    : 'Вы ещё не разгадали этот вопрос'

  const footer = question.data ? (
    <div className="space-y-3">
      {question.data.footerHint ? <p className="text-sm leading-relaxed text-muted-foreground">{question.data.footerHint}</p> : null}
      <CooldownAlertBox targetIso={question.data.nextAllowedAnswerAt} title="Кулдаун активен" />
      {submitAnswer.data ? (
        <AlertBox
          tone={
            submitAnswer.data.result === 'correct'
              ? 'success'
              : submitAnswer.data.result === 'wrong'
                ? 'danger'
                : 'info'
          }
          title={describeAnswerResult(submitAnswer.data.result)}
          description={submitAnswer.data.message}
        />
      ) : null}
      <form
        className="space-y-3"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            const r = await submitAnswer.mutateAsync(values)
            toast.success(r.message)
            form.reset()
          } catch (error) {
            toast.error(isApiError(error) ? error.message : 'Не удалось отправить ответ')
          }
        })}
      >
        <FormField label="Ответ" error={form.formState.errors.answer?.message}>
          <Input {...form.register('answer')} placeholder="Ответ команды" disabled={question.data.isSolved} />
        </FormField>
        <Button className="w-full" type="submit" disabled={submitAnswer.isPending || question.data.isSolved}>
          {submitAnswer.isPending ? 'Проверяю...' : question.data.isSolved ? 'Уже решено' : 'Отправить ответ'}
        </Button>
      </form>
    </div>
  ) : null

  return (
    <Modal open className="max-w-lg" onClose={onClose} footer={footer}>
      {question.isPending ? (
        <LoadingScreen label="Загружаю вопрос..." />
      ) : question.error || !question.data ? (
        <div className="space-y-4 py-4">
          <p className="text-muted-foreground">Нет доступа к этому вопросу или он ещё не открыт для команды.</p>
          <Button className="w-full" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-start justify-between gap-3 pr-10">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                <TagChip name={question.data.tagName} color={question.data.tagColor} />
              </p>
              <h2 className="mt-2 text-xl font-semibold leading-tight text-foreground sm:text-2xl">{question.data.title}</h2>
            </div>
            <span
              className="inline-flex shrink-0 cursor-help items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground"
              title={statusTooltip}
            >
              <CircleHelp className="h-3.5 w-3.5" />
              {question.data.isSolved ? 'Решён' : 'Открыт'}
            </span>
          </div>
          {question.data.imageUrl ? (
            <div className="mb-4 max-h-48 overflow-hidden rounded-2xl border border-border bg-muted/30 sm:max-h-56">
              <img src={question.data.imageUrl} alt="" className="max-h-48 w-full object-contain sm:max-h-56" />
            </div>
          ) : null}
          <RichText value={question.data.bodyRichText} className="text-base leading-relaxed sm:text-lg" />
        </>
      )}
    </Modal>
  )
}

export function PlayerQuestionsPage() {
  const { questionId } = useParams()
  const navigate = useNavigate()
  const myTeam = useMyTeam()
  const questions = useQuery({
    queryKey: queryKeys.questionsKnown,
    queryFn: participantApi.knownQuestions,
    enabled: Boolean(myTeam.data),
    retry: false,
  })

  const closeModal = () => {
    navigate('/player/questions')
  }

  if (myTeam.isPending || (myTeam.data ? questions.isPending : false)) {
    return <LoadingScreen label="Загружаю известные вопросы..." />
  }

  if (!myTeam.data) {
    return (
      <MotionSection>
        <PageHeader
          title="Вопросы"
          description="Здесь появятся вопросы, которые вы открыли по QR. Сначала войдите в команду и отсканируйте QR на локации."
          actions={<PlayerStageHelp stage="questions" />}
        />
        <EmptyState title="Команда не выбрана" description="Создайте или выберите команду, чтобы открыть игру." action={<Button asChild><Link to="/player/team">К странице команды</Link></Button>} />
      </MotionSection>
    )
  }

  return (
    <MotionSection>
      <PageHeader
        title="Открытые вопросы"
        description="Вопросы, которые команда уже открыла. Повторное сканирование не нужно."
        actions={<PlayerStageHelp stage="questions" />}
      />

      {questions.data && questions.data.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {questions.data.map((question) => (
            <motion.div key={question.id} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap gap-2">
                    <TagChip name={question.tagName} color={question.tagColor} />
                    <Badge tone={question.isSolved ? 'success' : 'info'}>{question.isSolved ? 'Решён' : 'Открыт'}</Badge>
                  </div>
                  <CardTitle>{question.title}</CardTitle>
                  <CardDescription>Открыт {formatDateTime(question.firstUnlockedAt)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {question.isSolved && question.footerHint?.trim() ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">{question.footerHint}</p>
                  ) : null}
                  <CooldownAlertBox targetIso={question.nextAllowedAnswerAt} title="Кулдаун активен" />
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
          description="Найдите QR-код на локации. После сканирования вопрос появится здесь."
          action={
            <Button asChild>
              <Link to="/">Вернуться на главную</Link>
            </Button>
          }
        />
      )}

      {questionId ? <QuestionDetailModal questionId={questionId} onClose={closeModal} /> : null}
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
    refetchInterval: (q) => (q.state.data?.isEnigmaSolved ? 60_000 : false),
    refetchOnWindowFocus: true,
  })
  const [deltas, setDeltas] = useState<Record<string, number>>({})

  useEffect(() => {
    setDeltas({})
  }, [state.data?.profileId])

  const effectivePositions = useMemo(() => {
    if (!state.data) return {}
    return Object.fromEntries(
      state.data.rotors.map((r) => [r.tagId, deltas[r.tagId] ?? r.draftPosition]),
    )
  }, [state.data, deltas])

  const saveDraft = useMutation({
    mutationFn: (positions: Record<string, number>) =>
      participantApi.updateEnigmaDraftPositions({ positions }),
    onSuccess(_data, positions) {
      queryClient.setQueryData<EnigmaStateResponse>(queryKeys.enigmaState, (old) => {
        if (!old) return old
        return {
          ...old,
          rotors: old.rotors.map((r) =>
            positions[r.tagId] !== undefined ? { ...r, draftPosition: positions[r.tagId]! } : r,
          ),
        }
      })
      setDeltas((d) => {
        const next = { ...d }
        for (const k of Object.keys(positions)) delete next[k]
        return next
      })
    },
    onError(error) {
      toast.error(isApiError(error) ? error.message : 'Не удалось сохранить позицию ротора')
    },
  })

  if (myTeam.isPending || (myTeam.data ? state.isPending : false)) {
    return <LoadingScreen label="Подготавливаю Enigma..." />
  }

  if (!myTeam.data) {
    return (
      <MotionSection>
        <PageHeader
          title="Enigma"
          description="Экран роторов открывается только после вступления в команду."
          actions={<PlayerStageHelp stage="enigma" />}
        />
        <EmptyState title="Команда не выбрана" description="Создайте или выберите команду, чтобы открыть игру." action={<Button asChild><Link to="/player/team">К странице команды</Link></Button>} />
      </MotionSection>
    )
  }

  if (!state.data) {
    return (
      <MotionSection>
        <PageHeader title="Enigma" description="Экран Enigma пока недоступен." actions={<PlayerStageHelp stage="enigma" />} />
        <EmptyState title="Enigma ещё не запущена" description="Обратитесь к организаторам или зайдите позже." />
      </MotionSection>
    )
  }

  return (
    <MotionSection>
      <PageHeader
        title="Enigma"
        description="Ротор открывается после решения вопроса с соответствующим тегом. Позиции сохраняются автоматически. Между попытками действует кулдаун."
        actions={<PlayerStageHelp stage="enigma" />}
      />
      <EnigmaPlayerExperience
        state={state.data}
        effectivePositions={effectivePositions}
        setDeltas={setDeltas}
        saveDraft={{ mutate: saveDraft.mutate, isPending: saveDraft.isPending }}
      />
    </MotionSection>
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
        <PageHeader title="Профиль" description="Войдите как участник, чтобы открыть профиль." actions={<PlayerStageHelp stage="profile" />} />
        <EmptyState title="Нет активной сессии" description="Войдите как участник, чтобы открыть профиль." action={<Button asChild><Link to="/player/login">Войти</Link></Button>} />
      </MotionSection>
    )
  }

  return (
    <MotionSection>
      <PageHeader title="Профиль" description="Ваши данные и выход из аккаунта." actions={<PlayerStageHelp stage="profile" />} />
      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{session.data.displayName}</CardTitle>
            <CardDescription>Логин: {session.data.login ?? session.data.providerSubject}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2 flex items-center gap-3">
              <MemberAvatar displayName={session.data.displayName} avatarUrl={session.data.avatarUrl} size="lg" />
            </div>
            <KeyValue label="Учётная запись" value={session.data.provider === 'local' ? 'Локальная' : session.data.provider} />
            <KeyValue label="Статус" value={session.data.isBlocked ? 'Заблокирован' : 'Активен'} />
            <KeyValue label="Аватар" value={session.data.avatarUrl || 'не загружен'} />
            <KeyValue label="ID участника" value={session.data.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Сессия и вход</CardTitle>
            <CardDescription>Чтобы войти под другим аккаунтом, нажмите «Выйти».</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                try {
                  await logout.mutateAsync()
                  toast.success('Вы вышли из профиля участника')
                  navigate('/', { replace: true })
                } catch {
                  toast.error('Не удалось выйти')
                }
              }}
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
