/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const Palette = {
  deepForest: '#0B3D2E',   // Primary
  mintTeal: '#2EC4B6',     // Interactive
  freshGreen: '#84CC16',   // Growth
  sunGlow: '#FBBF24',      // Accent
  warmOrange: '#F97316',   // Motivation
  softCream: '#FDFBF7',    // Background
  lightGreen: '#E8F5E9',   // Surfaces
  leafTint: '#DCE9D6',     // Cards
  slate: '#334155',        // Text
  white: '#FFFFFF',        // Clean
} as const;

export const Colors = {
  light: {
    text: Palette.slate,
    background: Palette.softCream,
    backgroundElement: Palette.lightGreen,
    backgroundSelected: Palette.leafTint,
    textSecondary: '#64748B',
    primary: Palette.deepForest,
    accent: Palette.mintTeal,
  },
  dark: {
    text: Palette.softCream,
    background: '#071F17',
    backgroundElement: '#0E2E23',
    backgroundSelected: '#164334',
    textSecondary: '#94A3B8',
    primary: Palette.mintTeal,
    accent: Palette.freshGreen,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
