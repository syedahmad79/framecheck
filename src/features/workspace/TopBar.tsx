import { useState } from 'react';
import type { SessionProject } from '@/state/sessionStore';
import { routeToHash } from '@/state/route';
import { Button } from '@/ui/Button';
import { CheckIcon, HistoryIcon, KeyboardIcon, Logo } from '@/ui/icons';
import { Spinner } from '@/ui/Spinner';
import { ThemeToggle } from '@/ui/ThemeToggle';
import { Tooltip } from '@/ui/Tooltip';
import { HistoryDialog } from './HistoryDialog';

interface TopBarProps {
  readonly project: SessionProject;
  readonly saveError: string | null;
  readonly onRename: (name: string) => void;
  readonly onShowShortcuts: () => void;
}

export function TopBar({ project, saveError, onRename, onShowShortcuts }: TopBarProps) {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <header className="border-line bg-chrome flex h-12 shrink-0 items-center gap-3 border-b px-3">
      <a
        href={routeToHash({ name: 'home' })}
        aria-label="Framecheck, new comparison"
        className="font-display flex shrink-0 items-center gap-2 rounded-md py-1 pr-1 text-base font-semibold"
      >
        <Logo size={22} />
        <span className="max-sm:hidden">Framecheck</span>
      </a>
      <span className="bg-line-strong h-5 w-px max-sm:hidden" aria-hidden="true" />

      <div className="flex min-w-0 flex-1 items-center gap-3">
        {project.isSample ? (
          <h1 className="truncate text-sm font-medium">{project.name}</h1>
        ) : (
          <input
            // Remount when the stored name changes so the field always starts from the saved value.
            key={project.name}
            defaultValue={project.name}
            aria-label="Comparison name"
            maxLength={120}
            spellCheck={false}
            onBlur={(event) => {
              if (event.target.value.trim()) onRename(event.target.value);
              else event.target.value = project.name;
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') {
                event.currentTarget.value = project.name;
                event.currentTarget.blur();
              }
            }}
            className="motion-colors hover:bg-hover focus:bg-hover h-8 max-w-sm min-w-0 flex-1 truncate rounded-md bg-transparent px-2 text-sm font-medium"
          />
        )}
        <SaveStatus project={project} error={saveError} />
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Tooltip label="Saved comparisons" align="end">
          <Button variant="ghost" onClick={() => setHistoryOpen(true)} aria-label="History">
            <HistoryIcon />
            <span className="max-md:hidden">History</span>
          </Button>
        </Tooltip>
        <Tooltip label="Keyboard shortcuts" shortcut="?" align="end">
          <Button
            variant="ghost"
            iconOnly
            aria-label="Keyboard shortcuts"
            onClick={onShowShortcuts}
          >
            <KeyboardIcon />
          </Button>
        </Tooltip>
        <ThemeToggle />
      </div>

      <HistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </header>
  );
}

function SaveStatus({ project, error }: { project: SessionProject; error: string | null }) {
  let content;
  if (error) {
    content = (
      <span className="text-danger" title={error}>
        Not saved
      </span>
    );
  } else if (project.isSample) {
    content = <span>Sample · not saved</span>;
  } else if (project.persisted) {
    content = (
      <>
        <CheckIcon width={12} height={12} />
        Saved on this device
      </>
    );
  } else {
    content = (
      <>
        <Spinner size={12} />
        Saving…
      </>
    );
  }
  return (
    <p
      role="status"
      className="text-fg-subtle flex shrink-0 items-center gap-1.5 text-xs max-md:hidden"
    >
      {content}
    </p>
  );
}
