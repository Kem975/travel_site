import {
  Button,
  Card,
  createTheme,
  Paper,
  PasswordInput,
  Select,
  Textarea,
  TextInput,
} from '@mantine/core';

import { travelCream, travelGold, travelNavy, travelTeal } from './colors';

// Central brand identity. Dark/light is handled by MantineProvider + the persisted
// color scheme. Public pages layer their cinematic surfaces on top via the --app-*
// CSS variables in global.css; admin pages use stock Mantine surfaces + travelTeal.
export const theme = createTheme({
  primaryColor: 'travelTeal',
  primaryShade: { light: 7, dark: 4 },

  colors: {
    travelNavy,
    travelCream,
    travelGold,
    travelTeal,
  },

  white: '#FFFFFF',
  black: '#05101A',

  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',

  fontFamilyMonospace:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',

  headings: {
    fontFamily: '"Anthropic Serif", Georgia, "Times New Roman", serif',
    fontWeight: '600',
    textWrap: 'balance',
  },

  defaultRadius: 'lg',
  // radius: {
  //   xs: '0.25rem',
  //   sm: '0.45rem',
  //   md: '0.7rem',
  //   lg: '1rem',
  //   xl: '1.4rem',
  // },

  shadows: {
    xs: '0 1px 2px rgba(5, 16, 26, 0.08)',
    sm: '0 4px 12px rgba(5, 16, 26, 0.10)',
    md: '0 10px 30px rgba(5, 16, 26, 0.14)',
    lg: '0 18px 50px rgba(5, 16, 26, 0.20)',
    xl: '0 30px 80px rgba(5, 16, 26, 0.28)',
  },

  focusRing: 'auto',
  cursorType: 'pointer',
  respectReducedMotion: true,
  autoContrast: true,

  components: {
    Button: Button.extend({
      defaultProps: { radius: 'xl', color: 'travelTeal' },
    }),
    Paper: Paper.extend({
      defaultProps: { radius: 'xl', shadow: 'sm' },
    }),
    Card: Card.extend({
      defaultProps: { radius: 'xl', shadow: 'sm', withBorder: true },
    }),
    TextInput: TextInput.extend({
      defaultProps: { radius: 'md' },
    }),
    PasswordInput: PasswordInput.extend({
      defaultProps: { radius: 'md' },
    }),
    Textarea: Textarea.extend({
      defaultProps: { radius: 'md', autosize: true, minRows: 4 },
    }),
    Select: Select.extend({
      defaultProps: { radius: 'md' },
    }),
  },

  other: {
    publicMaxWidth: '74rem',
    articleTextWidth: '46rem',
    articleWideWidth: '82rem',

    light: {
      bg: '#F2F4F6',
      surface: '#FFFFFF',
      surfaceMuted: '#E7EBEF',
      text: '#141A1F',
      muted: '#5B666F',
      border: '#D2D9DF',
      accent: '#96590A',
    },

    dark: {
      bg: '#05101A',
      surface: '#0B1824',
      surfaceMuted: '#102333',
      text: '#F3EBDD',
      muted: '#B9AA94',
      border: '#213342',
      accent: '#FFD27D',
    },
  },
});
