// Waypoint, milestone 1 (vertical slice): boot, title and lead choice; the rest lives in field/battle/menu.js.
/* global Phaser */
import { W, H, FONT, drawWindow, choose } from "./ui.js";
import { G, start, load, hasSave } from "./state.js";
import { Field } from "./field.js";
import { Battle } from "./battle.js";
import { Menu } from "./menu.js";
import { Ending } from "./ending.js";
import { EQUIP, ENEMIES, SKILLS } from "./rules.js";
import { HOUSES } from "./data.js";
import { preloadAudio, initAudio, music } from "./audio.js";

const DIRS = ["up", "left", "down", "right"]; // LPC row order
const LEADS = ["lead_m", "lead_f"];
const TILES = ["grass", "ground_sand", "ground_snow", "ground_lush", "flagstone", "road", "road_line", "sidewalk", "cobble", "brick", "house", "tree", "pine", "gate", "chest", "dungeon_wall", "battle_town", "battle_dungeon", ...["dunes", "desert", "beach", "snow", "forest", "ruins", "meadow", "castle"].flatMap(n => [`battle_${n}`, `battle_${n}_night`]), "battle_town_night", "water", "water_ice", "water_lagoon", "plank", "barrel", "barrels", ...HOUSES];
const ENEMY_IMGS = [...new Set(Object.entries(ENEMIES).map(([id, e]) => e.sprite || id))];

class Boot extends Phaser.Scene {
  constructor() { super("boot"); }
  preload() {
    preloadAudio(this);
    this.load.json("cast", "assets/sprites/manifest.json");
    this.load.once("filecomplete-json-cast", (_k, _t, cast) => {
      for (const [id, c] of Object.entries(cast))
        for (const anim of Object.keys(c.anims)) this.load.spritesheet(`${id}-${anim}`, `assets/sprites/${id}/${anim}.png`, { frameWidth: 64, frameHeight: 64 });
    });
    for (const id of [...Object.keys(EQUIP), ...Object.keys(SKILLS).map(k => "skill_" + k)]) this.load.image("icon-" + id, `assets/icons/${id}.png`); // equipment icons, 24x24
    for (const id of ["sora", "ilse", "oluwa", "vesper", "kessler", "director"]) this.load.image("face-" + id, `assets/portraits/${id}.png`); // speaker portraits, 64x64
    for (const t of TILES) this.load.image(`tile-${t}`, `assets/tiles/${t}.png`);
    for (const e of ENEMY_IMGS) this.load.image(`enemy-${e}`, `assets/enemies/${e}.png`);
  }
  create() {
    for (const [id, c] of Object.entries(this.cache.json.get("cast"))) {
      const n = c.anims.walk.frames;
      DIRS.forEach((d, row) => {
        // frame 0 of each walk row is the standing pose; 1..8 are the cycle
        this.anims.create({ key: `${id}-walk-${d}`, frames: this.anims.generateFrameNumbers(`${id}-walk`, { start: row * n + 1, end: row * n + n - 1 }), frameRate: 10, repeat: -1 });
      });
      for (const a of ["slash", "thrust", "spellcast"]) {
        if (!c.anims[a]) continue;
        const m = c.anims[a].frames; // battle uses the left-facing row
        this.anims.create({ key: `${id}-${a}-left`, frames: this.anims.generateFrameNumbers(`${id}-${a}`, { start: m, end: 2 * m - 1 }), frameRate: 14 });
      }
    }
    initAudio(this.game);
    this.scene.launch("sound");
    this.scene.start("title");
  }
}

class Sound extends Phaser.Scene { constructor() { super("sound"); } } // runs all the time: owns the music loader and the fades

class Title extends Phaser.Scene {
  constructor() { super("title"); }
  async create() {
    this.add.text(W / 2, 100, "WAYPOINT", { ...FONT, fontSize: "48px", color: "#ffd76a", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5);
    this.add.text(W / 2, 150, "You can be anywhere you can picture.", { ...FONT, color: "#c8d0ff" }).setOrigin(0.5);
    music("title");
    this.add.text(W / 2, H - 14, "M: sound on / off", { ...FONT, fontSize: "11px", color: "#8890c0" }).setOrigin(0.5);
    const saved = hasSave();
    const k = await choose(this, W / 2 - 80, 200, 160, [saved ? "Continue" : { label: "Continue", disabled: true }, "New Game"], { cancel: false });
    if (k === 0 && load()) this.scene.start("field", {});
    else this.scene.start("lead");
  }
}

class LeadSelect extends Phaser.Scene {
  constructor() { super("lead"); }
  create() {
    const cast = this.cache.json.get("cast");
    this.add.text(W / 2, 40, "Who do you play?", { ...FONT, fontSize: "22px", color: "#ffd76a" }).setOrigin(0.5);
    this.add.text(W / 2, 66, "The other one travels with you.", { ...FONT, fontSize: "13px", color: "#c8d0ff" }).setOrigin(0.5);
    this.pick = Math.max(0, LEADS.indexOf(lastLead()));
    this.cards = LEADS.map((id, i) => {
      const x = W / 2 + (i ? 110 : -110);
      drawWindow(this, x - 85, 95, 170, 200).setDepth(0);
      const s = this.add.sprite(x, 185, `${id}-walk`, 2 * cast[id].anims.walk.frames).setScale(2.5);
      const name = this.add.text(x, 268, cast[id].name, { ...FONT, fontSize: "18px" }).setOrigin(0.5);
      s.setInteractive({ useHandCursor: true }).on("pointerdown", () => (this.pick === i ? this.confirm() : this.select(i)));
      return { id, s, name };
    });
    this.cursor = this.add.text(0, 268, "▶", { ...FONT, fontSize: "18px", color: "#ffd76a" }).setOrigin(0.5);
    this.add.text(W / 2, 330, "← → choose   Enter confirm", { ...FONT, fontSize: "12px", color: "#8890c0" }).setOrigin(0.5);
    this.input.keyboard.on("keydown-LEFT", () => this.select(0));
    this.input.keyboard.on("keydown-RIGHT", () => this.select(1));
    this.input.keyboard.on("keydown-ENTER", () => this.confirm());
    this.input.keyboard.on("keydown-SPACE", () => this.confirm());
    this.select(this.pick);
  }
  select(i) {
    this.pick = i;
    const cast = this.cache.json.get("cast");
    this.cards.forEach((c, j) => {
      c.s.setAlpha(i === j ? 1 : 0.45);
      i === j ? c.s.play(`${c.id}-walk-down`, true) : c.s.stop().setFrame(2 * cast[c.id].anims.walk.frames);
    });
    this.cursor.setX(this.cards[i].name.x - this.cards[i].name.width / 2 - 14);
  }
  confirm() {
    try { localStorage.setItem("waypoint.lead", LEADS[this.pick]); } catch { /* private mode */ }
    start(LEADS[this.pick]);
    this.scene.start("field", {});
  }
}
const lastLead = () => { try { return localStorage.getItem("waypoint.lead"); } catch { return null; } };

window.game = new Phaser.Game({ // on window for debugging from the console
  type: Phaser.AUTO, parent: "game", width: W, height: H, pixelArt: true, backgroundColor: "#05060c",
  dom: { createContainer: true }, // the NPC text box is a real <input>
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [Boot, Title, LeadSelect, Field, Battle, Menu, Ending, Sound] });
window.G = G;
