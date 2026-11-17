import { useCallback, useState, type ReactNode } from 'react';
import type { ComparisonLayout } from '@/domain/layout';
import { formatDimensions } from '@/domain/files';
import { ROLE_LABEL, type ImageRole } from '@/domain/types';
import type { DiffResult } from '@/services/diffProtocol';
import type { ImagePair } from '@/services/images';
import { usePeek } from '@/state/stageStores';
import { cn } from '@/ui/cn';
import { PaneCanvas } from './PaneCanvas';
import {
  desaturate,
  drawBackdrop,
  drawDensity,
  drawEdge,
  drawGrid,
  drawLayer,
  drawOutside,
  drawPlacement,
  drawProbe,
  type Frame,
} from './paint';
import { SliderHandle } from './SliderHandle';

interface ViewProps {
  readonly images: ImagePair;
  readonly layout: ComparisonLayout;
}

const ROLE_DOT: Record<ImageRole, string> = { reference: 'bg-ref', implementation: 'bg-impl' };

export function RoleTag({
  role,
  detail,
  side = 'left',
}: {
  role: ImageRole;
  detail?: ReactNode;
  side?: 'left' | 'right';
}) {
  return (
    <span
      className={cn(
        'bg-material text-fg shadow-raised pointer-events-none absolute top-3 flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-2 text-xs font-medium backdrop-blur-md',
        side === 'left' ? 'left-3' : 'right-3',
      )}
    >
      <span className={cn('size-2 rounded-full', ROLE_DOT[role])} />
      {ROLE_LABEL[role]}
      {detail && <span className="tabular text-fg-subtle font-normal">{detail}</span>}
    </span>
  );
}

/** Image pixels, centred where they land on the canvas, over a checkerboard. */
function paintImage(frame: Frame, images: ImagePair, layout: ComparisonLayout, role: ImageRole) {
  drawBackdrop(frame, layout.canvas, 'checker');
  drawPlacement(frame, images[role].bitmap, layout[role]);
  drawEdge(frame, layout.canvas);
}

function overlays(frame: Frame, layout: ComparisonLayout) {
  drawGrid(frame, layout.canvas);
  drawProbe(frame);
}

export function SideBySideView({ images, layout }: ViewProps) {
  const paintReference = useCallback(
    (frame: Frame) => {
      paintImage(frame, images, layout, 'reference');
      overlays(frame, layout);
    },
    [images, layout],
  );
  const paintImplementation = useCallback(
    (frame: Frame) => {
      paintImage(frame, images, layout, 'implementation');
      overlays(frame, layout);
    },
    [images, layout],
  );
  return (
    <div className="bg-line-strong grid h-full grid-cols-1 grid-rows-2 gap-px md:grid-cols-2 md:grid-rows-1">
      <PaneCanvas paint={paintReference} measure label="Reference screenshot">
        <RoleTag role="reference" detail={formatDimensions(images.reference)} />
      </PaneCanvas>
      <PaneCanvas paint={paintImplementation} label="Implementation screenshot">
        <RoleTag role="implementation" detail={formatDimensions(images.implementation)} />
      </PaneCanvas>
    </div>
  );
}

interface SliderViewProps extends ViewProps {
  readonly position: number;
  readonly onPositionCommit: (position: number) => void;
}

export function SliderView({ images, layout, position, onPositionCommit }: SliderViewProps) {
  // The live position exists only while dragging; it never touches the persisted view state.
  const [live, setLive] = useState<number | null>(null);
  const split = live ?? position;
  const peek = usePeek();

  const paint = useCallback(
    (frame: Frame) => {
      drawBackdrop(frame, layout.canvas, 'checker');
      const { ctx, pane } = frame;
      if (peek !== 'implementation')
        drawPlacement(frame, images.reference.bitmap, layout.reference);
      if (peek !== 'reference') {
        // The clip edge and the divider's CSS `left` are both split × the pane's width.
        const edge = peek === 'implementation' ? 0 : split * pane.width;
        ctx.save();
        ctx.beginPath();
        ctx.rect(edge, 0, pane.width - edge, pane.height);
        ctx.clip();
        drawPlacement(frame, images.implementation.bitmap, layout.implementation);
        ctx.restore();
      }
      drawEdge(frame, layout.canvas);
      overlays(frame, layout);
    },
    [images, layout, split, peek],
  );

  return (
    <PaneCanvas
      paint={paint}
      measure
      label="Reference on the left of the divider, implementation on the right"
    >
      <RoleTag role="reference" />
      <RoleTag role="implementation" side="right" />
      <SliderHandle
        position={split}
        onChange={setLive}
        onCommit={(next) => {
          onPositionCommit(next);
          setLive(null);
        }}
      />
    </PaneCanvas>
  );
}

export function OverlayView({ images, layout, opacity }: ViewProps & { opacity: number }) {
  const peek = usePeek();
  const paint = useCallback(
    (frame: Frame) => {
      drawBackdrop(frame, layout.canvas, 'checker');
      // Opacity is a drawing parameter only; the comparison never sees it.
      if (peek !== 'implementation')
        drawPlacement(frame, images.reference.bitmap, layout.reference);
      if (peek !== 'reference') {
        drawPlacement(
          frame,
          images.implementation.bitmap,
          layout.implementation,
          peek ? 1 : opacity,
        );
      }
      drawEdge(frame, layout.canvas);
      overlays(frame, layout);
    },
    [images, layout, opacity, peek],
  );
  return (
    <PaneCanvas paint={paint} measure label="Implementation drawn over the reference">
      <RoleTag role="reference" detail="below" />
      <RoleTag role="implementation" detail={`${Math.round(opacity * 100)}% above`} side="right" />
    </PaneCanvas>
  );
}

interface DiffViewProps extends ViewProps {
  /** A result computed for the current layout, or null while none is available. */
  readonly result: DiffResult | null;
  /** How strongly the reference shows beneath the mask. */
  readonly context: number;
}

export function DiffView({ images, layout, result, context }: DiffViewProps) {
  const paint = useCallback(
    (frame: Frame) => {
      drawBackdrop(frame, layout.canvas, 'flat');
      drawPlacement(frame, images.reference.bitmap, layout.reference, context);
      desaturate(frame, layout.canvas);
      if (result) {
        drawOutside(frame, layout.canvas, layout.overlap);
        drawDensity(frame, result.density, layout.canvas);
        if (result.maskBitmap) {
          drawLayer(frame, result.maskBitmap, layout.overlap, { x: 0, y: 0 });
        }
      }
      drawEdge(frame, layout.canvas);
      overlays(frame, layout);
    },
    [images, layout, result, context],
  );
  return (
    <PaneCanvas
      paint={paint}
      measure
      label="Differences between the images, highlighted over the reference"
    >
      <RoleTag role="reference" detail="context" />
    </PaneCanvas>
  );
}
