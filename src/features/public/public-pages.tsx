import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowRight, KeyRound, Sparkles, UserRound, UsersRound } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { PERSONAL_DATA_POLICY_URL } from '@/features/public/privacy-policy'
import { adminApi, isApiError, participantApi, publicApi } from '@/shared/api/client'
import { queryKeys } from '@/shared/contracts/api'
import { describeQrState } from '@/features/public/qr-state'
import { SessionRoleNotice } from '@/features/session/session'
import { useAdminSession, useParticipantSession } from '@/features/session/session-hooks'
import {
  AlertBox,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
  Input,
  LoadingScreen,
  PageHeader,
  RichText,
} from '@/shared/ui/ui'
import { questDayStatusLabel } from '@/shared/utils/quest-day'
import { formatDateTime } from '@/shared/utils/time'

const participantLoginSchema = z.object({
  login: z.string().trim().min(3, 'Логин от 3 символов').max(100),
  password: z.string().min(1, 'Введите пароль'),
})

const participantRegisterSchema = z
  .object({
    login: z.string().trim().min(3, 'Логин от 3 символов').max(100),
    displayName: z.string().trim().min(2, 'Введите ФИО').max(200),
    password: z.string().min(8, 'Пароль не короче 8 символов'),
    confirmPassword: z.string().min(1, 'Повторите пароль'),
    acceptPersonalData: z.boolean(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  })
  .refine((data) => data.acceptPersonalData === true, {
    message: 'Нужно согласие на обработку персональных данных',
    path: ['acceptPersonalData'],
  })

const adminLoginSchema = z.object({
  login: z.string().trim().min(1, 'Введите логин'),
  password: z.string().trim().min(1, 'Введите пароль'),
})

type ParticipantLoginFormValues = z.infer<typeof participantLoginSchema>
type ParticipantRegisterFormValues = z.infer<typeof participantRegisterSchema>
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
          <InfoCard title="1. Войти" description="Регистрация и вход по логину и паролю." icon={<UserRound className="h-5 w-5" />} />
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
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  const loginForm = useForm<ParticipantLoginFormValues>({
    resolver: zodResolver(participantLoginSchema),
    defaultValues: { login: '', password: '' },
  })

  const registerForm = useForm<ParticipantRegisterFormValues>({
    resolver: zodResolver(participantRegisterSchema),
    defaultValues: {
      login: '',
      displayName: '',
      password: '',
      confirmPassword: '',
      acceptPersonalData: false,
    },
  })

  useEffect(() => {
    if (session.isSuccess && session.data) {
      navigate(searchParams.get('from') || '/player/team', { replace: true })
    }
  }, [navigate, searchParams, session.data, session.isSuccess])

  const authSuccess = async (message: string) => {
    toast.success(message)
    await queryClient.invalidateQueries({ queryKey: queryKeys.participantSession })
    navigate(searchParams.get('from') || '/player/team')
  }

  const loginMutation = useMutation({
    mutationFn: participantApi.login,
    onSuccess: async () => authSuccess('Вход выполнен'),
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : 'Не удалось войти')
    },
  })

  const registerMutation = useMutation({
    mutationFn: participantApi.register,
    onSuccess: async () => {
      setAvatarFile(null)
      await authSuccess('Регистрация и вход выполнены')
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : 'Не удалось зарегистрироваться')
    },
  })

  const switchToRegister = () => {
    setMode('register')
    loginForm.reset()
    loginMutation.reset()
  }

  const switchToLogin = () => {
    setMode('login')
    registerForm.reset()
    setAvatarFile(null)
    registerMutation.reset()
  }

  return (
    <MotionSection>
      <PageHeader
        title="Участник"
        description={mode === 'login' ? 'Войдите по логину и паролю.' : 'Создайте аккаунт: логин, ФИО и пароль. Аватар по желанию.'}
      />
      <SessionRoleNotice />
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>{mode === 'login' ? 'Вход' : 'Регистрация'}</CardTitle>
          <CardDescription>
            {mode === 'login'
              ? 'После входа вы сможете создать команду или присоединиться к существующей.'
              : 'Логин будет нормализован (регистр не важен).'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === 'login' ? (
            <form
              className="space-y-4"
              onSubmit={loginForm.handleSubmit((values) => loginMutation.mutate(values))}
            >
              <FormField label="Логин" error={loginForm.formState.errors.login?.message}>
                <Input {...loginForm.register('login')} autoComplete="username" placeholder="ivanov" />
              </FormField>
              <FormField label="Пароль" error={loginForm.formState.errors.password?.message}>
                <Input {...loginForm.register('password')} type="password" autoComplete="current-password" />
              </FormField>
              <Button className="w-full" type="submit" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? 'Вхожу...' : 'Войти'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={switchToRegister}>
                Регистрация
              </Button>
            </form>
          ) : (
            <form
              className="space-y-4"
              onSubmit={registerForm.handleSubmit((values) =>
                registerMutation.mutate({
                  login: values.login,
                  displayName: values.displayName,
                  password: values.password,
                  acceptPersonalDataProcessing: values.acceptPersonalData,
                  avatarFile,
                }),
              )}
            >
              <FormField label="Логин" error={registerForm.formState.errors.login?.message}>
                <Input {...registerForm.register('login')} autoComplete="username" placeholder="ivanov" />
              </FormField>
              <FormField label="ФИО" error={registerForm.formState.errors.displayName?.message}>
                <Input {...registerForm.register('displayName')} autoComplete="name" placeholder="Иванов Иван" />
              </FormField>
              <FormField label="Пароль" error={registerForm.formState.errors.password?.message}>
                <Input {...registerForm.register('password')} type="password" autoComplete="new-password" />
              </FormField>
              <FormField label="Повторите пароль" error={registerForm.formState.errors.confirmPassword?.message}>
                <Input {...registerForm.register('confirmPassword')} type="password" autoComplete="new-password" />
              </FormField>
              <FormField label="Аватар (необязательно)">
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                />
              </FormField>
              <div className="space-y-2">
                <Checkbox
                  label="Согласен с обработкой персональных данных"
                  description={
                    <span>
                      Текст политики:{' '}
                      <a href={PERSONAL_DATA_POLICY_URL} className="text-primary underline underline-offset-2" target="_blank" rel="noreferrer">
                        ознакомиться
                      </a>
                      .
                    </span>
                  }
                  {...registerForm.register('acceptPersonalData')}
                />
                {registerForm.formState.errors.acceptPersonalData ? (
                  <p className="text-sm text-danger">{registerForm.formState.errors.acceptPersonalData.message}</p>
                ) : null}
              </div>
              <Button className="w-full" type="submit" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? 'Регистрирую...' : 'Зарегистрироваться'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={switchToLogin}>
                Уже есть аккаунт — войти
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
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
    if (session.isSuccess && session.data) {
      navigate(searchParams.get('from') || '/admin', { replace: true })
    }
  }, [navigate, searchParams, session.data, session.isSuccess])

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
