import { useId, useRef, useState, type DragEvent } from 'react';
import { ACCEPT_ATTRIBUTE, formatBytes, formatDimensions } from '@/domain/files';
import { ROLE_LABEL, type ImageRole } from '@/domain/types';
import { Button } from '@/ui/Button';
import { cn } from '@/ui/cn';
import { AlertIcon, ImageIcon } from '@/ui/icons';
import { Spinner } from '@/ui/Spinner';
import { Thumbnail } from './Thumbnail';
import type { ImportSlot } from './useImportSlots';

const ROLE_COPY: Record<ImageRole, { hint: string; dot: string; empty: string }> = {
  reference: {
    hint: 'The design, or how it should look',
    dot: 'bg-ref',
    empty: 'Drop the reference screenshot',
  },
  implementation: {
    hint: 'What was actually built',
    dot: 'bg-impl',
    empty: 'Drop the implementation screenshot',
  },
};

interface DropSlotProps {
  readonly role: ImageRole;
  readonly slot: ImportSlot;
  /** A file is being dragged somewhere over the page. */
  readonly pageDragging: boolean;
  readonly onFiles: (files: File[]) => void;
  readonly onClear: () => void;
}

export function DropSlot({ role, slot, pageDragging, onFiles, onClear }: DropSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragDepth, setDragDepth] = useState(0);
  const headingId = useId();
  const errorId = useId();
  const copy = ROLE_COPY[role];
  const overSlot = dragDepth > 0;

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    // Handled here; the page-level drop target must not assign the same files again.
    event.stopPropagation();
    setDragDepth(0);
    onFiles(Array.from(event.dataTransfer.files));
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <section
      aria-labelledby={headingId}
      data-testid={`slot-${role}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragDepth((depth) => depth + 1);
      }}
      onDragLeave={() => setDragDepth((depth) => Math.max(0, depth - 1))}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className={cn(
        'motion-colors bg-raised flex min-h-64 flex-col rounded-2xl',
        overSlot
          ? 'shadow-[0_0_0_2px_var(--focus)]'
          : slot.status === 'error'
            ? 'shadow-[0_0_0_1px_color-mix(in_srgb,var(--danger)_55%,transparent)]'
            : slot.status === 'loaded'
              ? 'shadow-raised'
              : cn(
                  'border border-dashed',
                  pageDragging ? 'border-focus bg-hover' : 'border-line-strong',
                ),
      )}
    >
      <header className="flex items-center justify-between gap-3 px-4 pt-3.5">
        <h2 id={headingId} className="flex items-center gap-2 text-sm font-semibold">
          <span className={cn('size-2.5 rounded-full', copy.dot)} aria-hidden="true" />
          {ROLE_LABEL[role]}
        </h2>
        <p className="text-fg-subtle truncate text-xs">{copy.hint}</p>
      </header>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid={`input-${role}`}
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          // Allow choosing the same file again after an error or removal.
          event.target.value = '';
        }}
      />

      {slot.status === 'loaded' ? (
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="bg-stage flex h-36 items-center justify-center overflow-hidden rounded-lg">
            <Thumbnail blob={slot.image.blob} className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium" title={slot.image.name}>
                {slot.image.name}
              </p>
              <p className="tabular text-fg-muted text-xs">
                {formatDimensions(slot.image)} px · {formatBytes(slot.image.bytes)}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                size="sm"
                onClick={openPicker}
                aria-label={`Replace ${ROLE_LABEL[role]} image`}
              >
                Replace
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClear}
                aria-label={`Remove ${ROLE_LABEL[role]} image`}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : slot.status === 'loading' ? (
        <p role="status" className="text-fg-muted flex flex-1 items-center justify-center gap-2">
          <Spinner />
          Reading {slot.fileName}…
        </p>
      ) : (
        <div className="flex flex-1 flex-col p-2">
          <button
            type="button"
            onClick={openPicker}
            aria-describedby={slot.status === 'error' ? errorId : undefined}
            className="motion-colors hover:bg-hover flex flex-1 flex-col items-center justify-center gap-2 rounded-xl px-4 py-6 text-center"
          >
            <ImageIcon width={22} height={22} className="text-fg-subtle" />
            <span className="text-fg">{overSlot ? 'Release to add' : copy.empty}</span>
            <span className="text-fg-muted text-xs">
              or <span className="underline underline-offset-2">choose a file</span> · PNG or JPEG
            </span>
          </button>
          {slot.status === 'error' && (
            <p
              id={errorId}
              role="alert"
              className="text-danger mx-2 mb-2 flex items-start gap-1.5 text-xs"
            >
              <AlertIcon className="mt-0.5" width={14} height={14} />
              <span>{slot.message}</span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
