import { COMPARISON_MODES, type ComparisonMode, type ViewSettings } from '@/domain/types';
import { MAX_SCALE, MIN_SCALE } from '@/domain/viewport';
import { useMediaQuery } from '@/state/useMediaQuery';
import { useViewportStore } from '@/state/viewportStore';
import { Button } from '@/ui/Button';
import {
  DiffIcon,
  FitIcon,
  InspectorIcon,
  OverlayIcon,
  SideBySideIcon,
  SliderIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '@/ui/icons';
import { RangeField } from '@/ui/RangeField';
import { SegmentedControl, type SegmentOption } from '@/ui/SegmentedControl';
import { cn } from '@/ui/cn';
import { Tooltip } from '@/ui/Tooltip';
import { ResultChip } from './ResultChip';
import type { DiffState } from '@/state/sessionStore';
import type { DiffSettings } from '@/domain/types';

const MODE_OPTIONS: Record<ComparisonMode, Omit<SegmentOption<ComparisonMode>, 'value'>> = {
  'side-by-side': { label: 'Side by side', icon: <SideBySideIcon />, hint: '1' },
  slider: { label: 'Slider', icon: <SliderIcon />, hint: '2' },
  overlay: { label: 'Overlay', icon: <OverlayIcon />, hint: '3' },
  diff: { label: 'Differences', icon: <DiffIcon />, hint: '4' },
};

const OPTIONS = COMPARISON_MODES.map((value) => ({ value, ...MODE_OPTIONS[value] }));

/** Wide enough to keep the zoom controls in the toolbar; narrower screens float them over the stage. */
export const ROOMY = '(min-width: 768px)';

const percent = (value: number) => `${Math.round(value * 100)}%`;

interface ToolbarProps {
  readonly view: ViewSettings;
  readonly settings: DiffSettings;
  readonly diff: DiffState;
  readonly inspectorOpen: boolean;
  readonly onViewChange: (patch: Partial<ViewSettings>) => void;
  readonly onToggleInspector: () => void;
}

export function Toolbar({
  view,
  settings,
  diff,
  inspectorOpen,
  onViewChange,
  onToggleInspector,
}: ToolbarProps) {
  const roomy = useMediaQuery(ROOMY);
  return (
    <div
      role="toolbar"
      aria-label="Comparison controls"
      className="border-line bg-chrome flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2"
    >
      <SegmentedControl
        label="Comparison mode"
        options={OPTIONS}
        value={view.mode}
        onChange={(mode) => onViewChange({ mode })}
        labels="md"
      />

      {view.mode === 'overlay' && (
        <RangeField
          label="Blend"
          bare
          className="w-44 max-sm:order-last max-sm:w-full"
          value={view.overlayOpacity}
          min={0}
          max={1}
          step={0.01}
          ends={['Reference', 'Implementation']}
          format={(value) => `Implementation ${percent(value)}`}
          onChange={(overlayOpacity) => onViewChange({ overlayOpacity })}
        />
      )}
      {view.mode === 'diff' && (
        <RangeField
          label="Reference context"
          bare
          className="w-40 max-sm:order-last max-sm:w-full"
          value={view.diffContext}
          min={0}
          max={1}
          step={0.01}
          ends={['Mask only', 'More reference']}
          format={(value) => `Reference context ${percent(value)}`}
          onChange={(diffContext) => onViewChange({ diffContext })}
        />
      )}

      <div className="ml-auto flex items-center gap-2">
        <ResultChip
          diff={diff}
          settings={settings}
          expanded={inspectorOpen}
          onClick={onToggleInspector}
        />
        {roomy && <ZoomControls />}
        <Tooltip
          label={inspectorOpen ? 'Hide inspector' : 'Show inspector'}
          shortcut="["
          align="end"
        >
          <Button
            variant="ghost"
            iconOnly
            aria-label="Inspector"
            aria-pressed={inspectorOpen}
            aria-controls="inspector"
            onClick={onToggleInspector}
          >
            <InspectorIcon />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

export function formatZoom(scale: number): string {
  const value = scale * 100;
  return `${value < 10 ? value.toFixed(1) : Math.round(value)}%`;
}

export function ZoomControls({
  className,
  floating = false,
}: {
  className?: string;
  floating?: boolean;
}) {
  const scale = useViewportStore((state) => state.transform.scale);
  const autoFit = useViewportStore((state) => state.autoFit);
  const { zoomStep, fit, actualSize } = useViewportStore.getState();

  return (
    <div
      className={cn(
        'flex items-center',
        floating && 'bg-material shadow-raised rounded-full p-0.5 backdrop-blur-md',
        className,
      )}
      role="group"
      aria-label="Zoom"
    >
      <Tooltip label="Zoom out" shortcut="−">
        <Button
          variant="ghost"
          iconOnly
          onClick={() => zoomStep(-1)}
          disabled={scale <= MIN_SCALE}
          aria-label="Zoom out"
        >
          <ZoomOutIcon />
        </Button>
      </Tooltip>
      <output
        aria-label="Zoom level"
        data-testid="zoom-level"
        className="tabular text-fg w-12 text-center text-xs"
      >
        {formatZoom(scale)}
      </output>
      <Tooltip label="Zoom in" shortcut="+">
        <Button
          variant="ghost"
          iconOnly
          onClick={() => zoomStep(1)}
          disabled={scale >= MAX_SCALE}
          aria-label="Zoom in"
        >
          <ZoomInIcon />
        </Button>
      </Tooltip>
      <span className="bg-line-strong mx-1 h-4 w-px" aria-hidden="true" />
      <Tooltip label="Fit to screen" shortcut="F">
        <Button variant="ghost" onClick={fit} aria-pressed={autoFit} aria-label="Fit to screen">
          <FitIcon />
          <span className={floating ? 'sr-only' : 'max-lg:sr-only'}>Fit</span>
        </Button>
      </Tooltip>
      {!floating && (
        <Tooltip label="Actual size" shortcut="0">
          <Button variant="ghost" onClick={actualSize} aria-label="Actual size, 100%">
            100%
          </Button>
        </Tooltip>
      )}
    </div>
  );
}
