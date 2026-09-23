import { extendTheme } from '@chakra-ui/react';

// Design system: Zangoh indigo/violet brand + a glassmorphism surface language —
// translucent, blurred cards floating over a soft lavender gradient canvas.
const theme = extendTheme({
  config: { initialColorMode: 'light', useSystemColorMode: false },
  colors: {
    brand: {
      50: '#EEF0FF',
      100: '#DCDFFF',
      200: '#B9BFFF',
      300: '#8F97FE',
      400: '#6C6BFB',
      500: '#463EF0',
      600: '#372FD6',
      700: '#2A23AC',
      800: '#1E1982',
      900: '#141059',
    },
    navy: {
      50: '#EEF0FA',
      100: '#D3D8ED',
      200: '#A8B1DA',
      300: '#7A87C2',
      400: '#575FA0',
      500: '#3D3F7A',
      600: '#2E2F5E',
      700: '#222345',
      800: '#17182F',
      900: '#0F1020',
    },
    alert: { low: '#38A169', medium: '#DD9426', high: '#E5484D' },
  },
  fonts: {
    heading: `'Inter', -apple-system, sans-serif`,
    body: `'Inter', -apple-system, sans-serif`,
  },
  radii: { xl: '16px', '2xl': '20px' },
  shadows: {
    card: '0 8px 30px rgba(70, 62, 240, 0.10), 0 1px 2px rgba(20, 16, 89, 0.06)',
    glow: '0 0 0 1px rgba(70, 62, 240, 0.12), 0 12px 36px rgba(70, 62, 240, 0.18)',
  },
  layerStyles: {
    // The core "glass" surface: translucent + blurred, used for every card/panel.
    glass: {
      bg: 'rgba(255, 255, 255, 0.68)',
      backdropFilter: 'blur(18px) saturate(180%)',
      WebkitBackdropFilter: 'blur(18px) saturate(180%)',
      border: '1px solid rgba(255, 255, 255, 0.6)',
      boxShadow: 'card',
      borderRadius: 'xl',
    },
    glassStrong: {
      bg: 'rgba(255, 255, 255, 0.82)',
      backdropFilter: 'blur(22px) saturate(180%)',
      WebkitBackdropFilter: 'blur(22px) saturate(180%)',
      border: '1px solid rgba(255, 255, 255, 0.7)',
      boxShadow: 'card',
    },
  },
  styles: {
    global: (props) => ({
      body: {
        color: props.colorMode === 'dark' ? 'gray.100' : 'navy.800',
        bg: props.colorMode === 'dark'
          ? 'navy.900'
          : 'radial-gradient(1200px circle at 10% -10%, #EEF0FF 0%, transparent 55%), radial-gradient(1000px circle at 90% 0%, #F3EFFF 0%, transparent 50%), #F5F6FC',
        backgroundAttachment: 'fixed',
      },
    }),
  },
  components: {
    Button: {
      baseStyle: { fontWeight: 'semibold', borderRadius: 'lg' },
      defaultProps: { colorScheme: 'brand' },
    },
    Badge: { baseStyle: { borderRadius: 'full', px: 2 } },
    Tag: { defaultProps: { colorScheme: 'brand' } },
    Switch: { defaultProps: { colorScheme: 'brand' } },
    Checkbox: { defaultProps: { colorScheme: 'brand' } },
    Slider: { defaultProps: { colorScheme: 'brand' } },
    Tabs: { defaultProps: { colorScheme: 'brand' } },
    Progress: { defaultProps: { colorScheme: 'brand' } },
  },
});

export default theme;
