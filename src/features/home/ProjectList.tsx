import { useState } from 'react';
import { formatDimensions } from '@/domain/files';
import { sizesEqual } from '@/domain/types';
import type { ProjectRecord } from '@/services/projectRepository';
import { routeToHash } from '@/state/route';
import { Button } from '@/ui/Button';
import { TrashIcon } from '@/ui/icons';
import type { ProjectListState } from './useProjectList';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

interface ProjectListProps {
  readonly state: ProjectListState;
  readonly onDelete: (id: string) => void;
}

export function ProjectList({ state, onDelete }: ProjectListProps) {
  return (
    <section aria-labelledby="saved-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="saved-heading" className="text-[13px] font-semibold">
          Saved comparisons
        </h2>
        <p className="text-fg-subtle text-xs">Stored in this browser only</p>
      </div>

      {state.status === 'loading' && <p className="text-fg-muted">Loading…</p>}

      {state.status === 'error' && (
        <p role="alert" className="border-danger/40 text-danger rounded-md border px-3 py-2">
          {state.message}
        </p>
      )}

      {state.status === 'ready' && state.projects.length === 0 && (
        <p className="border-line text-fg-muted rounded-md border px-3 py-4">
          Nothing saved yet. Comparisons you create are saved automatically and listed here.
        </p>
      )}

      {state.status === 'ready' && state.projects.length > 0 && (
        <ul className="divide-line border-line divide-y overflow-hidden rounded-md border">
          {state.projects.map((project) => (
            <ProjectRow key={project.id} project={project} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ProjectRow({
  project,
  onDelete,
}: {
  project: ProjectRecord;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const { reference, implementation } = project.images;
  const dimensions = sizesEqual(reference, implementation)
    ? `${formatDimensions(reference)} px`
    : `${formatDimensions(reference)} vs ${formatDimensions(implementation)} px`;

  return (
    <li className="bg-canvas hover:bg-raised flex items-center gap-3 pr-2">
      <a
        href={routeToHash({ name: 'project', id: project.id })}
        className="flex min-w-0 flex-1 flex-col px-3 py-2 focus-visible:outline-offset-[-2px]"
      >
        <span className="truncate font-medium">{project.name}</span>
        <span className="tabular text-fg-muted truncate text-xs">
          {dimensions} · {dateFormat.format(project.updatedAt)}
        </span>
      </a>
      {confirming ? (
        <div className="flex items-center gap-1.5">
          <Button
            variant="danger"
            autoFocus
            onClick={() => onDelete(project.id)}
            aria-label={`Confirm deleting ${project.name}`}
          >
            Delete
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          iconOnly
          onClick={() => setConfirming(true)}
          aria-label={`Delete ${project.name}`}
          title="Delete"
        >
          <TrashIcon />
        </Button>
      )}
    </li>
  );
}
