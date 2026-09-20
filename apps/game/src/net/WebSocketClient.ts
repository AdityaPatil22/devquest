import { WS_URL } from '../config';
import type { ClientMessage, ServerMessage } from './protocol';

type MessageHandler = (msg: ServerMessage) => void;

const SESSION_STORAGE_KEY = 'devquest_session_id';

export class WebSocketClient {
  private ws?: WebSocket;
  private handlers: MessageHandler[] = [];
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseUrl: string;
  private _sessionId?: string;
  private outboundQueue: ClientMessage[] = [];

  constructor(url?: string) {
    this.baseUrl = url ?? WS_URL;
    this._sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY) ?? undefined;
  }

  get sessionId(): string | undefined {
    return this._sessionId;
  }

  setSessionId(id: string): void {
    this._sessionId = id;
    sessionStorage.setItem(SESSION_STORAGE_KEY, id);
  }

  clearSession(): void {
    this._sessionId = undefined;
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }

  connect(): void {
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
      this.ws.onclose = null;
      this.ws.close();
    }

    try {
      const url = this._sessionId
        ? `${this.baseUrl}?session_id=${this._sessionId}`
        : this.baseUrl;

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log(
          '[WS] Connected',
          this._sessionId ? `(session ${this._sessionId})` : '(new)',
        );
        this.reconnectAttempts = 0;
        this.flushQueue();
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
      try {
        this.ws.send(JSON.stringify(msg));
      } catch (err) {
        console.error('[WS] Failed to send message, queued for retry:', err);
        this.outboundQueue.push(msg);
      }
    } else {
      this.outboundQueue.push(msg);
      console.log('[WS] Not connected, message queued:', msg.type);
    }
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = undefined;
    }
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private flushQueue(): void {
    while (this.ws?.readyState === WebSocket.OPEN && this.outboundQueue.length > 0) {
      const msg = this.outboundQueue.shift();
      if (!msg) return;

      try {
        this.ws.send(JSON.stringify(msg));
      } catch (err) {
        console.error('[WS] Failed to flush queued message:', err);
        this.outboundQueue.unshift(msg);
        return;
      }
    }
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
