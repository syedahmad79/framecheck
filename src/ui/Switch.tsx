import { useId, type ReactNode } from 'react';

interface SwitchProps {
  readonly label: string;
  readonly description?: ReactNode;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

export function Switch({ label, description, checked, onChange }: SwitchProps) {
  const descriptionId = useId();
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        aria-describedby={description ? descriptionId : undefined}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className="motion-colors bg-line-strong peer-checked:bg-accent peer-focus-visible:outline-focus after:bg-raised peer-checked:after:bg-accent-fg relative mt-0.5 h-5 w-9 shrink-0 rounded-full peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:shadow-sm after:transition-transform after:duration-(--dur-base) after:ease-(--ease-out) peer-checked:after:translate-x-4"
      />
      <span className="min-w-0">
        <span className="text-fg block text-sm">{label}</span>
        {description && (
          <span id={descriptionId} className="text-fg-muted block text-xs">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
