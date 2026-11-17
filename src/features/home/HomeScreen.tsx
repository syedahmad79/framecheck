import { useEffect, useRef, type DragEvent } from 'react';
import { IMAGE_ROLES } from '@/domain/types';
import type { ImagePair, LoadedImage } from '@/services/images';
import type { ProjectRepository } from '@/services/projectRepository';
import { routeToHash } from '@/state/route';
import { Button } from '@/ui/Button';
import { AlertIcon, Logo, SwapIcon } from '@/ui/icons';
import { DropSlot } from './DropSlot';
import { ProjectList } from './ProjectList';
import { useImportSlots } from './useImportSlots';
import { useProjectList } from './useProjectList';

interface HomeScreenProps {
  readonly repository: ProjectRepository;
  readonly loadFile: (file: File) => Promise<LoadedImage>;
  readonly onCompare: (images: ImagePair) => void;
}

const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files');

export function HomeScreen({ repository, loadFile, onCompare }: HomeScreenProps) {
  const importSlots = useImportSlots(loadFile);
  const projects = useProjectList(repository);
  const compareRef = useRef<HTMLButtonElement>(null);
  const ready = importSlots.pair !== null;

  // Once both images are in, the next action is always "Compare".
  useEffect(() => {
    if (ready) compareRef.current?.focus();
  }, [ready]);

  const compare = () => {
    const pair = importSlots.take();
    if (pair) onCompare(pair);
  };

  return (
    <div
      className="h-full overflow-y-auto"
      // Dropping anywhere on the page works; without this the browser would navigate to the file.
      onDragOver={(event) => {
        if (hasFiles(event)) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        importSlots.assignMany(Array.from(event.dataTransfer.files));
      }}
    >
      <header className="border-line flex h-11 items-center gap-2 border-b px-4">
        <Logo />
        <span className="text-[13px] font-semibold tracking-tight">Framecheck</span>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Compare two screenshots</h1>
          <p className="text-fg-muted max-w-2xl">
            Pixel-level comparison of a reference and an implementation. Everything runs in your
            browser; images are never uploaded.
          </p>
        </div>

        <section aria-label="New comparison" className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {IMAGE_ROLES.map((role) => (
              <DropSlot
                key={role}
                role={role}
                slot={importSlots.slots[role]}
                onFiles={(files) => importSlots.assignMany(files, role)}
                onClear={() => importSlots.clear(role)}
              />
            ))}
          </div>

          {importSlots.notice && (
            <p role="alert" className="text-danger flex items-center gap-1.5 text-xs">
              <AlertIcon className="shrink-0" />
              {importSlots.notice}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              ref={compareRef}
              variant="primary"
              className="h-8 px-3.5"
              disabled={!ready}
              onClick={compare}
            >
              Compare
            </Button>
            <Button
              variant="ghost"
              className="h-8"
              onClick={importSlots.swap}
              disabled={IMAGE_ROLES.every((role) => importSlots.slots[role].status !== 'loaded')}
            >
              <SwapIcon />
              Swap
            </Button>
            <p className="text-fg-muted ml-auto">
              No screenshots handy?{' '}
              <a
                href={routeToHash({ name: 'sample' })}
                className="text-accent rounded-sm underline-offset-2 hover:underline"
              >
                Open the sample comparison
              </a>
            </p>
          </div>
        </section>

        <ProjectList state={projects.state} onDelete={(id) => void projects.remove(id)} />
      </main>
    </div>
  );
}
