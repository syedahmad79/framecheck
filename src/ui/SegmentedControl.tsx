import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn';

export interface SegmentOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly icon?: ReactNode;
  /** Shown in the tooltip, e.g. a keyboard shortcut. */
  readonly hint?: string;
}

interface SegmentedControlProps<T extends string> {
  readonly label: string;
  readonly options: readonly SegmentOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** Hide text labels below the `md` breakpoint when every option has an icon. */
  readonly compact?: boolean;
  readonly className?: string;
}

/**
 * A single-choice control implemented as an ARIA radio group: one tab stop,
 * arrow keys move and select, Home/End jump to the ends.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  compact = false,
  className,
}: SegmentedControlProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);

  const select = (index: number) => {
    const option = options[(index + options.length) % options.length];
    if (!option) return;
    onChange(option.value);
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-value="${option.value}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = options.findIndex((option) => option.value === value);
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        select(current + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        select(current - 1);
        break;
      case 'Home':
        select(0);
        break;
      case 'End':
        select(options.length - 1);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('border-line bg-canvas inline-flex rounded-md border p-0.5', className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            title={option.hint ? `${option.label} (${option.hint})` : option.label}
            data-value={option.value}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-6 flex-1 items-center justify-center gap-1.5 rounded-[5px] px-2 text-[12.5px] whitespace-nowrap transition-colors select-none',
              selected
                ? 'bg-hover text-fg shadow-[inset_0_0_0_1px_var(--color-line-strong)]'
                : 'text-fg-muted hover:text-fg',
            )}
          >
            {option.icon}
            <span className={cn(compact && option.icon ? 'hidden md:inline' : undefined)}>
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
