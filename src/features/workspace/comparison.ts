import { useMemo } from 'react';
import { computeLayout, type ComparisonLayout } from '@/domain/layout';
import type { DiffSettings } from '@/domain/types';
import type { DiffResult } from '@/services/diffProtocol';
import type { ImagePair } from '@/services/images';

/** The layout is cheap and pure, so the UI derives it directly instead of waiting for the worker. */
export function useComparisonLayout(images: ImagePair, settings: DiffSettings): ComparisonLayout {
  const { reference, implementation } = images;
  return useMemo(
    () =>
      computeLayout(
        { width: reference.width, height: reference.height },
        { width: implementation.width, height: implementation.height },
        settings.strategy,
        settings.anchor,
      ),
    [
      reference.width,
      reference.height,
      implementation.width,
      implementation.height,
      settings.strategy,
      settings.anchor,
    ],
  );
}

/** A result can be drawn over the current layout only if it was computed for the same canvas. */
export function resultMatchesLayout(result: DiffResult | null, settings: DiffSettings): boolean {
  return (
    result !== null &&
    result.settings.strategy === settings.strategy &&
    result.settings.anchor === settings.anchor
  );
}

/** True when the result reflects every current setting, not just the layout. */
export function resultIsCurrent(result: DiffResult | null, settings: DiffSettings): boolean {
  return (
    resultMatchesLayout(result, settings) &&
    result?.settings.threshold === settings.threshold &&
    result.settings.includeAA === settings.includeAA
  );
}
