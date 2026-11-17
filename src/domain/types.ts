export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect extends Point, Size {}

export const IMAGE_ROLES = ['reference', 'implementation'] as const;
export type ImageRole = (typeof IMAGE_ROLES)[number];

export const ROLE_LABEL: Record<ImageRole, string> = {
  reference: 'Reference',
  implementation: 'Implementation',
};

export const COMPARISON_MODES = ['side-by-side', 'slider', 'overlay', 'diff'] as const;
export type ComparisonMode = (typeof COMPARISON_MODES)[number];

/** How two images of different dimensions are brought onto one comparison canvas. */
export const MISMATCH_STRATEGIES = ['pad', 'crop'] as const;
export type MismatchStrategy = (typeof MISMATCH_STRATEGIES)[number];

export const ANCHORS = ['top-left', 'top-center', 'center'] as const;
export type Anchor = (typeof ANCHORS)[number];

export interface DiffSettings {
  /** Pixelmatch matching threshold, 0 (strict) to 1 (lenient). */
  readonly threshold: number;
  /** Count anti-aliased pixels as differences instead of ignoring them. */
  readonly includeAA: boolean;
  readonly strategy: MismatchStrategy;
  readonly anchor: Anchor;
}

export const DEFAULT_DIFF_SETTINGS: DiffSettings = {
  threshold: 0.1,
  includeAA: false,
  strategy: 'pad',
  anchor: 'top-left',
};

export interface ViewSettings {
  readonly mode: ComparisonMode;
  /** Divider position in the slider mode, as a fraction of the pane width. */
  readonly sliderPosition: number;
  /** Opacity of the implementation layer in the overlay mode. */
  readonly overlayOpacity: number;
  /** How strongly the reference shows beneath the difference mask, 0 to 1. */
  readonly diffContext: number;
}

export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  mode: 'side-by-side',
  sliderPosition: 0.5,
  overlayOpacity: 0.5,
  diffContext: 0.3,
};

/** Raw, non-premultiplied RGBA pixels in row-major order. */
export interface RgbaImage extends Size {
  readonly data: Uint8ClampedArray;
}

export function sizesEqual(a: Size, b: Size): boolean {
  return a.width === b.width && a.height === b.height;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
