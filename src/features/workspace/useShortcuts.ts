import { useEffect } from 'react';
import { COMPARISON_MODES, type ComparisonMode } from '@/domain/types';
import { peekStore } from '@/state/stageStores';
import { useViewportStore } from '@/state/viewportStore';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return (
    target instanceof HTMLInputElement && target.type !== 'range' && target.type !== 'checkbox'
  );
}

interface ShortcutHandlers {
  readonly onMode: (mode: ComparisonMode) => void;
  readonly onToggleInspector: () => void;
  readonly onShowShortcuts: () => void;
}

/** Workspace-wide keyboard shortcuts. Ignored while typing, in a dialog, and with a modifier held. */
export function useShortcuts({
  onMode,
  onToggleInspector,
  onShowShortcuts,
}: ShortcutHandlers): void {
  useEffect(() => {
    const ignored = (event: KeyboardEvent) =>
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      isTyping(event.target) ||
      document.querySelector('dialog[open]') !== null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (ignored(event)) return;
      const viewport = useViewportStore.getState();
      const key = event.key.toLowerCase();

      if (key === 'r' || key === 'i') {
        peekStore.setState({ peek: key === 'r' ? 'reference' : 'implementation' });
      } else if (/^[1-4]$/.test(key)) {
        const mode = COMPARISON_MODES[Number(key) - 1];
        if (mode) onMode(mode);
      } else if (key === '+' || key === '=') viewport.zoomStep(1);
      else if (key === '-' || key === '_') viewport.zoomStep(-1);
      else if (key === '0') viewport.actualSize();
      else if (key === 'f') viewport.fit();
      else if (key === '[') onToggleInspector();
      else if (key === '?') onShowShortcuts();
      else return;

      event.preventDefault();
    };

    const releasePeek = () => peekStore.setState({ peek: null });
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r' || event.key.toLowerCase() === 'i') releasePeek();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releasePeek);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', releasePeek);
      releasePeek();
    };
  }, [onMode, onToggleInspector, onShowShortcuts]);
}
