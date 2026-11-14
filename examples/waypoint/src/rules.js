// Game rules with no Phaser in them, so check.mjs can test them in Node.
import { newPlot } from "./story.js";

export const ITEMS = {
  potion: { name: "Potion", price: 20, hp: 40, desc: "Restores 40 HP to one ally." },
  ether: { name: "Ether", price: 40, mp: 15, desc: "Restores 15 MP to one ally." },
};

// kind: phys uses atk, mag uses mag, heal restores HP. target: enemy | enemies | ally.
export const SKILLS = {
  blink_strike: { name: "Blink Strike", mp: 4, kind: "phys", power: 2, target: "enemy", anim: "thrust", sound: "blink", desc: "Teleport behind a foe and strike twice as hard." },
  rift_burst: { name: "Rift Burst", mp: 8, kind: "mag", power: 1.1, target: "enemies", anim: "spellcast", sound: "burst", desc: "Tear space open around every foe." },
  lantern_flare: { name: "Lantern Flare", mp: 10, kind: "mag", power: 1.4, target: "enemies", anim: "spellcast", sound: "burst", desc: "Sora's lantern flares and burns every foe." },
  mend: { name: "Mend", mp: 5, kind: "heal", power: 35, target: "ally", anim: "spellcast", sound: "heal", desc: "Heal one ally." },
  static_lance: { name: "Static Lance", mp: 5, kind: "mag", power: 1.8, target: "enemy", anim: "spellcast", sound: "lance", desc: "A bolt of folded lightning." },
};

