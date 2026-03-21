import {
  Activity,
  ArrowLeftRight,
  DatabaseZap,
  LayoutDashboard,
  ListChecks,
  Menu,
  QrCode,
  Radar,
  ScanSearch,
  Settings,
  ShieldQuestion,
  UserCircle,
  Users,
  X,
  Zap,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom'

import { AdminIdentityCard } from '@/features/admin/admin-pages'
import { ParticipantLogoutButton } from '@/features/session/ParticipantLogoutButton'
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
  { to: '/admin', label: 'Обзор', icon: LayoutDashboard },
  { to: '/admin/tags', label: 'Теги', icon: Radar },
  { to: '/admin/questions', label: 'Вопросы', icon: ShieldQuestion },
  { to: '/admin/pools', label: 'Пулы', icon: ListChecks },
  { to: '/admin/qr', label: 'QR', icon: QrCode },
  { to: '/admin/routing', label: 'Маршрутизация', icon: ArrowLeftRight },
  { to: '/admin/enigma', label: 'Enigma', icon: DatabaseZap },
  { to: '/admin/quest-day', label: 'Игровой день', icon: Activity },
  { to: '/admin/settings', label: 'Настройки', icon: Settings },
  { to: '/admin/profile', label: 'Администраторы', icon: UserCircle },
  { to: '/admin/support/teams', label: 'Команды', icon: Users },
  { to: '/admin/audit', label: 'Аудит', icon: ScanSearch },
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
          <p className="text-sm text-muted-foreground">Вход участников, админка и сканирование QR.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <NavLink to="/player/login">Участник</NavLink>
          </Button>
          <Button variant="outline" asChild>
            <NavLink to="/admin/login">Admin</NavLink>
          </Button>
          <ParticipantLogoutButton />
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
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
      <div className="mb-6 rounded-3xl border border-border bg-card p-3 shadow-sm md:p-5">
        {/* Мобилка: компактная шапка + бургер */}
        <div className="flex items-center gap-3 md:hidden">
          <div className="min-w-0 flex-1">
            <NavLink to="/" className="block truncate text-base font-semibold tracking-tight text-foreground">
              Quest Enigma / Player
            </NavLink>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">Команда, QR, вопросы, кулдауны и Enigma.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-11 shrink-0 rounded-xl p-0"
            aria-expanded={menuOpen}
            aria-controls="player-mobile-menu"
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Планшет/ПК */}
        <div className="hidden flex-col gap-4 md:flex lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="min-w-0 shrink-0">
            <NavLink to="/" className="text-lg font-semibold tracking-tight text-foreground">
              Quest Enigma / Player
            </NavLink>
            <p className="mt-0.5 text-sm text-muted-foreground">Команда, QR, вопросы, кулдауны и Enigma.</p>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3 lg:max-w-2xl lg:items-end">
            <nav className="flex w-full flex-row flex-wrap gap-2 md:justify-end" aria-label="Разделы игрока">
              {playerNavItems.map((item) => (
                <PlayerNavLink key={item.to} to={item.to} icon={item.icon} label={item.label} />
              ))}
            </nav>
            <div className="flex flex-row flex-wrap items-center gap-2 md:justify-end">
              <ParticipantLogoutButton />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Выезжающее меню (только мобилка) */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" id="player-mobile-menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            aria-label="Закрыть меню"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className="absolute right-0 top-0 flex h-full w-[min(100%,20rem)] flex-col border-l border-border bg-card shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Меню игрока"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Разделы</span>
              <Button type="button" variant="ghost" className="h-9 w-9 shrink-0 rounded-lg p-0" aria-label="Закрыть" onClick={() => setMenuOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 space-y-1.5 overflow-y-auto p-3" aria-label="Разделы игрока">
              {playerNavItems.map((item) => (
                <PlayerDrawerNavLink key={item.to} to={item.to} icon={item.icon} label={item.label} onNavigate={() => setMenuOpen(false)} />
              ))}
            </nav>
            <div className="space-y-2 border-t border-border bg-muted/15 p-3">
              <ThemeToggle variant="menuRow" />
              <ParticipantLogoutButton className="h-11 w-full justify-start gap-2 rounded-xl border border-border bg-card px-4 font-medium shadow-sm hover:bg-muted/50" />
            </div>
          </div>
        </div>
      ) : null}

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
              <p className="mt-1 text-sm text-muted-foreground">Операционная консоль.</p>
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

/** Таблетки навигации (md+) */
function PlayerNavLink({
  to,
  label,
  icon: Icon,
}: {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </NavLink>
  )
}

function PlayerDrawerNavLink({
  to,
  label,
  icon: Icon,
  onNavigate,
}: {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  onNavigate: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex min-h-[2.75rem] w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors active:scale-[0.99]',
          isActive
            ? 'border-primary bg-primary text-primary-foreground shadow-sm'
            : 'border-border bg-muted/30 text-foreground hover:bg-muted/60',
        )
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      {label}
    </NavLink>
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
