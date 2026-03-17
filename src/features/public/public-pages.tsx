import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowRight, KeyRound, Sparkles, UserRound, UsersRound } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { adminApi, isApiError, participantApi, publicApi } from '@/shared/api/client'
import { queryKeys } from '@/shared/contracts/api'
import { describeQrState } from '@/features/public/qr-state'
import { SessionRoleNotice } from '@/features/session/session'
import { useAdminSession, useParticipantSession } from '@/features/session/session-hooks'
import { AlertBox, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Input, LoadingScreen, PageHeader, RichText } from '@/shared/ui/ui'
import { questDayStatusLabel } from '@/shared/utils/quest-day'
import { formatDateTime } from '@/shared/utils/time'

const playerLoginSchema = z.object({
  providerSubject: z.string().trim().min(3, 'Нужен dev identifier'),
  displayName: z.string().trim().min(2, 'Введите отображаемое имя'),
  avatarUrl: z.union([z.string().trim().url('Нужен валидный URL').max(2048), z.literal('')]).optional(),
})

const adminLoginSchema = z.object({
  login: z.string().trim().min(1, 'Введите логин'),
  password: z.string().trim().min(1, 'Введите пароль'),
})

type PlayerLoginValues = z.infer<typeof playerLoginSchema>
type AdminLoginValues = z.infer<typeof adminLoginSchema>

function MotionSection({ children }: { children: ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      className="space-y-6"
    >
      {children}
    </motion.section>
  )
}

function QuestDayStatusCard() {
  const questDay = useQuery({
    queryKey: queryKeys.questDayPublic,
    queryFn: publicApi.getQuestDay,
  })

  if (questDay.isPending) {
    return <LoadingScreen label="Получаю статус квеста..." />
  }

  if (questDay.error) {
    return (
      <AlertBox
        tone="danger"
        title="Не удалось загрузить статус квеста"
        description="Обновите страницу или попробуйте позже."
      />
    )
  }

  const tone = questDay.data.status === 'Running' ? 'success' : 'info'

  return (
    <Card className="bg-gradient-to-br from-card to-card/60">
      <CardHeader>
        <CardTitle>Статус игрового дня</CardTitle>
        <CardDescription>Текущий этап квеста и сообщение для участников.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Badge tone={tone}>{questDayStatusLabel(questDay.data.status)}</Badge>
          {questDay.data.startedAt ? <Badge>Старт: {formatDateTime(questDay.data.startedAt)}</Badge> : null}
          {questDay.data.endedAt ? <Badge>Конец: {formatDateTime(questDay.data.endedAt)}</Badge> : null}
        </div>
        <p className="text-sm text-muted-foreground">{questDay.data.message}</p>
      </CardContent>
    </Card>
  )
}

export function LandingPage() {
  return (
    <MotionSection>
      <PageHeader
        title="Quest Enigma"
        description="Участникам: войти, собрать команду, сканировать QR и решать задания. Статус игрового дня — по кнопке ниже."
        actions={<Button asChild><Link to="/quest-status">Статус дня</Link></Button>}
      />

      <SessionRoleNotice />

      <Card className="bg-gradient-to-br from-primary/10 via-card to-info/10">
        <CardHeader>
          <CardTitle>Как это работает</CardTitle>
          <CardDescription>
            QR-коды открывают вопросы, за правильные ответы команда получает награды для механики Enigma. В конце — расшифровка финального сообщения.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <InfoCard title="1. Войти" description="Вход участника (сейчас через dev login)." icon={<UserRound className="h-5 w-5" />} />
          <InfoCard title="2. Команда" description="Создать команду или вступить по секретному слову." icon={<UsersRound className="h-5 w-5" />} />
          <InfoCard title="3. Играть" description="Сканировать QR, отвечать на вопросы, пробовать Enigma с кулдауном." icon={<Sparkles className="h-5 w-5" />} />
        </CardContent>
      </Card>

      <RoleCard
        title="Участникам"
        description="Вход, команда, список вопросов и экран Enigma."
        href="/player/login"
        buttonLabel="Войти и играть"
      />
    </MotionSection>
  )
}

