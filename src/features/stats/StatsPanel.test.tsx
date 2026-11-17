import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { computeDiff } from '@/domain/diff';
import { computeLayout } from '@/domain/layout';
import { DEFAULT_DIFF_SETTINGS, type DiffSettings } from '@/domain/types';
import type { DiffResult } from '@/services/diffProtocol';
import type { DiffState } from '@/state/sessionStore';
import { fakeLoadedImage } from '@/test/fakes';
import { BLACK, solidImage, withRect } from '@/test/pixels';
import { StatsPanel } from './StatsPanel';

function setup({
  implementationHeight = 80,
  settings = DEFAULT_DIFF_SETTINGS,
  diffOverride,
}: {
  implementationHeight?: number;
  settings?: DiffSettings;
  diffOverride?: DiffState;
} = {}) {
  const images = {
    reference: fakeLoadedImage('ref.png', 100, 80),
    implementation: fakeLoadedImage('impl.png', 100, implementationHeight),
  };
  // Real statistics from the real algorithm, on synthetic pixels.
  const computation = computeDiff(
    solidImage(100, 80),
    withRect(solidImage(100, implementationHeight), { x: 10, y: 20, width: 20, height: 10 }, BLACK),
    settings,
  );
  const result: DiffResult = { ...computation, settings, compareMs: 4.2, decodeMs: 0 };
  const handlers = { onSettingsChange: vi.fn(), onZoomToChanges: vi.fn(), onRetry: vi.fn() };
  render(
    <StatsPanel
      images={images}
      layout={computeLayout(
        images.reference,
        images.implementation,
        settings.strategy,
        settings.anchor,
      )}
      settings={settings}
      diff={diffOverride ?? { status: 'ready', result, error: null }}
      {...handlers}
    />,
  );
  return handlers;
}

describe('StatsPanel', () => {
  it('reports the percentage and pixel counts from the result', () => {
    setup();
    expect(screen.getByTestId('diff-percent')).toHaveTextContent('2.50%');
    expect(screen.getByText('200 of 8,000 compared pixels differ.')).toBeInTheDocument();
    expect(screen.getByText('20 × 10 at 10, 20')).toBeInTheDocument();
    expect(screen.queryByTestId('mismatch-notice')).not.toBeInTheDocument();
  });

  it('zooms to the changed region', async () => {
    const { onZoomToChanges } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Zoom to changes' }));
    expect(onZoomToChanges).toHaveBeenCalledWith({ x: 10, y: 20, width: 20, height: 10 });
  });

  it('shows a waiting state before the first result and while the layout is stale', () => {
    setup({ diffOverride: { status: 'computing', result: null, error: null } });
    expect(screen.getByText('Comparing pixels…')).toHaveAttribute('role', 'status');
    expect(screen.queryByTestId('diff-percent')).not.toBeInTheDocument();
  });

  it('shows the error with a retry action', async () => {
    const { onRetry } = setup({
      diffOverride: { status: 'error', result: null, error: 'Out of memory' },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Out of memory');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('explains a size mismatch and lets the strategy and anchor be changed', async () => {
    const { onSettingsChange } = setup({ implementationHeight: 110 });
    const notice = screen.getByTestId('mismatch-notice');
    expect(notice).toHaveTextContent('Sizes differ.');
    expect(notice).toHaveTextContent('0 × +30 px');
    expect(notice).toHaveTextContent('Images are never rescaled.');
    expect(screen.getByText('Comparison canvas').closest('div')).toHaveTextContent('100 × 110 px');
    // The padded strip is reported separately, not as differences.
    expect(screen.getByText('Outside overlap').closest('div')).toHaveTextContent('3,000');

    await userEvent.click(within(notice).getByRole('radio', { name: 'Crop' }));
    expect(onSettingsChange).toHaveBeenCalledWith({ strategy: 'crop' });

    await userEvent.selectOptions(within(notice).getByLabelText('Align from'), 'center');
    expect(onSettingsChange).toHaveBeenCalledWith({ anchor: 'center' });
  });

  it('changes the threshold and the anti-aliasing option', async () => {
    const { onSettingsChange } = setup();
    fireEvent.change(screen.getByLabelText('Threshold'), { target: { value: '0.25' } });
    expect(onSettingsChange).toHaveBeenCalledWith({ threshold: 0.25 });

    await userEvent.click(screen.getByRole('checkbox', { name: /Count anti-aliased pixels/ }));
    expect(onSettingsChange).toHaveBeenCalledWith({ includeAA: true });
  });

  it('marks the result as updating when a setting has changed since it was computed', () => {
    const settings = { ...DEFAULT_DIFF_SETTINGS, threshold: 0.4 };
    const stale = computeDiff(solidImage(100, 80), solidImage(100, 80), DEFAULT_DIFF_SETTINGS);
    setup({
      settings,
      diffOverride: {
        status: 'ready',
        result: { ...stale, settings: DEFAULT_DIFF_SETTINGS, compareMs: 1, decodeMs: 0 },
        error: null,
      },
    });
    expect(screen.getByText('Updating…')).toBeInTheDocument();
  });
});
