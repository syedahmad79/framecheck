import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  ref?: Ref<HTMLButtonElement>;
  /** Square button for a lone icon. Requires an `aria-label`. */
  iconOnly?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-fg font-medium hover:bg-accent-hover active:scale-[0.98] disabled:bg-hover disabled:text-fg-subtle disabled:active:scale-100',
  secondary:
    'bg-raised text-fg shadow-raised hover:bg-hover active:bg-pressed disabled:text-fg-subtle disabled:hover:bg-raised',
  ghost:
    'text-fg-muted hover:bg-hover hover:text-fg active:bg-pressed aria-pressed:bg-hover aria-pressed:text-fg disabled:text-fg-subtle disabled:hover:bg-transparent',
  danger:
    'text-danger shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--danger)_45%,transparent)] hover:bg-danger/10',
};

const SIZES: Record<Size, string> = {
  sm: 'h-7 text-xs',
  md: 'h-8 text-sm',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  iconOnly = false,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'motion-colors inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md whitespace-nowrap select-none disabled:cursor-not-allowed pointer-coarse:min-h-10 pointer-coarse:min-w-10',
        SIZES[size],
        iconOnly ? (size === 'sm' ? 'w-7' : 'w-8') : size === 'sm' ? 'px-2.5' : 'px-3',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
