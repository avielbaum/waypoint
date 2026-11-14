// The ending: an epilogue written by Anansi from the cities you visited, a summary of the journey, and what to do next.
/* global Phaser */
import { G, save } from "./state.js";
import { W, FONT, drawWindow, text, say, choose, waitFor } from "./ui.js";
import { epilogue } from "./anansi.js";
import { ENDINGS, RELAYS_NEEDED } from "./story.js";
import { music } from "./audio.js";

export class Ending extends Phaser.Scene {
  constructor() { super("ending"); }

  async create() {
    this.cameras.main.fadeIn(600);
    music("ending", 1500);
    this.add.text(W / 2, 64, "THE END", { ...FONT, fontSize: "40px", color: "#ffd76a", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5);
    const plot = G.s.plot, cities = Object.keys(G.s.cities), [lead, mate] = G.s.party;
    await say(this, "", await waitFor(this, epilogue(plot.ending, cities), "The story settles"));
    drawWindow(this, 60, 110, W - 120, 150);
    text(this, 80, 124, [`Ending: ${ENDINGS[plot.ending]}`, `Route: ${["Old Town", ...cities].join(" > ")}`,
      `Relays destroyed: ${Math.min(plot.relays.length, RELAYS_NEEDED)}   Side quests done: ${G.s.questsDone}`, `${lead.name} Lv ${lead.lvl}   ${mate.name} Lv ${mate.lvl}`].join("\n"),
    { wordWrap: { width: W - 160 }, lineSpacing: 8 });
    const k = await choose(this, W / 2 - 90, 280, 180, ["Keep exploring", "Title screen"], { cancel: false });
    G.s.map = "town"; G.s.pos = null; // the world stays open: teleport anywhere, or finish the side quests
    save();
    this.scene.start(k === 0 ? "field" : "title", {});
  }
}
