// The field menu (Esc / X): party summary, Items, Status, Story, Quests, Teleport, Save.
/* global Phaser */
import { G, save } from "./state.js";
import { mapFor, areaOf, areaLabel, cityId } from "./world.js";
import { fetchAtlas, atlasCached, suggestions } from "./anansi.js";
import { cleanDest } from "./atlas.js";
import { ensureCity } from "./travel.js";
import { ACTS, objective } from "./story.js";
import { REGIONS, REGION_IDS } from "./regions.js";
import { settings, setMuted, cycleVolume, sfx } from "./audio.js";
import { ITEMS, SKILLS, HEROES, xpToNext, useItem, EQUIP, SLOTS, SLOT_NAMES, canEquip, equip, unequip, preview, bonusText } from "./rules.js";
import { W, H, drawWindow, text, choose, say, prompt, waitFor } from "./ui.js";

export class Menu extends Phaser.Scene {
  constructor() { super("menu"); }

  create() {
    this.add.rectangle(0, 0, W, H, 0x000000, 0.35).setOrigin(0);
    drawWindow(this, 8, 8, 470, H - 16);
    this.summary = text(this, 26, 24, "", { lineSpacing: 6 });
    drawWindow(this, 486, H - 64, 146, 56);
    this.goldTxt = text(this, 500, H - 48, "");
    this.loop();
  }

  draw() {
    this.summary.setText(G.s.party.map(h =>
      `${h.name}   Lv ${h.lvl}\n  HP ${h.hp}/${h.maxhp}   MP ${h.mp}/${h.maxmp}\n  next level in ${xpToNext(h.lvl) - h.xp} XP\n`).join("\n"));
    this.goldTxt.setText(`${G.s.gold} G`);
  }

  async loop() {
    for (;;) {
      this.draw();
      const k = await choose(this, 486, 8, 146, ["Items", "Equip", "Status", "Story", "Quests", "Teleport", "Sound", "Save", "Close"]);
      if (k === 0) await this.items();
      else if (k === 1) await this.equipment();
      else if (k === 2) await this.status();
      else if (k === 3) await this.story();
      else if (k === 4) await this.quests();
      else if (k === 5) { if (await this.teleport()) return; }
      else if (k === 6) await this.soundPage();
      else if (k === 7) { const ok = save(); if (ok) sfx("save"); await say(this, "", ok ? "Game saved." : "Could not save (browser storage is blocked)."); }
      else return this.close();
    }
  }

  async items() {
    for (;;) {
      const ids = Object.keys(G.s.items).filter(id => G.s.items[id] > 0);
      if (!ids.length) return say(this, "", "No items.");
      const help = text(this, 26, H - 40, "");
      const k = await choose(this, 250, 40, 220, ids.map(id => `${ITEMS[id].name.padEnd(9)} x${G.s.items[id]}`), { onMove: i => help.setText(ITEMS[ids[i]].desc) });
      help.destroy();
      if (k < 0) return;
      const who = await choose(this, 250, 160, 220, G.s.party.map(h => ({ label: `${h.name} ${h.hp}/${h.maxhp}`, disabled: h.hp <= 0 })));
      if (who >= 0 && useItem(ids[k], G.s.party[who])) G.s.items[ids[k]]--;
      this.draw();
    }
  }

  async status() {
    for (const h of G.s.party) {
      await say(this, h.name, `Lv ${h.lvl}  ATK ${h.atk}  MAG ${h.mag}  DEF ${h.def}  SPD ${h.spd}\nGear: ${SLOTS.map(k => (h.eq?.[k] ? EQUIP[h.eq[k]].name : "-")).join(", ")}\nSkills: ${HEROES[h.id].skills.map(s => SKILLS[s].name).join(", ")}`);
    }
  }

