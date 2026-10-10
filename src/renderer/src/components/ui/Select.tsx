import * as RadixSelect from '@radix-ui/react-select'
import type React from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export function Select({
  options,
  value,
  onValueChange,
  placeholder = 'Sélectionner…',
  className,
  disabled
}: {
  options: SelectOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}): React.JSX.Element {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-line bg-panel-2 px-3 text-sm',
          'text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30',
          'data-[placeholder]:text-ink-faint disabled:opacity-50',
          className
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown className="h-4 w-4 text-ink-dim" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-line bg-panel shadow-xl"
        >
          <RadixSelect.Viewport className="p-1">
            <RadixSelect.Group>
              {options.map((option) => (
                <RadixSelect.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm text-ink outline-none',
                    'focus:bg-panel-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
                    'data-[highlighted]:bg-accent/15'
                  )}
                >
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator>
                    <Check className="h-4 w-4 text-accent" />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Group>
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}