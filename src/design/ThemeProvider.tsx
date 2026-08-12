import React, {createContext, useContext, useMemo} from 'react';
import {useColorScheme} from 'react-native';
import {Provider as PaperProvider} from 'react-native-paper';
import {Colors, Scheme, paletteFor, paperThemeFor} from './theme';

type ThemeValue = {colors: Colors; scheme: Scheme};

const ThemeContext = createContext<ThemeValue>({colors: paletteFor('light'), scheme: 'light'});

/**
 * Drives the whole app from the system light/dark setting. Provides the active
 * palette to components (via `useColors`) and configures react-native-paper.
 */
export function ThemeProvider({children}: {children: React.ReactNode}) {
  const system = useColorScheme();
  const scheme: Scheme = system === 'dark' ? 'dark' : 'light';
  const value = useMemo(() => ({colors: paletteFor(scheme), scheme}), [scheme]);
  const paperTheme = useMemo(() => paperThemeFor(scheme), [scheme]);
  return (
    <ThemeContext.Provider value={value}>
      <PaperProvider theme={paperTheme}>{children}</PaperProvider>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
export const useColors = () => useContext(ThemeContext).colors;
export const useScheme = () => useContext(ThemeContext).scheme;
