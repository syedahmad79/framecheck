import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fitTransform, toImagePoint } from '@/domain/viewport';
import { useViewportStore } from './viewportStore';

const view = () => useViewportStore.getState();
const CONTENT = { width: 2000, height: 1000 };
const PANE = { width: 1000, height: 600 };

beforeEach(() => {
  useViewportStore.setState({
    autoFit: true,
    transform: { scale: 1, x: 0, y: 0 },
    pane: { width: 0, height: 0 },
    content: { width: 0, height: 0 },
  });
  view().setContent(CONTENT);
  view().setPane(PANE);
});

describe('viewport store', () => {
  it('starts fitted once both sizes are known', () => {
    expect(view().transform).toEqual(fitTransform(CONTENT, PANE));
    expect(view().autoFit).toBe(true);
  });

  it('re-fits on resize while fitted, but keeps the view centre once the user has moved', () => {
    view().setPane({ width: 800, height: 500 });
    expect(view().transform).toEqual(fitTransform(CONTENT, { width: 800, height: 500 }));

    view().zoomAt(2, { x: 400, y: 250 });
    const centreBefore = toImagePoint(view().transform, { x: 400, y: 250 });
    view().setPane({ width: 1200, height: 700 });
    const centreAfter = toImagePoint(view().transform, { x: 600, y: 350 });
    expect(centreAfter.x).toBeCloseTo(centreBefore.x, 4);
    expect(centreAfter.y).toBeCloseTo(centreBefore.y, 4);
    expect(view().autoFit).toBe(false);
  });

  it('zoomAt keeps the point under the focus fixed and clamps the pan', () => {
    const focus = { x: 300, y: 200 };
    const before = toImagePoint(view().transform, focus);
    view().zoomAt(4, focus);
    const after = toImagePoint(view().transform, focus);
    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.y).toBeCloseTo(before.y, 5);

    view().pan(1e6, 1e6);
    expect(view().transform.x).toBeLessThanOrEqual(PANE.width);
    expect(view().transform.y).toBeLessThanOrEqual(PANE.height);
  });

  it('actualSize centres the content at 100%; fit returns to the fitted view', () => {
    view().actualSize();
    expect(view().transform.scale).toBe(1);
    expect(view().autoFit).toBe(false);
    view().fit();
    expect(view().transform).toEqual(fitTransform(CONTENT, PANE));
    expect(view().autoFit).toBe(true);
  });

  it('zoomStep walks the zoom ladder from the current scale', () => {
    view().actualSize();
    view().zoomStep(1);
    expect(view().transform.scale).toBe(1.5);
    view().zoomStep(-1);
    view().zoomStep(-1);
    expect(view().transform.scale).toBe(0.75);
  });

  it('toggleZoom zooms in from the fitted view and back to fit', () => {
    const fitted = view().transform.scale;
    view().toggleZoom({ x: 500, y: 300 });
    expect(view().transform.scale).toBeCloseTo(Math.max(1, fitted * 2), 5);
    view().toggleZoom({ x: 500, y: 300 });
    expect(view().transform.scale).toBeCloseTo(fitted, 5);
  });

  it('frame centres a region of the canvas in the pane', () => {
    view().frame({ x: 600, y: 300, width: 100, height: 50 });
    const centre = toImagePoint(view().transform, { x: PANE.width / 2, y: PANE.height / 2 });
    expect(centre.x).toBeCloseTo(650, 4);
    expect(centre.y).toBeCloseTo(325, 4);
  });

  it('a new content size resets to fitted', () => {
    view().zoomAt(4, { x: 0, y: 0 });
    view().setContent({ width: 800, height: 800 });
    expect(view().autoFit).toBe(true);
    expect(view().transform).toEqual(fitTransform({ width: 800, height: 800 }, PANE));
  });

  it('reset re-fits immediately even if the content size is unchanged', () => {
    view().zoomAt(4, { x: 0, y: 0 });
    view().reset();
    expect(view().transform).toEqual(fitTransform(CONTENT, PANE));
  });
});

describe('animated motion', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const settle = () => vi.advanceTimersByTime(1500);

  it('glides to the target and stops exactly on it', () => {
    view().actualSize();
    expect(view().transform.scale).toBe(fitTransform(CONTENT, PANE).scale);
    vi.advanceTimersByTime(60);
    const mid = view().transform.scale;
    expect(mid).toBeGreaterThan(fitTransform(CONTENT, PANE).scale);
    expect(mid).toBeLessThan(1);
    settle();
    expect(view().transform.scale).toBe(1);
  });

  it('is interrupted by direct manipulation, continuing from the on-screen value', () => {
    view().actualSize();
    vi.advanceTimersByTime(60);
    const onScreen = view().transform;
    view().pan(10, 0);
    expect(view().transform.scale).toBe(onScreen.scale);
    settle();
    // Nothing keeps animating towards the old target after the user took over.
    expect(view().transform.scale).toBe(onScreen.scale);
  });

  it('keeps zoom-to-changes aimed at the region when the pane resizes mid-flight', () => {
    // Switching mode swaps a half-width pane for a full-width one while the animation runs.
    const region = { x: 600, y: 300, width: 100, height: 50 };
    view().frame(region);
    vi.advanceTimersByTime(60);
    const wider = { width: 1400, height: 600 };
    view().setPane(wider);
    settle();
    const centre = toImagePoint(view().transform, { x: wider.width / 2, y: wider.height / 2 });
    expect(centre.x).toBeCloseTo(650, 3);
    expect(centre.y).toBeCloseTo(325, 3);
    expect(view().transform.scale).toBeGreaterThan(4);
  });

  it('stepping zoom repeatedly aims from the pending target, not the in-flight value', () => {
    view().actualSize();
    settle();
    view().zoomStep(1);
    view().zoomStep(1);
    view().zoomStep(1);
    settle();
    expect(view().transform.scale).toBe(3);
  });

  it('flings after a drag and coasts to a stop within the bounds', () => {
    view().actualSize();
    settle();
    const before = view().transform.x;
    view().fling(-1500, 0);
    vi.advanceTimersByTime(3000);
    expect(view().transform.x).toBeLessThan(before);
    const rested = view().transform.x;
    vi.advanceTimersByTime(1000);
    expect(view().transform.x).toBe(rested);
  });

  it('ignores a slow release instead of coasting', () => {
    view().actualSize();
    settle();
    const before = view().transform;
    view().fling(40, 0);
    vi.advanceTimersByTime(1000);
    expect(view().transform).toEqual(before);
  });
});
