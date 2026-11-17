import { cn } from './cn';

export function Kbd({ children, className }: { children: string; className?: string }) {
  return (
    <kbd
      className={cn(
        'bg-hover text-2xs text-fg-muted inline-flex min-w-5 items-center justify-center rounded-[5px] px-1 font-sans font-medium shadow-[inset_0_-1px_0_var(--line-strong),0_0_0_1px_var(--line)]',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
