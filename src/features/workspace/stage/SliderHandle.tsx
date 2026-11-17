import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { fractionAlong } from '@/domain/render';
import { clamp } from '@/domain/types';

interface SliderHandleProps {
  /** Divider position as a fraction of the pane width, 0 to 1. */
  readonly position: number;
  /** Called with every position during a drag. */
  readonly onChange: (position: number) => void;
  /** Called once with the final position when a gesture or key press ends. */
  readonly onCommit: (position: number) => void;
}

const STEP = 0.01;
const LARGE_STEP = 0.1;
const CENTER = 0.5;
/** Half the width of the grab area, in CSS pixels. */
const GRAB_RADIUS = 22;

interface Grab {
  readonly pointerId: number;
  /** Distance from the divider's centre to where it was grabbed, so it never jumps under the pointer. */
  readonly offset: number;
}

/**
 * The draggable divider of the before/after view, exposed as an ARIA slider.
 *
 * It owns its gesture: the stage ignores pointers that start inside `data-gesture-owner`, and the
 * handle captures the pointer, so dragging can neither pan the image nor stall when the pointer
 * leaves the handle, the pane or the window. Position is the pointer's position along the
 * pane's own box, the same box the clip in the painter uses, so zoom and pan cannot skew it.
 *
 * The line is drawn at the exact position, but the grab area is kept inside the pane. At 0% and
 * 100% half of a centred grab area would be clipped and the divider could not be picked up again.
 */
export function SliderHandle({ position, onChange, onCommit }: SliderHandleProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const grab = useRef<Grab | null>(null);
  const latest = useRef(position);
  const percent = Math.round(position * 100);

  const paneBox = () => trackRef.current?.getBoundingClientRect();

  const move = (event: PointerEvent<HTMLElement>, current: Grab) => {
    const box = paneBox();
    if (!box || event.pointerId !== current.pointerId) return;
    const next = fractionAlong(event.clientX, box.left, box.width, current.offset);
    latest.current = next;
    onChange(next);
  };

  const end = (event: PointerEvent<HTMLElement>) => {
    const current = grab.current;
    if (current?.pointerId !== event.pointerId) return;
    if (event.type === 'pointerup') move(event, current);
    grab.current = null;
    delete event.currentTarget.dataset.dragging;
    onCommit(latest.current);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (grab.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const box = paneBox();
    if (!box) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = 'true';
    event.currentTarget.focus({ preventScroll: true });
    latest.current = position;
    grab.current = {
      pointerId: event.pointerId,
      offset: event.clientX - (box.left + position * box.width),
    };
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? LARGE_STEP : STEP;
    const moves: Record<string, number> = {
      ArrowLeft: position - step,
      ArrowDown: position - step,
      ArrowRight: position + step,
      ArrowUp: position + step,
      PageDown: position - LARGE_STEP,
      PageUp: position + LARGE_STEP,
      Home: 0,
      End: 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    onCommit(clamp(next, 0, 1));
  };

  // `cqw` is a percentage of the track's width, which lets the grab area clamp to the pane edges.
  const exact = 'calc(var(--p) * 100cqw)';
  const clamped = `clamp(${GRAB_RADIUS}px, ${exact}, calc(100cqw - ${GRAB_RADIUS}px))`;

  return (
    <div
      ref={trackRef}
      className="[container-type:inline-size] pointer-events-none absolute inset-0"
      style={{ '--p': position } as CSSProperties}
    >
      <div
        role="slider"
        tabIndex={0}
        data-gesture-owner
        aria-label="Comparison divider"
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`Reference ${percent}%, implementation ${100 - percent}%`}
        onPointerDown={onPointerDown}
        onPointerMove={(event) => {
          if (grab.current) move(event, grab.current);
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onDoubleClick={() => onCommit(CENTER)}
        onKeyDown={onKeyDown}
        className="group pointer-events-auto absolute inset-y-0 flex w-11 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center select-none focus-visible:outline-none"
        style={{ left: clamped }}
      >
        <span
          className="absolute inset-y-0 w-px -translate-x-1/2 bg-white shadow-[0_0_0_0.5px_rgb(0_0_0/0.55),0_0_8px_rgb(0_0_0/0.25)] transition-[width] duration-(--dur-fast) group-hover:w-0.5 group-data-[dragging]:w-0.5"
          style={{ left: `calc(50% + ${exact} - ${clamped})` }}
        />
        <span className="motion-transform group-focus-visible:outline-focus relative flex h-9 w-6 items-center justify-center rounded-full bg-white text-neutral-800 shadow-[0_0_0_0.5px_rgb(0_0_0/0.35),0_2px_8px_rgb(0_0_0/0.35)] group-hover:scale-105 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-data-[dragging]:scale-95">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4.5 4 1.75 7 4.5 10M9.5 4 12.25 7 9.5 10" />
          </svg>
        </span>
      </div>
    </div>
  );
}
