import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import { CloseIcon } from './icons';

interface DialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
  readonly width?: string;
}

/**
 * A modal built on the native <dialog> element: the browser supplies the focus trap, Escape to
 * close, inert background and return of focus. Content only mounts while open.
 */
export function Dialog({ open, onClose, title, children, width = '28rem' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="fc-dialog"
      aria-labelledby={titleId}
      style={{ width }}
      onClose={onClose}
      onClick={(event) => {
        // Only a click on the backdrop reaches the dialog element itself.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
            <h2 id={titleId} className="text-fg text-lg font-semibold">
              {title}
            </h2>
            <Button variant="ghost" iconOnly size="sm" aria-label="Close" onClick={onClose}>
              <CloseIcon />
            </Button>
          </header>
          <div
            // A scrolling region must be reachable by keyboard so its overflow can be read without a mouse.
            role="region"
            aria-labelledby={titleId}
            tabIndex={0}
            className="min-h-0 overflow-y-auto px-5 pb-5"
          >
            {children}
          </div>
        </div>
      )}
    </dialog>
  );
}