  /** Equip: pick a hero, a slot, then a piece from the gear bag. The stats show what would change before you choose. */
  async equipment() {
    this.summary.setVisible(false); // text is drawn above every window, so the party summary would show through
    const win = drawWindow(this, 8, 8, 470, H - 16);
    let objs = [];
    const clear = () => { objs.forEach(o => o.destroy()); objs = []; };
    // `slot` and `id`: preview that piece in that slot (id null: the slot emptied). `slots`: draw the three slots; `note`: a line under the list.
    const show = (h, { slot, id, slots = true, note = "" } = {}) => {
      clear();
      const p = slot ? preview(h, slot, id) : h;
      objs.push(text(this, 26, 20, `${h.name}   Lv ${h.lvl}`, { color: "#ffd76a" }));
      if (slots) SLOTS.forEach((s, i) => {
        const piece = p.eq?.[s], y = 46 + i * 58;
        objs.push(text(this, 26, y + 2, SLOT_NAMES[s], { fontSize: "11px", color: "#9aa3d8" }));
        if (piece) {
          objs.push(this.add.image(46, y + 36, "icon-" + piece).setScale(1.5).setScrollFactor(0).setDepth(10002));
          objs.push(text(this, 76, y + 20, EQUIP[piece].name), text(this, 76, y + 38, bonusText(piece), { fontSize: "12px", color: "#9fd3ff" }));
        } else objs.push(text(this, 76, y + 28, "-", { color: "#7f86a8" }));
      });
      if (note) objs.push(text(this, 26, 190, note, { fontSize: "12px", color: "#c8d0ff", wordWrap: { width: 430 } }));
      [["atk", "ATK"], ["mag", "MAG"], ["def", "DEF"], ["spd", "SPD"], ["maxhp", "HP"], ["maxmp", "MP"]].forEach(([k, label], i) => {
        const now = h[k], then = p[k], x = 26 + (i % 3) * 145, y = 250 + Math.floor(i / 3) * 24;
        objs.push(text(this, x, y, then === now ? `${label} ${now}` : `${label} ${now} > ${then}`, { color: then > now ? "#7dff9a" : then < now ? "#ff8a8a" : "#ffffff" }));
      });
    };
    for (;;) {
      const hi = await choose(this, 486, 8, 146, [...G.s.party.map(h => h.name), "Back"], { onMove: i => G.s.party[i] && show(G.s.party[i]) });
      if (hi < 0 || hi === G.s.party.length) break;
      const h = G.s.party[hi];
      let at = 0;
      for (;;) {
        show(h);
        const si = await choose(this, 486, 8, 146, [...SLOTS.map(s => SLOT_NAMES[s]), "Back"], { start: at });
        if (si < 0 || si === SLOTS.length) break;
        at = si;
        const slot = SLOTS[si], worn = h.eq?.[slot];
        const opts = [...(worn ? [{ id: null, label: "Take off" }] : []),
          ...Object.keys(G.s.gear).filter(id => G.s.gear[id] > 0 && EQUIP[id].slot === slot && canEquip(h, id)).map(id => ({ id, label: `${EQUIP[id].name}  x${G.s.gear[id]}` }))];
        if (!opts.length) { await say(this, "", `Nothing in the bag fits ${h.name}'s ${SLOT_NAMES[slot].toLowerCase()} slot.`); continue; }
        const note = o => (o.id ? `${bonusText(o.id)}. ${EQUIP[o.id].desc}` : `Take off the ${EQUIP[worn].name}.`);
        show(h, { slot, id: opts[0].id, slots: false, note: note(opts[0]) });
        const k = await choose(this, 20, 46, 300, opts.map(o => o.label), { onMove: i => show(h, { slot, id: opts[i].id, slots: false, note: note(opts[i]) }) });
        if (k >= 0) { if (opts[k].id) equip(G.s, h, opts[k].id); else unequip(G.s, h, slot); }
      }
    }
    clear(); win.destroy();
    this.summary.setVisible(true);
    this.draw();
  }

  async soundPage() {
    const bar = v => "█".repeat(Math.round(v * 3)) + "░".repeat(3 - Math.round(v * 3));
    let at = 0;
    for (;;) {
      const k = await choose(this, 250, 40, 260, [`Music    ${bar(settings.music)}`, `Effects  ${bar(settings.sfx)}`, `Sound    ${settings.muted ? "off" : "on"}  (M)`, "Back"], { start: at });
      if (k < 0 || k === 3) return;
      at = k;
      if (k === 2) setMuted(!settings.muted); else cycleVolume(k === 0 ? "music" : "sfx");
    }
  }

  async story() {
    const p = G.s.plot;
    const lines = [ACTS[p.act] || ACTS[1], "", objective(p)];
    if (p.act === 2) lines.push("", `Relays destroyed: ${p.relays.length ? p.relays.join(", ") : "none yet"}`);
    if (p.act >= 3 && p.act < 5) lines.push("", ...REGION_IDS.map(id => `${p.sites[id] ? "✔" : "·"} ${REGIONS[id].name}: ${REGIONS[id].ally}, held in ${REGIONS[id].anchor}`));
    await this.page(lines.join("\n"));
  }

