import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { peekStore } from '@/state/stageStores';
import { useViewportStore } from '@/state/viewportStore';
import { useShortcuts } from './useShortcuts';

function Harness(handlers: Parameters<typeof useShortcuts>[0]) {
  useShortcuts(handlers);
  return <input aria-label="Name" />;
}

const handlers = () => ({ onMode: vi.fn(), onToggleInspector: vi.fn(), onShowShortcuts: vi.fn() });

beforeEach(() => {
  useViewportStore.setState({ autoFit: true, transform: { scale: 1, x: 0, y: 0 } });
  useViewportStore.getState().setContent({ width: 400, height: 300 });
  useViewportStore.getState().setPane({ width: 800, height: 600 });
  peekStore.setState({ peek: null });
});

describe('useShortcuts', () => {
  it('switches mode with the number keys', async () => {
    const h = handlers();
    render(<Harness {...h} />);
    await userEvent.keyboard('2');
    await userEvent.keyboard('4');
    await userEvent.keyboard('5');
    expect(h.onMode.mock.calls).toEqual([['slider'], ['diff']]);
  });

  it('zooms in steps, resets to actual size and fits', async () => {
    render(<Harness {...handlers()} />);
    await userEvent.keyboard('+');
    expect(useViewportStore.getState().transform.scale).toBe(1.5);
    expect(useViewportStore.getState().autoFit).toBe(false);
    await userEvent.keyboard('-');
    await userEvent.keyboard('-');
    expect(useViewportStore.getState().transform.scale).toBe(0.75);
    await userEvent.keyboard('0');
    expect(useViewportStore.getState().transform.scale).toBe(1);
    await userEvent.keyboard('f');
    expect(useViewportStore.getState().autoFit).toBe(true);
  });

  it('toggles the inspector and opens the shortcut list', async () => {
    const h = handlers();
    render(<Harness {...h} />);
    await userEvent.keyboard('[[');
    await userEvent.keyboard('?');
    expect(h.onToggleInspector).toHaveBeenCalledTimes(1);
    expect(h.onShowShortcuts).toHaveBeenCalledTimes(1);
  });

  it('shows one image only while R or I is held, and restores on release', () => {
    render(<Harness {...handlers()} />);
    fireEvent.keyDown(window, { key: 'r' });
    expect(peekStore.getState().peek).toBe('reference');
    fireEvent.keyUp(window, { key: 'r' });
    expect(peekStore.getState().peek).toBeNull();
    fireEvent.keyDown(window, { key: 'i' });
    expect(peekStore.getState().peek).toBe('implementation');
    fireEvent(window, new Event('blur'));
    expect(peekStore.getState().peek).toBeNull();
  });

  it('does nothing while the user is typing in a text field', async () => {
    const h = handlers();
    render(<Harness {...h} />);
    await userEvent.type(screen.getByLabelText('Name'), 'v2 0+r[[?');
    expect(h.onMode).not.toHaveBeenCalled();
    expect(h.onToggleInspector).not.toHaveBeenCalled();
    expect(peekStore.getState().peek).toBeNull();
    expect(useViewportStore.getState().transform.scale).toBe(1);
  });

  it('is suspended while a dialog is open', () => {
    const h = handlers();
    render(<Harness {...h} />);
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.append(dialog);
    fireEvent.keyDown(window, { key: '3' });
    expect(h.onMode).not.toHaveBeenCalled();
    dialog.remove();
  });
});
