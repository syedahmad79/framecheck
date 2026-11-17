import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { clamp } from '@/domain/types';

interface SliderHandleProps {
  /** Divider position as a fraction of the pane width, 0 to 1. */
  readonly position: number;
  readonly onChange: (position: number) => void;
}

const STEP = 0.01;
const LARGE_STEP = 0.1;

/** The draggable divider of the before/after view, exposed as an ARIA slider. */
export function SliderHandle({ position, onChange }: SliderHandleProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const percent = Math.round(position * 100);

  const moveTo = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    onChange(clamp((clientX - rect.left) / rect.width, 0, 1));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // Dragging the divider must not also pan the viewport underneath it.
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    moveTo(event.clientX);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) moveTo(event.clientX);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? LARGE_STEP : STEP;
    let next: number;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = position - step;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        next = position + step;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    // Arrow keys also pan the viewport when it has focus; keep them for the divider here.
    event.stopPropagation();
    onChange(clamp(next, 0, 1));
  };

  return (
    <div ref={trackRef} className="pointer-events-none absolute inset-0">
      <div
        role="slider"
        tabIndex={0}
        aria-label="Comparison divider"
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`Reference ${percent}%, implementation ${100 - percent}%`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
        className="group pointer-events-auto absolute inset-y-0 -ml-3 flex w-6 cursor-ew-resize touch-none justify-center focus-visible:outline-none"
        style={{ left: `${position * 100}%` }}
      >
        <span className="bg-accent h-full w-px shadow-[0_0_0_1px_rgba(0,0,0,0.45)]" />
        <span className="border-accent bg-surface group-focus-visible:outline-accent absolute top-1/2 flex h-8 w-5 -translate-y-1/2 items-center justify-center gap-0.5 rounded-md border shadow-md group-focus-visible:outline-2 group-focus-visible:outline-offset-2">
          <span className="bg-fg-muted h-3 w-px" />
          <span className="bg-fg-muted h-3 w-px" />
        </span>
      </div>
    </div>
  );
}
