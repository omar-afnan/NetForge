import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Site-wide button, in the NetForge console idiom: chamfered (3px), tonal
 * rather than floating, monospace label. Colour follows the product's
 * protocol — violet is the "a human pressed this" colour, red is a fault
 * action, everything else is unlit metal until you touch it.
 *
 * Usage:
 *   <Button>Primary</Button>
 *   <Button variant="accent" size="lg">Run</Button>
 *   <Button variant="destructive" size="sm">Delete</Button>
 *   <Button variant="icon" aria-label="Close"><X className="h-4 w-4" /></Button>
 */
export type ButtonVariant =
  | 'primary'
  | 'accent'
  | 'secondary'
  | 'destructive'
  | 'minimal'
  | 'icon'

export type ButtonSize = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-medium tracking-wide ' +
  'whitespace-nowrap select-none border ' +
  'transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-out ' +
  'active:translate-y-px focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-[var(--accent-link)] focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-[var(--bg-root)] disabled:pointer-events-none disabled:opacity-45'

const variants: Record<ButtonVariant, string> = {
  // quiet console key — unlit metal that lights on hover
  primary:
    'border-[var(--border-bright)] bg-[var(--bg-elevated)] text-[var(--text-primary)] ' +
    'hover:border-[var(--accent-link)] hover:bg-[color-mix(in_srgb,var(--accent-link)_12%,var(--bg-elevated))] ' +
    'active:bg-[color-mix(in_srgb,var(--accent-link)_20%,var(--bg-elevated))]',
  // the one loud key: a lit action
  accent:
    'border-transparent bg-[var(--accent-link)] text-white ' +
    'shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent-link)_60%,transparent),0_0_16px_-6px_var(--accent-link)] ' +
    'hover:bg-[color-mix(in_srgb,white_10%,var(--accent-link))] ' +
    'active:bg-[color-mix(in_srgb,black_8%,var(--accent-link))]',
  secondary:
    'border-[var(--border)] bg-transparent text-[var(--text-secondary)] ' +
    'hover:border-[var(--border-bright)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] ' +
    'active:bg-[var(--bg-inset)]',
  destructive:
    'border-transparent bg-[var(--status-down)] text-[#1a0d0c] font-semibold ' +
    'shadow-[0_0_16px_-6px_var(--status-down)] ' +
    'hover:bg-[color-mix(in_srgb,white_12%,var(--status-down))] ' +
    'active:bg-[color-mix(in_srgb,black_8%,var(--status-down))]',
  minimal:
    'border-transparent bg-transparent text-[var(--text-dim)] ' +
    'hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)]',
  icon:
    'border-[var(--border-bright)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] ' +
    'hover:border-[var(--accent-link)] hover:text-[var(--text-primary)] active:translate-y-px',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-[13px]',
  lg: 'h-11 px-6 text-sm',
}

const iconSizes: Record<ButtonSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Render as a full-width block button. */
  block?: boolean
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', block, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        base,
        variants[variant],
        variant === 'icon' ? iconSizes[size] : sizes[size],
        block && 'w-full',
        className,
      )}
      {...props}
    />
  )
})
