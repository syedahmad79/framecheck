import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  ref?: Ref<HTMLButtonElement>;
  /** Square button for a lone icon. Requires an `aria-label`. */
  iconOnly?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-[#08111f] font-medium hover:bg-[#8ab9ff] disabled:bg-raised disabled:text-fg-subtle',
  secondary:
    'border border-line-strong bg-raised text-fg hover:bg-hover disabled:text-fg-subtle disabled:hover:bg-raised',
  ghost:
    'text-fg-muted hover:bg-hover hover:text-fg disabled:text-fg-subtle disabled:hover:bg-transparent',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
};

export function Button({
  variant = 'secondary',
  iconOnly = false,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-md text-[13px] whitespace-nowrap transition-colors select-none disabled:cursor-not-allowed',
        iconOnly ? 'w-7' : 'px-2.5',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
