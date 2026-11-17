import { COMPARISON_MODES, type ComparisonMode, type ViewSettings } from '@/domain/types';
import { useViewportStore } from '@/state/viewportStore';
import { MAX_SCALE, MIN_SCALE } from '@/domain/viewport';
import { Button } from '@/ui/Button';
import {
  DiffIcon,
  OverlayIcon,
  SideBySideIcon,
  SliderIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '@/ui/icons';
import { SegmentedControl, type SegmentOption } from '@/ui/SegmentedControl';

const MODE_OPTIONS: Record<ComparisonMode, Omit<SegmentOption<ComparisonMode>, 'value'>> = {
  'side-by-side': { label: 'Side by side', icon: <SideBySideIcon />, hint: '1' },
  slider: { label: 'Slider', icon: <SliderIcon />, hint: '2' },
  overlay: { label: 'Overlay', icon: <OverlayIcon />, hint: '3' },
  diff: { label: 'Differences', icon: <DiffIcon />, hint: '4' },
};

const OPTIONS = COMPARISON_MODES.map((value) => ({ value, ...MODE_OPTIONS[value] }));

interface ToolbarProps {
  readonly view: ViewSettings;
  readonly onViewChange: (patch: Partial<ViewSettings>) => void;
}

export function Toolbar({ view, onViewChange }: ToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Comparison controls"
      className="border-line bg-surface flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-1.5"
    >
      <SegmentedControl
        label="Comparison mode"
        options={OPTIONS}
        value={view.mode}
        onChange={(mode) => onViewChange({ mode })}
        compact
      />

      {view.mode === 'overlay' && (
        <label className="text-fg-muted flex items-center gap-2">
          <span>Opacity</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(view.overlayOpacity * 100)}
            onChange={(event) => onViewChange({ overlayOpacity: Number(event.target.value) / 100 })}
            aria-valuetext={`Implementation ${Math.round(view.overlayOpacity * 100)}% opaque`}
            className="w-28"
          />
          <output className="tabular text-fg w-9 text-right text-xs">
            {Math.round(view.overlayOpacity * 100)}%
          </output>
        </label>
      )}

      <ZoomControls />
    </div>
  );
}

function ZoomControls() {
  const scale = useViewportStore((state) => state.transform.scale);
  const autoFit = useViewportStore((state) => state.autoFit);
  const { zoomStep, fit, actualSize } = useViewportStore.getState();

  return (
    <div className="ml-auto flex items-center gap-1" role="group" aria-label="Zoom">
      <Button
        variant="ghost"
        iconOnly
        onClick={() => zoomStep(-1)}
        disabled={scale <= MIN_SCALE}
        aria-label="Zoom out"
        title="Zoom out (−)"
      >
        <ZoomOutIcon />
      </Button>
      <output
        aria-label="Zoom level"
        data-testid="zoom-level"
        className="tabular text-fg w-12 text-center text-xs"
      >
        {formatZoom(scale)}
      </output>
      <Button
        variant="ghost"
        iconOnly
        onClick={() => zoomStep(1)}
        disabled={scale >= MAX_SCALE}
        aria-label="Zoom in"
        title="Zoom in (+)"
      >
        <ZoomInIcon />
      </Button>
      <span className="bg-line mx-1 h-4 w-px" aria-hidden="true" />
      <Button variant="ghost" onClick={fit} aria-pressed={autoFit} title="Fit to screen (F)">
        Fit
      </Button>
      <Button
        variant="ghost"
        onClick={actualSize}
        title="Actual size (0)"
        aria-label="Actual size, 100%"
      >
        100%
      </Button>
    </div>
  );
}

export function formatZoom(scale: number): string {
  const percent = scale * 100;
  return `${percent < 10 ? percent.toFixed(1) : Math.round(percent)}%`;
}
