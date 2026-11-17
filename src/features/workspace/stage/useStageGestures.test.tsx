import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockBox, pointer } from '@/test/pointer';
import { probeStore } from '@/state/stageStores';
import { useViewportStore } from '@/state/viewportStore';
import { useStageGestures } from './useStageGestures';

const PANE = { left: 50, top: 20, width: 800, height: 600 };

function Surface() {
  const ref = useRef<HTMLDivElement>(null);
  useStageGestures(ref);
  return (
    <div ref={ref} data-testid="surface" tabIndex={0}>
      <div data-pane data-testid="pane" />
      <div data-gesture-owner data-testid="owner" tabIndex={0} />
      <button type="button" data-testid="overlay-button">
        Dismiss
      </button>
    </div>
  );
}

const view = () => useViewportStore.getState();

beforeEach(() => {
  useViewportStore.setState({ autoFit: true, transform: { scale: 1, x: 0, y: 0 } });
  view().setContent({ width: 1600, height: 1200 });
  view().setPane({ width: PANE.width, height: PANE.height });
  view().zoomAt(1, { x: 0, y: 0 });
  useViewportStore.setState({ transform: { scale: 1, x: 100, y: 100 }, autoFit: false });
  probeStore.setState({ point: null });
});

function setup() {
  render(<Surface />);
  mockBox(screen.getByTestId('pane'), PANE);
  return { surface: screen.getByTestId('surface'), owner: screen.getByTestId('owner') };
}

describe('pan', () => {
  it('drags the shared transform by the pointer movement', () => {
    const { surface } = setup();
    pointer.down(surface, { clientX: 300, clientY: 300 });
    pointer.move(surface, { clientX: 340, clientY: 280 });
    pointer.up(surface, { clientX: 340, clientY: 280 });
    expect(view().transform).toMatchObject({ x: 140, y: 80, scale: 1 });
  });

  it('does not move the view when a gesture starts inside a gesture owner (the slider divider)', () => {
    const { owner } = setup();
    const before = view().transform;
    pointer.down(owner, { clientX: 300, clientY: 300 });
    pointer.move(owner, { clientX: 400, clientY: 350 });
    pointer.up(owner, { clientX: 400, clientY: 350 });
    expect(view().transform).toEqual(before);
    expect(view().autoFit).toBe(false);
  });

  it('does not pan or capture the pointer when a gesture starts on a button over the stage', () => {
    const { surface } = setup();
    const button = screen.getByTestId('overlay-button');
    const before = view().transform;
    pointer.down(button, { clientX: 300, clientY: 300 });
    pointer.move(button, { clientX: 400, clientY: 350 });
    pointer.up(button, { clientX: 400, clientY: 350 });
    expect(view().transform).toEqual(before);
    // Capture would retarget the click that follows, so the button would never receive it.
    expect(surface.hasPointerCapture(1)).toBe(false);
  });

  it('ignores the right mouse button', () => {
    const { surface } = setup();
    pointer.down(surface, { button: 2, clientX: 300, clientY: 300 });
    pointer.move(surface, { clientX: 340, clientY: 300 });
    expect(view().transform.x).toBe(100);
  });

  it('leaves arrow keys alone when they come from a control inside the stage', () => {
    const { owner } = setup();
    const before = view().transform;
    fireEvent.keyDown(owner, { key: 'ArrowLeft' });
    fireEvent.keyDown(owner, { key: 'ArrowDown', shiftKey: true });
    expect(view().transform).toEqual(before);
  });

  it('pans with arrow keys while focused, further with Shift', () => {
    const { surface } = setup();
    fireEvent.keyDown(surface, { key: 'ArrowLeft' });
    expect(view().transform.x).toBe(148);
    fireEvent.keyDown(surface, { key: 'ArrowDown', shiftKey: true });
    expect(view().transform.y).toBe(100 - 240);
  });
});

describe('zoom', () => {
  it('zooms at the cursor with Ctrl + wheel, keeping the point under it fixed', () => {
    const { surface } = setup();
    const before = view().transform;
    const cursor = { x: 300, y: 200 };
    const imagePoint = {
      x: (cursor.x - before.x) / before.scale,
      y: (cursor.y - before.y) / before.scale,
    };
    // clientX is relative to the viewport; the pane starts at (50, 20).
    fireEvent.wheel(surface, {
      deltaY: -200,
      ctrlKey: true,
      clientX: cursor.x + PANE.left,
      clientY: cursor.y + PANE.top,
    });
    const after = view().transform;
    expect(after.scale).toBeGreaterThan(1);
    expect((cursor.x - after.x) / after.scale).toBeCloseTo(imagePoint.x, 5);
    expect((cursor.y - after.y) / after.scale).toBeCloseTo(imagePoint.y, 5);
  });

  it('scrolls (pans) with a plain wheel', () => {
    const { surface } = setup();
    fireEvent.wheel(surface, { deltaX: 10, deltaY: 30 });
    expect(view().transform).toMatchObject({ scale: 1, x: 90, y: 70 });
  });

  it('pinches with two pointers: spreading zooms in, around the midpoint', () => {
    const { surface } = setup();
    pointer.down(surface, { pointerId: 1, pointerType: 'touch', clientX: 400, clientY: 300 });
    pointer.down(surface, { pointerId: 2, pointerType: 'touch', clientX: 500, clientY: 300 });
    pointer.move(surface, { pointerId: 2, pointerType: 'touch', clientX: 700, clientY: 300 });
    expect(view().transform.scale).toBeCloseTo(3, 5);
    pointer.up(surface, { pointerId: 2, pointerType: 'touch', clientX: 700, clientY: 300 });
    pointer.up(surface, { pointerId: 1, pointerType: 'touch', clientX: 400, clientY: 300 });
  });

  it('toggles between fit and a zoomed-in view on double-click', () => {
    const { surface } = setup();
    view().fit();
    const fitted = view().transform.scale;
    fireEvent.doubleClick(surface, { clientX: 400, clientY: 300 });
    expect(view().transform.scale).toBeGreaterThan(fitted);
    fireEvent.doubleClick(surface, { clientX: 400, clientY: 300 });
    expect(view().transform.scale).toBeCloseTo(fitted, 5);
  });

  it('ignores double-click on a gesture owner', () => {
    const { owner } = setup();
    const before = view().transform;
    fireEvent.doubleClick(owner);
    expect(view().transform).toEqual(before);
  });
});

describe('pixel probe', () => {
  it('reports the canvas pixel under a hovering mouse and clears on leave', async () => {
    const { surface } = setup();
    pointer.move(surface, { clientX: PANE.left + 250, clientY: PANE.top + 340 });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    // transform is (scale 1, x 100, y 100): pane point (250, 340) is image pixel (150, 240).
    expect(probeStore.getState().point).toEqual({ x: 150, y: 240 });
    fireEvent.pointerLeave(surface);
    expect(probeStore.getState().point).toBeNull();
  });
});