// ---- equipment: a weapon, armor and an accessory per hero ---------------------------------------------------------------
// A bonus is added to the hero's own stats while the piece is worn and taken off again when it is removed, so level-ups and
// the battle code need to know nothing about equipment. hp and mp raise the maximums. `for` limits a piece to one hero.
export const SLOTS = ["weapon", "armor", "accessory"];
export const SLOT_NAMES = { weapon: "Weapon", armor: "Armor", accessory: "Accessory" };
const STATS = ["atk", "mag", "def", "spd", "hp", "mp"];
export const EQUIP = {
  training_blade: { name: "Training Blade", slot: "weapon", for: "lead_m", atk: 2, desc: "A blunt blade for practice." },
  iron_sword: { name: "Iron Sword", slot: "weapon", for: "lead_m", atk: 5, price: 70, desc: "Plain, sharp and reliable." },
  tempered_blade: { name: "Tempered Blade", slot: "weapon", for: "lead_m", atk: 7, price: 150, desc: "Tobias keeps these for survivors." },
  steel_blade: { name: "Steel Blade", slot: "weapon", for: "lead_m", atk: 9, desc: "The Warden's own blade." },
  rift_edge: { name: "Rift Edge", slot: "weapon", for: "lead_m", atk: 14, spd: 2, desc: "It cuts space as well as flesh." },
  training_rod: { name: "Training Rod", slot: "weapon", for: "lead_f", mag: 2, desc: "A willow rod for practice." },
  oak_wand: { name: "Oak Wand", slot: "weapon", for: "lead_f", mag: 5, price: 70, desc: "It hums faintly when you cast." },
  ash_staff: { name: "Ash Staff", slot: "weapon", for: "lead_f", mag: 7, price: 150, desc: "Burnt black, and sharper for it." },
  crystal_tome: { name: "Crystal Tome", slot: "weapon", for: "lead_f", mag: 9, desc: "Taken from the Warden's belt." },
  moon_scepter: { name: "Moon Scepter", slot: "weapon", for: "lead_f", mag: 14, spd: 2, desc: "It spirals light into the air." },
  travel_coat: { name: "Travel Coat", slot: "armor", def: 1, desc: "Warm, and hard to spot in a crowd." },
  leather_vest: { name: "Leather Vest", slot: "armor", def: 3, price: 60, desc: "Stiff leather over the ribs." },
  chain_vest: { name: "Chain Vest", slot: "armor", def: 5, hp: 8, price: 140, desc: "Links of Directorate wire." },
  plated_jacket: { name: "Plated Jacket", slot: "armor", def: 6, hp: 10, desc: "A coat with Directorate plating sewn in." },
  brass_charm: { name: "Brass Charm", slot: "accessory", hp: 12, price: 80, desc: "A lucky trinket from Tobias' shelf." },
  silver_charm: { name: "Silver Charm", slot: "accessory", hp: 20, spd: 1, price: 170, desc: "Tobias polished it himself." },
  quick_boots: { name: "Quick Boots", slot: "accessory", spd: 3, desc: "Salvaged from the first relay." },
  mana_ring: { name: "Mana Ring", slot: "accessory", mp: 10, desc: "Salvaged from the second relay." },
  vital_pendant: { name: "Vital Pendant", slot: "accessory", hp: 30, def: 2, desc: "Salvaged from the third relay." },
  lantern_sigil: { name: "Lantern Sigil", slot: "accessory", spd: 4, mag: 3, desc: "Sora's sigil: a slow-burning lantern flame." },
  clock_sigil: { name: "Clock Sigil", slot: "accessory", def: 4, hp: 20, desc: "Ilse's sigil: it ticks when danger is near." },
  dune_sigil: { name: "Dune Sigil", slot: "accessory", atk: 4, hp: 15, desc: "Oluwa's sigil: warm as sun on sand." },
  vine_sigil: { name: "Vine Sigil", slot: "accessory", mp: 14, hp: 10, desc: "Vesper's sigil: it grows if you let it." },
  spire_helm: { name: "Spire Helm", slot: "accessory", def: 4, hp: 15, desc: "A helm from the Director's guards." },
};
export const START_GEAR = { lead_m: ["training_blade", "travel_coat"], lead_f: ["training_rod", "travel_coat"] };
export const SHOP_GEAR = ["iron_sword", "oak_wand", "leather_vest", "brass_charm"];
export const SHOP_GEAR2 = ["tempered_blade", "ash_staff", "chain_vest", "silver_charm"]; // Tobias stocks these once the Warden has fallen
export const SITE_GEAR = { pacific: "lantern_sigil", europe: "clock_sigil", sahara: "dune_sigil", americas: "vine_sigil" }; // the sigil each Rift Site
export const WARDEN_GEAR = ["steel_blade", "crystal_tome"]; // dropped when the Warden falls
export const RELAY_GEAR = ["quick_boots", "mana_ring", "vital_pendant"]; // one from each of the first three relays

export const canEquip = (h, id) => !!EQUIP[id] && (!EQUIP[id].for || EQUIP[id].for === h.id);
export const bonusText = id => STATS.filter(k => EQUIP[id][k]).map(k => `${EQUIP[id][k] > 0 ? "+" : ""}${EQUIP[id][k]} ${k.toUpperCase()}`).join("  ");

function apply(h, id, sign) {
  const e = EQUIP[id];
  for (const k of ["atk", "mag", "def", "spd"]) h[k] += sign * (e[k] || 0);
  for (const [k, max, cur] of [["hp", "maxhp", "hp"], ["mp", "maxmp", "mp"]]) {
    if (!e[k]) continue;
    h[max] += sign * e[k];
    if (sign > 0 && (k === "mp" || h.hp > 0)) h[cur] += e[k]; // a bonus fills in as well as raising the maximum
    h[cur] = Math.min(h[cur], h[max]);
  }
}

