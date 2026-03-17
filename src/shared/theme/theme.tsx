import { MonitorCog, MoonStar, SunMedium } from 'lucide-react'
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'
import { type CSSProperties, type ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  )
}

export function ThemeToggle({ className, variant = 'default' }: { className?: string; variant?: 'default' | 'menuRow' }) {
  const { theme, setTheme } = useTheme()
  const resolvedTheme = theme ?? 'system'

  if (variant === 'menuRow') {
    const rowIcon =
      resolvedTheme === 'dark' ? (
        <MoonStar className="h-5 w-5 shrink-0 text-foreground" />
      ) : resolvedTheme === 'light' ? (
        <SunMedium className="h-5 w-5 shrink-0 text-foreground" />
      ) : (
        <MonitorCog className="h-5 w-5 shrink-0 text-foreground" />
      )
    return (
      <label
        className={cn(
          'flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm shadow-sm',
          className,
        )}
      >
        {rowIcon}
        <span className="shrink-0 text-muted-foreground">Тема</span>
        <select
          className="min-w-0 flex-1 cursor-pointer appearance-none rounded-lg border-0 bg-transparent py-0.5 pl-0 pr-6 text-left text-sm font-semibold text-foreground outline-none dark:bg-transparent"
          style={{ textAlignLast: 'left' } satisfies CSSProperties}
          value={resolvedTheme}
          onChange={(event) => setTheme(event.target.value)}
        >
          <option value="system">Системная</option>
          <option value="light">Светлая</option>
          <option value="dark">Тёмная</option>
        </select>
      </label>
    )
  }

  return (
    <label
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm text-muted-foreground shadow-sm',
        className,
      )}
    >
      {resolvedTheme === 'dark' ? <MoonStar className="h-4 w-4" /> : resolvedTheme === 'light' ? <SunMedium className="h-4 w-4" /> : <MonitorCog className="h-4 w-4" />}
      <select
        className="min-w-[7.5rem] cursor-pointer rounded-lg border-0 bg-transparent py-1 pl-1 pr-6 text-foreground outline-none dark:bg-card dark:text-foreground"
        value={resolvedTheme}
        onChange={(event) => setTheme(event.target.value)}
      >
        <option value="system">Системная</option>
        <option value="light">Светлая</option>
        <option value="dark">Тёмная</option>
      </select>
    </label>
  )
}
