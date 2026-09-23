import Phaser from 'phaser';

export interface OptionRoomConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class OptionRoomGenerator {
  constructor(private scene: Phaser.Scene) {}

  create(config: OptionRoomConfig): Phaser.GameObjects.Container {
    const { x, y, width, height } = config;

    const container = this.scene.add.container(x, y);

    const floor = this.scene.add.rectangle(
      0,
      0,
      width,
      height,
      0x444444,
    );

    const topWall = this.scene.add.rectangle(
      0,
      -height / 2,
      width,
      16,
      0x111111,
    );

    const leftWall = this.scene.add.rectangle(
      -width / 2,
      0,
      16,
      height,
      0x111111,
    );

    const rightWall = this.scene.add.rectangle(
      width / 2,
      0,
      16,
      height,
      0x111111,
    );

    container.add([
      floor,
      topWall,
      leftWall,
      rightWall,
    ]);

    return container;
  }
}