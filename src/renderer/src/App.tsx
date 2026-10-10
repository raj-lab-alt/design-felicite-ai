import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Shell } from './components/layout/Shell'
import { ToastHost } from './components/ui/Toast'
import { Spinner } from './components/ui/primitives'
import { bootstrapStore, useAppStore } from './store/useAppStore'
import { DashboardPage } from './pages/DashboardPage'
import { NotFoundPage } from './pages/NotFoundPage'

const LibraryPage = lazy(() => import('./pages/LibraryPage').then((m) => ({ default: m.LibraryPage })))
const ProjectPage = lazy(() => import('./pages/ProjectPage').then((m) => ({ default: m.ProjectPage })))
const AnalysisPage = lazy(() => import('./pages/AnalysisPage').then((m) => ({ default: m.AnalysisPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const DiagnosticsPage = lazy(() =>
  import('./pages/DiagnosticsPage').then((m) => ({ default: m.DiagnosticsPage }))
)

function Splash(): React.JSX.Element {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-bg text-ink">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white">
        <Sparkles className="h-6 w-6" />
      </div>
      <div className="text-sm font-semibold text-ink">Design Félicité AI</div>
      <Spinner />
    </div>
  )
}

function PageLoader(): React.JSX.Element {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner />
    </div>
  )
}

function lazyPage(node: React.ReactNode): React.JSX.Element {
  return <Suspense fallback={<PageLoader />}>{node}</Suspense>
}

export default function App(): React.JSX.Element {
  const bootstrapped = useAppStore((s) => s.bootstrapped)
  const toast = useAppStore((s) => s.toast)

  useEffect(() => {
    bootstrapStore().catch((error: unknown) => {
      toast('error', error instanceof Error ? error.message : 'Impossible de démarrer l’application.')
    })
  }, [toast])

  if (!bootstrapped) return <Splash />

  return (
    <>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<DashboardPage />} />
          <Route path="library" element={lazyPage(<LibraryPage />)} />
          <Route path="projects/:projectId" element={lazyPage(<ProjectPage />)} />
          <Route
            path="projects/:projectId/analyses/:analysisId"
            element={lazyPage(<AnalysisPage />)}
          />
          <Route path="settings" element={lazyPage(<SettingsPage />)} />
          <Route path="diagnostics" element={lazyPage(<DiagnosticsPage />)} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <ToastHost />
    </>
  )
}