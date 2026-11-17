import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
});

// jsdom has no canvas implementation. Components treat a missing context as "nothing to draw".
HTMLCanvasElement.prototype.getContext = (() => null) as HTMLCanvasElement['getContext'];

// Pointer capture is not implemented in jsdom; track it per element so handlers can be exercised.
const captures = new WeakMap<Element, Set<number>>();
Element.prototype.setPointerCapture = function (this: Element, id: number) {
  captures.set(this, (captures.get(this) ?? new Set()).add(id));
};
Element.prototype.hasPointerCapture = function (this: Element, id: number) {
  return captures.get(this)?.has(id) ?? false;
};
Element.prototype.releasePointerCapture = function (this: Element, id: number) {
  captures.get(this)?.delete(id);
};

// jsdom's <dialog> does not implement showModal/close.
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
