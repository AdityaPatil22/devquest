export interface PlayerPosition {
  x: number;
  y: number;
}

export interface PlayerStateData {
  position: PlayerPosition;
  currentRoomId?: string;
  completedRooms: string[];
}

export class PlayerState {
  private data: PlayerStateData = {
    position: { x: 0, y: 0 },
    completedRooms: [],
  };

  reset(): void {
    this.data = {
      position: { x: 0, y: 0 },
      completedRooms: [],
    };
  }

  setPosition(x: number, y: number): void {
    this.data.position = { x, y };
  }

  setRoom(roomId: string | undefined): void {
    this.data.currentRoomId = roomId;
  }

  markRoomComplete(roomId: string): void {
    if (!this.data.completedRooms.includes(roomId)) {
      this.data.completedRooms.push(roomId);
    }
  }

  get position(): PlayerPosition {
    return { ...this.data.position };
  }

  get currentRoomId(): string | undefined {
    return this.data.currentRoomId;
  }

  get completedRooms(): string[] {
    return [...this.data.completedRooms];
  }

  snapshot(): PlayerStateData {
    return {
      position: this.position,
      currentRoomId: this.currentRoomId,
      completedRooms: this.completedRooms,
    };
  }
}
