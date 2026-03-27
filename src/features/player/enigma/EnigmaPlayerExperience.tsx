import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { WandSparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'

import { RotorWheel } from '@/features/player/enigma/RotorWheel'
import { LockedRotorSlot } from '@/features/player/enigma/LockedRotorSlot'
import { playEnigmaTypeClick } from '@/features/player/enigma/enigmaTypeSound'
import { describeEnigmaAttemptResult, isApiError, participantApi } from '@/shared/api/client'
import {
  type EnigmaStateResponse,
  type SubmitEnigmaAttemptResponse,
  type TeamSummaryResponse,
  queryKeys,
} from '@/shared/contracts/api'
import {
  AlertBox,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CooldownAlertBox,
  Modal,
} from '@/shared/ui/ui'
import { IMAGE_UPLOAD_ACCEPT } from '@/shared/utils/image-upload'

const EXIT_MS = 420
const GAP_MS = 300
/** Failure path: faster typewriter. Success: slower for emphasis. */
const TYPE_MS_FAILURE = 7
const TYPE_MS_SUCCESS = 26
/** After failure text is fully typed, hold paper before fade + toast + rotors. */
const WRONG_HOLD_AFTER_TYPING_MS = 2000
const WRONG_CLEANUP_MS = 520
const ROTORS_ENTER_DURATION_S = 0.48
const SOUND_EVERY_CHARS = 2
const DEFAULT_FAILURE_TOAST = 'Кажется, сообщение не удалось расшифровать :('

type Scene = 'idle' | 'exiting' | 'typing' | 'wrong_cleanup' | 'solved_persistent'

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export function EnigmaPlayerExperience({
  state,
  effectivePositions,
  setDeltas,
  saveDraft,
  teamSummary,
  participantId,
}: {
  state: EnigmaStateResponse
  effectivePositions: Record<string, number>
  setDeltas: React.Dispatch<React.SetStateAction<Record<string, number>>>
  saveDraft: {
    mutate: (positions: Record<string, number>) => void
    isPending: boolean
  }
  teamSummary: TeamSummaryResponse
  participantId: string
}) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [scene, setScene] = useState<Scene>(() => (state.isEnigmaSolved ? 'solved_persistent' : 'idle'))
  const [paperTarget, setPaperTarget] = useState(() => state.solvedRevealMessage ?? '')
  const [typedLen, setTypedLen] = useState(() => (state.isEnigmaSolved ? (state.solvedRevealMessage ?? '').length : 0))
  const [lifecycleBanner, setLifecycleBanner] = useState<SubmitEnigmaAttemptResponse | null>(null)

  const typingKindRef = useRef<'success' | 'failure'>('success')
  const typingDoneRef = useRef(false)
  const failureToastRef = useRef<string | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const flowAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    flowAbortRef.current?.abort()
    typingDoneRef.current = false
    setLifecycleBanner(null)
    setScene(state.isEnigmaSolved ? 'solved_persistent' : 'idle')
    setPaperTarget(state.solvedRevealMessage ?? '')
    setTypedLen(state.isEnigmaSolved ? (state.solvedRevealMessage ?? '').length : 0)
  }, [state.profileId])

  useEffect(() => {
    if (!state.isEnigmaSolved) return
    setScene((s) => (s === 'exiting' || s === 'typing' || s === 'wrong_cleanup' ? s : 'solved_persistent'))
  }, [state.isEnigmaSolved])

  useEffect(() => {
    if (!state.isEnigmaSolved) return
    if (scene === 'typing' || scene === 'exiting' || scene === 'wrong_cleanup') return
    const next = state.solvedRevealMessage ?? ''
    setPaperTarget(next)
    setTypedLen(next.length)
  }, [state.isEnigmaSolved, state.solvedRevealMessage, scene])

  const allActiveRotorsUnlocked = useMemo(
    () => state.rotors.filter((r) => r.isActive).every((r) => r.isUnlocked),
    [state.rotors],
  )

  const ensureAudio = useCallback(async () => {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    if (!audioCtxRef.current) audioCtxRef.current = new AC()
    try {
      await audioCtxRef.current.resume()
    } catch {
      /* ignore */
    }
    return audioCtxRef.current
  }, [])

  const attempt = useMutation({
    mutationFn: (positions: Record<string, number>) =>
      participantApi.submitEnigmaAttempt({ rotorPositions: positions }),
  })

  const uploadPhoto = useMutation({
    mutationFn: (file: File) => participantApi.uploadFinalTaskPhoto(file),
    onSuccess: async () => {
      toast.success('Фотография отправлена')
      await queryClient.invalidateQueries({ queryKey: queryKeys.teamsMe })
      setConfirmOpen(false)
      setPendingFile(null)
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    },
    onError: (error) => {
      toast.error(isApiError(error) ? error.message : 'Не удалось отправить фотографию')
    },
  })

  const isCaptain = Boolean(
    teamSummary.createdByParticipantId && participantId && teamSummary.createdByParticipantId === participantId,
  )
  const finalPhotoDone = Boolean(teamSummary.finalTaskPhotoUploadedAt || teamSummary.finalTaskPhotoUrl)

  const closePhotoConfirm = () => {
    setConfirmOpen(false)
    setPendingFile(null)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  const onFinalPhotoSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPendingFile(file)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setConfirmOpen(true)
  }

  const runPaperFlow = useCallback(
    async (r: SubmitEnigmaAttemptResponse, signal: AbortSignal) => {
      typingKindRef.current = r.result === 'failure' ? 'failure' : 'success'
      failureToastRef.current =
        r.result === 'failure' ? (r.afterFailureMessage?.trim() || DEFAULT_FAILURE_TOAST) : null
      typingDoneRef.current = false
      setPaperTarget(r.message)
      setTypedLen(0)
      setLifecycleBanner(null)
      setScene('exiting')
      await sleep(EXIT_MS)
      if (signal.aborted) return
      await sleep(GAP_MS)
      if (signal.aborted) return
      setScene('typing')
    },
    [],
  )

  const handleSubmit = async () => {
    setLifecycleBanner(null)
    await ensureAudio()
    flowAbortRef.current?.abort()
    const ac = new AbortController()
    flowAbortRef.current = ac
    const signal = ac.signal

    try {
      const r = await attempt.mutateAsync(effectivePositions)

      if (r.result === 'not_started' || r.result === 'day_closed' || r.result === 'cooldown') {
        setLifecycleBanner(r)
        toast.message(describeEnigmaAttemptResult(r.result), { description: r.message })
        await queryClient.invalidateQueries({ queryKey: queryKeys.enigmaState })
        return
      }

      if (r.result === 'already_solved') {
        queryClient.setQueryData<EnigmaStateResponse>(queryKeys.enigmaState, (old) =>
          old ? { ...old, isEnigmaSolved: true, solvedRevealMessage: r.message } : old,
        )
        setPaperTarget(r.message)
        setTypedLen(r.message.length)
        setScene('solved_persistent')
        await queryClient.invalidateQueries({ queryKey: queryKeys.enigmaState })
        return
      }

      if (r.result === 'success' || r.result === 'failure') {
        await runPaperFlow(r, signal)
      }
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'Не удалось отправить попытку Enigma')
    }
  }

  useEffect(() => {
    if (scene !== 'typing') return
    if (typedLen >= paperTarget.length) return
    const ms = typingKindRef.current === 'success' ? TYPE_MS_SUCCESS : TYPE_MS_FAILURE
    const id = window.setTimeout(() => setTypedLen((n) => n + 1), ms)
    return () => window.clearTimeout(id)
  }, [scene, typedLen, paperTarget])

  useEffect(() => {
    if (scene !== 'typing') return
    if (typedLen === 0) return
    if (typedLen % SOUND_EVERY_CHARS !== 0) return
    const ctx = audioCtxRef.current
    if (ctx) playEnigmaTypeClick(ctx)
  }, [scene, typedLen])

  useEffect(() => {
    if (scene !== 'typing') return
    if (typedLen < paperTarget.length) return
    if (typingDoneRef.current) return
    typingDoneRef.current = true

    if (typingKindRef.current === 'failure') {
      const holdId = window.setTimeout(() => setScene('wrong_cleanup'), WRONG_HOLD_AFTER_TYPING_MS)
      return () => window.clearTimeout(holdId)
    }

    queryClient.setQueryData<EnigmaStateResponse>(queryKeys.enigmaState, (old) =>
      old ? { ...old, isEnigmaSolved: true, solvedRevealMessage: paperTarget } : old,
    )
    setScene('solved_persistent')
  }, [scene, typedLen, paperTarget, queryClient])

  useEffect(() => {
    if (scene !== 'wrong_cleanup') return
    const id = window.setTimeout(() => {
      setScene('idle')
      const msg = failureToastRef.current ?? DEFAULT_FAILURE_TOAST
      failureToastRef.current = null
      toast.error(msg)
      void queryClient.invalidateQueries({ queryKey: queryKeys.enigmaState })
    }, WRONG_CLEANUP_MS)
    return () => window.clearTimeout(id)
  }, [scene, queryClient])

  const rotorsOpen = scene === 'idle' || scene === 'exiting'
  const paperOpen = scene === 'typing' || scene === 'wrong_cleanup' || scene === 'solved_persistent'
  const submitDisabled =
    attempt.isPending ||
    scene !== 'idle' ||
    !allActiveRotorsUnlocked ||
    state.isEnigmaSolved ||
    saveDraft.isPending

  const paperClass =
    scene === 'wrong_cleanup' ? 'opacity-0 scale-[0.98] blur-[2px]' : 'opacity-100 scale-100 blur-0'

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        <AnimatePresence initial={false} mode="popLayout">
          {rotorsOpen ? (
            <motion.div
              key="rotors"
              initial={{ opacity: 0, y: 20 }}
              animate={{
                opacity: scene === 'exiting' ? 0 : 1,
                y: scene === 'exiting' ? -10 : 0,
              }}
              exit={{ opacity: 0, y: 12 }}
              transition={{
                duration: scene === 'exiting' ? EXIT_MS / 1000 : ROTORS_ENTER_DURATION_S,
                ease: 'easeOut',
              }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Роторы</CardTitle>
                  <CardDescription>
                    Крутите диск или используйте кнопки. На телефоне позиция сохраняется после остановки прокрутки или при уходе фокуса с ротора.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {state.rotors.map((rotor) =>
                    rotor.isUnlocked ? (
                      <RotorWheel
                        key={rotor.id}
                        label={rotor.label}
                        tagName={rotor.tagName}
                        color={rotor.color}
                        min={rotor.positionMin}
                        max={rotor.positionMax}
                        value={effectivePositions[rotor.tagId] ?? rotor.draftPosition}
                        onChange={(v) => setDeltas((d) => ({ ...d, [rotor.tagId]: v }))}
                        onCommit={(v) => {
                          saveDraft.mutate({ [rotor.tagId]: v })
                        }}
                      />
                    ) : (
                      <LockedRotorSlot key={rotor.id} rotor={rotor} />
                    ),
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {paperOpen ? (
            <motion.div
              key="paper"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.35 }}
            >
              <div
                className={`relative mx-auto max-w-2xl rounded-sm border border-amber-900/25 bg-[#f4e9d8] px-8 py-10 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.35),inset_0_0_80px_rgba(139,90,43,0.08)] transition-all duration-[480ms] ease-out ${paperClass}`}
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(120,80,40,0.07) 31px, rgba(120,80,40,0.07) 32px)',
                  /* Shift ruling up vs content so baselines sit nearer the drawn line (padding on <p> broke the 32px rhythm). */
                  backgroundPosition: '0 -5px',
                }}
              >
                <div
                  className="pointer-events-none absolute inset-0 rounded-sm opacity-[0.14] mix-blend-multiply"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                  }}
                />
                <p
                  className="relative m-0 whitespace-pre-wrap font-mono text-[0.95rem] text-amber-950/95"
                  style={{
                    lineHeight: '32px',
                  }}
                >
                  {paperTarget.slice(0, typedLen)}
                  {scene === 'typing' && typedLen < paperTarget.length ? (
                    <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-amber-900/70 align-middle" />
                  ) : null}
                </p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="space-y-4">
        {state.isEnigmaSolved ? (
          <Card>
            <CardHeader>
              <CardTitle>Последнее задание</CardTitle>
              <CardDescription>После успешной расшифровки Enigma капитан команды может выгрузить одну фотографию.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {finalPhotoDone ? (
                <p className="text-sm text-muted-foreground">Фотография отправлена организаторам.</p>
              ) : isCaptain ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={IMAGE_UPLOAD_ACCEPT}
                    className="sr-only"
                    onChange={onFinalPhotoSelected}
                  />
                  <Button type="button" className="w-full" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                    Загрузить фотографию
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Загрузить фото может капитан команды.</p>
              )}
            </CardContent>
          </Card>
        ) : null}
        {!state.isEnigmaSolved && scene !== 'solved_persistent' ? (
          <Card>
            <CardHeader>
              <CardTitle>Отправить попытку</CardTitle>
              <CardDescription>Следующая попытка будет доступна через некоторое время.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <CooldownAlertBox
                targetIso={state.nextAllowedAttemptAt}
                serverTimeIso={state.serverTime}
                title="Кулдаун активен"
              />
              {lifecycleBanner ? (
                <AlertBox
                  tone={
                    lifecycleBanner.result === 'cooldown'
                      ? 'warning'
                      : lifecycleBanner.result === 'day_closed'
                        ? 'danger'
                        : 'info'
                  }
                  title={describeEnigmaAttemptResult(lifecycleBanner.result)}
                  description={lifecycleBanner.message}
                />
              ) : null}
              {!allActiveRotorsUnlocked ? (
                <p className="text-sm text-muted-foreground">
                  Откройте все активные роторы (решите вопросы с нужными тегами), чтобы проверить комбинацию.
                </p>
              ) : null}
              <Button className="w-full" onClick={() => void handleSubmit()} disabled={submitDisabled}>
                <WandSparkles className="h-4 w-4" />
                {attempt.isPending ? 'Проверяю...' : 'Проверить комбинацию'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Расшифровка</CardTitle>
              <CardDescription>Комбинация верна. Текст выше можно обновить организаторами — страница подтянет изменения автоматически.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      <Modal
        open={confirmOpen}
        onClose={closePhotoConfirm}
        title="Подтвердите отправку"
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={closePhotoConfirm} disabled={uploadPhoto.isPending}>
              Отмена
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (pendingFile) void uploadPhoto.mutateAsync(pendingFile)
              }}
              disabled={!pendingFile || uploadPhoto.isPending}
            >
              {uploadPhoto.isPending ? 'Отправка...' : 'Отправить'}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          Вы уверены, что хотите выгрузить эту фотографию? Вы можете выгрузить только одну фотографию.
        </p>
        {previewUrl ? (
          <img src={previewUrl} alt="" className="mt-4 max-h-64 w-full rounded-xl border border-border object-contain" />
        ) : null}
      </Modal>
    </div>
  )
}
