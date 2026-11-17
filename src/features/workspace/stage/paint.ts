import { MASK_COLORS, type DensityGrid } from '@/domain/diff';
import type { Placement } from '@/domain/layout';
import { subtractRect } from '@/domain/layout';
import { projectToPane, rectToPane } from '@/domain/render';
import type { Point, Rect, Size } from '@/domain/types';
import type { ViewTransform } from '@/domain/viewport';

/** Colours for the painted parts of the stage, read from the active theme's CSS tokens. */
export interface Palette {
  readonly paperA: string;
  readonly paperB: string;
  readonly paperDiff: string;
  readonly edge: string;
  readonly grid: string;
  readonly diff: string;
  readonly aa: string;
  readonly outside: string;
}

export function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    paperA: token('--paper-a'),
    paperB: token('--paper-b'),
    paperDiff: token('--paper-diff'),
    edge: token('--paper-edge'),
    grid: token('--grid'),
    diff: token('--diff'),
    aa: token('--aa'),
    outside: token('--outside'),
  };
}

export interface Frame {
  readonly ctx: CanvasRenderingContext2D;
  /** The transform with its translation snapped to whole device pixels. */
  readonly transform: ViewTransform;
  readonly pane: Size;
  readonly dpr: number;
  readonly palette: Palette;
  readonly probe: Point | null;
}

/** Device pixels per image pixel. Above ~2 each image pixel is drawn as a crisp square. */
const deviceScale = (frame: Frame) => frame.transform.scale * frame.dpr;
const CRISP_FROM = 2;
const PROBE_FROM = 6;
const GRID_FROM = 10;
const DENSITY_BELOW = 1;

export function beginFrame(
  ctx: CanvasRenderingContext2D,
  pane: Size,
  dpr: number,
  transform: ViewTransform,
  palette: Palette,
  probe: Point | null,
): Frame {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, pane.width, pane.height);
  const snapped = {
    scale: transform.scale,
    x: Math.round(transform.x * dpr) / dpr,
    y: Math.round(transform.y * dpr) / dpr,
  };
  return { ctx, transform: snapped, pane, dpr, palette, probe };
}

function setSmoothing(frame: Frame): void {
  const smooth = deviceScale(frame) < CRISP_FROM;
  frame.ctx.imageSmoothingEnabled = smooth;
  if (smooth) frame.ctx.imageSmoothingQuality = 'high';
}

const patterns = new WeakMap<Palette, CanvasPattern | null>();

function checkerPattern(frame: Frame): CanvasPattern | null {
  const cached = patterns.get(frame.palette);
  if (cached !== undefined) return cached;
  const tile = document.createElement('canvas');
  tile.width = tile.height = 16;
  const context = tile.getContext('2d');
  let pattern: CanvasPattern | null = null;
  if (context) {
    context.fillStyle = frame.palette.paperA;
    context.fillRect(0, 0, 16, 16);
    context.fillStyle = frame.palette.paperB;
    context.fillRect(0, 0, 8, 8);
    context.fillRect(8, 8, 8, 8);
    pattern = frame.ctx.createPattern(tile, 'repeat');
  }
  patterns.set(frame.palette, pattern);
  return pattern;
}

const canvasRect = (canvas: Size): Rect => ({ x: 0, y: 0, ...canvas });

/** The area the images live in: a checkerboard (so transparency reads as transparency), or flat. */
export function drawBackdrop(frame: Frame, canvas: Size, kind: 'checker' | 'flat'): void {
  const r = rectToPane(canvasRect(canvas), frame.transform);
  const { ctx } = frame;
  ctx.fillStyle = (kind === 'checker' ? checkerPattern(frame) : null) ?? frame.palette.paperDiff;
  ctx.fillRect(r.x, r.y, r.width, r.height);
}

export function drawEdge(frame: Frame, canvas: Size): void {
  const r = rectToPane(canvasRect(canvas), frame.transform);
  const { ctx } = frame;
  ctx.strokeStyle = frame.palette.edge;
  ctx.lineWidth = 1 / frame.dpr;
  ctx.strokeRect(
    r.x - 0.5 / frame.dpr,
    r.y - 0.5 / frame.dpr,
    r.width + 1 / frame.dpr,
    r.height + 1 / frame.dpr,
  );
}

/**
 * Draw `source` pixels onto the canvas rectangle `content`. The destination is exactly
 * `scale` times the source, so nothing is ever resampled at an unintended ratio.
 */
export function drawLayer(
  frame: Frame,
  source: ImageBitmap,
  content: Rect,
  origin: Point,
  alpha = 1,
): void {
  const rect = projectToPane(content, origin, frame.transform, frame.pane);
  if (!rect) return;
  const { ctx } = frame;
  ctx.globalAlpha = alpha;
  setSmoothing(frame);
  try {
    ctx.drawImage(source, rect.sx, rect.sy, rect.sw, rect.sh, rect.dx, rect.dy, rect.dw, rect.dh);
  } catch (error) {
    // A bitmap released between scheduling and painting (the comparison was closed) is skipped.
    if (!(error instanceof DOMException && error.name === 'InvalidStateError')) throw error;
  } finally {
    ctx.globalAlpha = 1;
  }
}