function InfoCard({
  title,
  description,
  icon,
}: {
  title: string
  description: string
  icon: ReactNode
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-background/80 p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div>
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function RoleCard({
  title,
  description,
  href,
  buttonLabel,
}: {
  title: string
  description: string
  href: string
  buttonLabel: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild className="w-full">
          <Link to={href}>
            {buttonLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export function PlayerLoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const session = useParticipantSession()
  const [defaultProviderSubject] = useState(() => {
    const generated = globalThis.crypto?.randomUUID?.().slice(0, 8)
    return `dev-${generated || 'local'}`
  })
  const form = useForm<PlayerLoginValues>({
    resolver: zodResolver(playerLoginSchema),
    defaultValues: {
      providerSubject: defaultProviderSubject,
      displayName: '',
      avatarUrl: '',
    },
  })

  useEffect(() => {
    if (session.data) {
      navigate(searchParams.get('from') || '/player/team', { replace: true })
    }
  }, [navigate, searchParams, session.data])

  const mutation = useMutation({
    mutationFn: participantApi.login,
    onSuccess: async () => {
      toast.success('Вход участника выполнен')
      await queryClient.invalidateQueries({ queryKey: queryKeys.participantSession })
      navigate(searchParams.get('from') || '/player/team')
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : 'Не удалось войти как участник')
    },
  })

  const onSubmit = form.handleSubmit((values) =>
    mutation.mutate({
      providerSubject: values.providerSubject,
      displayName: values.displayName,
      avatarUrl: values.avatarUrl || null,
    }),
  )

  return (
    <MotionSection>
      <PageHeader title="Вход участника" description="Временный dev-вход; позже — VK или другой провайдер." />
      <SessionRoleNotice />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Dev-вход</CardTitle>
            <CardDescription>Введите имя и нажмите «Войти» — после этого вы сможете создать команду или присоединиться к существующей.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <FormField label="Идентификатор (subject)" error={form.formState.errors.providerSubject?.message}>
                <Input {...form.register('providerSubject')} placeholder="dev-ivanov-42" />
              </FormField>
              <FormField label="Отображаемое имя" error={form.formState.errors.displayName?.message}>
                <Input {...form.register('displayName')} placeholder="Команда Сириус" />
              </FormField>
              <FormField label="URL аватара" error={form.formState.errors.avatarUrl?.message}>
                <Input {...form.register('avatarUrl')} placeholder="https://..." />
              </FormField>
              <Button className="w-full" type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Вхожу...' : 'Войти как участник'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>VK — позже</CardTitle>
            <CardDescription>Внешняя авторизация будет здесь; пока используйте форму слева.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <AlertBox
              tone="info"
              title="VK auth позже"
              description="Вход через соцсети появится позже. Пока войдите через форму слева."
            />
            <Button variant="outline" className="w-full" disabled>
              ВКонтакте (скоро)
            </Button>
          </CardContent>
        </Card>
      </div>
    </MotionSection>
  )
}

export function AdminLoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const session = useAdminSession()
  const form = useForm<AdminLoginValues>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      login: '',
      password: '',
    },
  })

  useEffect(() => {
    if (session.data) {
      navigate(searchParams.get('from') || '/admin', { replace: true })
    }
  }, [navigate, searchParams, session.data])

  const mutation = useMutation({
    mutationFn: adminApi.login,
    onSuccess: async () => {
      toast.success('Вход администратора выполнен')
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminSession })
      navigate(searchParams.get('from') || '/admin')
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : 'Не удалось войти как администратор')
    },
  })

  return (
    <MotionSection>
      <PageHeader title="Вход администратора" description="Локальная учётная запись из настроек сервера." />
      <SessionRoleNotice />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Админка</CardTitle>
          <CardDescription>После входа используется cookie администратора и защита маршрутов.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField label="Логин" error={form.formState.errors.login?.message}>
              <Input {...form.register('login')} autoComplete="username" />
            </FormField>
            <FormField label="Пароль" error={form.formState.errors.password?.message}>
              <Input type="password" {...form.register('password')} autoComplete="current-password" />
            </FormField>
            <Button className="w-full" type="submit" disabled={mutation.isPending}>
              <KeyRound className="h-4 w-4" />
              {mutation.isPending ? 'Вхожу...' : 'Войти в админку'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </MotionSection>
  )
}

export function QuestStatusPage() {
  return (
    <MotionSection>
      <PageHeader
        title="Статус игрового дня"
        description="Текущее состояние квеста и сообщение для участников."
        actions={
          <Button variant="outline" asChild>
            <Link to="/">На главную</Link>
          </Button>
        }
      />
      <QuestDayStatusCard />
    </MotionSection>
  )
}

export function QrRoutePage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.qrResolution(slug),
    queryFn: () => publicApi.resolveQr(slug),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (query.data?.question && query.data.questionId) {
      queryClient.setQueryData(queryKeys.questionDetail(query.data.questionId), query.data.question)
    }
  }, [query.data, queryClient])

  if (query.isPending) {
    return <LoadingScreen label="Обрабатываю QR-код..." />
  }

  if (query.error) {
    return (
      <MotionSection>
        <PageHeader title="QR-код" description="Сканирование временно недоступно." />
        <AlertBox
          tone="danger"
          title="Не удалось обработать QR-код"
          description="Попробуйте позже или обратитесь к организаторам."
        />
      </MotionSection>
    )
  }

  const state = describeQrState(query.data.state)

  return (
    <MotionSection>
      <PageHeader title={`QR: ${slug}`} description="Результат сканирования." />
      <AlertBox tone={state.tone} title={state.title} description={query.data.message} />

      {query.data.state === 'resolved' && query.data.question ? (
        <Card>
          <CardHeader>
            <CardTitle>{query.data.question.title}</CardTitle>
            <CardDescription>Вопрос добавлен в ваш список — откройте раздел «Вопросы», чтобы ответить.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge>{query.data.question.tagName}</Badge>
              <Badge tone={query.data.question.isSolved ? 'success' : 'info'}>
                {query.data.question.isSolved ? 'Решён' : 'Открыт'}
              </Badge>
            </div>
            <RichText value={query.data.question.bodyRichText} />
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate(`/player/questions/${query.data.questionId}`)}>Открыть карточку вопроса</Button>
              <Button variant="outline" onClick={() => navigate('/player/questions')}>
                К списку вопросов
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {query.data.state === 'requires_auth' ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6 md:flex-row">
            <Button asChild>
              <Link to={`/player/login?from=${encodeURIComponent(`/q/${slug}`)}`}>Войти как участник</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">На главную</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {query.data.state === 'requires_team' ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6 md:flex-row">
            <Button asChild>
              <Link to="/player/team">Создать или выбрать команду</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/player/questions">Перейти к уже открытым вопросам</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {query.data.state !== 'resolved' && query.data.state !== 'requires_auth' && query.data.state !== 'requires_team' ? (
        <EmptyState title={state.title} description={query.data.message} action={<Button asChild><Link to="/">Вернуться на главную</Link></Button>} />
      ) : null}
    </MotionSection>
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
