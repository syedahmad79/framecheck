import { useMemo, useSyncExternalStore } from 'react';

export type Route =
  | { readonly name: 'home' }
  | { readonly name: 'sample' }
  | { readonly name: 'project'; readonly id: string };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path === 'sample') return { name: 'sample' };
  const match = /^p\/([\w-]+)$/.exec(path);
  if (match?.[1]) return { name: 'project', id: match[1] };
  return { name: 'home' };
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'sample':
      return '#/sample';
    case 'project':
      return `#/p/${route.id}`;
  }
}

export function navigate(route: Route): void {
  window.location.hash = routeToHash(route);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

const getHash = () => window.location.hash;

/** Hash-based routing: works from any static host and from the file system, with no server rewrites. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash);
  // A stable object per hash, so effects keyed on the route only run when the URL changes.
  return useMemo(() => parseRoute(hash), [hash]);
}
