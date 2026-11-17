import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { themeStore } from '@/state/theme';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  it('shows the current preference and switches themes, updating the document', async () => {
    themeStore.getState().setPreference('system');
    render(<ThemeToggle />);
    expect(screen.getByRole('radio', { name: 'System theme' })).toBeChecked();

    await userEvent.click(screen.getByRole('radio', { name: 'Dark theme' }));
    expect(screen.getByRole('radio', { name: 'Dark theme' })).toBeChecked();
    expect(document.documentElement.dataset.theme).toBe('dark');

    await userEvent.click(screen.getByRole('radio', { name: 'Light theme' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('framecheck:theme')).toBe('light');
  });
});
