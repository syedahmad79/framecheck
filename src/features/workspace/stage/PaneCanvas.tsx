import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useTheme } from '@/state/theme';
import { probeStore } from '@/state/stageStores';
import { useViewportStore } from '@/state/viewportStore';
import { beginFrame, readPalette, type Frame, type Palette } from './paint';

interface PaneCanvasProps {
  /** Draws the pane. Called from an animation frame whenever the view or this function changes. */
  readonly paint: (frame: Frame) => void;
  /** Description for assistive technology. */
  readonly label: string;
  /** Report this pane's size to the shared viewport. Exactly one pane per view should. */
  readonly measure?: boolean;
  readonly children?: ReactNode;
}

/**
 * A pane is one canvas sized to its on-screen box (times the device pixel ratio) rather than to
 * the image. Zooming and panning redraw only what is visible, so memory use does not grow with
 * image size, the picture stays sharp at any zoom, and no React render happens while the pointer
 * moves: the viewport store notifies this component, which schedules at most one paint per frame.
 */
export function PaneCanvas({ paint, label, measure = false, children }: PaneCanvasProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef(paint);
  const requestRef = useRef<() => void>(() => undefined);
  const paletteRef = useRef<Palette | null>(null);
  const theme = useTheme((state) => state.resolved);

  useLayoutEffect(() => {
    paintRef.current = paint;
    requestRef.current();
  }, [paint]);

  useLayoutEffect(() => {
    // Theme tokens change with the theme attribute; read them again on the next paint.
    paletteRef.current = null;
    requestRef.current();
  }, [theme]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const run = () => {
      raf = 0;
      const ctx = canvas.getContext('2d');
      if (!ctx || width === 0 || height === 0) return;
      paletteRef.current ??= readPalette();
      paintRef.current(
        beginFrame(
          ctx,
          { width, height },
          dpr,
          useViewportStore.getState().transform,
          paletteRef.current,
          probeStore.getState().point,
        ),
      );
    };
    const request = () => {
      raf ||= requestAnimationFrame(run);
    };
    requestRef.current = request;

    const resize = () => {
      width = root.clientWidth;
      height = root.clientHeight;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      if (measure) useViewportStore.getState().setPane({ width, height });
      request();
    };
    resize();

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(root);

    // A change of device pixel ratio (browser zoom, moving between displays) is not a resize.
    let ratioQuery: MediaQueryList | null = null;
    const watchRatio = () => {
      ratioQuery?.removeEventListener('change', onRatioChange);
      if (typeof window.matchMedia !== 'function') return;
      ratioQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      ratioQuery.addEventListener('change', onRatioChange);
    };
    function onRatioChange() {
      resize();
      watchRatio();
    }
    watchRatio();

    const unsubscribeViewport = useViewportStore.subscribe((state, previous) => {
      if (state.transform !== previous.transform) request();
    });
    const unsubscribeProbe = probeStore.subscribe(request);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      requestRef.current = () => undefined;
      observer?.disconnect();
      ratioQuery?.removeEventListener('change', onRatioChange);
      unsubscribeViewport();
      unsubscribeProbe();
    };
  }, [measure]);

  return (
    <div ref={rootRef} data-pane className="relative size-full min-h-0 min-w-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className="absolute inset-0 size-full"
      />
      {children}
    </div>
  );
}
