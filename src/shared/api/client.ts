import type {
  AdminSelfProfileUpdateRequest,
  AdminUserCreateRequest,
  AdminUserListItemResponse,
  AdminLoginRequest,
  AnswerResult,
  AuditEntryResponse,
  AuthenticatedAdminResponse,
  CreateTeamRequest,
  ParticipantLoginRequest,
  EnigmaAttemptResult,
  EnigmaProfileResponse,
  EnigmaProfileUpsertRequest,
  EnigmaStateResponse,
  GlobalSettingsResponse,
  GlobalSettingsUpdateRequest,
  Id,
  ParticipantPasswordResetRequest,
  ParticipantProfileResponse,
  ProblemDetails,
  QrBindingOverrideRequest,
  QrBindingOverrideResponse,
  QrCodeResponse,
  QrCodeUpsertRequest,
  QrResolutionResponse,
  QuestionDetailsResponse,
  QuestionPoolResponse,
  QuestionPoolUpsertRequest,
  QuestionResponse,
  QuestionSummaryResponse,
  QuestionUpsertRequest,
  QuestDayStateResponse,
  RoutingPreviewRowResponse,
  RoutingProfileResponse,
  RoutingProfileUpsertRequest,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  SubmitEnigmaAttemptRequest,
  SubmitEnigmaAttemptResponse,
  TagResponse,
  TagUpsertRequest,
  TeamMemberRemovalRequest,
  TeamQuestionAdjustmentRequest,
  TeamRewardAdjustmentRequest,
  TeamSummaryResponse,
  TeamSupportDetailsResponse,
  UpdateQuestDayMessagesRequest,
} from '@/shared/contracts/api'

const QR_API_BASE_PATH = import.meta.env.VITE_QR_API_BASE_PATH || '/api/public/qr'

export class ApiError extends Error {
  status: number
  correlationId?: string
  problem?: ProblemDetails

  constructor(message: string, status: number, correlationId?: string, problem?: ProblemDetails) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.correlationId = correlationId
    this.problem = problem
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

function createCorrelationId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function buildHeaders(init?: RequestInit) {
  const headers = new Headers(init?.headers)
  headers.set('X-Correlation-Id', createCorrelationId())

  if (init?.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  return headers
}

async function parseBody(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''

  if (response.status === 204) {
    return undefined
  }

  if (contentType.includes('application/json') || contentType.includes('application/problem+json')) {
    return response.json()
  }

  return response.text()
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = buildHeaders(init)
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers,
  })

  const body = await parseBody(response)

  if (!response.ok) {
    const problem = typeof body === 'object' && body !== null ? (body as ProblemDetails) : undefined
    throw new ApiError(
      problem?.detail || problem?.title || response.statusText || 'Request failed.',
      response.status,
      response.headers.get('X-Correlation-Id') ?? undefined,
      problem,
    )
  }

  return body as T
}

function json(body?: unknown) {
  return body === undefined ? undefined : JSON.stringify(body)
}

export function buildQrResolutionPath(slug: string) {
  return `${QR_API_BASE_PATH}/${encodeURIComponent(slug)}`
}

export const publicApi = {
  getQuestDay() {
    return request<QuestDayStateResponse>('/api/quest-day/public')
  },
  resolveQr(slug: string) {
    return request<QrResolutionResponse>(buildQrResolutionPath(slug))
  },
}

export const participantApi = {
  login(payload: ParticipantLoginRequest) {
    return request<ParticipantProfileResponse>('/api/participant/auth/login', {
      method: 'POST',
      body: json(payload),
    })
  },
  register(payload: { login: string; displayName: string; password: string; avatarFile?: File | null }) {
    const body = new FormData()
    body.append('login', payload.login)
    body.append('displayName', payload.displayName)
    body.append('password', payload.password)
    if (payload.avatarFile) {
      body.append('avatar', payload.avatarFile)
    }

    return request<ParticipantProfileResponse>('/api/participant/auth/register', {
      method: 'POST',
      body,
    })
  },
  me() {
    return request<ParticipantProfileResponse>('/api/participant/auth/me')
  },
  logout() {
    return request<void>('/api/participant/auth/logout', {
      method: 'POST',
    })
  },
  availableTeams() {
    return request<TeamSummaryResponse[]>('/api/teams/available')
  },
  myTeam() {
    return request<TeamSummaryResponse>('/api/teams/me')
  },
  createTeam(payload: CreateTeamRequest) {
    return request<TeamSummaryResponse>('/api/teams', {
      method: 'POST',
      body: json(payload),
    })
  },
  joinTeam(payload: { teamId: Id; joinSecret: string }) {
    return request<TeamSummaryResponse>('/api/teams/join', {
      method: 'POST',
      body: json(payload),
    })
  },
  knownQuestions() {
    return request<QuestionSummaryResponse[]>('/api/questions/known')
  },
  question(questionId: Id) {
    return request<QuestionDetailsResponse>(`/api/questions/${questionId}`)
  },
  submitAnswer(questionId: Id, payload: SubmitAnswerRequest) {
    return request<SubmitAnswerResponse>(`/api/questions/${questionId}/answers`, {
      method: 'POST',
      body: json(payload),
    })
  },
  enigmaState() {
    return request<EnigmaStateResponse>('/api/enigma/state')
  },
  submitEnigmaAttempt(payload: SubmitEnigmaAttemptRequest) {
    return request<SubmitEnigmaAttemptResponse>('/api/enigma/attempts', {
      method: 'POST',
      body: json(payload),
    })
  },
}

