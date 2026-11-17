import { useCallback, useState } from 'react';
import { formatDimensions } from '@/domain/files';
import type { ComparisonMode } from '@/domain/types';
import type { ImagePair } from '@/services/images';
import { preferencesStore, usePreferences } from '@/state/preferences';
import { sessionStore, useSession } from '@/state/session';
import type { SessionProject } from '@/state/sessionStore';
import { useMediaQuery } from '@/state/useMediaQuery';
import { useViewportStore } from '@/state/viewportStore';
import { Inspector } from '../inspector/Inspector';
import { useComparisonLayout } from './comparison';
import { PixelReadout } from './PixelReadout';
import { ShortcutsDialog } from './ShortcutsDialog';
import { Stage } from './stage/Stage';
import { DiffStatus, ModeCaption, SampleHint } from './StageOverlays';
import { ROOMY, Toolbar, ZoomControls } from './Toolbar';
import { TopBar } from './TopBar';
import { useShortcuts } from './useShortcuts';

interface WorkspaceProps {
  readonly project: SessionProject;
  readonly images: ImagePair;
}

const WIDE_SCREEN = '(min-width: 1024px)';

/**
 * Wide screens keep the inspector as a column whose open state is remembered. On narrow screens
 * it is a sheet over the stage, which always starts closed so it never covers the picture on load.
 */
function useInspectorOpen(): [boolean, () => void, (open: boolean) => void] {
  const wide = useMediaQuery(WIDE_SCREEN);
  const stored = usePreferences((state) => state.inspectorOpen);
  const [sheetOpen, setSheetOpen] = useState(false);
  const open = wide ? (stored ?? true) : sheetOpen;
  const set = useCallback(
    (next: boolean) => {
      if (wide) preferencesStore.getState().setInspectorOpen(next);
      else setSheetOpen(next);
    },
    [wide],
  );
  const toggle = useCallback(() => set(!open), [open, set]);
  return [open, toggle, set];
}

export function Workspace({ project, images }: WorkspaceProps) {
  const settings = useSession((state) => state.settings);
  const view = useSession((state) => state.view);
  const diff = useSession((state) => state.diff);
  const saveError = useSession((state) => state.saveError);
  const hintDismissed = usePreferences((state) => state.hintDismissed);
  const { updateSettings, updateView, rename, retryDiff } = sessionStore.getState();

  const layout = useComparisonLayout(images, settings);
  const [inspectorOpen, toggleInspector, setInspectorOpen] = useInspectorOpen();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const roomy = useMediaQuery(ROOMY);

  const setMode = useCallback((mode: ComparisonMode) => updateView({ mode }), [updateView]);
  const showShortcuts = useCallback(() => setShortcutsOpen(true), []);
  useShortcuts({
    onMode: setMode,
    onToggleInspector: toggleInspector,
    onShowShortcuts: showShortcuts,
  });

  return (
    <div className="flex h-full flex-col">
      <TopBar
        project={project}
        saveError={saveError}
        onRename={rename}
        onShowShortcuts={showShortcuts}
      />
      <Toolbar
        view={view}
        settings={settings}
        diff={diff}
        inspectorOpen={inspectorOpen}
        onViewChange={updateView}
        onToggleInspector={toggleInspector}
      />
      <div className="relative flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <Stage
              images={images}
              layout={layout}
              settings={settings}
              view={view}
              diff={diff}
              onSliderCommit={(sliderPosition) => updateView({ sliderPosition })}
            >
              <ModeCaption view={view} settings={settings} layout={layout} diff={diff} />
              <DiffStatus view={view} settings={settings} diff={diff} onRetry={retryDiff} />
              {!roomy && <ZoomControls floating className="absolute top-3 right-3" />}
              {project.isSample && !hintDismissed && (
                <SampleHint onDismiss={() => preferencesStore.getState().dismissHint()} />
              )}
            </Stage>
          </div>
          <footer className="border-line bg-chrome flex h-8 shrink-0 items-center justify-between gap-4 border-t px-3 text-xs">
            <PixelReadout images={images} layout={layout} />
            <span className="tabular text-fg-subtle max-sm:hidden">
              {formatDimensions(layout.canvas)} px
            </span>
          </footer>
        </main>
        <Inspector
          open={inspectorOpen}
          images={images}
          layout={layout}
          settings={settings}
          diff={diff}
          onSettingsChange={updateSettings}
          onZoomToChanges={(bounds) => {
            useViewportStore.getState().frame(bounds);
            if (view.mode !== 'diff') updateView({ mode: 'diff' });
          }}
          onRetry={retryDiff}
          onClose={() => setInspectorOpen(false)}
        />
      </div>
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
