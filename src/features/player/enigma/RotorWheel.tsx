import { useCallback, useEffect, useRef } from 'react'

const ITEM_PX = 40
const VIEW_H = 176

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function rangeInclusive(min: number, max: number) {
  const out: number[] = []
  for (let i = min; i <= max; i += 1) out.push(i)
  return out
}

export function RotorWheel({
  label,
  tagName,
  color,
  min,
  max,
  value,
  onChange,
  onCommit,
}: {
  label: string
  tagName: string
  color: string
  min: number
  max: number
  value: number
  onChange: (v: number) => void
  onCommit: (v: number) => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCommittedRef = useRef(value)
  const values = rangeInclusive(min, max)

  useEffect(() => {
    lastCommittedRef.current = value
  }, [value])

  const emitCommit = useCallback(
    (v: number) => {
      if (lastCommittedRef.current === v) return
      lastCommittedRef.current = v
      onCommit(v)
    },
    [onCommit],
  )
  const pad = (VIEW_H - ITEM_PX) / 2

  const scrollToValue = useCallback(
    (v: number, behavior: ScrollBehavior = 'auto') => {
      const el = scrollerRef.current
      if (!el) return
      const idx = clamp(v - min, 0, values.length - 1)
      el.scrollTo({ top: idx * ITEM_PX, behavior })
    },
    [min, values.length],
  )

  useEffect(() => {
    scrollToValue(value, 'auto')
  }, [value, scrollToValue])

  const scheduleButtonCommit = useCallback(
    (v: number) => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current)
      commitTimerRef.current = setTimeout(() => {
        commitTimerRef.current = null
        emitCommit(v)
      }, 280)
    },
    [emitCommit],
  )

  const flushScrollCommit = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const idx = clamp(Math.round(el.scrollTop / ITEM_PX), 0, values.length - 1)
    const v = min + idx
    if (v !== value) onChange(v)
    emitCommit(v)
    scrollToValue(v, 'smooth')
  }, [min, onChange, emitCommit, value, values.length, scrollToValue])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const delta = e.key === 'ArrowUp' ? -1 : 1
      const v = clamp(value + delta, min, max)
      onChange(v)
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(min)
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(max)
    }
  }

  return (
    <div
      className="rotor-wheel-enclosure rounded-2xl border border-zinc-700/80 bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-950 p-3 shadow-[inset_0_2px_12px_rgba(0,0,0,0.45)]"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.35)' }}
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <span
          className="inline-flex max-w-[65%] items-center gap-2 truncate text-xs font-medium text-zinc-200"
          title={label}
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full ring-2 ring-white/20"
            style={{ backgroundColor: color }}
          />
          <span className="truncate">{tagName}</span>
        </span>
        <span className="truncate text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      </div>

      <div className="flex items-stretch gap-0">
        <div
          className="rotor-gear relative w-7 shrink-0 rounded-l-xl border border-r-0 border-zinc-600/90 bg-gradient-to-b from-zinc-300 via-zinc-100 to-zinc-400"
          aria-hidden
        >
          <div
            className="absolute inset-y-1 left-0.5 w-2 rounded-sm bg-[repeating-linear-gradient(180deg,transparent,transparent_3px,rgba(0,0,0,0.22)_3px,rgba(0,0,0,0.22)_5px)]"
            style={{ boxShadow: 'inset -1px 0 2px rgba(255,255,255,0.7)' }}
          />
          <div className="absolute inset-y-0 right-0 w-1 bg-gradient-to-b from-white/50 via-transparent to-black/25" />
        </div>

        <div className="relative min-w-0 flex-1">
          <div
            className="pointer-events-none absolute left-0 right-0 top-1/2 z-10 h-10 -translate-y-1/2 border-y border-red-600/70 bg-red-500/5"
            aria-hidden
          />
          <div
            ref={scrollerRef}
            tabIndex={0}
            role="slider"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-label={`Ротор ${label}, значение ${value}`}
            onKeyDown={onKeyDown}
            onBlur={() => {
              if (commitTimerRef.current) {
                clearTimeout(commitTimerRef.current)
                commitTimerRef.current = null
              }
              emitCommit(value)
            }}
            className="rotor-scroller h-44 overflow-y-auto overflow-x-hidden rounded-r-xl border border-l-0 border-zinc-600/90 bg-gradient-to-b from-[#d4d4d8] via-[#e4e4e7] to-[#a1a1aa] outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
            style={{
              scrollSnapType: 'y mandatory',
              scrollbarWidth: 'thin',
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.12)',
            }}
            onPointerUp={flushScrollCommit}
            onPointerCancel={flushScrollCommit}
          >
            <div style={{ paddingTop: pad, paddingBottom: pad }}>
              {values.map((n) => (
                <div
                  key={n}
                  className="flex h-10 items-center justify-center font-mono text-lg tabular-nums text-zinc-900"
                  style={{ scrollSnapAlign: 'center' }}
                >
                  {n}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-center gap-2">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-500 bg-gradient-to-b from-zinc-200 to-zinc-400 text-lg font-semibold text-zinc-900 shadow-md transition hover:brightness-110 active:scale-95 disabled:opacity-40"
          disabled={value <= min}
          onClick={() => {
            const v = clamp(value - 1, min, max)
            onChange(v)
            scheduleButtonCommit(v)
          }}
        >
          −
        </button>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-500 bg-gradient-to-b from-zinc-200 to-zinc-400 text-lg font-semibold text-zinc-900 shadow-md transition hover:brightness-110 active:scale-95 disabled:opacity-40"
          disabled={value >= max}
          onClick={() => {
            const v = clamp(value + 1, min, max)
            onChange(v)
            scheduleButtonCommit(v)
          }}
        >
          +
        </button>
      </div>
    </div>
  )
}