export const adminApi = {
  login(payload: AdminLoginRequest) {
    return request<AuthenticatedAdminResponse>('/api/admin/auth/login', {
      method: 'POST',
      body: json(payload),
    })
  },
  me() {
    return request<AuthenticatedAdminResponse>('/api/admin/auth/me')
  },
  logout() {
    return request<void>('/api/admin/auth/logout', {
      method: 'POST',
    })
  },
  updateAdminProfile(payload: AdminSelfProfileUpdateRequest) {
    return request<AuthenticatedAdminResponse>('/api/admin/auth/profile', {
      method: 'PUT',
      body: json(payload),
    })
  },
  adminUsers() {
    return request<AdminUserListItemResponse[]>('/api/admin/users')
  },
  createAdminUser(payload: AdminUserCreateRequest) {
    return request<AdminUserListItemResponse>('/api/admin/users', {
      method: 'POST',
      body: json(payload),
    })
  },
  tags() {
    return request<TagResponse[]>('/api/admin/tags')
  },
  createTag(payload: TagUpsertRequest) {
    return request<TagResponse>('/api/admin/tags', {
      method: 'POST',
      body: json(payload),
    })
  },
  updateTag(id: Id, payload: TagUpsertRequest) {
    return request<TagResponse>(`/api/admin/tags/${id}`, {
      method: 'PUT',
      body: json(payload),
    })
  },
  questions() {
    return request<QuestionResponse[]>('/api/admin/questions')
  },
  createQuestion(payload: QuestionUpsertRequest) {
    return request<QuestionResponse>('/api/admin/questions', {
      method: 'POST',
      body: json(payload),
    })
  },
  updateQuestion(id: Id, payload: QuestionUpsertRequest) {
    return request<QuestionResponse>(`/api/admin/questions/${id}`, {
      method: 'PUT',
      body: json(payload),
    })
  },
  duplicateQuestion(id: Id) {
    return request<QuestionResponse>(`/api/admin/questions/${id}/duplicate`, {
      method: 'POST',
    })
  },
  pools() {
    return request<QuestionPoolResponse[]>('/api/admin/pools')
  },
  createPool(payload: QuestionPoolUpsertRequest) {
    return request<QuestionPoolResponse>('/api/admin/pools', {
      method: 'POST',
      body: json(payload),
    })
  },
  updatePool(id: Id, payload: QuestionPoolUpsertRequest) {
    return request<QuestionPoolResponse>(`/api/admin/pools/${id}`, {
      method: 'PUT',
      body: json(payload),
    })
  },
  qrCodes() {
    return request<QrCodeResponse[]>('/api/admin/qr')
  },
  createQrCode(payload: QrCodeUpsertRequest) {
    return request<QrCodeResponse>('/api/admin/qr', {
      method: 'POST',
      body: json(payload),
    })
  },
  updateQrCode(id: Id, payload: QrCodeUpsertRequest) {
    return request<QrCodeResponse>(`/api/admin/qr/${id}`, {
      method: 'PUT',
      body: json(payload),
    })
  },
  routingProfiles() {
    return request<RoutingProfileResponse[]>('/api/admin/routing/profiles')
  },
  createRoutingProfile(payload: RoutingProfileUpsertRequest) {
    return request<RoutingProfileResponse>('/api/admin/routing/profiles', {
      method: 'POST',
      body: json(payload),
    })
  },
  updateRoutingProfile(id: Id, payload: RoutingProfileUpsertRequest) {
    return request<RoutingProfileResponse>(`/api/admin/routing/profiles/${id}`, {
      method: 'PUT',
      body: json(payload),
    })
  },
  activateRoutingProfile(id: Id) {
    return request<void>(`/api/admin/routing/profiles/${id}/activate`, {
      method: 'POST',
    })
  },
  rotateTag(tagId: Id, step: number) {
    return request<void>(`/api/admin/routing/tags/${tagId}/rotate?step=${step}`, {
      method: 'POST',
    })
  },
  routingPreview() {
    return request<RoutingPreviewRowResponse[]>('/api/admin/routing/preview')
  },
  createOverride(payload: QrBindingOverrideRequest) {
    return request<QrBindingOverrideResponse>('/api/admin/routing/overrides', {
      method: 'POST',
      body: json(payload),
    })
  },
  clearOverride(id: Id) {
    return request<void>(`/api/admin/routing/overrides/${id}`, {
      method: 'DELETE',
    })
  },
  enigmaProfiles() {
    return request<EnigmaProfileResponse[]>('/api/admin/enigma/profiles')
  },
  createEnigmaProfile(payload: EnigmaProfileUpsertRequest) {
    return request<EnigmaProfileResponse>('/api/admin/enigma/profiles', {
      method: 'POST',
      body: json(payload),
    })
  },
  updateEnigmaProfile(id: Id, payload: EnigmaProfileUpsertRequest) {
    return request<EnigmaProfileResponse>(`/api/admin/enigma/profiles/${id}`, {
      method: 'PUT',
      body: json(payload),
    })
  },
  activateEnigmaProfile(id: Id) {
    return request<void>(`/api/admin/enigma/profiles/${id}/activate`, {
      method: 'POST',
    })
  },
  questDay() {
    return request<QuestDayStateResponse>('/api/admin/quest-day')
  },
  updateQuestDayMessages(payload: UpdateQuestDayMessagesRequest) {
    return request<QuestDayStateResponse>('/api/admin/quest-day/messages', {
      method: 'PUT',
      body: json(payload),
    })
  },
  startQuestDay() {
    return request<QuestDayStateResponse>('/api/admin/quest-day/start', {
      method: 'POST',
    })
  },
  finishQuestDay() {
    return request<QuestDayStateResponse>('/api/admin/quest-day/finish', {
      method: 'POST',
    })
  },
  globalSettings() {
    return request<GlobalSettingsResponse>('/api/admin/settings/global')
  },
  updateGlobalSettings(payload: GlobalSettingsUpdateRequest) {
    return request<GlobalSettingsResponse>('/api/admin/settings/global', {
      method: 'PUT',
      body: json(payload),
    })
  },
  supportTeams() {
    return request<TeamSummaryResponse[]>('/api/admin/support/teams')
  },
  supportTeam(teamId: Id) {
    return request<TeamSupportDetailsResponse>(`/api/admin/support/teams/${teamId}`)
  },
  unlockQuestion(teamId: Id, questionId: Id, payload: TeamQuestionAdjustmentRequest) {
    return request<void>(`/api/admin/support/teams/${teamId}/questions/${questionId}/unlock`, {
      method: 'POST',
      body: json(payload),
    })
  },
  solveQuestion(teamId: Id, questionId: Id, payload: TeamQuestionAdjustmentRequest) {
    return request<void>(`/api/admin/support/teams/${teamId}/questions/${questionId}/solve`, {
      method: 'POST',
      body: json(payload),
    })
  },
  revokeReward(teamId: Id, questionId: Id, payload: TeamQuestionAdjustmentRequest) {
    return request<void>(`/api/admin/support/teams/${teamId}/questions/${questionId}/revoke-reward`, {
      method: 'POST',
      body: json(payload),
    })
  },
  adjustReward(teamId: Id, payload: TeamRewardAdjustmentRequest) {
    return request<void>(`/api/admin/support/teams/${teamId}/rewards/adjust`, {
      method: 'POST',
      body: json(payload),
    })
  },
  removeMember(teamId: Id, membershipId: Id, payload: TeamMemberRemovalRequest) {
    return request<void>(`/api/admin/support/teams/${teamId}/members/${membershipId}/remove`, {
      method: 'POST',
      body: json(payload),
    })
  },
  resetParticipantPassword(participantId: Id, payload: ParticipantPasswordResetRequest) {
    return request<void>(`/api/admin/support/participants/${participantId}/password`, {
      method: 'POST',
      body: json(payload),
    })
  },
  audit(take = 200) {
    return request<AuditEntryResponse[]>(`/api/admin/audit?take=${take}`)
  },
}

export function describeAnswerResult(result: AnswerResult) {
  const labels: Record<AnswerResult, string> = {
    not_started: 'Квест еще не запущен',
    day_closed: 'Игровой день уже завершен',
    already_solved: 'Вопрос уже решен',
    cooldown: 'Сработал кулдаун',
    wrong: 'Ответ неверный',
    correct: 'Ответ принят',
  }

  return labels[result]
}

export function describeEnigmaAttemptResult(result: EnigmaAttemptResult) {
  const labels: Record<EnigmaAttemptResult, string> = {
    not_started: 'Квест еще не запущен',
    day_closed: 'Игровой день уже завершен',
    cooldown: 'Сработал кулдаун',
    success: 'Успех',
    failure: 'Неудача',
  }

  return labels[result]
}
