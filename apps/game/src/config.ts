export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 768;

export const TILE_SIZE = 16;

export const PLAYER_SPEED = 120;

export const WS_URL =
  import.meta.env.VITE_WS_URL ?? `ws://${window.location.host}/ws`;

export const API_URL =
  import.meta.env.VITE_API_URL ?? `${window.location.origin}/api`;

export const COLORS = {
  panelBg: 0x1a1a2e,
  panelBorder: 0x4a9eff,
  panelBorderLight: 0x7bc4ff,
  textPrimary: '#e0e0e0',
  textSecondary: '#aaaacc',
  textHighlight: '#4a9eff',
  textWarning: '#ffaa44',
  buttonBg: 0x2a2a4e,
  buttonHover: 0x3a3a6e,
  buttonText: '#ffffff',
  success: 0x44ff88,
  error: 0xff4444,
} as const;

export const FONTS = {
  pixel: '"Press Start 2P"',
  size: {
    sm: '8px',
    md: '10px',
    lg: '12px',
    xl: '14px',
    title: '16px',
  },
} as const;
