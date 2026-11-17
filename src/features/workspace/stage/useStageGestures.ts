import { useEffect, type RefObject } from 'react';
import { pixelAt } from '@/domain/render';
import type { Point } from '@/domain/types';
import { probeStore } from '@/state/stageStores';
import { useViewportStore } from '@/state/viewportStore';

const WHEEL_ZOOM_SPEED = 0.01;
const LINE_HEIGHT_PX = 16;
const KEY_PAN_PX = 48;
const KEY_PAN_LARGE_PX = 240;
/** Weight of the newest sample in the smoothed release velocity. */
const VELOCITY_SMOOTHING = 0.35;
/** A pause longer than this before release means the user stopped, so there is nothing to coast on. */
const STALE_VELOCITY_MS = 80;
/**
 * Targets that run their own interaction. A gesture that starts on one (the slider divider, or a
 * button floating over the stage) must not also move the picture, and must not capture the pointer,
 * because capture retargets the click that follows and the control would never receive it.
 */
const EXEMPT = '[data-gesture-owner], button, a[href], input, select, textarea, summary';
const isExempt = (target: EventTarget | null) =>
  target instanceof Element && target.closest(EXEMPT) !== null;

interface Tracked {
  x: number;
  y: number;
}

function paneOf(surface: HTMLElement, target: EventTarget | null): HTMLElement {
  const pane = target instanceof Element ? target.closest<HTMLElement>('[data-pane]') : null;
  return pane ?? surface.querySelector<HTMLElement>('[data-pane]') ?? surface;
}

/** A point in the coordinates of the pane it is over, which share one transform. */
function pointInPane(
  surface: HTMLElement,
  target: EventTarget | null,
  x: number,
  y: number,
): Point {
  const rect = paneOf(surface, target).getBoundingClientRect();
  return { x: x - rect.left, y: y - rect.top };
}

/**
 * Pointer, wheel and keyboard input for the stage, all feeding the shared viewport.
 *
 * - One pointer drags to pan and, for touch and pen, coasts on release.
 * - Two pointers pinch to zoom and pan together.
 * - Wheel scrolls; Ctrl/Cmd + wheel (and a trackpad pinch) zooms at the cursor.
 * - Double-click zooms in at the cursor, and back out to fit.
 * - Arrow keys pan while the stage has focus.
 * - Anything that starts on a control inside the stage is left alone (see `EXEMPT`), so a control
 *   can run its own gesture, or just be clicked, without also moving the picture.
 */
