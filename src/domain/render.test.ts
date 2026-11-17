import { describe, expect, it } from 'vitest';
import { fractionAlong, pixelAt, projectToPane, rectToPane } from './render';

const pane = { width: 400, height: 300 };

describe('projectToPane', () => {
  it('draws the whole image at exactly `scale` times its size when it fits', () => {
    const content = { x: 0, y: 0, width: 100, height: 50 };
    const r = projectToPane(content, { x: 0, y: 0 }, { scale: 2, x: 20, y: 30 }, pane);
    expect(r).toEqual({ sx: 0, sy: 0, sw: 100, sh: 50, dx: 20, dy: 30, dw: 200, dh: 100 });
  });

  it('draws only the visible whole source pixels when zoomed in, never resampling', () => {
    const content = { x: 0, y: 0, width: 1000, height: 1000 };
    // 10x zoom, panned so source pixel (100.5, 50.25) sits at the pane's top-left.
    const t = { scale: 10, x: -1005, y: -502.5 };
    const r = projectToPane(content, { x: 0, y: 0 }, t, pane);
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.dw / r.sw).toBe(10);
    expect(r.dh / r.sh).toBe(10);
    expect(Number.isInteger(r.sx) && Number.isInteger(r.sy)).toBe(true);
    expect(r.sx).toBe(100);
    expect(r.dx).toBe(-1005 + 100 * 10);
    // The drawn region covers the whole pane.
    expect(r.dx).toBeLessThanOrEqual(0);
    expect(r.dx + r.dw).toBeGreaterThanOrEqual(pane.width);
    expect(r.dy + r.dh).toBeGreaterThanOrEqual(pane.height);
  });

  it('offsets into the source for a placement that starts inside a larger source (crop)', () => {
    const content = { x: 0, y: 0, width: 80, height: 50 };
    const r = projectToPane(content, { x: 10, y: 5 }, { scale: 1, x: 0, y: 0 }, pane);
    expect(r).toMatchObject({ sx: 10, sy: 5, sw: 80, sh: 50, dx: 0, dy: 0 });
  });

  it('places padded content at its offset on the canvas', () => {
    const content = { x: 20, y: 30, width: 60, height: 40 };
    const r = projectToPane(content, { x: 0, y: 0 }, { scale: 1, x: 5, y: 5 }, pane);
    expect(r).toMatchObject({ sx: 0, sy: 0, dx: 25, dy: 35, dw: 60, dh: 40 });
  });

  it('returns null when the content is entirely off-screen', () => {
    const content = { x: 0, y: 0, width: 100, height: 100 };
    expect(projectToPane(content, { x: 0, y: 0 }, { scale: 1, x: 500, y: 0 }, pane)).toBeNull();
    expect(projectToPane(content, { x: 0, y: 0 }, { scale: 1, x: -200, y: 0 }, pane)).toBeNull();
  });
});

describe('rectToPane / pixelAt', () => {
  it('round-trips between canvas and pane space', () => {
    const t = { scale: 4, x: 30, y: -10 };
    expect(rectToPane({ x: 5, y: 2, width: 3, height: 1 }, t)).toEqual({
      x: 50,
      y: -2,
      width: 12,
      height: 4,
    });
    expect(pixelAt(t, { x: 50, y: -2 }, { width: 100, height: 100 })).toEqual({ x: 5, y: 2 });
    expect(pixelAt(t, { x: 61.9, y: 1.9 }, { width: 100, height: 100 })).toEqual({ x: 7, y: 2 });
  });

  it('is null off the canvas, including exactly past the last pixel', () => {
    const t = { scale: 1, x: 0, y: 0 };
    expect(pixelAt(t, { x: -0.5, y: 5 }, { width: 10, height: 10 })).toBeNull();
    expect(pixelAt(t, { x: 10, y: 5 }, { width: 10, height: 10 })).toBeNull();
    expect(pixelAt(t, { x: 9.99, y: 9.99 }, { width: 10, height: 10 })).toEqual({ x: 9, y: 9 });
  });
});

describe('fractionAlong', () => {
  it('maps pointer positions across the full width, clamped to 0..1', () => {
    expect(fractionAlong(100, 100, 400)).toBe(0);
    expect(fractionAlong(300, 100, 400)).toBe(0.5);
    expect(fractionAlong(500, 100, 400)).toBe(1);
    expect(fractionAlong(-50, 100, 400)).toBe(0);
    expect(fractionAlong(9999, 100, 400)).toBe(1);
  });

  it('respects the offset at which the handle was grabbed, so it does not jump', () => {
    // Grabbed 6px right of the divider's centre: the divider stays 6px left of the pointer.
    expect(fractionAlong(306, 100, 400, 6)).toBe(0.5);
  });

  it('is safe for a zero-width pane', () => {
    expect(fractionAlong(10, 0, 0)).toBe(0);
  });
});
