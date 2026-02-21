import { createTheme } from '@mantine/core';
import { BRAND_ACCENT_COLORS, BRAND_COLORS } from './brand';

export const mantineTheme = createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 5 },
  colors: {
    brand: BRAND_COLORS,
    accent: BRAND_ACCENT_COLORS,
  },
});
