import { useEffect } from 'react';
import { COMPARISON_MODES, type ComparisonMode } from '@/domain/types';
import { useViewportStore } from '@/state/viewportStore';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return (
    target instanceof HTMLInputElement && target.type !== 'range' && target.type !== 'checkbox'
  );
}

/** Workspace-wide keyboard shortcuts. Ignored while typing and when a modifier is held. */
export function useShortcuts(onModeChange: (mode: ComparisonMode) => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      const viewport = useViewportStore.getState();
      const mode = COMPARISON_MODES[Number(event.key) - 1];

      if (mode && /^[1-4]$/.test(event.key)) onModeChange(mode);
      else if (event.key === '+' || event.key === '=') viewport.zoomStep(1);
      else if (event.key === '-' || event.key === '_') viewport.zoomStep(-1);
      else if (event.key === '0') viewport.actualSize();
      else if (event.key.toLowerCase() === 'f') viewport.fit();
      else return;

      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onModeChange]);
}
