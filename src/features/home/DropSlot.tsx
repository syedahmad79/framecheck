import { useId, useRef, useState, type DragEvent } from 'react';
import { ACCEPT_ATTRIBUTE, formatBytes, formatDimensions } from '@/domain/files';
import { ROLE_LABEL, type ImageRole } from '@/domain/types';
import { BitmapCanvas } from '@/ui/BitmapCanvas';
import { Button } from '@/ui/Button';
import { cn } from '@/ui/cn';
import { AlertIcon, UploadIcon } from '@/ui/icons';
import type { ImportSlot } from './useImportSlots';

const ROLE_HINT: Record<ImageRole, string> = {
  reference: 'The design or expected result',
  implementation: 'What was actually built',
};

const THUMBNAIL_MAX = 480;

interface DropSlotProps {
  readonly role: ImageRole;
  readonly slot: ImportSlot;
  readonly onFiles: (files: File[]) => void;
  readonly onClear: () => void;
}

export function DropSlot({ role, slot, onFiles, onClear }: DropSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragDepth, setDragDepth] = useState(0);
  const headingId = useId();
  const errorId = useId();
  const dragging = dragDepth > 0;

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    // Handled here; do not let the page-level drop target assign the same files again.
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
        'bg-canvas flex min-h-56 flex-col rounded-lg border transition-colors',
        dragging
          ? 'border-accent bg-accent/5'
          : slot.status === 'error'
            ? 'border-danger/50'
            : slot.status === 'loaded'
              ? 'border-line-strong'
              : 'border-line-strong border-dashed',
      )}
    >
      <header className="flex items-baseline justify-between gap-3 px-3.5 pt-3">
        <h2 id={headingId} className="text-[13px] font-semibold">
          {ROLE_LABEL[role]}
        </h2>
        <p className="text-fg-subtle truncate text-xs">{ROLE_HINT[role]}</p>
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
        <div className="flex flex-1 flex-col gap-3 p-3.5">
          <div className="checkerboard border-line flex h-32 items-center justify-center overflow-hidden rounded-md border">
            <BitmapCanvas
              bitmap={slot.image.bitmap}
              size={thumbnailSize(slot.image)}
              className="max-h-full max-w-full object-contain"
            />
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
            <div className="flex gap-1.5">
              <Button onClick={openPicker} aria-label={`Replace ${ROLE_LABEL[role]} image`}>
                Replace
              </Button>
              <Button
                variant="ghost"
                onClick={onClear}
                aria-label={`Remove ${ROLE_LABEL[role]} image`}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-5 text-center">
          {slot.status === 'loading' ? (
            <p role="status" className="text-fg-muted">
              Reading {slot.fileName}…
            </p>
          ) : (
            <>
              <UploadIcon className="text-fg-subtle" width={20} height={20} />
              <p className="text-fg-muted">
                {dragging ? 'Drop to add' : 'Drop a PNG or JPEG here'}
              </p>
              <Button
                onClick={openPicker}
                aria-label={`Choose ${ROLE_LABEL[role]} image`}
                aria-describedby={slot.status === 'error' ? errorId : undefined}
              >
                Choose file
              </Button>
            </>
          )}
          {slot.status === 'error' && (
            <p
              id={errorId}
              role="alert"
              className="text-danger mt-1 flex max-w-sm items-start gap-1.5 text-left text-xs"
            >
              <AlertIcon className="mt-px shrink-0" />
              <span>{slot.message}</span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function thumbnailSize(image: { width: number; height: number }) {
  const scale = Math.min(1, THUMBNAIL_MAX / Math.max(image.width, image.height));
  return {
    width: Math.max(1, Math.round(image.width * scale)),
    height: Math.max(1, Math.round(image.height * scale)),
  };
}
