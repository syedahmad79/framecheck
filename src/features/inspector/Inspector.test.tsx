import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { computeDiff } from '@/domain/diff';
import { computeLayout } from '@/domain/layout';
import { DEFAULT_DIFF_SETTINGS, type DiffSettings } from '@/domain/types';
import type { DiffState } from '@/state/sessionStore';
import { fakeLoadedImage, fakeResult } from '@/test/fakes';
import { BLACK, solidImage, withRect } from '@/test/pixels';
import { Inspector } from './Inspector';

function setup({
  implementationHeight = 80,
  settings = DEFAULT_DIFF_SETTINGS,
  diffOverride,
  translucent = false,
}: {
  implementationHeight?: number;
  settings?: DiffSettings;
  diffOverride?: DiffState;
  translucent?: boolean;
} = {}) {
  const images = {
    reference: fakeLoadedImage('ref.png', 100, 80),
    implementation: fakeLoadedImage('impl.png', 100, implementationHeight),
  };
  const reference = translucent ? solidImage(100, 80, [255, 255, 255, 0]) : solidImage(100, 80);
  // Real statistics from the real algorithm, on synthetic pixels.
  const result = fakeResult(
    computeDiff(
      reference,
      withRect(
        solidImage(100, implementationHeight),
        { x: 10, y: 20, width: 20, height: 10 },
        BLACK,
      ),
      settings,
    ),
    settings,
  );
  const handlers = {
    onSettingsChange: vi.fn(),
    onZoomToChanges: vi.fn(),
    onRetry: vi.fn(),
    onClose: vi.fn(),
  };
  render(
    <Inspector
      open
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

describe('Inspector result', () => {
  it('reports the percentage, counts and changed region from the result', () => {
    setup();
    expect(screen.getByTestId('diff-percent')).toHaveTextContent('2.50%');
    expect(screen.getByText('200 of 8,000 compared pixels differ.')).toBeInTheDocument();
    expect(screen.getByText('20 × 10 at 10, 20')).toBeInTheDocument();
    expect(screen.queryByTestId('mismatch-notice')).not.toBeInTheDocument();
  });

  it('states which settings produced the numbers', () => {
    setup();
    expect(screen.getByText(/Threshold 0\.10, ignoring anti-aliasing\./)).toBeInTheDocument();
  });

  it('explains each statistic through an accessible info tip', () => {
    setup();
    const tip = screen.getByRole('button', { name: 'About compared' });
    expect(tip).toHaveAccessibleDescription(/covered by both images/);
  });

  it('zooms to the changed region', async () => {
    const { onZoomToChanges } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Zoom to changes' }));
    expect(onZoomToChanges).toHaveBeenCalledWith({ x: 10, y: 20, width: 20, height: 10 });
  });

  it('shows a waiting state before the first result', () => {
    setup({ diffOverride: { status: 'computing', result: null, error: null } });
    expect(screen.getByText('Comparing pixels…')).toBeInTheDocument();
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

  it('never presents stale numbers as current: a result for older settings is marked as updating', () => {
    const settings = { ...DEFAULT_DIFF_SETTINGS, threshold: 0.4 };
    const stale = fakeResult(
      computeDiff(solidImage(100, 80), solidImage(100, 80), DEFAULT_DIFF_SETTINGS),
      DEFAULT_DIFF_SETTINGS,
    );
    setup({ settings, diffOverride: { status: 'ready', result: stale, error: null } });
    expect(screen.getByText('Updating…')).toBeInTheDocument();
    expect(screen.getByTestId('diff-percent').closest('[aria-busy]')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    // The line under the number names the settings it was actually computed with.
    expect(screen.getByText(/Threshold 0\.10/)).toBeInTheDocument();
  });

  it('warns that partly transparent pixels are compared over white', () => {
    setup({ translucent: true });
    expect(screen.getByText(/partly transparent/)).toHaveTextContent(
      'compared as if composited over white',
    );
  });
});

describe('Inspector alignment', () => {
  it('says nothing needs aligning when the sizes match', () => {
    setup();
    expect(screen.getByText(/nothing to align/)).toBeInTheDocument();
  });

  it('explains a size mismatch and lets the strategy and anchor be changed', async () => {
    const { onSettingsChange } = setup({ implementationHeight: 110 });
    const notice = screen.getByTestId('mismatch-notice');
    expect(notice).toHaveTextContent('The sizes differ');
    expect(notice).toHaveTextContent('0 × +30 px');
    expect(notice).toHaveTextContent('Images are never rescaled.');
    expect(notice).toHaveTextContent('Canvas 100 × 110 px');
    expect(screen.getByText('Not compared').closest('div')).toHaveTextContent('3,000');

    await userEvent.click(within(notice).getByRole('radio', { name: 'Crop' }));
    expect(onSettingsChange).toHaveBeenCalledWith({ strategy: 'crop' });
    await userEvent.click(within(notice).getByRole('radio', { name: 'Centre' }));
    expect(onSettingsChange).toHaveBeenCalledWith({ anchor: 'center' });
  });
});

describe('Inspector sensitivity and images', () => {
  it('changes the threshold and the anti-aliasing option', async () => {
    const { onSettingsChange } = setup();
    fireEvent.change(screen.getByLabelText('Threshold'), { target: { value: '0.25' } });
    expect(onSettingsChange).toHaveBeenCalledWith({ threshold: 0.25 });
    await userEvent.click(screen.getByRole('switch', { name: /Count anti-aliased pixels/ }));
    expect(onSettingsChange).toHaveBeenCalledWith({ includeAA: true });
  });

  it('lists both images with their dimensions and format', () => {
    setup();
    const images = screen.getByRole('region', { name: 'Images' });
    expect(within(images).getByText('ref.png')).toBeInTheDocument();
    expect(within(images).getAllByText(/100 × 80 px · 2\.0 KB · PNG/)).toHaveLength(2);
  });
});

describe('Inspector identical images', () => {
  it('reports 0% as identical and offers no region to zoom to', () => {
    const images = {
      reference: fakeLoadedImage('a.png', 40, 40),
      implementation: fakeLoadedImage('b.png', 40, 40),
    };
    const computation = computeDiff(solidImage(40, 40), solidImage(40, 40), DEFAULT_DIFF_SETTINGS);
    render(
      <Inspector
        open
        images={images}
        layout={computation.layout}
        settings={DEFAULT_DIFF_SETTINGS}
        diff={{
          status: 'ready',
          result: fakeResult(computation, DEFAULT_DIFF_SETTINGS),
          error: null,
        }}
        onSettingsChange={vi.fn()}
        onZoomToChanges={vi.fn()}
        onRetry={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('diff-percent')).toHaveTextContent('0%');
    expect(screen.getByText('identical')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zoom to changes' })).not.toBeInTheDocument();
  });
});
