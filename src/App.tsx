import { useEffect } from 'react';
import { HomeScreen } from './features/home/HomeScreen';
import { Workspace } from './features/workspace/Workspace';
import { loadImageFile } from './services/images';
import { navigate, routeToHash, useRoute, type Route } from './state/route';
import { projectRepository, sessionStore, useSession } from './state/session';
import { Logo } from './ui/icons';

/** Keep the session in step with the URL, which is the single source of truth for what is open. */
function syncSession(route: Route): void {
  const session = sessionStore.getState();
  switch (route.name) {
    case 'home':
      if (session.status !== 'idle') session.close();
      break;
    case 'sample':
      if (!session.project?.isSample) void session.openSample();
      break;
    case 'project':
      if (session.project?.id !== route.id) void session.openProject(route.id);
      break;
  }
}

export function App() {
  const route = useRoute();
  const status = useSession((state) => state.status);
  const error = useSession((state) => state.error);
  const project = useSession((state) => state.project);
  const images = useSession((state) => state.images);

  useEffect(() => {
    syncSession(route);
  }, [route]);

  if (route.name === 'home') {
    return (
      <HomeScreen
        repository={projectRepository}
        loadFile={loadImageFile}
        onCompare={(pair) => {
          const { id } = sessionStore.getState().openImages(pair);
          navigate({ name: 'project', id });
        }}
      />
    );
  }

  if (status === 'ready' && project && images) {
    return <Workspace project={project} images={images} />;
  }

  return (
    <main className="bg-bg flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <Logo size={28} />
      {status === 'error' ? (
        <div role="alert" className="flex max-w-sm flex-col items-center gap-3">
          <h1 className="text-base font-semibold">This comparison could not be opened</h1>
          <p className="text-fg-muted">{error}</p>
          <a
            href={routeToHash({ name: 'home' })}
            className="text-accent rounded-sm underline-offset-2 hover:underline"
          >
            Back to all comparisons
          </a>
        </div>
      ) : (
        <p role="status" className="text-fg-muted">
          Opening comparison…
        </p>
      )}
    </main>
  );
}
