import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn';

export interface SegmentOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly icon?: ReactNode;
  /** Shown in the native tooltip, e.g. a keyboard shortcut. */
  readonly hint?: string;
}

interface SegmentedControlProps<T extends string> {
  readonly label: string;
  readonly options: readonly SegmentOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** When text labels are shown: always, from the `md` breakpoint up, or never (icon-only). */
  readonly labels?: 'always' | 'md' | 'never';
  readonly size?: 'sm' | 'md';
  readonly className?: string;
}

/**
 * A single-choice control implemented as an ARIA radio group: one tab stop, arrow keys move and
 * select, Home/End jump to the ends. The selected thumb slides between segments.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  labels = 'always',
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const select = (next: number) => {
    const option = options[(next + options.length) % options.length];
    if (!option) return;
    onChange(option.value);
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-value="${option.value}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        select(index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        select(index - 1);
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
      className={cn(
        'bg-hover relative inline-grid auto-cols-fr grid-flow-col rounded-lg p-0.5',
        size === 'sm' ? 'h-7' : 'h-8 pointer-coarse:h-10',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="motion-transform bg-raised shadow-raised absolute inset-y-0.5 left-0.5 rounded-md"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
          transitionProperty: 'transform',
        }}
      />
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
              'motion-colors relative inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 text-sm whitespace-nowrap select-none',
              selected ? 'text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {option.icon}
            {labels !== 'never' && (
              <span className={cn(labels === 'md' && option.icon ? 'max-md:sr-only' : undefined)}>
                {option.label}
              </span>
            )}
            {labels === 'never' && <span className="sr-only">{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
