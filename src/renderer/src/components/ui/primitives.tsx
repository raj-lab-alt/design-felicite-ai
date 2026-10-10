import React, { type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/cn'

/* ------------------------------------------------------------------ */
/* Boutons                                                             */
/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent2'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-soft focus-visible:ring-accent/50',
  secondary: 'bg-panel text-ink border border-line hover:border-accent/40',
  outline: 'border border-line text-ink-dim hover:text-ink hover:border-accent/50',
  ghost: 'text-ink-dim hover:text-ink hover:bg-panel-2',
  danger: 'bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30',
  accent2: 'bg-cyan-500/90 text-slate-950 hover:bg-accent-2'
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps): React.JSX.Element {
  const sizes = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-10 px-4 text-sm gap-2',
    lg: 'h-12 px-6 text-base gap-2.5'
  }
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors outline-none',
        'focus-visible:ring-2 focus-visible:ring-offset-0 disabled:opacity-50 disabled:pointer-events-none',
        buttonVariants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Champs de saisie                                                    */
/* ------------------------------------------------------------------ */

const fieldBase =
  'w-full rounded-lg border border-line bg-panel-2 px-3 text-sm text-ink placeholder:text-ink-faint ' +
  'outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-50'

export const Input = React.forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(fieldBase, 'h-10', invalid && 'border-danger/60 focus:border-danger focus:ring-danger/25', className)}
        {...rest}
      />
    )
  }
)

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldBase, 'min-h-24 py-2.5 resize-y', invalid && 'border-danger/60', className)}
      {...rest}
    />
  )
})

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className
}: {
  label: string
  hint?: string
  error?: string | null
  required?: boolean
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-xs font-medium text-ink-dim">
        {label}
        {required ? ' *' : ''}
        {hint ? <span className="ml-2 font-normal text-ink-faint">{hint}</span> : null}
      </span>
      {children}
      {error ? <span className="block text-xs text-danger">{error}</span> : null}
    </label>
  )
}

/* ------------------------------------------------------------------ */
/* Cartes, badges, états                                               */
/* ------------------------------------------------------------------ */

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={cn('rounded-xl border border-line bg-panel p-5', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  actions,
  className
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {subtitle ? <p className="text-xs text-ink-dim">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  )
}

type BadgeTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'accent' | 'info'

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-line/50 text-ink-dim',
  ok: 'bg-ok/15 text-ok',
  warn: 'bg-warn/15 text-warn',
  danger: 'bg-danger/15 text-danger',
  accent: 'bg-accent/15 text-accent',
  info: 'bg-accent-2/15 text-accent-2'
}

export function Badge({
  tone = 'neutral',
  className,
  children
}: {
  tone?: BadgeTone
  className?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-4',
        badgeTones[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

export function Spinner({ className }: { className?: string }): React.JSX.Element {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-accent', className)} />
}

export function ProgressBar({
  value,
  className
}: {
  value: number
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-line', className)}>
      <div
        className="h-full rounded-full bg-accent transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line py-14 text-center">
      {icon ? <div className="text-ink-faint">{icon}</div> : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="max-w-md text-xs text-ink-dim">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }): React.JSX.Element {
  return <h2 className={cn('mb-3 text-sm font-semibold text-accent-2', className)}>{children}</h2>
}

export function Kbd({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <kbd className="rounded border border-line bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-dim">
      {children}
    </kbd>
  )
}