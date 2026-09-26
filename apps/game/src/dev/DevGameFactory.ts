import { SessionStore } from '../state/SessionStore';
import { DevWebSocketClient } from './DevWebSocketClient';

export interface DevGameSession {
  ws: DevWebSocketClient;
  store: SessionStore;
}

export function createDevGameSession(): DevGameSession {
  const ws = new DevWebSocketClient();
  const store = new SessionStore();

  store.setSession('dev-session-001');

  return {
    ws,
    store,
  };
}