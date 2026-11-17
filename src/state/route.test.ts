import { describe, expect, it } from 'vitest';
import { parseRoute, routeToHash, type Route } from './route';

describe('routes', () => {
  it('parses known hashes and falls back to home', () => {
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/')).toEqual({ name: 'home' });
    expect(parseRoute('#/sample')).toEqual({ name: 'sample' });
    expect(parseRoute('#/p/3f2a-1b')).toEqual({ name: 'project', id: '3f2a-1b' });
    expect(parseRoute('#/p/')).toEqual({ name: 'home' });
    expect(parseRoute('#/unknown')).toEqual({ name: 'home' });
  });

  it('round-trips through routeToHash', () => {
    const routes: Route[] = [{ name: 'home' }, { name: 'sample' }, { name: 'project', id: 'abc' }];
    for (const route of routes) expect(parseRoute(routeToHash(route))).toEqual(route);
  });
});
