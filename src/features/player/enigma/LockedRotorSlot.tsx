import type { EnigmaRotorStateDto } from '@/shared/contracts/api'
import { TagChip } from '@/shared/ui/ui'

export function LockedRotorSlot({ rotor }: { rotor: EnigmaRotorStateDto }) {
  return (
    <div className="flex min-h-[17.5rem] flex-col justify-between rounded-2xl border border-dashed border-border/80 bg-muted/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <TagChip name={rotor.tagName} color={rotor.color} />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Закрыто</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6">
        <div
          className="h-36 w-full max-w-[8.5rem] rounded-xl bg-gradient-to-b from-muted to-muted/30 opacity-70"
          style={{ boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.08)' }}
        />
        <p className="max-w-[14rem] text-center text-xs text-muted-foreground">
          Ротор откроется, когда команда решит вопрос с тегом «{rotor.tagName}».
        </p>
      </div>
      <p className="text-center text-[11px] text-muted-foreground/80">{rotor.label}</p>
    </div>
  )
}
