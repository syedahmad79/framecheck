import { useCallback, useEffect, useState } from 'react';
import type { ProjectRecord, ProjectRepository } from '@/services/projectRepository';

export type ProjectListState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly projects: readonly ProjectRecord[] }
  | { readonly status: 'error'; readonly message: string };

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Saved comparisons could not be loaded.';

export function useProjectList(repository: ProjectRepository) {
  const [state, setState] = useState<ProjectListState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    repository.list().then(
      (projects) => {
        if (!cancelled) setState({ status: 'ready', projects });
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: messageOf(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const remove = useCallback(
    async (id: string) => {
      try {
        await repository.remove(id);
        setState({ status: 'ready', projects: await repository.list() });
      } catch (error) {
        setState({ status: 'error', message: messageOf(error) });
      }
    },
    [repository],
  );

  return { state, remove };
}
