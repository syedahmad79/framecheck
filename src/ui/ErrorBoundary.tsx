import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';

interface State {
  error: Error | null;
}

/** Last line of defence: render a recoverable message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <main className="mx-auto flex h-full max-w-md flex-col items-start justify-center gap-3 p-6">
        <h1 className="text-base font-semibold">Something went wrong</h1>
        <p className="text-fg-muted">
          Framecheck hit an unexpected error. Your saved comparisons are not affected.
        </p>
        <pre className="tabular border-line bg-canvas text-fg-muted max-h-32 w-full overflow-auto rounded-md border p-2 text-xs">
          {this.state.error.message}
        </pre>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </main>
    );
  }
}
