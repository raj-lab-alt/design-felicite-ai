import * as RadixTabs from '@radix-ui/react-tabs'
import type React from 'react'
import { cn } from '../../lib/cn'

export function Tabs({
  value,
  onValueChange,
  items,
  children
}: {
  value: string
  onValueChange?: (value: string) => void
  items: Array<{ value: string; label: string; count?: number }>
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange}>
      <RadixTabs.List className="flex gap-1 border-b border-line">
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              'group -mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm text-ink-dim',
              'outline-none transition-colors hover:text-ink data-[state=active]:border-accent data-[state=active]:text-ink'
            )}
          >
            {item.label}
            {typeof item.count === 'number' ? (
              <span className="rounded-full bg-line px-1.5 text-[10px] text-ink-dim group-data-[state=active]:bg-accent/20 group-data-[state=active]:text-accent">
                {item.count}
              </span>
            ) : null}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  )
}

export function TabsContent({
  value,
  children,
  className
}: {
  value: string
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <RadixTabs.Content value={value} className={cn('pt-5 outline-none', className)}>
      {children}
    </RadixTabs.Content>
  )
}