export function drawPlacement(
  frame: Frame,
  bitmap: ImageBitmap,
  placement: Placement,
  alpha = 1,
): void {
  drawLayer(
    frame,
    bitmap,
    { x: placement.dx, y: placement.dy, width: placement.width, height: placement.height },
    { x: placement.sx, y: placement.sy },
    alpha,
  );
}

/** Remove colour from everything painted so far inside the canvas area, leaving only lightness. */
export function desaturate(frame: Frame, canvas: Size): void {
  const r = rectToPane(canvasRect(canvas), frame.transform);
  const { ctx } = frame;
  ctx.globalCompositeOperation = 'saturation';
  ctx.fillStyle = '#808080';
  ctx.fillRect(r.x, r.y, r.width, r.height);
  ctx.globalCompositeOperation = 'source-over';
}

/** Tint the part of the canvas that only one image covers, which is not compared. */
export function drawOutside(frame: Frame, canvas: Size, overlap: Rect): void {
  const { ctx } = frame;
  ctx.fillStyle = frame.palette.outside;
  ctx.globalAlpha = 0.32;
  for (const rect of subtractRect(canvasRect(canvas), overlap)) {
    const r = rectToPane(rect, frame.transform);
    ctx.fillRect(r.x, r.y, r.width, r.height);
  }
  ctx.globalAlpha = 1;
}

const [DIFF_R, DIFF_G, DIFF_B] = MASK_COLORS.diff;
const DENSITY_MIN_ALPHA = 0.26;
const DENSITY_MAX_ALPHA = 0.8;
let densityCanvas: HTMLCanvasElement | null = null;
let densityKey: DensityGrid | null = null;

/**
 * Zoomed out, a single differing pixel is far smaller than a screen pixel and vanishes. This
 * halo marks every grid cell that contains differences; it shows where they are, not how many.
 */
export function drawDensity(frame: Frame, density: DensityGrid, canvas: Size): void {
  if (frame.transform.scale >= DENSITY_BELOW || density.max === 0) return;
  if (densityKey !== density || !densityCanvas) {
    densityCanvas ??= document.createElement('canvas');
    densityCanvas.width = density.columns;
    densityCanvas.height = density.rows;
    const context = densityCanvas.getContext('2d');
    if (!context) return;
    const image = context.createImageData(density.columns, density.rows);
    for (let cell = 0; cell < density.counts.length; cell++) {
      if ((density.counts[cell] ?? 0) === 0) continue;
      const intensity = Math.sqrt((density.counts[cell] ?? 0) / density.max);
      image.data.set(
        [
          DIFF_R,
          DIFF_G,
          DIFF_B,
          255 * (DENSITY_MIN_ALPHA + (DENSITY_MAX_ALPHA - DENSITY_MIN_ALPHA) * intensity),
        ],
        cell * 4,
      );
    }
    context.putImageData(image, 0, 0);
    densityKey = density;
  }
  const { ctx, transform } = frame;
  const area = rectToPane(canvasRect(canvas), transform);
  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x, area.y, area.width, area.height);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  const size = density.cellSize * transform.scale;
  ctx.drawImage(
    densityCanvas,
    transform.x,
    transform.y,
    density.columns * size,
    density.rows * size,
  );
  ctx.restore();
}

/** A faint pixel grid, drawn only when each image pixel is large enough to count individually. */
export function drawGrid(frame: Frame, canvas: Size): void {
  if (deviceScale(frame) < GRID_FROM) return;
  const { ctx, transform, pane } = frame;
  const area = rectToPane(canvasRect(canvas), transform);
  const left = Math.max(area.x, 0);
  const top = Math.max(area.y, 0);
  const right = Math.min(area.x + area.width, pane.width);
  const bottom = Math.min(area.y + area.height, pane.height);
  ctx.strokeStyle = frame.palette.grid;
  ctx.lineWidth = 1 / frame.dpr;
  ctx.beginPath();
  const firstX = Math.ceil((left - transform.x) / transform.scale);
  for (let x = transform.x + firstX * transform.scale; x <= right; x += transform.scale) {
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
  }
  const firstY = Math.ceil((top - transform.y) / transform.scale);
  for (let y = transform.y + firstY * transform.scale; y <= bottom; y += transform.scale) {
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
  }
  ctx.stroke();
}

/** Outline the pixel under the pointer, in both panes, once pixels are large enough to see. */
export function drawProbe(frame: Frame): void {
  if (!frame.probe || deviceScale(frame) < PROBE_FROM) return;
  const r = rectToPane(
    { x: frame.probe.x, y: frame.probe.y, width: 1, height: 1 },
    frame.transform,
  );
  const { ctx } = frame;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(r.x - 1, r.y - 1, r.width + 2, r.height + 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#000000';
  ctx.strokeRect(r.x - 0.5, r.y - 0.5, r.width + 1, r.height + 1);
}
