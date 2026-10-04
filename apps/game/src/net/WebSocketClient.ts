import { WS_URL } from '../config';
import type { ClientMessage, ServerMessage } from './protocol';

type MessageHandler = (msg: ServerMessage) => void;

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

type StatusHandler = (status: WebSocketStatus) => void;

const SESSION_STORAGE_KEY = 'devquest_session_id';

export class WebSocketClient {
  private ws?: WebSocket;

  private handlers: MessageHandler[] = [];

  private statusHandlers: StatusHandler[] = [];

  private reconnectTimer?: ReturnType<typeof setTimeout>;

  private reconnectAttempts = 0;

  private maxReconnectAttempts = 10;

  private baseUrl: string;

  private _sessionId?: string;

  private outboundQueue: ClientMessage[] = [];

  private _status: WebSocketStatus = 'disconnected';

  constructor(url?: string) {
    this.baseUrl = url ?? WS_URL;

    this._sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY) ?? undefined;
  }

  get sessionId(): string | undefined {
    return this._sessionId;
  }

  get status(): WebSocketStatus {
    return this._status;
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

    this.setStatus('connecting');

    try {
      const url = this._sessionId
        ? `${this.baseUrl}?session_id=${encodeURIComponent(this._sessionId)}`
        : this.baseUrl;

      console.log('[WS] Connecting:', url);

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log(
          '[WS] Connected',
          this._sessionId ? `(session ${this._sessionId})` : '(new session)',
        );

        this.reconnectAttempts = 0;

        this.setStatus('connected');

        this.flushQueue();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;

          this.handlers.forEach((handler) => handler(msg));
        } catch (error) {
          console.error('[WS] Failed to parse message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected');

        this.setStatus('disconnected');

        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);

        this.setStatus('error');
      };
    } catch (error) {
      console.error('[WS] Connection failed:', error);

      this.setStatus('error');

      this.scheduleReconnect();
    }
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch (error) {
        console.error('[WS] Failed to send message, queued for retry:', error);

        this.outboundQueue.push(msg);
      }

      return;
    }

    console.log('[WS] Socket not open, queueing message:', msg.type);

    this.outboundQueue.push(msg);
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.push(handler);

    return () => {
      const index = this.handlers.indexOf(handler);

      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.push(handler);

    handler(this._status);

    return () => {
      const index = this.statusHandlers.indexOf(handler);

      if (index !== -1) {
        this.statusHandlers.splice(index, 1);
      }
    };
  }

  protected dispatch(msg: ServerMessage): void {
    this.handlers.forEach((handler) => handler(msg));
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

    this.setStatus('disconnected');
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private setStatus(status: WebSocketStatus): void {
    if (this._status === status) {
      return;
    }

    this._status = status;

    this.statusHandlers.forEach((handler) => handler(status));
  }

  private flushQueue(): void {
    while (this.ws?.readyState === WebSocket.OPEN && this.outboundQueue.length > 0) {
      const msg = this.outboundQueue.shift();

      if (!msg) {
        return;
      }

      try {
        this.ws.send(JSON.stringify(msg));
      } catch (error) {
        console.error('[WS] Failed to flush queued message:', error);

        this.outboundQueue.unshift(msg);

        return;
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Maximum reconnect attempts reached');

      return;
    }

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);

    this.reconnectAttempts += 1;

    console.log(`[WS] Reconnecting in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
