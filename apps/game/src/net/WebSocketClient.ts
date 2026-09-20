import { WS_URL } from '../config';
import type {
  ClientMessage,
  ServerMessage,
} from './protocol';

type MessageHandler = (
  msg: ServerMessage,
) => void;

const SESSION_STORAGE_KEY =
  'devquest_session_id';

export class WebSocketClient {
  private ws?: WebSocket;

  private handlers: MessageHandler[] = [];

  private reconnectTimer?: ReturnType<
    typeof setTimeout
  >;

  private reconnectAttempts = 0;

  private maxReconnectAttempts = 10;

  private baseUrl: string;

  private _sessionId?: string;

  constructor(url?: string) {
    this.baseUrl = url ?? WS_URL;

    this._sessionId =
      sessionStorage.getItem(
        SESSION_STORAGE_KEY,
      ) ?? undefined;
  }

  get sessionId(): string | undefined {
    return this._sessionId;
  }

  setSessionId(id: string): void {
    this._sessionId = id;

    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      id,
    );
  }

  clearSession(): void {
    this._sessionId = undefined;

    sessionStorage.removeItem(
      SESSION_STORAGE_KEY,
    );
  }

  connect(): void {
    if (
      this.ws &&
      this.ws.readyState !== WebSocket.CLOSED
    ) {
      this.ws.onclose = null;
      this.ws.close();
    }

    try {
      const url = this._sessionId
        ? `${this.baseUrl}?session_id=${encodeURIComponent(
            this._sessionId,
          )}`
        : this.baseUrl;

      console.log(
        '[WS] Connecting:',
        url,
      );

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log(
          '[WS] Connected',
          this._sessionId
            ? `(session ${this._sessionId})`
            : '(new session)',
        );

        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const msg =
            JSON.parse(
              event.data,
            ) as ServerMessage;

          this.handlers.forEach(
            (handler) => handler(msg),
          );
        } catch (error) {
          console.error(
            '[WS] Failed to parse message:',
            error,
          );
        }
      };

      this.ws.onclose = () => {
        console.log(
          '[WS] Disconnected',
        );

        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error(
          '[WS] Error:',
          error,
        );
      };
    } catch (error) {
      console.error(
        '[WS] Connection failed:',
        error,
      );

      this.scheduleReconnect();
    }
  }

  send(msg: ClientMessage): void {
    if (
      this.ws?.readyState ===
      WebSocket.OPEN
    ) {
      this.ws.send(
        JSON.stringify(msg),
      );
    } else {
      console.warn(
        '[WS] Message dropped because socket is not connected:',
        msg.type,
      );
    }
  }

  onMessage(
    handler: MessageHandler,
  ): void {
    this.handlers.push(handler);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(
        this.reconnectTimer,
      );

      this.reconnectTimer =
        undefined;
    }

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = undefined;
    }
  }

  get connected(): boolean {
    return (
      this.ws?.readyState ===
      WebSocket.OPEN
    );
  }

  private scheduleReconnect(): void {
    if (
      this.reconnectAttempts >=
      this.maxReconnectAttempts
    ) {
      console.error(
        '[WS] Maximum reconnect attempts reached',
      );

      return;
    }

    const delay = Math.min(
      1000 *
        2 **
          this.reconnectAttempts,
      30000,
    );

    this.reconnectAttempts += 1;

    console.log(
      `[WS] Reconnecting in ${delay}ms`,
    );

    this.reconnectTimer =
      setTimeout(
        () => this.connect(),
        delay,
      );
  }
}