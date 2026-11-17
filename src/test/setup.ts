import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom has no canvas implementation. Components treat a missing context as "nothing to draw".
HTMLCanvasElement.prototype.getContext = (() => null) as HTMLCanvasElement['getContext'];
