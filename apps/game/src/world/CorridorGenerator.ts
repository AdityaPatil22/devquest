import Phaser from 'phaser';

export interface CorridorConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class CorridorGenerator {
  constructor(private scene: Phaser.Scene) {}

  create(config: CorridorConfig): Phaser.GameObjects.Container {
    const { x, y, width, height } = config;

    const container = this.scene.add.container(x, y);

    const floor = this.scene.add.rectangle(
      0,
      0,
      width,
      height,
      0x333333,
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
      leftWall,
      rightWall,
    ]);

    return container;
  }
}