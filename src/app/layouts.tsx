import { Activity, ArrowLeftRight, DatabaseZap, LayoutDashboard, ListChecks, QrCode, Radar, ScanSearch, Settings, ShieldQuestion, Users, Zap } from 'lucide-react'
import type { ComponentType } from 'react'
import { NavLink, Outlet, ScrollRestoration } from 'react-router-dom'

import { AdminIdentityCard } from '@/features/admin/admin-pages'
import { SessionRoleNotice } from '@/features/session/session'
import { ThemeToggle } from '@/shared/theme/theme'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/ui'

const playerNavItems = [
  { to: '/player/team', label: 'Команда', icon: Users },
  { to: '/player/questions', label: 'Вопросы', icon: ShieldQuestion },
  { to: '/player/enigma', label: 'Enigma', icon: Zap },
  { to: '/player/profile', label: 'Профиль', icon: Activity },
]

const adminNavItems = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/tags', label: 'Tags', icon: Radar },
  { to: '/admin/questions', label: 'Questions', icon: ShieldQuestion },
  { to: '/admin/pools', label: 'Pools', icon: ListChecks },
  { to: '/admin/qr', label: 'QR', icon: QrCode },
  { to: '/admin/routing', label: 'Routing', icon: ArrowLeftRight },
  { to: '/admin/enigma', label: 'Enigma', icon: DatabaseZap },
  { to: '/admin/quest-day', label: 'Quest day', icon: Activity },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/admin/support/teams', label: 'Support', icon: Users },
  { to: '/admin/audit', label: 'Audit', icon: ScanSearch },
]

export function RootLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <ScrollRestoration />
      <Outlet />
    </div>
  )
}

export function PublicShell() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-border bg-card px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <NavLink to="/" className="text-lg font-semibold tracking-tight text-foreground">
            Quest Enigma
          </NavLink>
          <p className="text-sm text-muted-foreground">Public zone, login entrypoints and QR orchestration.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <NavLink to="/player/login">Player</NavLink>
          </Button>
          <Button variant="outline" asChild>
            <NavLink to="/admin/login">Admin</NavLink>
          </Button>
          <ThemeToggle />
        </div>
      </div>
      <div className="space-y-6">
        <Outlet />
      </div>
    </main>
  )
}

export function PlayerShell() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
      <div className="mb-6 rounded-3xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <NavLink to="/" className="text-lg font-semibold tracking-tight text-foreground">
              Quest Enigma / Player
            </NavLink>
            <p className="text-sm text-muted-foreground">Команда, QR flow, вопросы, cooldowns и экран Enigma.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {playerNavItems.map((item) => (
              <ShellLink key={item.to} to={item.to} icon={item.icon} label={item.label} />
            ))}
            <ThemeToggle />
          </div>
        </div>
      </div>
      <div className="mb-6">
        <SessionRoleNotice />
      </div>
      <Outlet />
    </main>
  )
}

export function AdminShell() {
  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
          <aside className="space-y-4">
            <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
              <NavLink to="/" className="text-lg font-semibold tracking-tight text-foreground">
                Quest Enigma / Admin
              </NavLink>
              <p className="mt-1 text-sm text-muted-foreground">Strict operational console.</p>
            </div>
            <AdminIdentityCard />
            <nav className="rounded-3xl border border-border bg-card p-3 shadow-sm">
              <div className="space-y-1">
                {adminNavItems.map((item) => (
                  <ShellLink key={item.to} to={item.to} icon={item.icon} label={item.label} block />
                ))}
              </div>
            </nav>
          </aside>
          <section className="space-y-6">
            <Outlet />
          </section>
        </div>
      </div>
    </main>
  )
}

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-4xl font-semibold text-foreground">404</p>
      <p className="text-muted-foreground">Маршрут не найден.</p>
      <Button asChild>
        <NavLink to="/">На главную</NavLink>
      </Button>
    </div>
  )
}

function ShellLink({
  to,
  label,
  icon: Icon,
  block,
}: {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  block?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={to === '/admin'}
      className={({ isActive }) =>
        cn(
          'inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition-colors',
          block ? 'flex w-full' : '',
          isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  )
}
