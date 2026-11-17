import { fireEvent } from '@testing-library/react';

/** jsdom has no layout, so tests describe an element's box explicitly. */
export function mockBox(
  element: Element,
  box: { left: number; top: number; width: number; height: number },
) {
  element.getBoundingClientRect = () => ({
    ...box,
    x: box.left,
    y: box.top,
    right: box.left + box.width,
    bottom: box.top + box.height,
    toJSON: () => ({}),
  });
}

interface PointerInit {
  pointerId?: number;
  pointerType?: 'mouse' | 'touch' | 'pen';
  clientX?: number;
  clientY?: number;
  button?: number;
}

const base = (init: PointerInit): PointerInit => ({
  pointerId: 1,
  pointerType: 'mouse',
  clientX: 0,
  clientY: 0,
  button: 0,
  ...init,
});

export const pointer = {
  down: (el: Element, init: PointerInit = {}) => fireEvent.pointerDown(el, base(init)),
  move: (el: Element, init: PointerInit = {}) => fireEvent.pointerMove(el, base(init)),
  up: (el: Element, init: PointerInit = {}) => fireEvent.pointerUp(el, base(init)),
  cancel: (el: Element, init: PointerInit = {}) => fireEvent.pointerCancel(el, base(init)),
  lost: (el: Element, init: PointerInit = {}) => fireEvent.lostPointerCapture(el, base(init)),
};
