import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComparisonMode } from '@/domain/types';
import { useViewportStore } from '@/state/viewportStore';
import { useShortcuts } from './useShortcuts';

function Harness({ onMode }: { onMode: (mode: ComparisonMode) => void }) {
  useShortcuts(onMode);
  return <input aria-label="Name" />;
}

beforeEach(() => {
  useViewportStore.setState({ autoFit: true, transform: { scale: 1, x: 0, y: 0 } });
  useViewportStore.getState().setContent({ width: 400, height: 300 });
  useViewportStore.getState().setPane({ width: 800, height: 600 });
});

describe('useShortcuts', () => {
  it('switches mode with the number keys', async () => {
    const onMode = vi.fn();
    render(<Harness onMode={onMode} />);
    await userEvent.keyboard('2');
    await userEvent.keyboard('4');
    await userEvent.keyboard('5');
    expect(onMode.mock.calls).toEqual([['slider'], ['diff']]);
  });

  it('zooms in steps, resets to actual size and fits', async () => {
    render(<Harness onMode={vi.fn()} />);
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

  it('does nothing while the user is typing in a text field', async () => {
    const onMode = vi.fn();
    render(<Harness onMode={onMode} />);
    await userEvent.type(screen.getByLabelText('Name'), 'v2 0+');
    expect(onMode).not.toHaveBeenCalled();
    expect(useViewportStore.getState().transform.scale).toBe(1);
  });
});
