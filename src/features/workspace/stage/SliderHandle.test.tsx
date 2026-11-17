import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { mockBox, pointer } from '@/test/pointer';
import { SliderHandle } from './SliderHandle';

const PANE = { left: 100, top: 0, width: 400, height: 300 };

function setup(initial = 0.5) {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  function Harness() {
    const [position, setPosition] = useState(initial);
    return (
      <SliderHandle
        position={position}
        onChange={(next) => {
          setPosition(next);
          onChange(next);
        }}
        onCommit={(next) => {
          setPosition(next);
          onCommit(next);
        }}
      />
    );
  }
  const { container } = render(<Harness />);
  // The handle measures its parent overlay, which stands in for the pane.
  const track = container.firstElementChild as HTMLElement;
  mockBox(track, PANE);
  const handle = screen.getByRole('slider', { name: 'Comparison divider' });
  return { handle, onChange, onCommit };
}

/** x coordinate of the divider for a fraction of the pane. */
const at = (fraction: number) => PANE.left + PANE.width * fraction;

describe('SliderHandle dragging', () => {
  it('follows the pointer left to right, continuously', () => {
    const { handle, onChange } = setup(0.2);
    pointer.down(handle, { clientX: at(0.2) });
    for (const f of [0.3, 0.45, 0.6, 0.8]) pointer.move(handle, { clientX: at(f) });
    expect(onChange.mock.calls.map(([v]) => Number(v).toFixed(2))).toEqual([
      '0.30',
      '0.45',
      '0.60',
      '0.80',
    ]);
  });

  it('follows the pointer right to left', () => {
    const { handle, onChange, onCommit } = setup(0.8);
    pointer.down(handle, { clientX: at(0.8) });
    for (const f of [0.7, 0.4, 0.1]) pointer.move(handle, { clientX: at(f) });
    pointer.up(handle, { clientX: at(0.1) });
    expect(onChange).toHaveBeenLastCalledWith(expect.closeTo(0.1, 5));
    expect(onCommit).toHaveBeenCalledWith(expect.closeTo(0.1, 5));
  });

  it('does not jump to the pointer when grabbed off-centre', () => {
    const { handle, onChange } = setup(0.5);
    pointer.down(handle, { clientX: at(0.5) + 9 });
    pointer.move(handle, { clientX: at(0.5) + 9 });
    expect(onChange).toHaveBeenLastCalledWith(expect.closeTo(0.5, 5));
    pointer.move(handle, { clientX: at(0.7) + 9 });
    expect(onChange).toHaveBeenLastCalledWith(expect.closeTo(0.7, 5));
  });

  it('clamps at both extremes when the pointer leaves the pane', () => {
    const { handle, onChange, onCommit } = setup();
    pointer.down(handle, { clientX: at(0.5) });
    pointer.move(handle, { clientX: PANE.left - 500 });
    expect(onChange).toHaveBeenLastCalledWith(0);
    pointer.move(handle, { clientX: PANE.left + PANE.width + 500 });
    expect(onChange).toHaveBeenLastCalledWith(1);
    pointer.up(handle, { clientX: PANE.left + PANE.width + 500 });
    expect(onCommit).toHaveBeenCalledWith(1);
  });

  it('commits exactly once on release, even though capture loss follows', () => {
    const { handle, onCommit } = setup();
    pointer.down(handle, { clientX: at(0.5) });
    pointer.move(handle, { clientX: at(0.6) });
    pointer.up(handle, { clientX: at(0.6) });
    pointer.lost(handle, { clientX: at(0.6) });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('releases gracefully on cancellation, keeping the last position and ignoring later moves', () => {
    const { handle, onChange, onCommit } = setup();
    pointer.down(handle, { clientX: at(0.5) });
    pointer.move(handle, { clientX: at(0.65) });
    pointer.cancel(handle, { clientX: at(0.65) });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(expect.closeTo(0.65, 5));
    const calls = onChange.mock.calls.length;
    pointer.move(handle, { clientX: at(0.9) });
    expect(onChange.mock.calls.length).toBe(calls);
  });

  it('recovers when capture is lost mid-drag, so it can never stay stuck', () => {
    const { handle, onCommit } = setup();
    pointer.down(handle, { clientX: at(0.5) });
    pointer.move(handle, { clientX: at(0.55) });
    pointer.lost(handle, { clientX: at(0.55) });
    expect(onCommit).toHaveBeenCalledTimes(1);
    pointer.down(handle, { clientX: at(0.55) });
    pointer.move(handle, { clientX: at(0.4) });
    pointer.up(handle, { clientX: at(0.4) });
    expect(onCommit).toHaveBeenLastCalledWith(expect.closeTo(0.4, 5));
  });

  it('ignores a second pointer while one is dragging', () => {
    const { handle, onChange } = setup();
    pointer.down(handle, { pointerId: 1, clientX: at(0.5) });
    pointer.down(handle, { pointerId: 2, pointerType: 'touch', clientX: at(0.9) });
    pointer.move(handle, { pointerId: 2, pointerType: 'touch', clientX: at(0.9) });
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(['touch', 'pen'] as const)('supports %s pointers', (pointerType) => {
    const { handle, onCommit } = setup();
    pointer.down(handle, { pointerType, clientX: at(0.5) });
    pointer.move(handle, { pointerType, clientX: at(0.25) });
    pointer.up(handle, { pointerType, clientX: at(0.25) });
    expect(onCommit).toHaveBeenCalledWith(expect.closeTo(0.25, 5));
  });

  it('ignores the right mouse button but not a touch contact', () => {
    const { handle, onChange } = setup();
    pointer.down(handle, { button: 2, clientX: at(0.5) });
    pointer.move(handle, { clientX: at(0.8) });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('measures the pane at the moment of each move, so resizing mid-drag stays accurate', () => {
    const { handle, onChange } = setup();
    const track = handle.parentElement;
    if (!track) throw new Error('divider has no track');
    pointer.down(handle, { clientX: at(0.5) });
    mockBox(track, { left: 0, top: 0, width: 1000, height: 300 });
    // The pane is now 1000px wide starting at 0, so x=750 is 75% along it, whatever it was before.
    pointer.move(handle, { clientX: 750 });
    expect(onChange).toHaveBeenLastCalledWith(expect.closeTo(0.75, 5));
    pointer.move(handle, { clientX: 250 });
    expect(onChange).toHaveBeenLastCalledWith(expect.closeTo(0.25, 5));
  });
});

describe('SliderHandle semantics and keyboard', () => {
  it('describes both sides of the divider to assistive technology', () => {
    const { handle } = setup(0.4);
    expect(handle).toHaveAttribute('aria-valuenow', '40');
    expect(handle).toHaveAttribute('aria-valuetext', 'Reference 40%, implementation 60%');
    expect(handle).toHaveAttribute('data-gesture-owner');
  });

  it('moves in 1% steps with arrows and 10% steps with Shift or Page keys', async () => {
    const user = userEvent.setup();
    const { handle } = setup();
    handle.focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(handle).toHaveAttribute('aria-valuenow', '52');
    await user.keyboard('{ArrowLeft}');
    expect(handle).toHaveAttribute('aria-valuenow', '51');
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(handle).toHaveAttribute('aria-valuenow', '41');
    await user.keyboard('{PageUp}');
    expect(handle).toHaveAttribute('aria-valuenow', '51');
  });

  it('jumps to the ends with Home and End and never leaves 0–100', async () => {
    const user = userEvent.setup();
    const { handle } = setup();
    handle.focus();
    await user.keyboard('{Home}{ArrowLeft}');
    expect(handle).toHaveAttribute('aria-valuenow', '0');
    await user.keyboard('{End}{ArrowRight}');
    expect(handle).toHaveAttribute('aria-valuenow', '100');
  });

  it('centres on double-click', async () => {
    const { handle, onCommit } = setup(0.9);
    await userEvent.dblClick(handle);
    expect(onCommit).toHaveBeenCalledWith(0.5);
  });

  it('keeps arrow keys to itself so they do not also pan the stage', async () => {
    const onStageKey = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <div onKeyDown={onStageKey}>
        <SliderHandle position={0.5} onChange={vi.fn()} onCommit={vi.fn()} />
      </div>,
    );
    const handle = container.querySelector<HTMLElement>('[role=slider]');
    handle?.focus();
    await user.keyboard('{ArrowRight}');
    expect(onStageKey).not.toHaveBeenCalled();
  });
});
