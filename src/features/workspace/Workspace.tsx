import { useCallback } from 'react';
import type { ComparisonMode } from '@/domain/types';
import { formatDimensions } from '@/domain/files';
import type { ImagePair } from '@/services/images';
import { sessionStore, useSession } from '@/state/session';
import type { SessionProject } from '@/state/sessionStore';
import { useViewportStore } from '@/state/viewportStore';
import { StatsPanel } from '../stats/StatsPanel';
import { useComparisonLayout } from './comparison';
import { Stage } from './stage/Stage';
import { Toolbar } from './Toolbar';
import { useShortcuts } from './useShortcuts';
import { WorkspaceHeader } from './WorkspaceHeader';

interface WorkspaceProps {
  readonly project: SessionProject;
  readonly images: ImagePair;
}

export function Workspace({ project, images }: WorkspaceProps) {
  const settings = useSession((state) => state.settings);
  const view = useSession((state) => state.view);
  const diff = useSession((state) => state.diff);
  const saveError = useSession((state) => state.saveError);
  const { updateSettings, updateView, rename, retryDiff } = sessionStore.getState();

  const layout = useComparisonLayout(images, settings);

  const setMode = useCallback((mode: ComparisonMode) => updateView({ mode }), [updateView]);
  useShortcuts(setMode);

  return (
    <div className="flex h-full flex-col">
      <WorkspaceHeader project={project} saveError={saveError} onRename={rename} />
      <Toolbar view={view} onViewChange={updateView} />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <main className="flex min-h-[60vh] min-w-0 flex-1 flex-col lg:min-h-0">
          <div className="min-h-0 flex-1">
            <Stage
              images={images}
              layout={layout}
              settings={settings}
              view={view}
              diff={diff}
              onSliderChange={(sliderPosition) => updateView({ sliderPosition })}
              onRetryDiff={retryDiff}
            />
          </div>
          <footer className="tabular border-line bg-surface text-fg-subtle flex h-7 shrink-0 items-center gap-4 border-t px-3 text-[11px]">
            <span>{formatDimensions(layout.canvas)} px</span>
            <span className="hidden truncate sm:inline">
              Drag to pan · Ctrl/⌘ + scroll to zoom · 1–4 switch mode · F fit · 0 actual size
            </span>
          </footer>
        </main>
        <StatsPanel
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
        />
      </div>
    </div>
  );
}
