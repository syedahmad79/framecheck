import { useEffect, type RefObject } from 'react';
import type { Point } from '@/domain/types';
import { useViewportStore } from '@/state/viewportStore';

const WHEEL_ZOOM_SPEED = 0.01;
const LINE_HEIGHT_PX = 16;
const KEY_PAN_PX = 40;
const KEY_PAN_LARGE_PX = 200;

/** Pointer position relative to the pane it is over, so zooming focuses on the same image point in any pane. */
function pointInPane(
  surface: HTMLElement,
  target: EventTarget | null,
  x: number,
  y: number,
): Point {
  const pane =
    (target instanceof Element ? target.closest('[data-pane]') : null) ??
    surface.querySelector('[data-pane]') ??
    surface;
  const rect = pane.getBoundingClientRect();
  return { x: x - rect.left, y: y - rect.top };
}

/**
 * Wires pointer, wheel and keyboard input on the stage to the shared viewport:
 * drag to pan, scroll to pan, Ctrl/Cmd + scroll (or trackpad pinch) to zoom at the cursor,
 * arrow keys to pan while the stage has focus.
 */
export function useStageGestures(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const surface = ref.current;
    if (!surface) return;
    const viewport = () => useViewportStore.getState();

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_HEIGHT_PX : 1;
      const dx = event.deltaX * unit;
      const dy = event.deltaY * unit;
      // Browsers report a trackpad pinch as a wheel event with ctrlKey set.
      if (event.ctrlKey || event.metaKey) {
        const { transform, zoomAt } = viewport();
        zoomAt(
          transform.scale * Math.exp(-dy * WHEEL_ZOOM_SPEED),
          pointInPane(surface, event.target, event.clientX, event.clientY),
        );
      } else if (event.shiftKey && dx === 0) {
        viewport().pan(-dy, 0);
      } else {
        viewport().pan(-dx, -dy);
      }
    };

    let drag: { pointerId: number; x: number; y: number } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.button !== 1) return;
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      surface.setPointerCapture(event.pointerId);
      surface.dataset.panning = 'true';
    };

    const onPointerMove = (event: PointerEvent) => {
      if (drag?.pointerId !== event.pointerId) return;
      viewport().pan(event.clientX - drag.x, event.clientY - drag.y);
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    };

    const endDrag = (event: PointerEvent) => {
      if (drag?.pointerId !== event.pointerId) return;
      drag = null;
      delete surface.dataset.panning;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const step = event.shiftKey ? KEY_PAN_LARGE_PX : KEY_PAN_PX;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [step, 0],
        ArrowRight: [-step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      };
      const move = moves[event.key];
      if (!move) return;
      event.preventDefault();
      viewport().pan(move[0], move[1]);
    };

    // Must be non-passive to prevent the page from scrolling or zooming.
    surface.addEventListener('wheel', onWheel, { passive: false });
    surface.addEventListener('pointerdown', onPointerDown);
    surface.addEventListener('pointermove', onPointerMove);
    surface.addEventListener('pointerup', endDrag);
    surface.addEventListener('pointercancel', endDrag);
    surface.addEventListener('keydown', onKeyDown);
    return () => {
      surface.removeEventListener('wheel', onWheel);
      surface.removeEventListener('pointerdown', onPointerDown);
      surface.removeEventListener('pointermove', onPointerMove);
      surface.removeEventListener('pointerup', endDrag);
      surface.removeEventListener('pointercancel', endDrag);
      surface.removeEventListener('keydown', onKeyDown);
    };
  }, [ref]);
}
