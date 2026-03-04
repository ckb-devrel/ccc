import { GameObjects, Math, Scene } from "phaser";

export class Bullet extends GameObjects.Image {
  speed: number;
  flame?: GameObjects.Particles.ParticleEmitter;
  end_direction: Math.Vector2 = new Math.Vector2(0, 0);

  constructor(scene: Scene, x: number, y: number) {
    super(scene, x, y, "bullet");
    this.speed = Phaser.Math.GetSpeed(450, 1);
    this.postFX.addBloom(0xffffff, 1, 1, 2, 1.2);
    // Default bullet (player bullet)
    this.name = "bullet";
  }

  fire(
    x: number,
    y: number,
    targetX: number = 1,
    targetY: number = 0,
    bullet_texture: string = "bullet",
  ): void {
    // Change bullet change texture
    this.setTexture(bullet_texture);

    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);

    // Calculate direction towards target
    if (targetX === 1 && targetY === 0) {
      this.end_direction.setTo(1, 0);
    } else {
      this.end_direction.setTo(targetX - x, targetY - y).normalize();
    }
  }

  destroyBullet(): void {
    if (this.flame === undefined) {
      // Create particles for flame
      this.flame = this.scene.add.particles(this.x, this.y, "flares", {
        lifespan: 250,
        scale: { start: 1.5, end: 0, ease: "sine.out" },
        speed: 200,
        advance: 500,
        frequency: 20,
        blendMode: "ADD",
        duration: 100,
      });
      this.flame.setDepth(1);
      // When particles are complete, destroy them
      this.flame.once("complete", () => {
        if (this.flame) {
          this.flame.destroy();
        }
      });
    }

    // Destroy bullets
    this.setActive(false);
    this.setVisible(false);
    this.destroy();
  }

  // Update bullet position and destroy if it goes off screen
  update(_time: number, delta: number): void {
    this.x += this.end_direction.x * this.speed * delta;
    this.y += this.end_direction.y * this.speed * delta;

    // Check if the bullet has gone off screen
    if (
      this.x > this.scene.sys.canvas.width ||
      this.x < 0 ||
      this.y > this.scene.sys.canvas.height ||
      this.y < 0
    ) {
      this.setActive(false);
      this.setVisible(false);
      this.destroy();
    }
  }
}
