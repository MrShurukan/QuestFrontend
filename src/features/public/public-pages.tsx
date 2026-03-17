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
        description="Проверьте, что QuestBackend запущен на ожидаемом адресе и прокси настроен корректно."
      />
    )
  }

  const tone = questDay.data.status === 'Running' ? 'success' : 'info'

  return (
    <Card className="bg-gradient-to-br from-card to-card/60">
      <CardHeader>
        <CardTitle>Статус игрового дня</CardTitle>
        <CardDescription>Backend управляет lifecycle и блокирует QR, ответы и Enigma attempts на сервере.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Badge tone={tone}>{questDay.data.status}</Badge>
          {questDay.data.startedAt ? <Badge>Started: {formatDateTime(questDay.data.startedAt)}</Badge> : null}
          {questDay.data.endedAt ? <Badge>Ended: {formatDateTime(questDay.data.endedAt)}</Badge> : null}
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
        description="Один React SPA для public, player и admin зон. Player UI минималистичный и живой, admin UI строгий и операционный."
        actions={<Button asChild><Link to="/quest-status">Статус дня</Link></Button>}
      />

      <SessionRoleNotice />

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card className="bg-gradient-to-br from-primary/10 via-card to-info/10">
          <CardHeader>
            <CardTitle>Как это работает</CardTitle>
            <CardDescription>
              QR-коды открывают вопросы, вопросы дают ротора, а затем команда пытается расшифровать финальное сообщение через Enigma.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <InfoCard title="1. Войти" description="Сейчас доступен dev participant login и локальный admin login." icon={<UserRound className="h-5 w-5" />} />
            <InfoCard title="2. Собрать команду" description="Создать новую команду или вступить по join secret." icon={<UsersRound className="h-5 w-5" />} />
            <InfoCard title="3. Играть" description="Сканировать QR, решать вопросы и пробовать Enigma с cooldown." icon={<Sparkles className="h-5 w-5" />} />
          </CardContent>
        </Card>

        <QuestDayStatusCard />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <RoleCard
          title="Player Entry"
          description="Dev login участника, команды, вопросы, QR flow и экран Enigma."
          href="/player/login"
          buttonLabel="Открыть player login"
        />
        <RoleCard
          title="Admin Panel"
          description="Теги, вопросы, пулы, routing, Enigma profiles, lifecycle, support и audit."
          href="/admin/login"
          buttonLabel="Открыть admin login"
        />
        <RoleCard
          title="QR Browser Route"
          description="Frontend владеет `/q/:slug`, а QR resolution JSON приходит из backend API `/api/public/qr/:slug`."
          href="/q/demo"
          buttonLabel="Проверить QR route"
        />
      </div>
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
      <PageHeader title="Player Login" description="Временный dev-flow, пока VK авторизация оставлена как будущая интеграция." />
      <SessionRoleNotice />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Dev participant login</CardTitle>
            <CardDescription>Форма создает или повторно использует dev участника и выставляет participant cookie.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <FormField label="Provider subject" error={form.formState.errors.providerSubject?.message}>
                <Input {...form.register('providerSubject')} placeholder="dev-ivanov-42" />
              </FormField>
              <FormField label="Display name" error={form.formState.errors.displayName?.message}>
                <Input {...form.register('displayName')} placeholder="Команда Сириус" />
              </FormField>
              <FormField label="Avatar URL" error={form.formState.errors.avatarUrl?.message}>
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
            <CardTitle>VK placeholder</CardTitle>
            <CardDescription>Абстракция под будущий auth provider уже заложена в архитектуре, но поток пока не реализован.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <AlertBox
              tone="info"
              title="VK auth позже"
              description="Здесь появится кнопка внешней авторизации. Пока используйте dev login, чтобы покрыть backend endpoints уже сейчас."
            />
            <Button variant="outline" className="w-full" disabled>
              VK Login (planned)
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
      login: 'admin',
      password: 'admin123',
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
      <PageHeader title="Admin Login" description="Локальные логины backend. В development по умолчанию используются `admin / admin123`." />
      <SessionRoleNotice />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Локальный admin login</CardTitle>
          <CardDescription>После входа frontend использует admin cookie и route guards для закрытых секций.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField label="Login" error={form.formState.errors.login?.message}>
              <Input {...form.register('login')} />
            </FormField>
            <FormField label="Password" error={form.formState.errors.password?.message}>
              <Input type="password" {...form.register('password')} />
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
        title="Quest Status"
        description="Публичный экран текущего lifecycle status. Полезен как fallback вне QR flow."
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
    return <LoadingScreen label="Разрешаю QR scan..." />
  }

  if (query.error) {
    return (
      <MotionSection>
        <PageHeader title="QR Route" description="Frontend route существует, но backend QR resolver недоступен." />
        <AlertBox
          tone="danger"
          title="Ошибка при обращении к backend QR API"
          description="Проверьте `VITE_QR_API_BASE_PATH`. Для текущего проекта по умолчанию используется `/api/public/qr/:slug`, который Vite проксирует в backend через общий `/api` proxy."
        />
      </MotionSection>
    )
  }

  const state = describeQrState(query.data.state)

  return (
    <MotionSection>
      <PageHeader title={`QR: ${slug}`} description="Этот экран не prefetch'ится, потому что backend пишет scan event и может открыть вопрос." />
      <AlertBox tone={state.tone} title={state.title} description={query.data.message} />

      {query.data.state === 'resolved' && query.data.question ? (
        <Card>
          <CardHeader>
            <CardTitle>{query.data.question.title}</CardTitle>
            <CardDescription>Вопрос уже открыт команде и доступен без повторного сканирования.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge>{query.data.question.tagName}</Badge>
              <Badge tone={query.data.question.isSolved ? 'success' : 'info'}>
                {query.data.question.isSolved ? 'Solved' : 'Open'}
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
