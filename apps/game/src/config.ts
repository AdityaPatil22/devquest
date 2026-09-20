// Fill the whole browser viewport instead of a fixed 1024×768 canvas
// (avoids letterboxing / black bars on non-4:3 screens).
export const GAME_WIDTH = window.innerWidth;
export const GAME_HEIGHT = window.innerHeight;

export const TILE_SIZE = 16;

export const PLAYER_SPEED = 300;

export const WS_URL =
  import.meta.env.VITE_WS_URL ?? `ws://${window.location.host}/ws`;

export const API_URL =
  import.meta.env.VITE_API_URL ?? `${window.location.origin}/api`;

export const COLORS = {
  panelBg: 0x1a1a2e,
  panelBorder: 0x4a9eff,
  panelBorderLight: 0x7bc4ff,
  textPrimary: '#ffffff',
  textSecondary: '#aaaacc',
  textHighlight: '#ffffff',
  textWarning: '#ffd60a',
  buttonBg: 0x2a2a4e,
  buttonHover: 0x3a3a6e,
  buttonText: '#ffffff',
  success: 0x44ff88,
  error: 0xff4444,
} as const;

export const FONTS = {
  pixel: '"Press Start 2P"',
  size: {
    sm: '10px',
    md: '12px',
    lg: '14px',
    xl: '16px',
    title: '18px',
  },
} as const;
