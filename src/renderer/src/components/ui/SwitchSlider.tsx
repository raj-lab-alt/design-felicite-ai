import * as RadixSlider from '@radix-ui/react-slider'
import * as RadixSwitch from '@radix-ui/react-switch'
import type React from 'react'
import { cn } from '../../lib/cn'

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label
}: {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  label?: string
}): React.JSX.Element {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full border border-line bg-panel-2 outline-none transition-colors',
        'data-[state=checked]:bg-accent focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50'
      )}
      aria-label={label}
    >
      <RadixSwitch.Thumb
        className={cn(
          'block h-5 w-5 translate-x-0.5 rounded-full bg-ink transition-transform',
          'data-[state=checked]:translate-x-[22px] data-[state=checked]:bg-white'
        )}
      />
    </RadixSwitch.Root>
  )
}

export function Slider({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  label
}: {
  value: number
  onValueChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
}): React.JSX.Element {
  return (
    <RadixSlider.Root
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onValueChange?.(v[0] ?? value)}
      className="relative flex h-6 w-full touch-none select-none items-center"
      aria-label={label}
    >
      <RadixSlider.Track className="relative h-1.5 flex-1 rounded-full bg-line">
        <RadixSlider.Range className="absolute h-full rounded-full bg-accent" />
      </RadixSlider.Track>
      <RadixSlider.Thumb className="block h-4 w-4 rounded-full border-2 border-accent bg-panel shadow outline-none focus-visible:ring-2 focus-visible:ring-accent/40" />
    </RadixSlider.Root>
  )
}