export type RoomGenerationStatus = 'idle' | 'generating' | 'ready' | 'error';

export interface RoomGenerationSnapshot {
  readonly status: RoomGenerationStatus;
  readonly error?: string;
}

export class RoomGenerationState {
  private _status: RoomGenerationStatus = 'idle';
  private _error?: string;

  get status(): RoomGenerationStatus {
    return this._status;
  }

  get error(): string | undefined {
    return this._error;
  }

  get snapshot(): RoomGenerationSnapshot {
    return {
      status: this._status,
      error: this._error,
    };
  }

  begin(): boolean {
    if (this._status === 'generating') {
      return false;
    }

    this._status = 'generating';
    this._error = undefined;
    return true;
  }

  ready(): void {
    this._status = 'ready';
    this._error = undefined;
  }

  fail(error: unknown): void {
    this._status = 'error';
    this._error = error instanceof Error ? error.message : String(error);
  }

  reset(): void {
    this._status = 'idle';
    this._error = undefined;
  }
}
