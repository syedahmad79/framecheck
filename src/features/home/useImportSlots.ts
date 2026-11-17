import { useCallback, useEffect, useRef, useState } from 'react';
import { IMAGE_ROLES, type ImageRole } from '@/domain/types';
import { releaseImage, type ImagePair, type LoadedImage } from '@/services/images';

export type ImportSlot =
  | { readonly status: 'empty' }
  | { readonly status: 'loading'; readonly fileName: string }
  | { readonly status: 'loaded'; readonly image: LoadedImage }
  | { readonly status: 'error'; readonly message: string };

type Slots = Readonly<Record<ImageRole, ImportSlot>>;

const EMPTY: Slots = { reference: { status: 'empty' }, implementation: { status: 'empty' } };

export interface ImportSlots {
  readonly slots: Slots;
  /** Both images when both slots are loaded, otherwise null. */
  readonly pair: ImagePair | null;
  /** A problem that is not specific to one slot, e.g. too many files dropped. */
  readonly notice: string | null;
  readonly assign: (role: ImageRole, file: File) => void;
  /** Distribute dropped files: one file fills `preferred`, two fill both slots in order. */
  readonly assignMany: (files: readonly File[], preferred?: ImageRole) => void;
  readonly clear: (role: ImageRole) => void;
  readonly swap: () => void;
  /** Hand the loaded images to a new owner; the slots will no longer release their bitmaps. */
  readonly take: () => ImagePair | null;
}

export function useImportSlots(loadFile: (file: File) => Promise<LoadedImage>): ImportSlots {
  const [slots, setSlots] = useState<Slots>(EMPTY);
  const [notice, setNotice] = useState<string | null>(null);

  // Mirrors of state for use outside render: stale-load detection and bitmap cleanup.
  const latest = useRef<Slots>(EMPTY);
  const tokens = useRef<Record<ImageRole, number>>({ reference: 0, implementation: 0 });

  const write = useCallback((role: ImageRole, slot: ImportSlot) => {
    const previous = latest.current[role];
    if (previous.status === 'loaded') releaseImage(previous.image);
    latest.current = { ...latest.current, [role]: slot };
    setSlots(latest.current);
  }, []);

  const assign = useCallback(
    (role: ImageRole, file: File) => {
      const token = ++tokens.current[role];
      setNotice(null);
      write(role, { status: 'loading', fileName: file.name });
      loadFile(file).then(
        (image) => {
          if (tokens.current[role] === token) write(role, { status: 'loaded', image });
          else releaseImage(image);
        },
        (error: unknown) => {
          if (tokens.current[role] !== token) return;
          const message = error instanceof Error ? error.message : 'This file could not be read.';
          write(role, { status: 'error', message });
        },
      );
    },
    [loadFile, write],
  );

  const assignMany = useCallback(
    (files: readonly File[], preferred?: ImageRole) => {
      const [first, second, ...rest] = files;
      if (!first) return;
      if (rest.length > 0) {
        setNotice(
          `You dropped ${files.length} files. Drop one or two: a reference and an implementation.`,
        );
        return;
      }
      if (second) {
        assign('reference', first);
        assign('implementation', second);
        return;
      }
      const firstEmpty = IMAGE_ROLES.find((role) => latest.current[role].status !== 'loaded');
      assign(preferred ?? firstEmpty ?? 'reference', first);
    },
    [assign],
  );

  const clear = useCallback(
    (role: ImageRole) => {
      tokens.current[role]++;
      write(role, { status: 'empty' });
    },
    [write],
  );

  const swap = useCallback(() => {
    // Invalidate in-flight loads so they cannot land in the wrong slot.
    tokens.current.reference++;
    tokens.current.implementation++;
    const { reference, implementation } = latest.current;
    const settled = (slot: ImportSlot): ImportSlot =>
      slot.status === 'loading' ? { status: 'empty' } : slot;
    latest.current = { reference: settled(implementation), implementation: settled(reference) };
    setSlots(latest.current);
  }, []);

  const take = useCallback((): ImagePair | null => {
    const { reference, implementation } = latest.current;
    if (reference.status !== 'loaded' || implementation.status !== 'loaded') return null;
    latest.current = EMPTY;
    setSlots(EMPTY);
    return { reference: reference.image, implementation: implementation.image };
  }, []);

  useEffect(
    () => () => {
      for (const role of IMAGE_ROLES) {
        tokens.current[role]++;
        const slot = latest.current[role];
        if (slot.status === 'loaded') releaseImage(slot.image);
      }
      latest.current = EMPTY;
    },
    [],
  );

  const pair =
    slots.reference.status === 'loaded' && slots.implementation.status === 'loaded'
      ? { reference: slots.reference.image, implementation: slots.implementation.image }
      : null;

  return { slots, pair, notice, assign, assignMany, clear, swap, take };
}
