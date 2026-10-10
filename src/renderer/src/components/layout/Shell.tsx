import type React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  FolderOpen,
  LayoutDashboard,
  Library,
  Settings as SettingsIcon,
  Sparkles,
  Wrench
} from 'lucide-react'
import { Button } from '../ui/primitives'
import { useAppStore } from '../../store/useAppStore'
import { cn } from '../../lib/cn'

const navItems = [
  { to: '/', label: 'Accueil', icon: LayoutDashboard, end: true },
  { to: '/library', label: 'Bibliothèque', icon: Library }
]

function SetupBanner(): React.JSX.Element | null {
  const secrets = useAppStore((s) => s.secrets)
  const settings = useAppStore((s) => s.settings)
  const navigate = useNavigate()
  if (!secrets) return null
  const missingApiKey = !secrets.configured
  const missingConsent = settings && !settings.privacyConsentGivenAt
  if (!missingApiKey && !missingConsent) return null
  return (
    <div className="border-b border-line bg-accent/10 px-4 py-2 text-xs text-ink">
      <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-accent align-middle" />
      {!missingApiKey ? 'Configuration à terminer' : 'Clé API Gemini manquante'}
      {missingConsent ? ' · consentement de confidentialité non accepté' : ''}
      <Button variant="ghost" size="sm" className="ml-3 h-6 px-2" onClick={() => navigate('/settings')}>
        Configurer
      </Button>
    </div>
  )
}

export function Shell(): React.JSX.Element {
  const info = useAppStore((s) => s.info)
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-panel-2">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-none text-ink">Design Félicité</div>
            <div className="mt-0.5 text-[10px] tracking-wide text-ink-faint">AI · Analyse de design</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-dim transition-colors',
                  'hover:bg-panel hover:text-ink',
                  isActive && 'bg-panel text-ink'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}

          <div className="pt-4">
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
              Outils
            </div>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-dim transition-colors',
                  'hover:bg-panel hover:text-ink',
                  isActive && 'bg-panel text-ink'
                )
              }
            >
              <SettingsIcon className="h-4 w-4" />
              Paramètres
            </NavLink>
            <NavLink
              to="/diagnostics"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-dim transition-colors',
                  'hover:bg-panel hover:text-ink',
                  isActive && 'bg-panel text-ink'
                )
              }
            >
              <Wrench className="h-4 w-4" />
              Diagnostics
            </NavLink>
          </div>
        </nav>

        <div className="border-t border-line px-5 py-3 text-[10px] text-ink-faint">
          v{info?.appVersion ?? 'dev'} · données locales uniquement
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <SetupBanner />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function OpenDataDirButton(): React.JSX.Element {
  return (
    <Button variant="ghost" size="sm" icon={<FolderOpen className="h-4 w-4" />} onClick={() => void window.api.app.openDataDir()}>
      Dossier de données
    </Button>
  )
}