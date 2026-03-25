export type Id = string

export type ThemeMode = 'light' | 'dark' | 'system'
export type QuestDayStatus = 'NotStarted' | 'Running' | 'DayClosed'
export type QuestionStatus = 'Draft' | 'Active' | 'Disabled' | 'Archived'
export type AnswerValidationKind = 'ExactText' | 'NormalizedText' | 'Numeric'
export type QuestionSelectionMode = 'PoolSlotRotation'
export type EnigmaMode = 'HistoricalLike' | 'SimpleCombination'
export type QrResolutionState =
  | 'not_found'
  | 'not_started'
  | 'day_closed'
  | 'requires_auth'
  | 'requires_team'
  | 'unavailable'
  | 'resolved'
export type AnswerResult =
  | 'not_started'
  | 'day_closed'
  | 'already_solved'
  | 'cooldown'
  | 'wrong'
  | 'correct'
export type EnigmaAttemptResult =
  | 'not_started'
  | 'day_closed'
  | 'cooldown'
  | 'success'
  | 'failure'
  | 'already_solved'

export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  traceId?: string
  [key: string]: unknown
}

export interface AdminLoginRequest {
  login: string
  password: string
}

export interface AuthenticatedAdminResponse {
  id: Id
  login: string
  role: string
  isActive: boolean
}

export interface AdminSelfProfileUpdateRequest {
  currentPassword: string
  newLogin?: string | null
  newPassword?: string | null
}

export interface AdminUserCreateRequest {
  login: string
  password: string
  role: string
}

export interface AdminUserListItemResponse {
  id: Id
  login: string
  role: string
  isActive: boolean
  lastLoginAt?: string | null
}

export interface ParticipantLoginRequest {
  login: string
  password: string
}

export interface ParticipantProfileResponse {
  id: Id
  provider: string
  providerSubject: string
  displayName: string
  avatarUrl?: string | null
  isBlocked: boolean
  login?: string | null
}

export interface CreateTeamRequest {
  name: string
  joinSecret: string
}

export interface UpdateTeamJoinSecretRequest {
  joinSecret: string
}

export interface JoinTeamRequest {
  teamId: Id
  joinSecret: string
}

export interface TeamMemberResponse {
  membershipId: Id
  participantId: Id
  displayName: string
  status: string
  joinedAt: string
  avatarUrl?: string | null
  provider: string
}

export interface ParticipantPasswordResetRequest {
  newPassword: string
  reason?: string | null
}

export interface TeamSummaryResponse {
  id: Id
  name: string
  status: string
  isLocked: boolean
  isHidden: boolean
  isDisqualified: boolean
  /** Denormalized flag; absent on older API payloads. */
  enigmaSolved?: boolean
  enigmaSolvedAt?: string | null
  /** Participant id of team creator (captain); absent on older payloads. */
  createdByParticipantId?: Id | null
  finalTaskPhotoUrl?: string | null
  finalTaskPhotoUploadedAt?: string | null
  /** Plaintext join secret; только для капитана в GET /api/teams/me. */
  joinSecretForCaptain?: string | null
  members: TeamMemberResponse[]
}

export interface QuestionAnswerSchemaDto {
  kind: AnswerValidationKind
  acceptedAnswers: string[]
  expectedNumericValue?: number | null
  numericTolerance?: number | null
  trimWhitespace: boolean
  ignoreCase: boolean
  collapseInnerWhitespace: boolean
  removePunctuation: boolean
}

export interface QuestionSummaryResponse {
  id: Id
  tagId: Id
  tagName: string
  tagColor: string
  title: string
  isSolved: boolean
  nextAllowedAnswerAt?: string | null
  lastAttemptAt?: string | null
  firstUnlockedAt: string
  /** Filled for player known-questions API only when the question is solved (otherwise empty). */
  footerHint: string
}

export interface QuestionDetailsResponse {
  id: Id
  tagId: Id
  tagName: string
  tagColor: string
  title: string
  bodyRichText: string
  footerHint: string
  imageUrl?: string | null
  isSolved: boolean
  nextAllowedAnswerAt?: string | null
  firstUnlockedAt: string
  solvedAt?: string | null
}

