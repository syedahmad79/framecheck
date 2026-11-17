import { useId, type CSSProperties, type ReactNode } from 'react';

interface RangeFieldProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
  /** Text shown beside the label and announced as the slider's value. */
  readonly format: (value: number) => string;
  /** Labels for the two ends of the track. */
  readonly ends?: readonly [string, string];
  readonly description?: ReactNode;
  /** Visually hide the label row; the label still names the control. */
  readonly bare?: boolean;
  readonly className?: string;
}

export function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  ends,
  description,
  bare = false,
  className,
}: RangeFieldProps) {
  const id = useId();
  const descriptionId = useId();
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className={className}>
      <div className={bare ? 'sr-only' : 'flex items-baseline justify-between gap-3'}>
        <label htmlFor={id} className="text-fg text-sm">
          {label}
        </label>
        <output htmlFor={id} className="tabular text-fg-muted text-xs">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="fc-range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        aria-describedby={description ? descriptionId : undefined}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {ends && (
        <div className="text-2xs text-fg-subtle -mt-0.5 flex justify-between" aria-hidden="true">
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </div>
      )}
      {description && (
        <p id={descriptionId} className="text-fg-muted mt-1.5 text-xs">
          {description}
        </p>
      )}
    </div>
  );
}
