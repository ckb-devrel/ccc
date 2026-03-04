import { Math, Physics, Scene, Tweens } from "phaser";
import { Bullet } from "./Bullet";

export class BlueEnemy extends Physics.Arcade.Sprite {
  declare scene: Scene;
  animation_is_playing: boolean = false;
  damage_life_point: number = 3;
  scale_damage: number = 4;
  up_down_tween: Tweens.Tween | null = null;

  bullets: Physics.Arcade.Group;

  constructor(scene: Scene) {
    super(
      scene,
      scene.scale.width + 150,
      scene.scale.height - 100,
      "enemy-blue",
    );
    this.scene = scene;
    this.scene.add.existing(this);
    this.scene.physics.add.existing(this);
    this.setScale(4);
    if (this.body) {
      this.body.setSize(15, 15);
    }

    this.up_down_tween = this.scene.tweens.add({
      targets: this,
      y: 85,
      duration: 1000,
      ease: Math.Easing.Sine.InOut,
      yoyo: true,
      repeat: -1,
    });
    this.up_down_tween.pause();

    // Bullets group
    this.bullets = this.scene.physics.add.group({
      classType: Bullet,
      maxSize: 100,
      runChildUpdate: true,
    });
  }

  start(): void {
    // Enter from right to left
    this.scene.tweens.add({
      targets: this,
      x: this.scene.scale.width - 150,
      duration: 1000,
      delay: 1000,
      ease: "Power2",
      onComplete: () => {
        if (this.up_down_tween) {
          this.up_down_tween.resume();
        }
      },
    });
  }

  damage(player_x: number, player_y: number): void {
    const bullet = this.bullets.get() as Bullet;
    if (bullet) {
      bullet.fire(this.x, this.y, player_x, player_y, "enemy-bullet");
    }

    this.anims.play("hit");
    if (!this.animation_is_playing && this.scale_damage > 1) {
      if (this.damage_life_point === 0) {
        this.animation_is_playing = true;
        this.scene.tweens.add({
          targets: this,
          scale: --this.scale_damage,
          duration: 500,
          ease: "Elastic.In",
          onComplete: () => {
            this.damage_life_point = 10;
            this.animation_is_playing = false;
          },
        });
      } else {
        this.damage_life_point--;
      }
    }

    // Add more difficulty
    if (this.up_down_tween) {
      this.up_down_tween.timeScale = 1 + (3 - this.scale_damage) / 2;
      if (this.scale_damage === 1) {
        // Use ease property instead of setEasing method
        (this.up_down_tween as any).ease = "Power2";
        // Store custom property on the tween
        (this.up_down_tween as any).x = 10;
      }
    }
  }

  update(): void {
    // Any update logic can be added here
  }
}