export interface SubmitAnswerRequest {
  answer: string
}

export interface SubmitAnswerResponse {
  result: AnswerResult
  isSolved: boolean
  rewardGranted: boolean
  nextAllowedAnswerAt?: string | null
  message: string
  serverTime: string
}

export interface QrResolutionResponse {
  state: QrResolutionState
  message: string
  qrCodeId?: Id | null
  questionId?: Id | null
  question?: QuestionDetailsResponse | null
  serverTime: string
}

/** Admin enigma profile rotor row (no team runtime fields). */
export interface EnigmaRotorDefinitionDto {
  id: Id
  tagId: Id
  tagName: string
  color: string
  label: string
  displayOrder: number
  positionMin: number
  positionMax: number
  isActive: boolean
}

/** Player enigma state: definition + unlock + persisted draft value. */
export interface EnigmaRotorStateDto extends EnigmaRotorDefinitionDto {
  isUnlocked: boolean
  draftPosition: number
}

export interface EnigmaStateResponse {
  profileId: Id
  mode: EnigmaMode
  attemptCooldownMinutes: number
  nextAllowedAttemptAt?: string | null
  rotors: EnigmaRotorStateDto[]
  isEnigmaSolved?: boolean
  solvedRevealMessage?: string | null
  serverTime: string
}

export interface UpdateEnigmaDraftPositionsRequest {
  positions: Record<Id, number>
}

export interface SubmitEnigmaAttemptRequest {
  rotorPositions: Record<Id, number>
}

export interface SubmitEnigmaAttemptResponse {
  result: EnigmaAttemptResult
  message: string
  afterFailureMessage?: string | null
  nextAllowedAttemptAt?: string | null
  serverTime: string
}

export interface QuestDayStateResponse {
  id: Id
  dayCode: string
  status: QuestDayStatus
  message: string
  serverTime: string
  startedAt?: string | null
  endedAt?: string | null
}

export interface UpdateQuestDayMessagesRequest {
  preStartMessage: string
  dayClosedMessage: string
}

export interface TagUpsertRequest {
  code: string
  name: string
  color: string
  isActive: boolean
  sortOrder: number
  description?: string | null
}

export interface TagResponse extends TagUpsertRequest {
  id: Id
}

export interface QuestionUpsertRequest {
  tagId: Id
  title: string
  bodyRichText: string
  footerHint: string
  imageUrl?: string | null
  status: QuestionStatus
  isActive: boolean
  isArchived: boolean
  supportNotes?: string | null
  answerSchema: QuestionAnswerSchemaDto
}

export interface QuestionResponse extends QuestionUpsertRequest {
  id: Id
}

export interface QuestionPoolEntryRequest {
  questionId: Id
  position: number
  isEnabled: boolean
  notes?: string | null
}

export interface QuestionPoolUpsertRequest {
  tagId: Id
  name: string
  isActive: boolean
  isArchived: boolean
  description?: string | null
  sortOrder: number
  entries: QuestionPoolEntryRequest[]
}

export interface QuestionPoolEntryResponse extends QuestionPoolEntryRequest {
  id: Id
}

export interface QuestionPoolResponse extends QuestionPoolUpsertRequest {
  id: Id
}

export interface QrCodeUpsertRequest {
  tagId: Id
  slug: string
  label: string
  slotIndex: number
  isActive: boolean
  notes?: string | null
}

export interface QrCodeResponse extends QrCodeUpsertRequest {
  id: Id
}

export interface RoutingProfileTagStateRequest {
  tagId: Id
  activePoolId?: Id | null
  rotationOffset: number
  selectionMode: QuestionSelectionMode
  isEnabled: boolean
}

export interface RoutingProfileUpsertRequest {
  name: string
  isActive: boolean
  description?: string | null
  tagStates: RoutingProfileTagStateRequest[]
}

export interface RoutingProfileTagStateResponse extends RoutingProfileTagStateRequest {
  id: Id
}