export function useStageGestures(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const surface = ref.current;
    if (!surface) return;
    const viewport = () => useViewportStore.getState();

    const pointers = new Map<number, Tracked>();
    let velocity = { x: 0, y: 0 };
    let lastMoveAt = 0;
    let pinch: { distance: number; centre: Point } | null = null;

    // Hover position is coalesced to one update per frame, because the readout is React.
    let probeFrame = 0;
    let probeInput: { target: EventTarget | null; x: number; y: number } | null = null;
    const flushProbe = () => {
      probeFrame = 0;
      const input = probeInput;
      if (!input) return;
      const { transform, content } = viewport();
      const point = pixelAt(
        transform,
        pointInPane(surface, input.target, input.x, input.y),
        content,
      );
      const current = probeStore.getState().point;
      if (point?.x !== current?.x || point?.y !== current?.y) probeStore.setState({ point });
    };
    const updateProbe = (event: PointerEvent) => {
      probeInput = { target: event.target, x: event.clientX, y: event.clientY };
      probeFrame ||= requestAnimationFrame(flushProbe);
    };
    const clearProbe = () => {
      probeInput = null;
      probeStore.setState({ point: null });
    };

    const pinchState = (): { distance: number; centre: Point } | null => {
      const [a, b] = [...pointers.values()];
      if (!a || !b) return null;
      return {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        centre: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_HEIGHT_PX : 1;
      const dx = event.deltaX * unit;
      const dy = event.deltaY * unit;
      // Browsers report a trackpad pinch as a wheel event with ctrlKey set.
      if (event.ctrlKey || event.metaKey) {
        viewport().zoomAt(
          viewport().transform.scale * Math.exp(-dy * WHEEL_ZOOM_SPEED),
          pointInPane(surface, event.target, event.clientX, event.clientY),
        );
      } else if (event.shiftKey && dx === 0) {
        viewport().pan(-dy, 0);
      } else {
        viewport().pan(-dx, -dy);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (isExempt(event.target)) return;
      if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 1) return;
      viewport().halt();
      surface.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      velocity = { x: 0, y: 0 };
      lastMoveAt = event.timeStamp;
      pinch = pinchState();
      surface.dataset.panning = 'true';
    };

    const onPointerMove = (event: PointerEvent) => {
      const tracked = pointers.get(event.pointerId);
      if (!tracked) {
        if (event.pointerType === 'mouse') updateProbe(event);
        return;
      }

      const previous = { ...tracked };
      tracked.x = event.clientX;
      tracked.y = event.clientY;

      if (pointers.size >= 2 && pinch) {
        const next = pinchState();
        if (!next || pinch.distance === 0) return;
        const focus = pointInPane(surface, event.target, next.centre.x, next.centre.y);
        viewport().zoomAt(viewport().transform.scale * (next.distance / pinch.distance), focus);
        viewport().pan(next.centre.x - pinch.centre.x, next.centre.y - pinch.centre.y);
        pinch = next;
        return;
      }

      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      const dt = Math.max(1, event.timeStamp - lastMoveAt) / 1000;
      velocity = {
        x: velocity.x + (dx / dt - velocity.x) * VELOCITY_SMOOTHING,
        y: velocity.y + (dy / dt - velocity.y) * VELOCITY_SMOOTHING,
      };
      lastMoveAt = event.timeStamp;
      viewport().pan(dx, dy);
    };

    const onPointerEnd = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId)) return;
      const wasSinglePointer = pointers.size === 0;
      pinch = pinchState();
      if (wasSinglePointer) {
        delete surface.dataset.panning;
        const coasting =
          event.type === 'pointerup' &&
          event.pointerType !== 'mouse' &&
          event.timeStamp - lastMoveAt < STALE_VELOCITY_MS;
        if (coasting) viewport().fling(velocity.x, velocity.y);
      }
    };

    const onDoubleClick = (event: MouseEvent) => {
      if (isExempt(event.target)) return;
      viewport().toggleZoom(pointInPane(surface, event.target, event.clientX, event.clientY));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // Keys belong to a focused control inside the stage, such as the divider's arrow keys.
      if (event.ctrlKey || event.metaKey || event.altKey || isExempt(event.target)) return;
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

    // Wheel must be non-passive to stop the page from scrolling or zooming underneath.
    surface.addEventListener('wheel', onWheel, { passive: false });
    surface.addEventListener('pointerdown', onPointerDown);
    surface.addEventListener('pointermove', onPointerMove);
    surface.addEventListener('pointerup', onPointerEnd);
    surface.addEventListener('pointercancel', onPointerEnd);
    surface.addEventListener('lostpointercapture', onPointerEnd);
    surface.addEventListener('pointerleave', clearProbe);
    surface.addEventListener('dblclick', onDoubleClick);
    surface.addEventListener('keydown', onKeyDown);
    return () => {
      if (probeFrame) cancelAnimationFrame(probeFrame);
      viewport().halt();
      clearProbe();
      surface.removeEventListener('wheel', onWheel);
      surface.removeEventListener('pointerdown', onPointerDown);
      surface.removeEventListener('pointermove', onPointerMove);
      surface.removeEventListener('pointerup', onPointerEnd);
      surface.removeEventListener('pointercancel', onPointerEnd);
      surface.removeEventListener('lostpointercapture', onPointerEnd);
      surface.removeEventListener('pointerleave', clearProbe);
      surface.removeEventListener('dblclick', onDoubleClick);
      surface.removeEventListener('keydown', onKeyDown);
    };
  }, [ref]);
}
