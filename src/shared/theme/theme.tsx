import { MonitorCog, MoonStar, SunMedium } from 'lucide-react'
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'
import { type ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  )
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const resolvedTheme = theme ?? 'system'

  return (
    <label
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm text-muted-foreground shadow-sm',
        className,
      )}
    >
      {resolvedTheme === 'dark' ? <MoonStar className="h-4 w-4" /> : resolvedTheme === 'light' ? <SunMedium className="h-4 w-4" /> : <MonitorCog className="h-4 w-4" />}
      <select
        className="bg-transparent text-foreground outline-none"
        value={resolvedTheme}
        onChange={(event) => setTheme(event.target.value)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  )
}
