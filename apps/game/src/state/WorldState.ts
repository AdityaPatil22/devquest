export interface GeneratedRoomState {
  id: string;
  mapKey: string;
  kind: 'corridor' | 'decision' | 'trophy' | 'random';
  variant?: string;
  order: number;
  generatedAt: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface WorldStateData {
  rooms: GeneratedRoomState[];
  currentRoomId?: string;
  progressionIndex: number;
}

export class WorldState {
  private data: WorldStateData = {
    rooms: [],
    progressionIndex: 0,
  };

  reset(): void {
    this.data = {
      rooms: [],
      progressionIndex: 0,
    };
  }

  registerRoom(room: GeneratedRoomState): void {
    const existing = this.data.rooms.find((item) => item.id === room.id);

    if (existing) {
      Object.assign(existing, room);
    } else {
      this.data.rooms.push({ ...room });
    }

    this.data.currentRoomId = room.id;
  }

  setCurrentRoom(roomId: string | undefined): void {
    this.data.currentRoomId = roomId;
  }

  advanceProgression(): void {
    this.data.progressionIndex += 1;
  }

  setProgressionIndex(index: number): void {
    this.data.progressionIndex = Math.max(0, index);
  }

  get rooms(): GeneratedRoomState[] {
    return this.data.rooms.map((room) => ({
      ...room,
      metadata: room.metadata ? { ...room.metadata } : undefined,
    }));
  }

  get currentRoomId(): string | undefined {
    return this.data.currentRoomId;
  }

  get progressionIndex(): number {
    return this.data.progressionIndex;
  }

  snapshot(): WorldStateData {
    return {
      rooms: this.rooms,
      currentRoomId: this.currentRoomId,
      progressionIndex: this.progressionIndex,
    };
  }
}
