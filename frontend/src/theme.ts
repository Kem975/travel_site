import { createTheme } from '@mantine/core';

// Central place for brand identity. Dark/light is handled by MantineProvider +
// the persisted color scheme (no custom theming code needed).
export const theme = createTheme({
  primaryColor: 'teal',
  fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  defaultRadius: 'md',
});
