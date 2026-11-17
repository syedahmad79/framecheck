import type { SessionProject } from '@/state/sessionStore';
import { routeToHash } from '@/state/route';
import { ArrowLeftIcon } from '@/ui/icons';

interface WorkspaceHeaderProps {
  readonly project: SessionProject;
  readonly saveError: string | null;
  readonly onRename: (name: string) => void;
}

export function WorkspaceHeader({ project, saveError, onRename }: WorkspaceHeaderProps) {
  return (
    <header className="border-line bg-surface flex h-11 items-center gap-2 border-b px-2">
      <a
        href={routeToHash({ name: 'home' })}
        aria-label="Back to all comparisons"
        title="All comparisons"
        className="text-fg-muted hover:bg-hover hover:text-fg inline-flex size-7 shrink-0 items-center justify-center rounded-md"
      >
        <ArrowLeftIcon />
      </a>

      {project.isSample ? (
        <h1 className="truncate px-1.5 text-[13px] font-semibold">{project.name}</h1>
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
          className="hover:border-line focus:border-line-strong focus:bg-canvas h-7 min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-1.5 text-[13px] font-semibold sm:max-w-md"
        />
      )}

      <p className="ml-auto shrink-0 pr-1.5 text-xs" role="status">
        {saveError ? (
          <span className="text-danger" title={saveError}>
            Not saved: {saveError}
          </span>
        ) : project.isSample ? (
          <span className="text-fg-subtle">Sample, not saved</span>
        ) : project.persisted ? (
          <span className="text-fg-subtle">Saved in this browser</span>
        ) : (
          <span className="text-fg-subtle">Saving…</span>
        )}
      </p>
    </header>
  );
}
