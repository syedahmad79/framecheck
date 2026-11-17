import { THEME_PREFERENCES, themeStore, useTheme, type ThemePreference } from '@/state/theme';
import { MonitorIcon, MoonIcon, SunIcon } from './icons';
import { SegmentedControl } from './SegmentedControl';

const OPTIONS = THEME_PREFERENCES.map((value) => ({
  value,
  label: { system: 'System theme', light: 'Light theme', dark: 'Dark theme' }[value],
  icon: { system: <MonitorIcon />, light: <SunIcon />, dark: <MoonIcon /> }[value],
}));

export function ThemeToggle() {
  const preference = useTheme((state) => state.preference);
  return (
    <SegmentedControl<ThemePreference>
      label="Theme"
      options={OPTIONS}
      value={preference}
      onChange={themeStore.getState().setPreference}
      labels="never"
      size="sm"
    />
  );
}
