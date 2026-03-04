import { AUTO, Game, Scale, Types } from "phaser";
import { Preloader } from "./preloader";
import { GameOverScene } from "./scenes/GameOverScene";
import { HudScene } from "./scenes/HudScene";
import { MainScene } from "./scenes/MainScene";
import { MenuScene } from "./scenes/MenuScene";
import { SplashScene } from "./scenes/SplashScene";

// More information about config: https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
const config: Types.Core.GameConfig = {
  type: AUTO,
  parent: "phaser-container",
  width: 960,
  height: 540,
  backgroundColor: "#1c172e",
  pixelArt: true,
  roundPixels: false,
  max: {
    width: 800,
    height: 600,
  },
  scale: {
    mode: Scale.FIT,
    autoCenter: Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
    },
  },
  scene: [
    Preloader,
    SplashScene,
    MainScene,
    MenuScene,
    HudScene,
    GameOverScene,
  ],
};

new Game(config);
