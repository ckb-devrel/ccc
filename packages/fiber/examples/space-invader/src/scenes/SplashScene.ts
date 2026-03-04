import { Scene } from "phaser";

export class SplashScene extends Scene {
  constructor() {
    super("SplashScene");
  }

  init(): void {
    this.cameras.main.fadeIn(1000, 0, 0, 0);
  }

  create(): void {
    const logo = this.add.image(
      this.scale.width / 2,
      this.scale.height / 2,
      "logo",
    );
    // Add shine effect
    logo.postFX.addShine(1, 0.2, 5);

    this.time.addEvent({
      delay: 2000,
      callback: () => {
        const main_camera = this.cameras.main.fadeOut(1000, 0, 0, 0);
        // Fadeout complete
        main_camera.once("camerafadeoutcomplete", () => {
          this.scene.start("MainScene");
        });
      },
    });
  }
}
