import { GameObjects, Scene } from "phaser";

interface HudSceneInitData {
  remaining_time: number;
}

// The HUD scene is the scene that shows the points and the remaining time.
export class HudScene extends Scene {
  remaining_time: number = 0;

  remaining_time_text!: GameObjects.BitmapText;
  points_text!: GameObjects.BitmapText;

  constructor() {
    super("HudScene");
  }

  init(data: HudSceneInitData): void {
    this.cameras.main.fadeIn(1000, 0, 0, 0);
    this.remaining_time = data.remaining_time;
  }

  create(): void {
    this.points_text = this.add.bitmapText(
      10,
      10,
      "pixelfont",
      "POINTS:0000",
      24,
    );
    this.remaining_time_text = this.add
      .bitmapText(
        this.scale.width - 10,
        10,
        "pixelfont",
        `REMAINING:${this.remaining_time}s`,
        24,
      )
      .setOrigin(1, 0);
  }

  update_points(points: number): void {
    this.points_text.setText(`POINTS:${points.toString().padStart(4, "0")}`);
  }

  update_timeout(timeout: number): void {
    this.remaining_time_text.setText(
      `REMAINING:${timeout.toString().padStart(2, "0")}s`,
    );
  }
}
