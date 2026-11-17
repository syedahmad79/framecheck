import { useEffect, useRef, useState, type DragEvent } from 'react';
import { IMAGE_ROLES } from '@/domain/types';
import type { ImagePair, LoadedImage } from '@/services/images';
import type { ProjectRepository } from '@/services/projectRepository';
import { routeToHash } from '@/state/route';
import { Button } from '@/ui/Button';
import { ChevronRightIcon, LockIcon, Logo, SwapIcon } from '@/ui/icons';
import { ThemeToggle } from '@/ui/ThemeToggle';
import { ProjectList } from '../projects/ProjectList';
import { useProjectList } from '../projects/useProjectList';
import { DropSlot } from './DropSlot';
import { useImportSlots } from './useImportSlots';

interface HomeScreenProps {
  readonly repository: ProjectRepository;
  readonly loadFile: (file: File) => Promise<LoadedImage>;
  readonly onCompare: (images: ImagePair) => void;
}

const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files');
const sampleUrl = (file: string) => `${import.meta.env.BASE_URL}sample/${file}`;

export function HomeScreen({ repository, loadFile, onCompare }: HomeScreenProps) {
  const importSlots = useImportSlots(loadFile);
  const projects = useProjectList(repository);
  const compareRef = useRef<HTMLButtonElement>(null);
  const [dragDepth, setDragDepth] = useState(0);
  const ready = importSlots.pair !== null;
  const anyLoaded = IMAGE_ROLES.some((role) => importSlots.slots[role].status === 'loaded');

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
      className="bg-bg h-full overflow-y-auto"
      // Dropping anywhere on the page works; without this the browser would navigate to the file.
      onDragEnter={(event) => hasFiles(event) && setDragDepth((depth) => depth + 1)}
      onDragLeave={(event) => hasFiles(event) && setDragDepth((depth) => Math.max(0, depth - 1))}
      onDragOver={(event) => {
        if (hasFiles(event)) event.preventDefault();
      }}
      onDrop={(event) => {
        setDragDepth(0);
        if (!hasFiles(event)) return;
        event.preventDefault();
        importSlots.assignMany(Array.from(event.dataTransfer.files));
      }}
    >
      <header className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
        <div className="font-display flex items-center gap-2 text-base font-semibold">
          <Logo size={22} />
          Framecheck
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
        <div className="flex max-w-2xl flex-col gap-3">
          <h1 className="font-display text-display font-semibold text-balance max-sm:text-xl">
            Compare what you designed with what you built.
          </h1>
          <p className="text-fg-muted text-base">
            Add a reference screenshot and an implementation screenshot. Framecheck shows exactly
            which pixels differ, and by how much.
          </p>
          <p className="text-fg-subtle flex items-center gap-1.5 text-xs">
            <LockIcon width={13} height={13} />
            Runs entirely in your browser. Your images are never uploaded.
          </p>
        </div>

        <section aria-label="New comparison" className="flex flex-col gap-4">
          <div className="relative grid gap-3 sm:grid-cols-2">
            {IMAGE_ROLES.map((role) => (
              <DropSlot
                key={role}
                role={role}
                slot={importSlots.slots[role]}
                pageDragging={dragDepth > 0}
                onFiles={(files) => importSlots.assignMany(files, role)}
                onClear={() => importSlots.clear(role)}
              />
            ))}
            <Button
              iconOnly
              onClick={importSlots.swap}
              disabled={!anyLoaded}
              aria-label="Swap reference and implementation"
              className="absolute top-1/2 left-1/2 z-10 hidden size-9 -translate-x-1/2 -translate-y-1/2 rounded-full sm:inline-flex"
            >
              <SwapIcon />
            </Button>
          </div>

          {importSlots.notice && (
            <p role="alert" className="text-danger text-xs">
              {importSlots.notice}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              ref={compareRef}
              variant="primary"
              className="h-9 px-4"
              disabled={!ready}
              onClick={compare}
            >
              Compare
            </Button>
            <Button className="sm:hidden" onClick={importSlots.swap} disabled={!anyLoaded}>
              <SwapIcon />
              Swap
            </Button>
            <p className="text-fg-subtle text-xs">
              PNG or JPEG, up to 50 MB each. Drop both at once to fill both slots.
            </p>
          </div>
        </section>

        <a
          href={routeToHash({ name: 'sample' })}
          className="motion-colors group bg-raised shadow-raised hover:bg-hover flex items-center gap-4 rounded-2xl p-3"
        >
          <span className="relative h-16 w-28 shrink-0" aria-hidden="true">
            <img
              src={sampleUrl('reference.png')}
              alt=""
              className="absolute top-0 left-0 h-12 w-20 rounded-md object-cover object-top shadow-[0_0_0_1.5px_var(--ref)]"
            />
            <img
              src={sampleUrl('implementation.png')}
              alt=""
              className="absolute right-0 bottom-0 h-12 w-20 rounded-md object-cover object-top shadow-[0_0_0_1.5px_var(--impl)]"
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Open the sample comparison</span>
            <span className="text-fg-muted block text-xs">
              A billing page with deliberate regressions: a missing badge, tighter card padding, a
              darker button and a shifted usage section.
            </span>
          </span>
          <ChevronRightIcon className="motion-transform text-fg-subtle group-hover:translate-x-0.5" />
        </a>

        <section aria-labelledby="saved-heading" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 id="saved-heading" className="eyebrow">
              Saved comparisons
            </h2>
            <p className="text-fg-subtle text-xs">Stored in this browser only</p>
          </div>
          <ProjectList state={projects.state} onDelete={(id) => void projects.remove(id)} />
        </section>
      </main>
    </div>
  );
}
