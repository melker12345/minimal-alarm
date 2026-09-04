import {MD3DarkTheme, MD3LightTheme} from 'react-native-paper';

export type Colors = {
  canvas: string;
  surface: string;
  surfaceMuted: string; // e.g. a disabled/off card
  ink: string;
  muted: string;
  line: string;
  accent: string;
  onAccent: string;
  accentSoft: string;
  accentPale: string;
  accentLine: string; // hairline on accent-tinted surfaces
  ripple: string; // android press feedback
  coral: string;
  coralSoft: string;
  disabled: string;
  overlay: string; // scrim behind modals
};

export const lightColors: Colors = {
  canvas: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceMuted: '#ECEEF3',
  ink: '#151922',
  muted: '#707783',
  line: '#E1E5EC',
  accent: '#356AE6',
  onAccent: '#FFFFFF',
  accentSoft: '#E7EEFF',
  accentPale: '#F2F5FF',
  accentLine: '#C9D4ED',
  ripple: 'rgba(21, 25, 34, 0.08)',
  coral: '#C75A43',
  coralSoft: '#F8E5DF',
  disabled: '#A9B0AA',
  overlay: 'rgba(23, 26, 24, 0.32)',
};

export const darkColors: Colors = {
  canvas: '#0E1116',
  surface: '#171B22',
  surfaceMuted: '#12161C',
  ink: '#F2F4F8',
  muted: '#9AA3B2',
  line: '#262C36',
  accent: '#5B8BFF',
  onAccent: '#0B1220',
  accentSoft: '#1B2740',
  accentPale: '#151C2C',
  accentLine: '#2E3E63',
  ripple: 'rgba(242, 244, 248, 0.08)',
  coral: '#E58469',
  coralSoft: '#37241E',
  disabled: '#5B6472',
  overlay: 'rgba(0, 0, 0, 0.55)',
};

export type Scheme = 'light' | 'dark';

export const paletteFor = (scheme: Scheme): Colors => (scheme === 'dark' ? darkColors : lightColors);

export function paperThemeFor(scheme: Scheme) {
  const base = scheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const c = paletteFor(scheme);
  return {
    ...base,
    roundness: 18,
    colors: {
      ...base.colors,
      primary: c.accent,
      onPrimary: c.onAccent,
      primaryContainer: c.accentSoft,
      onPrimaryContainer: c.accent,
      secondary: c.coral,
      secondaryContainer: c.coralSoft,
      background: c.canvas,
      surface: c.surface,
      surfaceVariant: c.surface,
      onSurface: c.ink,
      onSurfaceVariant: c.muted,
      outline: c.line,
      // Snackbars use the inverse tokens; keep them on-theme instead of
      // Material's default bright-in-dark pill.
      inverseSurface: c.surface,
      inverseOnSurface: c.ink,
      inversePrimary: c.accent,
      elevation: {
        ...base.colors.elevation,
        level1: c.surface,
        level2: c.surface,
        level3: c.surface,
      },
    },
  };
}

export const spacing = {
  page: 22,
  card: 20,
  section: 28,
};

export const radii = {
  sm: 14,
  md: 18,
  lg: 24,
  xl: 30,
};

// Back-compat default palette for any non-themed reference.
export const colors = lightColors;
