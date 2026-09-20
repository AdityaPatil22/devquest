import { WS_URL } from '../config';
import type { ClientMessage, ServerMessage } from './protocol';

type MessageHandler = (msg: ServerMessage) => void;
type ConnectionHandler = (connected: boolean) => void;

const SESSION_STORAGE_KEY = 'devquest_session_id';

/**
 * WebSocket client with auto-reconnect and session persistence.
 *
 * On reconnect the client appends the stored session_id as a query
 * parameter so the server can associate the new socket with the
 * existing session instead of creating a brand-new one.
 */
export class WebSocketClient {
  private ws?: WebSocket;
  private handlers: MessageHandler[] = [];
  private connectionHandlers: ConnectionHandler[] = [];
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseUrl: string;
  private _sessionId?: string;

  constructor(url?: string) {
    this.baseUrl = url ?? WS_URL;
    // Restore session from a previous page load
    this._sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY) ?? undefined;
  }

  get sessionId(): string | undefined {
    return this._sessionId;
  }

  /** Store the session_id for future reconnects / page reloads. */
  setSessionId(id: string): void {
    this._sessionId = id;
    sessionStorage.setItem(SESSION_STORAGE_KEY, id);
  }

  /** Clear the stored session so the next connect creates a fresh one. */
  clearSession(): void {
    this._sessionId = undefined;
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }

  connect(): void {
    // Close any existing socket first to prevent duplicate connections
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
      this.ws.onclose = null; // prevent triggering reconnect
      this.ws.close();
    }

    try {
      const url = this._sessionId
        ? `${this.baseUrl}?session_id=${this._sessionId}`
        : this.baseUrl;

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WS] Connected', this._sessionId ? `(session ${this._sessionId})` : '(new)');
        this.reconnectAttempts = 0;
        this.connectionHandlers.forEach((handler) => handler(true));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: ServerMessage = JSON.parse(event.data);
          this.handlers.forEach((h) => h(msg));
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected');
        this.connectionHandlers.forEach((handler) => handler(false));
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.error('[WS] Error:', err);
      };
    } catch (err) {
      console.error('[WS] Connection failed:', err);
      this.scheduleReconnect();
    }
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn('[WS] Not connected, message dropped:', msg.type);
    }
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  onConnectionChange(handler: ConnectionHandler): void {
    this.connectionHandlers.push(handler);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.ws) {
      this.ws.onclose = null; // prevent triggering reconnect
      this.ws.close();
      this.ws = undefined;
    }
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts++;
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