export interface RoutingProfileResponse extends RoutingProfileUpsertRequest {
  id: Id
}

export interface QrBindingOverrideRequest {
  qrCodeId: Id
  questionId: Id
  scopeProfileId?: Id | null
  isActive: boolean
  reason?: string | null
}

export interface QrBindingOverrideResponse extends QrBindingOverrideRequest {
  id: Id
}

export interface RoutingPreviewRowResponse {
  qrCodeId: Id
  qrLabel: string
  qrSlug: string
  tagId: Id
  tagName: string
  questionId?: Id | null
  questionTitle?: string | null
  resolutionMode: string
}

export interface EnigmaRotorDefinitionRequest {
  tagId: Id
  label: string
  colorOverride?: string | null
  displayOrder: number
  positionMin: number
  positionMax: number
  isActive: boolean
}

export interface EnigmaProfileUpsertRequest {
  name: string
  mode: EnigmaMode
  isActive: boolean
  attemptCooldownMinutes: number
  successMessage: string
  failureMessage: string
  secretCombination: Record<Id, number>
  rotors: EnigmaRotorDefinitionRequest[]
}

export interface EnigmaProfileResponse extends EnigmaProfileUpsertRequest {
  id: Id
  rotors: EnigmaRotorDefinitionDto[]
}

export interface GlobalSettingsUpdateRequest {
  answerCooldownMinutes: number
  enigmaCooldownMinutes: number
  maxTeamMembers: number
  defaultAnswerNormalization: string
  currentQuestDayStateId?: Id | null
  currentRoutingProfileId?: Id | null
  currentEnigmaProfileId?: Id | null
  flagsJson: string
  timezone: string
}

export interface GlobalSettingsResponse extends GlobalSettingsUpdateRequest {
  id: Id
}

export interface TeamRewardAdjustmentRequest {
  tagId: Id
  sourceQuestionId?: Id | null
  revoke: boolean
  rewardType: string
}

export interface TeamQuestionAdjustmentRequest {
  reason?: string | null
}

export interface TeamMemberRemovalRequest {
  reason?: string | null
}

export interface AuditEntryResponse {
  id: Id
  adminUserId?: Id | null
  actionType: string
  entityType: string
  entityId: string
  occurredAt: string
  diffJson: string
  reason?: string | null
  correlationId?: string | null
}

export interface TeamSupportDetailsResponse {
  team: TeamSummaryResponse
  questions: QuestionSummaryResponse[]
  auditTrail: AuditEntryResponse[]
}

export const queryKeys = {
  participantSession: ['participant', 'auth', 'me'] as const,
  adminSession: ['admin', 'auth', 'me'] as const,
  questDayPublic: ['questDay', 'public'] as const,
  teamsAvailable: ['teams', 'available'] as const,
  teamsMe: ['teams', 'me'] as const,
  questionsKnown: ['questions', 'known'] as const,
  questionDetail: (questionId: Id) => ['questions', 'detail', questionId] as const,
  qrResolution: (slug: string) => ['public', 'qr', slug] as const,
  enigmaState: ['enigma', 'state'] as const,
  adminTags: ['admin', 'tags'] as const,
  adminQuestions: ['admin', 'questions'] as const,
  adminPools: ['admin', 'pools'] as const,
  adminQr: ['admin', 'qr'] as const,
  adminRoutingProfiles: ['admin', 'routing', 'profiles'] as const,
  adminRoutingPreview: ['admin', 'routing', 'preview'] as const,
  adminEnigmaProfiles: ['admin', 'enigma', 'profiles'] as const,
  adminQuestDay: ['admin', 'questDay'] as const,
  adminSettings: ['admin', 'settings', 'global'] as const,
  adminUsers: ['admin', 'users'] as const,
  adminSupportTeams: ['admin', 'support', 'teams'] as const,
  adminSupportTeam: (teamId: Id) => ['admin', 'support', 'team', teamId] as const,
  adminAudit: (take: number) => ['admin', 'audit', take] as const,
}