/** Puts a hero's starting gear on (new games, and saves from before equipment existed). Nothing comes out of the gear bag. */
export function kit(h, ids) {
  h.eq ||= {};
  for (const id of ids) if (!h.eq[EQUIP[id].slot]) { h.eq[EQUIP[id].slot] = id; apply(h, id, 1); }
}
/** A third member joins (replacing the last guest, whose gear goes back to the bag) at the party's best level, fully rested. */
export function joinParty(state, id) {
  leaveParty(state);
  const h = newHero(id, Math.max(...state.party.map(p => p.lvl)));
  h.eq = {};
  state.party.push(h);
  return h;
}
/** The guest, if any, leaves. */
export function leaveParty(state) {
  if (state.party.length < 3) return;
  const [h] = state.party.splice(2);
  for (const slot of SLOTS) unequip(state, h, slot);
}
export function addGear(state, id) { state.gear[id] = (state.gear[id] || 0) + 1; }
/** Takes the piece off a slot and into the gear bag. */
export function unequip(state, h, slot) {
  const id = h.eq?.[slot];
  if (!id) return false;
  apply(h, id, -1);
  delete h.eq[slot];
  addGear(state, id);
  return true;
}
/** Wears a piece from the gear bag, sending what was in its slot back to the bag. */
export function equip(state, h, id) {
  if (!canEquip(h, id) || !(state.gear[id] > 0)) return false;
  unequip(state, h, EQUIP[id].slot);
  state.gear[id]--;
  (h.eq ||= {})[EQUIP[id].slot] = id;
  apply(h, id, 1);
  return true;
}
/** A copy of the hero as it would be with `id` in `slot` (id null: the slot empty), for showing the change before choosing. */
export function preview(h, slot, id) {
  const p = { ...h, eq: { ...h.eq } };
  if (p.eq[slot]) { apply(p, p.eq[slot], -1); delete p.eq[slot]; }
  if (id) { p.eq[slot] = id; apply(p, id, 1); }
  return p;
}

export const HEROES = {
  lead_m: { name: "Kai", base: { hp: 62, mp: 14, atk: 12, mag: 7, def: 7, spd: 11 }, grow: { hp: 9, mp: 2, atk: 3, mag: 1, def: 2, spd: 1 }, skills: ["blink_strike", "rift_burst"], attack: "slash" },
  // Freed jumpers who travel with the party for a while (see joinParty). Vesper is not one of them.
  sora: { guest: true, name: "Sora", base: { hp: 48, mp: 24, atk: 8, mag: 12, def: 6, spd: 12 }, grow: { hp: 7, mp: 3, atk: 2, mag: 3, def: 1, spd: 1 }, skills: ["mend", "lantern_flare"], attack: "thrust" },
  ilse: { guest: true, name: "Ilse", base: { hp: 56, mp: 16, atk: 11, mag: 9, def: 8, spd: 10 }, grow: { hp: 8, mp: 2, atk: 2, mag: 2, def: 2, spd: 1 }, skills: ["static_lance", "blink_strike"], attack: "slash" },
  oluwa: { guest: true, name: "Oluwa", base: { hp: 72, mp: 10, atk: 13, mag: 5, def: 9, spd: 8 }, grow: { hp: 11, mp: 1, atk: 3, mag: 1, def: 2, spd: 1 }, skills: ["blink_strike", "mend"], attack: "slash" },
  lead_f: { name: "Mira", base: { hp: 50, mp: 22, atk: 9, mag: 12, def: 6, spd: 13 }, grow: { hp: 7, mp: 3, atk: 2, mag: 3, def: 1, spd: 1 }, skills: ["mend", "static_lance"], attack: "thrust" },
};

