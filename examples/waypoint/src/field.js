// The walking scene: one class for every map, whether written in data.js or generated for a city (city.js).
/* global Phaser */
import { STAMPS, TALK } from "./data.js";
import { mapFor, areaOf, areaLabel } from "./world.js";
import { ensureCity } from "./travel.js";
import { ENCOUNTERS } from "./city.js";
import { worldSpot } from "./overworld.js";
import { G } from "./state.js";
import { ITEMS, ENEMIES, HEROES, EQUIP, SHOP_GEAR, SHOP_GEAR2, WARDEN_GEAR, RELAY_GEAR, SITE_GEAR, addGear, joinParty, leaveParty, unequip, bonusText, questStep, payQuest, canGift, markGift, resetGifts } from "./rules.js";
import { BEATS, SITE_BEATS, ENDINGS, destroyRelay, completeSite, banter } from "./story.js";
import { REGIONS, REGION_IDS } from "./regions.js";
import { hash } from "./atlas.js";
import { sfx, music, musicPush, musicPop } from "./audio.js";
import { W, H, drawWindow, text, talk, choose, say, prompt, waitFor } from "./ui.js";
import { ask, prefetchQuest, takeQuest, warmAtlases, suggestions } from "./anansi.js";

const T = 32, DIRS = ["up", "left", "down", "right"], SPEED = 110;
const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const feet = (tx, ty) => ({ x: tx * T + 16, y: ty * T + 28 });
const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Field extends Phaser.Scene {
  constructor() { super("field"); }

  init(d) { this.mapId = d.map || G.s.map; this.at = d.at || G.s.pos || feet(...mapFor(this.mapId).spawn); }

  create() {
    const M = (this.M = mapFor(this.mapId));
    this.area = areaOf(this.mapId);
    G.s.map = this.mapId;
    this.busy = false; this.marker = null; this.leaving = false; // Phaser reuses this object when a map restarts: clear the last visit's state
    this.cast = this.cache.json.get("cast");
    this.solids = [];
    this.things = []; // things you can face and press confirm at: {box, act}
    this.add.tileSprite(0, 0, M.w * T, M.h * T, `tile-${M.ground}`).setOrigin(0).setDepth(-10).setTint(M.tints?.ground ?? 0xffffff);
    for (const [tex, x, y, w, h, solid] of M.paint) {
      this.add.tileSprite(x * T, y * T, w * T, h * T, `tile-${tex}`).setOrigin(0).setDepth(-9).setTint(tex === "cobble" ? M.tints?.paving ?? 0xffffff : 0xffffff);
      if (solid) this.solids.push({ x: x * T, y: y * T, w: w * T, h: h * T });
    }
    for (const [key, tx, ty, opt = {}] of M.objects) this.addStamp(key, tx, ty, opt);
    for (const [s, tx, ty] of M.labels || []) this.add.text(tx * T, ty * T, s, { fontFamily: "monospace", fontSize: "11px", color: "#fff", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(5000);
    for (const n of M.npcs || []) this.addNpc(n);
    if (M.relay) this.addRelay(M.relay);
    if (M.rift) this.addRift(M.rift);
    for (const pad of M.pads || []) this.addPad(pad);
    if (M.boss && !G.s.flags[M.boss.flag]) {
      const p = feet(M.boss.x, M.boss.y);
      this.bossImg = this.add.image(p.x, p.y, `enemy-${ENEMIES[M.boss.enemy].sprite || M.boss.enemy}`).setOrigin(0.5, 1).setDepth(p.y);
      this.solids.push((this.bossBox = { x: p.x - 24, y: p.y - 16, w: 48, h: 16 }));
    }

    if (this.blocked(this.at.x, this.at.y)) this.at = feet(...M.spawn); // a saved spot can end up inside something if a city's layout changed between versions

    const [lead, mate] = G.s.party.map(h => h.id);
    this.hero = this.addActor(lead, this.at.x, this.at.y, "down");
    this.mate = this.addActor(mate, this.at.x, this.at.y - 24, "down"); // a step behind (north of) the lead
    this.hero.s.setDepth(this.at.y + 0.5); this.mate.s.setDepth(this.at.y - 24);
    const g = G.s.party[2]; // a freed jumper travelling with the party, a step behind the companion
    this.guest = g ? this.addActor(g.id, this.at.x, this.at.y - 48, "down") : null;
    this.trail = [];
    this.cameras.main.setBounds(0, 0, M.w * T, M.h * T).startFollow(this.hero.s, true).setRoundPixels(true);
    this.keys = this.input.keyboard.addKeys("UP,DOWN,LEFT,RIGHT,W,A,S,D", false); // no key capture: the NPC text box needs W/A/S/D
    this.input.keyboard.on("keydown", e => this.onKey(e.key));
    this.inZone = this.zonesAt(this.hero.s).length > 0; // arriving on an exit does not bounce you back
    this.nextFight = this.fightGap();
    this.events.on("resume", () => { this.input.keyboard.resetKeys(); });
    this.cameras.main.fadeIn(250);
    music(M.music);
    const banner = this.add.text(W / 2, 30, M.name, { fontFamily: "monospace", fontSize: "18px", color: "#fff", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setScrollFactor(0).setDepth(9000);
    this.tweens.add({ targets: banner, alpha: 0, delay: 1500, duration: 600, onComplete: () => banner.destroy() });
    if (G.s.pending) { const p = G.s.pending; G.s.pending = null; this.run(() => this.pendingScene(p)); }
    else if (M.intro && !G.s.flags[M.intro]) { G.s.flags[M.intro] = true; this.run(() => this.lines(TALK[M.intro])); }
    else if (M.arrival && !G.s.flags[`seen:${this.mapId}`]) { G.s.flags[`seen:${this.mapId}`] = true; this.run(() => this.lines(BEATS[M.arrival])); }
    else if (M.vibe && !G.s.flags[`seen:${this.mapId}`]) { G.s.flags[`seen:${this.mapId}`] = true; this.run(async () => { await say(this, "", M.vibe); if (M.climate) await say(this, G.s.party[1].name, banter(M.climate, M.style, hash(M.name))); }); } // a new city: what it feels like
    this.refreshMarker();
    // quests take a while on CPU: start before anyone asks, but not the instant you land in a new city (you may only be passing through)
    if (!G.s.quest && G.s.offer?.area !== this.area.key) this.time.delayedCall(this.area.key === "home" ? 0 : 15000, () => prefetchQuest(this.area));
    this.time.delayedCall(30000, () => warmAtlases(suggestions().slice(0, 3))); // so that Teleport can answer from the cache
  }

  addStamp(key, tx, ty, opt) {
    const st = STAMPS[key], x = tx * T, y = ty * T;
    if (opt.chest && G.s.flags[opt.chest]) return this.add.image(x, y, "tile-chest").setOrigin(0).setDepth(y + st.h).setTint(0x777777);
    const img = this.add.image(x, y, `tile-${key}`).setOrigin(0).setDepth(st.flat ? -5 : y + st.h);
    if (opt.tint) img.setTint(opt.tint);
    if (st.foot) {
      const box = { x: x + st.foot[0], y: y + st.foot[1], w: st.foot[2], h: st.foot[3] };
      this.solids.push(box);
      if (opt.chest) { const t = { box, act: () => this.openChest(img, opt, t) }; this.things.push(t); }
    }
    return img;
  }

  addActor(id, x, y, dir) {
    const s = this.add.sprite(x, y, `${id}-walk`).setOrigin(0.5, 58 / 64);
    const a = { id, s, dir };
    this.face(a, dir, false);
    return a;
  }

  /** A story character standing beside the hero for one scene; returns a function that removes them. */
  cameo(id) {
    const { x, y } = this.hero.s, a = this.addActor(id, x + 36, y, "down");
    a.s.setDepth(y);
    return () => a.s.destroy();
  }

  addNpc(n) {
    const p = feet(n.x, n.y), a = this.addActor(n.id, p.x, p.y, n.dir);
    a.s.setDepth(p.y);
    const box = { x: p.x - 12, y: p.y - 12, w: 24, h: 14 };
    this.solids.push(box);
    this.things.push({ box, act: () => this.talkTo(n, a) });
  }

  face(a, dir, moving) {
    a.dir = dir;
    if (moving) a.s.play(`${a.id}-walk-${dir}`, true);
    else a.s.stop().setFrame(DIRS.indexOf(dir) * this.cast[a.id].anims.walk.frames);
  }

  /** Runs a cutscene/menu with movement locked. */
  async run(fn) {
    this.busy = true;
    this.face(this.hero, this.hero.dir, false); this.face(this.mate, this.mate.dir, false);
    try { await fn(); } finally { if (!this.leaving) this.busy = false; this.input.keyboard.resetKeys(); }
  }

  /** Dialogue lines with LEAD/MATE replaced by the party's names. */
  lines(ls, speaker) {
    const name = id => G.s.party.find(h => h.id === id)?.name || this.cast[id]?.name || id;
    const [lead, mate] = G.s.party.map(h => h.id);
    return talk(this, ls.map(l => (Array.isArray(l) ? [l[0] === "LEAD" ? name(lead) : l[0] === "MATE" ? name(mate) : l[0], l[1]] : l)), speaker);
  }

  talkTo(n, a) {
    const opposite = { up: "down", down: "up", left: "right", right: "left" }[this.hero.dir];
    this.face(a, opposite, false);
    const who = n.name || this.cast[n.id].name, t = TALK[n.talk];
    this.run(async () => {
      if (n.qid) await this.questEvent("talk_to", n.qid);
      const opts = [n.talk === "shop" ? "Shop" : "Talk", ...(n.qid ? ["Ask…"] : []), ...(n.work ? ["Any work?"] : []), "Leave"];
      for (;;) {
        const o = opts[await choose(this, W - 170, 56, 160, opts)];
        if (o === "Shop") await this.shop(who);
        else if (o === "Talk") await this.lines(n.lines || (Array.isArray(t) ? t : G.s.flags.warden ? t.after : t.before), who);
        else if (o === "Ask…") await this.chat(n, who);
        else if (o === "Any work?") await this.offerQuest(n, who);
        else break;
      }
      this.face(a, n.dir, false);
    });
  }

  /** Free-text talk through Anansi until the player presses Esc. */
  async chat(n, who) {
    for (;;) {
      const line = await prompt(this, `Say something to ${who}:`);
      if (!line) return;
      const r = await waitFor(this, ask(n.qid, line, this.area), `${who} is thinking`);
      await say(this, who, r.say);
      const gift = `${this.area.key}:${n.qid}`;
      if (r.action === "none" || n.qid === "agent" || !canGift(G.s, gift)) continue;
      if (r.action === "heal_hero") {
        G.s.party.forEach(h => { if (h.hp > 0) h.hp = h.maxhp; });
        markGift(G.s, gift); // marked when it happens, not after the player dismisses the message
        sfx("heal"); await say(this, "", `${who} patches the party up. HP restored.`);
      } else if (r.action === "give_supplies") {
        G.s.items.potion = (G.s.items.potion || 0) + 1;
        markGift(G.s, gift);
        sfx("gift"); await say(this, "", `${who} hands you a Potion.`);
      }
    }
  }

  async offerQuest(n, who) {
    const a = G.s.quest;
    if (a) return say(this, who, a.area === this.area.key ? `How's "${a.q.title}" going? ${a.q.steps[a.step].description}`
      : `You still have a job in ${areaLabel(a.area)}: "${a.q.title}". Finish that first.`);
    let q = G.s.offer?.area === this.area.key ? G.s.offer.q : null;
    if (!q) { q = (await waitFor(this, takeQuest(this.area), `${who} is thinking`)).quest; G.s.offer = { q, area: this.area.key }; }
    await say(this, who, `${q.title}. ${q.summary}`);
    if ((await choose(this, W - 170, 56, 160, ["Take the job", "Not now"])) !== 0) return say(this, who, "The offer stands. Come back when you're ready.");
    G.s.quest = { q, step: 0, area: this.area.key }; G.s.offer = null;
    await say(this, "", `New quest: ${q.title}. Open the menu (Esc) and choose Quests to review it.`);
    await this.questEvent("talk_to", n.qid); // a quest that starts with "talk to Ines" is already under way
    this.refreshMarker();
  }

  /** The quest step that is current here, or null: a quest only moves on in its own area. */
  currentStep() { const a = G.s.quest; return a?.area === this.area.key ? a.q.steps[a.step] : null; }
  stepIs(kind, id) { const s = this.currentStep(); return !!s && s.objective === kind && s.target_id === id; }

  async questEvent(kind, id) {
    if (!this.stepIs(kind, id)) return;
    const r = questStep(G.s.quest, kind, id);
    const q = G.s.quest.q;
    this.refreshMarker();
    if (r === "step") sfx("step");
    if (r === "step") return this.toast(`✔ ${q.steps[G.s.quest.step - 1].description}`);
    G.s.quest = null;
    const pay = payQuest(G.s, q), extra = Object.entries(pay.items).map(([i, k]) => `, ${k} × ${ITEMS[i].name}`).join("");
    sfx("questdone");
    await say(this, "", `Quest complete: ${q.title}! +${pay.gold} G${extra}.`);
    prefetchQuest(this.area);
  }

  /** A sparkle where the current fetch step's item is, when it is on this map. */
  refreshMarker() {
    this.marker?.obj.destroy(); this.marker = null;
    const s = this.currentStep(), spot = s?.objective === "fetch" && this.area.itemSpots[s.target_id];
    if (!spot || spot[0] !== this.mapId) return;
    const p = feet(spot[1], spot[2]);
    const obj = this.add.star(p.x, p.y - 10, 4, 3, 8, 0xfff2a8).setDepth(p.y).setStrokeStyle(1, 0xffffff);
    this.tweens.add({ targets: obj, scale: 1.5, alpha: 0.55, angle: 45, yoyo: true, repeat: -1, duration: 500 });
    this.marker = { obj, x: p.x, y: p.y, id: s.target_id };
  }

  toast(msg) {
    const short = msg.length > 90 ? msg.slice(0, 87).replace(/\s+\S*$/, "") + "…" : msg;
    const t = text(this, W / 2, 56, short, { stroke: "#000", strokeThickness: 4, align: "center", wordWrap: { width: W - 80 } }).setOrigin(0.5, 0);
    this.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 500, onComplete: () => t.destroy() });
  }

  async shop(who) {
    await say(this, who, TALK.shop[0]);
    for (;;) {
      const goldWin = drawWindow(this, W - 150, 8, 142, 40), goldTxt = text(this, W - 136, 20, `${G.s.gold} G`);
      const pick = await choose(this, W - 210, 56, 200, ["Buy", "Gear", "Rest (10 G)", "Leave"]);
      goldWin.destroy(); goldTxt.destroy();
      if (pick === 0) {
        const ids = Object.keys(ITEMS);
        const desc = text(this, 20, H - 40, "");
        const k = await choose(this, W - 260, 56, 250, ids.map(id => ({ label: `${ITEMS[id].name.padEnd(8)} ${String(ITEMS[id].price).padStart(3)} G  x${G.s.items[id] || 0}`, disabled: G.s.gold < ITEMS[id].price })),
          { onMove: i => desc.setText(ITEMS[ids[i]].desc) });
        desc.destroy();
        if (k >= 0) { sfx("coin"); G.s.gold -= ITEMS[ids[k]].price; G.s.items[ids[k]] = (G.s.items[ids[k]] || 0) + 1; await say(this, who, `One ${ITEMS[ids[k]].name}. Thank you kindly!`); }
      } else if (pick === 1) {
        await this.buyGear(who);
      } else if (pick === 2) {
        if (G.s.gold < 10) { await say(this, who, "Ten gold for the cot in the back, I'm afraid."); continue; }
        G.s.gold -= 10;
        await new Promise(r => { this.cameras.main.fadeOut(400); this.cameras.main.once("camerafadeoutcomplete", r); });
        G.s.party.forEach(h => { h.hp = h.maxhp; h.mp = h.maxmp; });
        sfx("rest");
        resetGifts(G.s); // a night's rest: everyone is ready to help again
        this.cameras.main.fadeIn(400);
        await say(this, who, "Rested and ready. Mind the tunnels.");
      } else return say(this, who, "Come back any time!");
    }
  }

  /** Tobias' gear: Iron Sword and Oak Wand are for Kai and Mira; the vest and charm fit anyone. */
  async buyGear(who) {
    const stock = G.s.plot.act >= 2 ? [...SHOP_GEAR, ...SHOP_GEAR2] : SHOP_GEAR;
    const desc = text(this, 20, H - 40, "");
    const wearer = id => (EQUIP[id].for ? G.s.party.find(h => h.id === EQUIP[id].for)?.name || "-" : "all").padEnd(4);
    const k = await choose(this, W - 330, 56, 320, stock.map(id => ({ label: `${EQUIP[id].name.padEnd(14)} ${String(EQUIP[id].price).padStart(3)} G ${wearer(id)} x${G.s.gear[id] || 0}`, disabled: G.s.gold < EQUIP[id].price })),
      { onMove: i => desc.setText(`${bonusText(stock[i])}. ${EQUIP[stock[i]].desc}`) });
    desc.destroy();
    if (k < 0) return;
    const id = stock[k];
    sfx("coin"); G.s.gold -= EQUIP[id].price; addGear(G.s, id);
    await say(this, who, `The ${EQUIP[id].name}. Put it on from the menu, and good luck!`);
  }

  openChest(img, opt, t) {
    this.run(async () => {
      G.s.flags[opt.chest] = true;
      sfx("chest");
      if (opt.equip) addGear(G.s, opt.equip); else G.s.items[opt.item] = (G.s.items[opt.item] || 0) + opt.n;
      img.setTint(0x777777);
      this.things = this.things.filter(x => x !== t);
      await say(this, "", opt.equip ? `Found the ${EQUIP[opt.equip].name}! Put it on from the menu.` : `Found ${opt.n} × ${ITEMS[opt.item].name}!`);
    });
  }

  onKey(k) {
    if (this.busy || !this.scene.isActive()) return;
    if (["Enter", " ", "z", "Z"].includes(k)) {
      const [dx, dy] = VEC[this.hero.dir], s = this.hero.s;
      const probe = { x: s.x + dx * 22 - 6, y: s.y + dy * 20 - 10, w: 12, h: 12 };
      this.things.find(t => hit(probe, t.box))?.act();
    } else if (["Escape", "x", "X"].includes(k)) {
      this.busy = true;
      this.face(this.hero, this.hero.dir, false); this.face(this.mate, this.mate.dir, false);
      G.s.pos = { x: this.hero.s.x, y: this.hero.s.y };
      this.scene.launch("menu"); this.scene.pause();
      this.events.once("resume", () => { this.busy = false; });
    }
  }

  blocked(x, y) {
    const b = { x: x - 9, y: y - 8, w: 18, h: 10 };
    if (b.x < 0 || b.y < 0 || b.x + b.w > this.M.w * T || b.y + b.h > this.M.h * T) return true;
    return this.solids.some(s => hit(b, s));
  }

  zonesAt(s) { return (this.M.zones || []).filter(z => hit({ x: s.x - 2, y: s.y - 2, w: 4, h: 4 }, { x: z.x * T, y: z.y * T, w: z.w * T, h: z.h * T })); }

  update(_t, dt) {
    if (this.busy) return;
    const k = this.keys, h = this.hero, s = h.s;
    const dx = (k.RIGHT.isDown || k.D.isDown) - (k.LEFT.isDown || k.A.isDown), dy = (k.DOWN.isDown || k.S.isDown) - (k.UP.isDown || k.W.isDown);
    const moving = dx || dy;
    if (moving) {
      const v = (SPEED * Math.min(dt, 50)) / 1000, ox = s.x, oy = s.y;
      if (dx && !this.blocked(s.x + dx * v, s.y)) s.x += dx * v;
      if (dy && !this.blocked(s.x, s.y + dy * v)) s.y += dy * v;
      const dir = dy ? (dy < 0 ? "up" : "down") : dx < 0 ? "left" : "right";
      this.face(h, dir, true);
      const moved = Math.hypot(s.x - ox, s.y - oy);
      if (moved) { this.trail.push({ x: s.x, y: s.y, dir }); this.afterStep(moved); }
    } else this.face(h, h.dir, false);
    let p = null; // the companion walks the lead's path ~30px behind
    while (this.trail.length && Phaser.Math.Distance.Between(this.trail[0].x, this.trail[0].y, s.x, s.y) > 30) p = this.trail.shift();
    if (p && this.guest) { this.guest.s.setPosition(this.mate.s.x, this.mate.s.y); this.face(this.guest, this.mate.dir, true); } else if (this.guest) this.face(this.guest, this.guest.dir, false);
    if (this.guest) this.guest.s.setDepth(this.guest.s.y - 1);
    if (p) { this.mate.s.setPosition(p.x, p.y); this.face(this.mate, p.dir, true); } else this.face(this.mate, this.mate.dir, false);
    s.setDepth(s.y + 0.5); this.mate.s.setDepth(this.mate.s.y);
  }

  afterStep(moved) {
    const zones = this.zonesAt(this.hero.s);
    if (zones.length && !this.inZone) {
      this.inZone = true;
      const z = zones[0];
      if (z.go) return this.goTo(z.go);
      if (z.enter) return this.run(async () => this.teleportTo(await ensureCity(this, z.enter))); // a gate on the overworld
      if (z.world) { const [x, y] = worldSpot(this.mapId); return this.goTo({ map: "world", x, y }); } // the road out of a city
      if (z.back) return this.teleportTo(G.s.siteFrom && G.s.siteFrom !== this.mapId ? G.s.siteFrom : "town");
      if (z.boss && !G.s.flags[this.M.boss.flag]) return this.bossFight();
    }
    if (!zones.length) this.inZone = false;
    const s = this.hero.s, here = (this.area.regions[this.mapId] || []).find(([, x, y, w, h]) => hit({ x: s.x, y: s.y, w: 1, h: 1 }, { x: x * T, y: y * T, w: w * T, h: h * T }));
    if (here && this.stepIs("explore", here[0])) return this.run(() => this.questEvent("explore", here[0]));
    if (this.marker && Phaser.Math.Distance.Between(s.x, s.y, this.marker.x, this.marker.y) < 20) {
      const id = this.marker.id;
      return this.run(async () => { sfx("pickup"); await say(this, "", `Found: ${this.area.names[id]}`); await this.questEvent("fetch", id); });
    }
    if ((this.M.encounters || this.M.biomes) && (this.nextFight -= moved) <= 0) {
      this.nextFight = this.fightGap();
      this.battle(Phaser.Utils.Array.GetRandom(this.biome()?.encounters || this.M.encounters));
    }
  }

  /** Jumps to another map (Teleport in the menu) and arrives at its spawn point. */
  teleportTo(mapId) { const [x, y] = mapFor(mapId).spawn; this.goTo({ map: mapId, x, y }, "teleport"); }

  goTo(go, sound = "door") {
    this.busy = this.leaving = true; // stays locked through the fade, until the new map is built
    G.s.pos = null;
    sfx(sound);
    this.cameras.main.fadeOut(250);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.restart({ map: go.map, at: feet(go.x, go.y) }));
  }

  /** On the overworld: the climate band under the hero, with its wildlife and battle backdrop. */
  biome() {
    const s = this.hero.s;
    const b = (this.M.biomes || []).find(({ rect: [x, y, w, h] }) => s.x >= x * T && s.x < (x + w) * T && s.y >= y * T && s.y < (y + h) * T);
    return b && { encounters: ENCOUNTERS[b.climate], battle: b.battle };
  }

  /** Steps to walk before the next random fight: [min, max] from the map, else the usual. */
  fightGap() { return Phaser.Math.Between(...(this.M.encounterSteps || [550, 1000])); }

  /** A Directorate relay (Act II): dark before the Warden falls, a pulsing red light after, wreckage once destroyed. */
  addRelay(r) {
    const p = feet(r.x, r.y), live = G.s.plot.act === 2 && !G.s.plot.relays.includes(this.area.key);
    this.add.graphics().setDepth(p.y).fillStyle(0x23242e, 1).fillRect(p.x - 10, p.y - 12, 20, 14).fillRect(p.x - 3, p.y - 46, 6, 36);
    this.relayLight = this.add.circle(p.x, p.y - 50, 6, live ? 0xff3b3b : 0x55565f).setDepth(p.y + 1);
    if (live) this.tweens.add({ targets: this.relayLight, alpha: 0.35, scale: 1.5, yoyo: true, repeat: -1, duration: 600 });
    const box = { x: p.x - 12, y: p.y - 12, w: 24, h: 14 };
    this.solids.push(box);
    this.things.push({ box, act: () => this.useRelay() });
  }

  useRelay() {
    const plot = G.s.plot, key = this.area.key, name = this.area.label;
    this.run(async () => {
      if (plot.act <= 1) return say(this, "", BEATS.relayDark);
      if (plot.act > 2 || plot.relays.includes(key)) return say(this, "", BEATS.relayDead);
      await this.lines(BEATS.relayFound(name));
      if ((await this.battle(["relay_guard", "relay_drone", "relay_drone"], true)) !== "won") return;
      this.busy = true; // the battle handed control back; the story goes on
      const { count, last } = destroyRelay(plot, key);
      this.tweens.killTweensOf(this.relayLight);
      this.relayLight.setFillStyle(0x55565f).setScale(1).setAlpha(1);
      sfx("relay");
      const salvage = RELAY_GEAR[count - 1];
      if (salvage) { addGear(G.s, salvage); sfx("pickup"); await say(this, "", `Salvaged from the relay: ${EQUIP[salvage].name}. Put it on from the menu.`); }
      await this.lines(BEATS.relayDown(count, name));
      if (last) plot.act = 3; // the relays' last signal names the Rift Sites
    });
  }

  /** The Rift Door of an anchor city (Act III): a seam of light into the region's Rift Site. */
  addRift(r) {
    const p = feet(r.x, r.y), plot = G.s.plot, open = plot.act >= 3 && !plot.sites[r.region];
    const g = this.add.graphics().setDepth(p.y).fillStyle(open ? 0x9ffff0 : 0x55565f, open ? 0.85 : 0.5).fillRoundedRect(p.x - 10, p.y - 52, 20, 52, 8);
    if (open) this.tweens.add({ targets: g, alpha: 0.4, yoyo: true, repeat: -1, duration: 700 });
    const box = { x: p.x - 14, y: p.y - 12, w: 28, h: 14 };
    this.solids.push(box);
    this.things.push({ box, act: () => this.run(async () => {
      if (plot.sites[r.region]) return say(this, "", "The Rift Site beyond is empty now. The jumper you freed is long gone.");
      if (plot.act < 3) return say(this, "", "A seam of light shivers in the wall here, too faint to step through. Not yet.");
      await say(this, "", SITE_BEATS[r.region].door);
      G.s.siteFrom = this.mapId;
      this.goTo({ map: `site:${r.region}`, x: 3, y: 10 }, "teleport");
    }) });
  }

  /** A recovery pad (Act III): confirm on it to restore the party. */
  addPad(pad) {
    const q = feet(pad.x, pad.y);
    const ring = this.add.ellipse(q.x, q.y - 4, 30, 14, 0x5fe0d0, 0.35).setDepth(q.y - 20).setStrokeStyle(2, 0x9ffff0);
    this.tweens.add({ targets: ring, alpha: 0.9, yoyo: true, repeat: -1, duration: 800 });
    this.things.push({ box: { x: q.x - 14, y: q.y - 12, w: 28, h: 16 }, act: () => this.run(async () => {
      G.s.party.forEach(h => { h.hp = h.maxhp; h.mp = h.maxmp; });
      resetGifts(G.s);
      this.cameras.main.flash(300, 95, 224, 208);
      sfx("pad");
      await say(this, "", "The pad hums and the party is fully restored.");
    }) });
  }

  bossFight() {
    const b = this.M.boss;
    this.run(async () => {
      await this.lines(BEATS.bossIntro[b.flag], b.name);
      await this.battle([b.enemy], true, true);
    });
  }

  /** What follows a boss: the Warden opens Act II, a site guardian frees a jumper, Vesper opens the Spire, the Director ends the story. */
  async afterBoss(b) {
    if (b.flag === "warden") {
      await this.lines(BEATS.wardenWon);
      G.s.plot.act = Math.max(G.s.plot.act, 2);
      for (const id of WARDEN_GEAR) addGear(G.s, id);
      sfx("chest");
      await say(this, "", `The Warden drops a ${EQUIP[WARDEN_GEAR[0]].name} and a ${EQUIP[WARDEN_GEAR[1]].name}. Put them on from the menu.`);
      return;
    }
    if (b.flag.startsWith("site_")) return this.afterSite(b.flag.slice(5));
    if (b.flag === "vesper") {
      const plot = G.s.plot;
      await this.lines(BEATS.vesperWon);
      for (const r of REGION_IDS) addGear(G.s, SITE_GEAR[r]); // the four sigils come back
      plot.act = 5; plot.spire = true;
      sfx("chest");
      await say(this, "", "The four sigils are yours again. The Spire opens.");
      this.teleportTo("spire");
      return;
    }
    await this.lines(BEATS.directorWon);
    const kinds = Object.keys(ENDINGS), k = await choose(this, W / 2 - 110, 90, 220, kinds.map(e => ENDINGS[e]), { cancel: false });
    G.s.plot.ending = kinds[k];
    await this.lines(BEATS.endings[kinds[k]]);
    this.scene.start("ending");
  }

  /** A Rift Site guardian is down: the jumper is freed and leaves a sigil, and the party is sent home. The second site brings
   *  Kessler and the fourth Vesper's betrayal; both play when the party arrives (pendingScene), since the map is rebuilt. */
  async afterSite(region) {
    const plot = G.s.plot;
    const gone = this.cameo(REGIONS[region].ally.toLowerCase());
    await this.lines(SITE_BEATS[region].won);
    gone();
    const { fresh, rivalNow, last } = completeSite(plot, region);
    if (fresh) { addGear(G.s, SITE_GEAR[region]); sfx("chest"); await say(this, "", `${REGIONS[region].ally}'s sigil: ${EQUIP[SITE_GEAR[region]].name}. Put it on from the menu.`); }
    const ally = REGIONS[region].ally.toLowerCase();
    if (fresh && HEROES[ally]) { joinParty(G.s, ally); sfx("levelup"); await say(this, "", `${REGIONS[region].ally} joins the party for now.`); }
    if (rivalNow) { plot.rival = true; G.s.pending = "kessler"; }
    if (last) G.s.pending = "allFree";
    this.teleportTo(G.s.siteFrom && G.s.siteFrom !== this.mapId ? G.s.siteFrom : "town");
  }

  /** A story scene that waits for the next map: Kessler's ambush, or Vesper taking the sigils. */
  async pendingScene(which) {
    const plot = G.s.plot;
    if (which === "kessler") {
      const gone = this.cameo("kessler");
      await this.lines(BEATS.kesslerAmbush);
      gone();
      if ((await this.battle(["kessler"], true)) !== "won") return;
      this.busy = true;
      const back = this.cameo("kessler");
      await this.lines(BEATS.kesslerWon);
      back();
    } else if (which === "allFree") {
      await this.lines(BEATS.allFree);
      leaveParty(G.s);
      for (const r of REGION_IDS) { // Vesper takes the sigils, even off the party's backs
        for (const h of G.s.party) if (h.eq?.accessory === SITE_GEAR[r]) unequip(G.s, h, "accessory");
        delete G.s.gear[SITE_GEAR[r]];
      }
      plot.act = 4;
    }
  }

  /** Starts a battle over this scene; resolves with "won", "fled" ... when it ends and the field is back.
   *  noFlee: no running away. mapBoss: this map's boss (see data.js), whose defeat is remembered and followed by afterBoss. */
  battle(enemies, noFlee = false, mapBoss = false) {
    this.busy = true;
    this.face(this.hero, this.hero.dir, false); this.face(this.mate, this.mate.dir, false);
    G.s.pos = { x: this.hero.s.x, y: this.hero.s.y };
    return new Promise(done => {
      this.cameras.main.flash(300, 255, 255, 255);
      sfx(mapBoss ? "rage" : "alert");
      musicPush(mapBoss ? this.M.boss.music : noFlee ? "tension" : "battle");
      this.time.delayedCall(300, () => {
        this.scene.launch("battle", { enemies, bg: this.biome()?.battle || this.M.battle, boss: noFlee, onEnd: async result => {
          this.scene.resume();
          musicPop();
          this.busy = false;
          if (result === "won" && mapBoss) {
            const b = this.M.boss;
            G.s.flags[b.flag] = true;
            this.bossImg?.destroy();
            this.solids = this.solids.filter(sb => sb !== this.bossBox);
            await this.run(() => this.afterBoss(b));
          }
          done(result);
        } });
        this.scene.pause();
      });
    });
  }
}
