import { GameObjects, Physics, Scene } from "phaser";
import { Bullet } from "./Bullet";

interface PlayerConstructorParams {
  scene: Scene;
}

export class Player extends Physics.Arcade.Image {
  // Player states: waiting, start, can_move
  state: string = "waiting";
  propulsion_fire: GameObjects.Sprite | null = null;
  declare scene: Scene;
  bullets: Physics.Arcade.Group;

  constructor({ scene }: PlayerConstructorParams) {
    super(scene, -190, 100, "player");
    this.scene = scene;
    this.scene.add.existing(this);
    this.scene.physics.add.existing(this);

    this.propulsion_fire = this.scene.add.sprite(
      this.x - 32,
      this.y,
      "propulsion-fire",
    );
    this.propulsion_fire.play("fire");

    // Bullets group to create pool
    this.bullets = this.scene.physics.add.group({
      classType: Bullet,
      maxSize: 100,
      runChildUpdate: true,
    });
  }

  start(): void {
    this.state = "start";
    const propulsion_fires_trail: GameObjects.Sprite[] = [];

    // Effect to move the player from left to right
    this.scene.tweens.add({
      targets: this,
      x: 200,
      duration: 800,
      delay: 1000,
      ease: "Power2",
      yoyo: false,
      onUpdate: () => {
        // Just a little trail FX
        const propulsion = this.scene.add.sprite(
          this.x - 32,
          this.y,
          "propulsion-fire",
        );
        propulsion.play("fire");
        propulsion_fires_trail.push(propulsion);
      },
      onComplete: () => {
        // Destroy all the trail FX
        propulsion_fires_trail.forEach((propulsion, i) => {
          this.scene.tweens.add({
            targets: propulsion,
            alpha: 0,
            scale: 0.5,
            duration: 200 + i * 2,
            ease: "Power2",
            onComplete: () => {
              propulsion.destroy();
            },
          });
        });

        if (this.propulsion_fire) {
          this.propulsion_fire.setPosition(this.x - 32, this.y);
        }

        // When all tween are finished, the player can move
        this.state = "can_move";
      },
    });
  }

  move(direction: string): void {
    if (this.state === "can_move") {
      if (direction === "up" && this.y - 10 > 0) {
        this.y -= 5;
        this.updatePropulsionFire();
      } else if (
        direction === "down" &&
        this.y + 75 < this.scene.scale.height
      ) {
        this.y += 5;
        this.updatePropulsionFire();
      }
    }
  }

  fire(x?: number, y?: number): void {
    if (this.state === "can_move") {
      // Create bullet
      const bullet = this.bullets.get() as Bullet;
      if (bullet) {
        bullet.fire(this.x + 16, this.y + 5, x, y);
      }
    }
  }

  updatePropulsionFire(): void {
    if (this.propulsion_fire) {
      this.propulsion_fire.setPosition(this.x - 32, this.y);
    }
  }

  update(): void {
    // Sinusoidal movement up and down up and down 2px
    this.y += Math.sin(this.scene.time.now / 200) * 0.1;
    if (this.propulsion_fire) {
      this.propulsion_fire.y = this.y;
    }
  }
}
