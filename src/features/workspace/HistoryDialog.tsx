import { projectRepository } from '@/state/session';
import { routeToHash } from '@/state/route';
import { Dialog } from '@/ui/Dialog';
import { PlusIcon } from '@/ui/icons';
import { ProjectList } from '../projects/ProjectList';
import { useProjectList } from '../projects/useProjectList';

function HistoryList() {
  const { state, remove } = useProjectList(projectRepository);
  return <ProjectList state={state} onDelete={(id) => void remove(id)} />;
}

export function HistoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Saved comparisons" width="30rem">
      <div className="flex flex-col gap-4">
        <p className="text-fg-muted">Stored in this browser only. Nothing leaves your device.</p>
        <HistoryList />
        <a
          href={routeToHash({ name: 'home' })}
          className="motion-colors bg-accent text-accent-fg hover:bg-accent-hover inline-flex h-8 items-center gap-1.5 self-start rounded-md px-3 text-sm font-medium"
        >
          <PlusIcon />
          New comparison
        </a>
      </div>
    </Dialog>
  );
}
