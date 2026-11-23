import { useEffect } from 'react';
import type { Theme } from '../../core';

/** Puts the theme on the page, so every window of the app shows the same one (theme.css reads it). */
export function useTheme(theme: Theme | undefined): void {
  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
}
