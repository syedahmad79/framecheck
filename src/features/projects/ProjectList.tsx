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
  readonly emptyHint?: string;
}

export function ProjectList({ state, onDelete, emptyHint }: ProjectListProps) {
  if (state.status === 'loading') return <p className="text-fg-muted py-2">Loading…</p>;

  if (state.status === 'error') {
    return (
      <p role="alert" className="bg-danger/10 text-danger rounded-lg px-3 py-2">
        {state.message}
      </p>
    );
  }

  if (state.projects.length === 0) {
    return (
      <p className="border-line-strong text-fg-muted rounded-lg border border-dashed px-4 py-5 text-center">
        {emptyHint ?? 'Nothing saved yet. Comparisons you make are saved here automatically.'}
      </p>
    );
  }

  return (
    <ul className="divide-line bg-raised shadow-raised divide-y overflow-hidden rounded-lg">
      {state.projects.map((project) => (
        <ProjectRow key={project.id} project={project} onDelete={onDelete} />
      ))}
    </ul>
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
    ? formatDimensions(reference)
    : `${formatDimensions(reference)} vs ${formatDimensions(implementation)}`;

  return (
    <li className="motion-colors hover:bg-hover flex items-center gap-2 pr-2">
      <a
        href={routeToHash({ name: 'project', id: project.id })}
        className="flex min-w-0 flex-1 flex-col px-3.5 py-2.5 focus-visible:outline-offset-[-2px]"
      >
        <span className="text-fg truncate font-medium">{project.name}</span>
        <span className="tabular text-fg-muted truncate text-xs">
          {dimensions} px · {dateFormat.format(project.updatedAt)}
        </span>
      </a>
      {confirming ? (
        <div className="flex items-center gap-1">
          <Button
            variant="danger"
            size="sm"
            autoFocus
            onClick={() => onDelete(project.id)}
            aria-label={`Confirm deleting ${project.name}`}
          >
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={() => setConfirming(true)}
          aria-label={`Delete ${project.name}`}
        >
          <TrashIcon />
        </Button>
      )}
    </li>
  );
}
