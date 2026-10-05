// Fill the whole browser viewport instead of a fixed 1024×768 canvas
// (avoids letterboxing / black bars on non-4:3 screens).
export const GAME_WIDTH = window.innerWidth;
export const GAME_HEIGHT = window.innerHeight;

export const PLAYER_SPEED = 200;

export const WS_URL = import.meta.env.VITE_WS_URL ?? `ws://${window.location.host}/ws`;
