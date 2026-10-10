import type React from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { cn } from '../../lib/cn'

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info
}

const tones = {
  success: 'border-ok/40 text-ok',
  error: 'border-danger/40 text-danger',
  info: 'border-accent/40 text-accent'
}

export function ToastHost(): React.JSX.Element {
  const toasts = useAppStore((s) => s.toasts)
  const dismiss = useAppStore((s) => s.dismissToast)
  if (toasts.length === 0) return <></>
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = icons[toast.kind]
        return (
          <button
            key={toast.id}
            onClick={() => dismiss(toast.id)}
            className={cn(
              'pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-panel p-3 text-left shadow-lg',
              tones[toast.kind]
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="text-xs text-ink">{toast.message}</span>
          </button>
        )
      })}
    </div>
  )
}