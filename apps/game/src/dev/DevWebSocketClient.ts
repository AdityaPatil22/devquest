import { WebSocketClient } from '../net/WebSocketClient';
import type { ClientMessage } from '../net/protocol';

export class DevWebSocketClient extends WebSocketClient {
  override connect(): void {
    console.log('[DEV WS] Mock WebSocket connected');
  }

  override disconnect(): void {
    console.log('[DEV WS] Mock WebSocket disconnected');
  }

  override send(message: ClientMessage): void {
    console.log('[DEV WS] Mock message:', message);
  }

  override get connected(): boolean {
    return true;
  }
}