export const ENEMIES = {
  bat: { name: "Rift Bat", hp: 24, atk: 10, mag: 0, def: 3, spd: 15, xp: 6, gold: 4 },
  slime: { name: "Sump Slime", hp: 34, atk: 9, mag: 0, def: 5, spd: 7, xp: 7, gold: 5 },
  snake: { name: "Pipe Viper", hp: 28, atk: 12, mag: 0, def: 4, spd: 12, xp: 8, gold: 6 },
  eyeball: { name: "Watcher", hp: 30, atk: 6, mag: 11, def: 4, spd: 10, xp: 9, gold: 8, magic: true },
  spider_bot: { name: "Spider Drone", hp: 38, atk: 13, mag: 0, def: 8, spd: 9, xp: 11, gold: 10 },
  drone_tank: { name: "Directorate Tank", hp: 60, atk: 15, mag: 0, def: 10, spd: 6, xp: 18, gold: 20 },
  minotaur_mage: { name: "The Warden", hp: 260, atk: 17, mag: 15, def: 9, spd: 10, xp: 150, gold: 120, magic: true, boss: true },
  // The wildlife of generated cities, by climate (city.js ENCOUNTERS). `sprite` reuses a picture, `tint` colours it.
  sand_viper: { name: "Sand Viper", sprite: "snake", tint: 0xffd890, hp: 30, atk: 12, mag: 0, def: 4, spd: 13, xp: 8, gold: 6 },
  sand_wasp: { name: "Sand Wasp", sprite: "wasp", hp: 26, atk: 12, mag: 0, def: 3, spd: 16, xp: 8, gold: 6 },
  dune_worm: { name: "Dune Worm", sprite: "worm", hp: 46, atk: 14, mag: 0, def: 7, spd: 7, xp: 12, gold: 10 },
  burrower: { name: "Burrower", sprite: "drill_beast", hp: 62, atk: 16, mag: 0, def: 10, spd: 6, xp: 17, gold: 16 },
  frost_bat: { name: "Frost Bat", sprite: "bat", tint: 0x9fd0ff, hp: 26, atk: 10, mag: 0, def: 3, spd: 15, xp: 7, gold: 5 },
  ice_slime: { name: "Ice Slime", sprite: "slime", tint: 0xa0e8ff, hp: 38, atk: 10, mag: 0, def: 6, spd: 7, xp: 8, gold: 6 },
  frost_eye: { name: "Frost Eye", sprite: "eyeball", tint: 0xa8d8ff, hp: 34, atk: 6, mag: 12, def: 4, spd: 10, xp: 11, gold: 9, magic: true },
  snow_wisp: { name: "Snow Wisp", sprite: "wraith", tint: 0xc8e8ff, scale: 1.1, hp: 56, atk: 8, mag: 16, def: 6, spd: 12, xp: 17, gold: 14, magic: true },
  jungle_vine: { name: "Jungle Vine", sprite: "vine", hp: 40, atk: 12, mag: 0, def: 6, spd: 8, xp: 10, gold: 8 },
  spore_sprout: { name: "Spore Sprout", sprite: "sprout", hp: 28, atk: 9, mag: 0, def: 4, spd: 10, xp: 7, gold: 5 },
  pollen_puff: { name: "Pollen Puff", sprite: "balloon", hp: 30, atk: 5, mag: 12, def: 3, spd: 11, xp: 9, gold: 7, magic: true },
  jungle_wasp: { name: "Jungle Wasp", sprite: "wasp", tint: 0xb0ff90, hp: 30, atk: 13, mag: 0, def: 4, spd: 16, xp: 9, gold: 7 },
  field_sprout: { name: "Field Sprout", sprite: "sprout2", hp: 26, atk: 9, mag: 0, def: 4, spd: 11, xp: 6, gold: 4 },
  // Act II: the guards of a Directorate relay. `sprite` reuses another enemy's picture.
  relay_guard: { name: "Relay Guard", sprite: "drone_tank", hp: 125, atk: 19, mag: 0, def: 12, spd: 8, xp: 50, gold: 40 },
  relay_drone: { name: "Relay Drone", sprite: "spider_bot", hp: 72, atk: 15, mag: 0, def: 9, spd: 10, xp: 35, gold: 25 },
  // Act III: the guardians of the four Rift Sites, then Kessler and the traitor
  lantern_warden: { name: "Lantern Warden", sprite: "eyeball", tint: 0xffc860, scale: 2.4, hp: 650, atk: 15, mag: 26, def: 11, spd: 11, xp: 160, gold: 90, magic: true, boss: true },
  clock_sentinel: { name: "Clock Sentinel", sprite: "drone_tank", tint: 0xc8d8ff, scale: 2.3, hp: 900, atk: 29, mag: 0, def: 17, spd: 8, xp: 160, gold: 90, boss: true },
  sand_colossus: { name: "Sand Colossus", sprite: "drill_beast", tint: 0xffd890, scale: 2.2, hp: 960, atk: 28, mag: 0, def: 15, spd: 7, xp: 170, gold: 90, boss: true },
  hydra: { name: "Jungle Hydra", sprite: "vine", scale: 3, hp: 840, atk: 25, mag: 21, def: 12, spd: 10, xp: 170, gold: 90, boss: true },
  site_guard: { name: "Rift Guard", sprite: "drone_tank", tint: 0xb8c0d8, hp: 140, atk: 21, mag: 0, def: 13, spd: 9, xp: 55, gold: 30 },
  site_drone: { name: "Rift Drone", sprite: "spider_bot", tint: 0xb8c0d8, hp: 85, atk: 17, mag: 0, def: 10, spd: 11, xp: 40, gold: 22 },
  kessler: { name: "Kessler's Walker", sprite: "drone_tank", tint: 0xffe08a, scale: 2.2, hp: 900, atk: 28, mag: 0, def: 16, spd: 11, xp: 200, gold: 150, boss: true,
    waveEvery: 4, rage: { at: 0.5, waveEvery: 3, atk: 33, note: "Kessler overrides the safeties!" } },
  vesper: { name: "Vesper, Unbound", sprite: "wraith", tint: 0xd09aff, scale: 2.0, hp: 1000, atk: 16, mag: 30, def: 14, spd: 13, xp: 250, gold: 150, magic: true, boss: true,
    waveEvery: 3, rage: { at: 0.5, waveEvery: 2, atk: 19, note: "Vesper tears the room apart!" } },
  // Act V: inside the Spire
  spire_guard: { name: "Spire Guard", sprite: "drone_tank", hp: 150, atk: 23, mag: 0, def: 14, spd: 9, xp: 70, gold: 35 },
  spire_drone: { name: "Spire Drone", sprite: "spider_bot", hp: 90, atk: 19, mag: 0, def: 11, spd: 11, xp: 50, gold: 25 },
  wraith: { name: "Null Wraith", hp: 115, atk: 8, mag: 21, def: 7, spd: 12, xp: 65, gold: 30, magic: true },
  // The Director fights harder at half health: `rage` changes how often he uses Null Wave and how hard he hits
  director: { name: "The Director", sprite: "wraith", scale: 2.2, hp: 1280, atk: 26, mag: 22, def: 13, spd: 11, xp: 0, gold: 0, magic: true, boss: true,
    waveEvery: 3, rage: { at: 0.5, waveEvery: 2, atk: 32, note: "The Director's mask cracks!" } },
};

