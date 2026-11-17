export interface Shortcut {
  readonly keys: readonly string[];
  readonly description: string;
}

export interface ShortcutGroup {
  readonly title: string;
  readonly shortcuts: readonly Shortcut[];
}

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    title: 'Comparison',
    shortcuts: [
      { keys: ['1'], description: 'Side by side' },
      { keys: ['2'], description: 'Slider' },
      { keys: ['3'], description: 'Overlay' },
      { keys: ['4'], description: 'Differences' },
      { keys: ['R'], description: 'Hold to show only the reference' },
      { keys: ['I'], description: 'Hold to show only the implementation' },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { keys: ['+', '−'], description: 'Zoom in or out' },
      { keys: ['F'], description: 'Fit to screen' },
      { keys: ['0'], description: 'Actual size (100%)' },
      { keys: ['Arrows'], description: 'Pan while the viewport has focus' },
      { keys: ['Shift', 'Arrows'], description: 'Pan further' },
      { keys: ['Double-click'], description: 'Zoom in at the cursor, or back to fit' },
      { keys: ['Ctrl/⌘', 'Scroll'], description: 'Zoom at the cursor' },
    ],
  },
  {
    title: 'Divider',
    shortcuts: [
      { keys: ['←', '→'], description: 'Move 1%' },
      { keys: ['Shift', '←', '→'], description: 'Move 10%' },
      { keys: ['Home', 'End'], description: 'Jump to either side' },
      { keys: ['Double-click'], description: 'Centre the divider' },
    ],
  },
  {
    title: 'Interface',
    shortcuts: [
      { keys: ['['], description: 'Show or hide the inspector' },
      { keys: ['?'], description: 'Show this list' },
    ],
  },
];