  /** A full-width page of text until Back. The party summary is hidden meanwhile: text is drawn above every window, so it would show through. */
  async page(body) {
    this.summary.setVisible(false);
    const win = drawWindow(this, 8, 8, 470, H - 16);
    const t = text(this, 26, 24, body, { wordWrap: { width: 430 }, lineSpacing: 6 });
    await choose(this, 486, H - 140, 146, ["Back"]);
    win.destroy(); t.destroy();
    this.summary.setVisible(true);
  }

  async quests() {
    const a = G.s.quest;
    if (!a) return say(this, "", `No quest right now. ${G.s.questsDone ? `Finished: ${G.s.questsDone}. ` : ""}Ines in Old Town, and the first local you meet in a new city, often have work.`);
    const spots = areaOf(a.area).itemSpots;
    const where = s => (s.objective === "fetch" && spots[s.target_id] ? ` (${mapFor(spots[s.target_id][0]).name})` : "");
    const steps = a.q.steps.map((s, i) => `${i < a.step ? "✔" : i === a.step ? "▶" : "·"} ${s.description}${where(s)}`).join("\n");
    await this.page(`${a.q.title} (${areaLabel(a.area)})\n\n${a.q.summary}\n\n${steps}`);
  }

  /** The World Map: pick a region, then one of its places (its anchor city first; "More" shows others). Returns {dest} or null. */
  async worldMap() {
    const plot = G.s.plot, ids = REGION_IDS;
    const mark = id => (plot.act >= 3 ? (plot.sites[id] ? "  ✔" : "  !") : "");
    const r = await choose(this, 250, 40, 260, [...ids.map(id => REGIONS[id].name + mark(id)), "Back"]);
    if (r < 0 || r === ids.length) return null;
    const R = REGIONS[ids[r]], visited = Object.keys(G.s.cities).map(d => d.toLowerCase());
    let offset = 0;
    for (;;) {
      const rest = R.places.filter(p => p !== R.anchor), pick = Array.from({ length: Math.min(6, rest.length) }, (_, i) => rest[(offset + i) % rest.length]);
      const entries = [R.anchor, ...pick].map((d, i) => ({ dest: d, label: `${i === 0 ? "★ " : ""}${d}${visited.includes(d.toLowerCase()) ? " •" : atlasCached(d) ? " ✦" : ""}` }));
      const help = text(this, 26, H - 40, `${R.blurb} ★ anchor city, • visited.`, { fontSize: "12px" });
      const k = await choose(this, 250, 40, 260, [...entries, { label: "More places…" }, "Back"]);
      help.destroy();
      if (k < 0 || k === entries.length + 1) return null;
      if (k === entries.length) { offset += 6; continue; }
      return { dest: entries[k].dest };
    }
  }

  /** Teleport: to Old Town, a city you have been to, a place from the World Map, or a new place named by the player. Returns true if the party left. */
  async teleport() {
    const here = G.s.map, plot = G.s.plot;
    const entries = [{ label: "World Map", world: true }, { label: "Type a place…" },
      ...(plot.spire && here !== "spire" ? [{ label: "Directorate Spire", map: "spire" }] : []),
      ...(plot.act === 4 && !G.s.flags.vesper && here !== "site:gate" ? [{ label: "The Rift Gate", map: "site:gate" }] : []),
      ...(here === "world" ? [] : [{ label: "The Wide World", map: "world" }]),
      ...(here === "town" ? [] : [{ label: "Old Town", map: "town" }]),
      ...Object.keys(G.s.cities).filter(d => cityId(d) !== here).slice(-6).map(d => ({ label: d.slice(0, 20), map: cityId(d) }))];
    const k = await choose(this, 250, 40, 220, entries.map(e => e.label));
    if (k < 0) return false;
    let map = entries[k].map, dest = null;
    if (entries[k].world) { const w = await this.worldMap(); if (!w) return false; dest = w.dest; }
    else if (!map) dest = cleanDest((await prompt(this, "Where to? Any real place on Earth:")) || "");
    if (!map) {
      if (!dest) return false;
      map = await ensureCity(this, dest);
    }
    if (map.startsWith("site:")) G.s.siteFrom = here;
    this.close();
    this.scene.get("field").teleportTo(map);
    return true;
  }

  close() {
    this.scene.stop();
    this.scene.resume("field");
  }
}