export const statsAt = (id, lvl) => Object.fromEntries(Object.entries(HEROES[id].base).map(([k, v]) => [k, v + HEROES[id].grow[k] * (lvl - 1)]));

export function newHero(id, lvl = 1) {
  const s = statsAt(id, lvl);
  return { id, name: HEROES[id].name, lvl, xp: 0, ...s, maxhp: s.hp, maxmp: s.mp };
}

export const xpToNext = lvl => 12 * lvl * lvl;

/** Adds xp; returns how many levels were gained. Level-ups raise max HP/MP by the growth and keep current damage. */
export function gainXp(h, xp) {
  let ups = 0;
  h.xp += xp;
  while (h.xp >= xpToNext(h.lvl)) {
    h.xp -= xpToNext(h.lvl);
    h.lvl++; ups++;
    const g = HEROES[h.id].grow;
    for (const k of ["atk", "mag", "def", "spd"]) h[k] += g[k];
    h.maxhp += g.hp; h.maxmp += g.mp;
    if (h.hp > 0) { h.hp += g.hp; h.mp += g.mp; }
  }
  return ups;
}

/** Damage of one hit: attack stat against defence, scaled by power, +-10% spread, at least 1. Defending halves it. */
export function damage(att, def, power = 1, rand = Math.random, defending = false) {
  const base = Math.max(1, att * 2 - def) * power * (0.9 + 0.2 * rand());
  return Math.max(1, Math.round(defending ? base / 2 : base));
}

