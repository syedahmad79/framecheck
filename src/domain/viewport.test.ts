import { describe, expect, it } from 'vitest';
import {
  constrainPan,
  fitTransform,
  frameRect,
  MAX_SCALE,
  MIN_SCALE,
  nextZoomStep,
  panBy,
  toImagePoint,
  zoomTo,
} from './viewport';

describe('fitTransform', () => {
  it('scales down to fit inside the padded pane and centres the content', () => {
    const t = fitTransform({ width: 2000, height: 1000 }, { width: 1048, height: 800 }, 24);
    expect(t.scale).toBeCloseTo(0.5);
    expect(t.x).toBeCloseTo(24);
    expect(t.y).toBeCloseTo(150);
  });

  it('does not upscale small content past 100%', () => {
    const t = fitTransform({ width: 100, height: 100 }, { width: 500, height: 300 });
    expect(t).toEqual({ scale: 1, x: 200, y: 100 });
  });

  it('falls back to identity for degenerate sizes', () => {
    expect(fitTransform({ width: 0, height: 10 }, { width: 500, height: 300 }).scale).toBe(1);
    expect(fitTransform({ width: 10, height: 10 }, { width: 0, height: 0 }).scale).toBe(1);
  });
});

describe('zoomTo', () => {
  it('keeps the image point under the focus stationary', () => {
    const before = { scale: 0.5, x: 40, y: -20 };
    const focus = { x: 300, y: 220 };
    const after = zoomTo(before, 2, focus);
    const a = toImagePoint(before, focus);
    const b = toImagePoint(after, focus);
    expect(after.scale).toBe(2);
    expect(b.x).toBeCloseTo(a.x);
    expect(b.y).toBeCloseTo(a.y);
  });

  it('clamps to the scale limits', () => {
    expect(zoomTo({ scale: 1, x: 0, y: 0 }, 1000, { x: 0, y: 0 }).scale).toBe(MAX_SCALE);
    expect(zoomTo({ scale: 1, x: 0, y: 0 }, 0, { x: 0, y: 0 }).scale).toBe(MIN_SCALE);
  });
});

describe('nextZoomStep', () => {
  it('moves to the adjacent stop from an arbitrary scale', () => {
    expect(nextZoomStep(0.42, 1)).toBe(0.5);
    expect(nextZoomStep(0.42, -1)).toBe(0.33);
  });

  it('moves past the current stop when exactly on one', () => {
    expect(nextZoomStep(1, 1)).toBe(1.5);
    expect(nextZoomStep(1, -1)).toBe(0.75);
  });

  it('saturates at the limits', () => {
    expect(nextZoomStep(MAX_SCALE, 1)).toBe(MAX_SCALE);
    expect(nextZoomStep(MIN_SCALE, -1)).toBe(MIN_SCALE);
  });
});

describe('frameRect', () => {
  it('centres the rectangle in the pane', () => {
    const pane = { width: 800, height: 600 };
    const rect = { x: 100, y: 200, width: 50, height: 20 };
    const t = frameRect(rect, pane);
    const centre = toImagePoint(t, { x: 400, y: 300 });
    expect(centre.x).toBeCloseTo(125);
    expect(centre.y).toBeCloseTo(210);
    expect(t.scale).toBeLessThanOrEqual(8);
  });
});

describe('panBy / constrainPan', () => {
  it('translates without changing scale', () => {
    expect(panBy({ scale: 2, x: 10, y: 10 }, 5, -5)).toEqual({ scale: 2, x: 15, y: 5 });
  });

  it('pulls content back so a margin stays visible', () => {
    const content = { width: 200, height: 100 };
    const pane = { width: 400, height: 300 };
    expect(constrainPan({ scale: 1, x: 1000, y: 1000 }, content, pane, 48)).toEqual({
      scale: 1,
      x: 352,
      y: 252,
    });
    expect(constrainPan({ scale: 1, x: -1000, y: -1000 }, content, pane, 48)).toEqual({
      scale: 1,
      x: -152,
      y: -52,
    });
  });

  it('returns the same object when already in bounds', () => {
    const t = { scale: 1, x: 10, y: 10 };
    expect(constrainPan(t, { width: 200, height: 100 }, { width: 400, height: 300 })).toBe(t);
  });
});
