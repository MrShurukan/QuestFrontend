import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { AlertTriangle, LoaderCircle } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import Markdown from 'react-markdown'

import { cn } from '@/shared/lib/cn'
import { formatDateTime, formatRemainingMs, getRemainingMs } from '@/shared/utils/time'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/85',
        outline: 'border border-border bg-background hover:bg-muted',
        ghost: 'hover:bg-muted',
        danger: 'bg-danger text-white hover:bg-danger/90',
      },
      size: {
        sm: 'h-9 px-3',
        md: 'h-10 px-4',
        lg: 'h-11 px-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'flex h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring',
        props.className,
      )}
    />
  )
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'flex min-h-28 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring',
        props.className,
      )}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'flex h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        props.className,
      )}
    />
  )
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string; className?: string }) {
  return (
    <label className={cn('flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm', className)}>
      <input type="checkbox" className="mt-1 h-4 w-4 rounded border-border accent-primary" {...props} />
      <span className="space-y-1">
        <span className="block font-medium text-foreground">{label}</span>
        {description ? <span className="block text-muted-foreground">{description}</span> : null}
      </span>
    </label>
  )
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-3xl border border-border bg-card p-6 shadow-sm', className)} {...props} />
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-5 space-y-1', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-lg font-semibold text-foreground', className)} {...props} />
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-4', className)} {...props} />
}

export function Badge({
  children,
  tone = 'default',
  className,
  style,
}: {
  children: ReactNode
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
  style?: CSSProperties
}) {
  const classes = {
    default: 'bg-muted text-foreground',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    danger: 'bg-danger/15 text-danger',
    info: 'bg-info/15 text-info',
  } as const

  return (
    <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', classes[tone], className)} style={style}>
      {children}
    </span>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{title}</h1>
        {description ? <p className="max-w-3xl text-sm text-muted-foreground md:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  )
}

export function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <Card className="border-dashed text-center">
      <CardContent className="space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action ? <div className="flex justify-center">{action}</div> : null}
      </CardContent>
    </Card>
  )
}

export function AlertBox({
  title,
  description,
  tone = 'info',
}: {
  title: string
  description: ReactNode
  tone?: 'info' | 'warning' | 'danger' | 'success'
}) {
  const tones = {
    info: 'border-info/20 bg-info/10 text-info',
    warning: 'border-warning/20 bg-warning/10 text-warning',
    danger: 'border-danger/20 bg-danger/10 text-danger',
    success: 'border-success/20 bg-success/10 text-success',
  } as const

  return (
    <div className={cn('rounded-2xl border px-4 py-3', tones[tone])}>
      <p className="font-semibold">{title}</p>
      <div className="mt-1 text-sm opacity-90">{description}</div>
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('h-5 w-5 animate-spin', className)} />
}

export function LoadingScreen({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Spinner className="h-7 w-7" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function KeyValue({
  label,
  value,
  accentColor,
}: {
  label: string
  value: ReactNode
  accentColor?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium text-foreground" style={accentColor ? { color: accentColor } : undefined}>
        {value}
      </div>
    </div>
  )
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
      {hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}
    </Card>
  )
}

export function RichText({ value }: { value: string }) {
  return (
    <div className="rich-text text-sm leading-7">
      <Markdown>{value}</Markdown>
    </div>
  )
}

export function LiveCountdown({
  targetIso,
  serverTimeIso,
  emptyLabel = 'Cooldown inactive',
}: {
  targetIso?: string | null
  serverTimeIso?: string | null
  emptyLabel?: string
}) {
  if (!targetIso) {
    return <span>{emptyLabel}</span>
  }

  const resetKey = `${targetIso}|${serverTimeIso ?? 'client'}`

  return <LiveCountdownText key={resetKey} targetIso={targetIso} serverTimeIso={serverTimeIso} emptyLabel={emptyLabel} />
}

function LiveCountdownText({
  targetIso,
  serverTimeIso,
  emptyLabel,
}: {
  targetIso: string
  serverTimeIso?: string | null
  emptyLabel: string
}) {
  const [initialClientNow] = useState(() => Date.now())
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsedMs((current) => current + 1000)
    }, 1000)

    return () => window.clearInterval(id)
  }, [])

  const remaining = useMemo(
    () => getRemainingMs(targetIso, serverTimeIso, initialClientNow + elapsedMs, initialClientNow),
    [elapsedMs, initialClientNow, serverTimeIso, targetIso],
  )

  if (remaining <= 0) {
    return <span>{emptyLabel}</span>
  }

  return <span>{formatRemainingMs(remaining)}</span>
}

export function JsonBlock({ value }: { value: string }) {
  return <pre className="overflow-x-auto rounded-2xl border border-border bg-muted p-4 text-xs text-foreground">{value}</pre>
}

export function Divider() {
  return <div className="h-px w-full bg-border" />
}

export function TagChip({ name, color }: { name: string; color: string }) {
  return (
    <Badge
      className="gap-2 font-medium"
      style={{
        backgroundColor: `${color}22`,
        color,
      }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </Badge>
  )
}

export function TimestampHint({ label, value }: { label: string; value?: string | null }) {
  return (
    <span className="text-xs text-muted-foreground">
      {label}: {formatDateTime(value)}
    </span>
  )
}