/** How far a time gauge (0..100) fills in dt milliseconds: speed 10 fills it in about three seconds. */
export const atbFill = (spd, dt) => (dt / 1000) * (spd + 20) * 1.1;

export function useItem(item, target) {
  const it = ITEMS[item];
  if (!it || target.hp <= 0) return false; // no raising the fallen in the slice
  if (it.hp) target.hp = Math.min(target.maxhp, target.hp + it.hp);
  if (it.mp) target.mp = Math.min(target.maxmp, target.mp + it.mp);
  return true;
}

export function newGame(lead) {
  const other = lead === "lead_m" ? "lead_f" : "lead_m";
  return { v: 1, party: [lead, other].map(id => { const h = newHero(id); kit(h, START_GEAR[id]); return h; }), items: { potion: 3, ether: 1 }, gold: 60, map: "town", pos: null, flags: {},
    quest: null, offer: null, story: "", questsDone: 0, gifted: {}, cities: {}, gear: {}, plot: newPlot() };
}

// ---- side quests (from Anansi or the written fallbacks) ------------------------------------------------------------

export const QUEST_REWARDS = { small: { gold: 30, items: {} }, medium: { gold: 60, items: { potion: 1 } }, large: { gold: 100, items: { ether: 1 } } };

/** The active quest {q, step}: moves on when (kind, id) is its current step. Returns "step", "done" or null. */
export function questStep(active, kind, id) {
  const s = active?.q.steps[active.step];
  if (!s || s.objective !== kind || s.target_id !== id) return null;
  active.step++;
  return active.step >= active.q.steps.length ? "done" : "step";
}

/** Pays a finished quest's reward into the save; returns the reward. Unknown tiers pay as small. */
export function payQuest(state, q) {
  const r = QUEST_REWARDS[q.reward_tier] || QUEST_REWARDS.small;
  state.gold += r.gold;
  for (const [id, n] of Object.entries(r.items)) state.items[id] = (state.items[id] || 0) + n;
  state.story = [state.story, q.story_summary].filter(Boolean).join(" ").slice(-800); // the newest part; the gateway cuts story_so_far at 1500 chars
  state.questsDone = (state.questsDone || 0) + 1;
  resetGifts(state); // a finished job is a reason for people to help again
  return r;
}

/** One gift (a heal or supplies) per NPC, until the party rests or finishes a quest. It is kept in the save, so it
 *  survives changing maps and reloading; keys are "<area>:<npc>". */
export const canGift = (s, key) => !s.gifted?.[key];
export const markGift = (s, key) => { (s.gifted ||= {})[key] = true; };
export const resetGifts = s => { s.gifted = {}; };

/** Tidies generated quest text: raw ids become names, and stray CJK characters (a small-model glitch) go. */
export function tidyQuest(q, names) {
  const fix = s => String(s).replace(/\b[a-z]+(?:_[a-z]+)+\b|\b[pli]\d\b/g, w => names[w] || w) // snake_case ids, and a generated city's p0 / l1 / i2
    .replace(/[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}]+/gu, "").replace(/\s+/g, " ").trim();
  return { ...q, title: fix(q.title), summary: fix(q.summary), story_summary: fix(q.story_summary),
    steps: q.steps.map(s => ({ ...s, description: fix(s.description) })) };
}

/** A quest is usable only if every step targets something this game has; generated quests are checked again here. */
export const questFits = (q, world) => !!q && Array.isArray(q.steps) && q.steps.length > 0 && q.steps.every(s =>
  ({ talk_to: world.npcs, explore: world.locations, fetch: world.items })[s.objective]?.some(e => e.id === s.target_id));
