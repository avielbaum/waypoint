// Generated cities. A real destination, and what the model knows about it, becomes a walkable town in the same shape
// as MAPS in data.js, plus the "area" (people, places, items, personas) that quests and NPC chat need.
// Pure functions: check.mjs generates cities in Node and proves everything in them can be reached on foot.
import { STAMPS } from "./data.js";
import { hash, rng, buildWorld } from "./atlas.js";
import { anchorOf } from "./regions.js";

export const T = 32, W = 40, H = 26;
export const feet = (tx, ty) => ({ x: tx * T + 16, y: ty * T + 28 });

const GROUND = { temperate: "grass", desert: "ground_sand", snow: "ground_snow", tropical: "ground_lush" };
const TREE = { temperate: "tree", desert: "tree", snow: "pine", tropical: "tree" };
const TREES = { temperate: 7, desert: 2, snow: 7, tropical: 8 };
export const LOCALS = ["local_f", "local_m", "local_f2", "local_m2", "shopkeeper"]; // sprites the people of a city wear
// What you meet on the streets: the local wildlife, and now and then a Directorate drone sent after you
export const ENCOUNTERS = {
  temperate: [["bat", "bat"], ["slime", "field_sprout"], ["snake", "bat"], ["field_sprout", "field_sprout", "bat"], ["spider_bot"], ["drone_tank"], ["spider_bot", "slime"]],
  desert: [["sand_viper", "sand_wasp"], ["dune_worm"], ["sand_wasp", "sand_wasp", "sand_viper"], ["burrower"], ["dune_worm", "sand_wasp"], ["spider_bot"], ["drone_tank"]],
  snow: [["frost_bat", "frost_bat"], ["ice_slime", "frost_bat"], ["frost_eye"], ["ice_slime", "ice_slime", "frost_eye"], ["snow_wisp"], ["spider_bot"], ["drone_tank"]],
  tropical: [["spore_sprout", "spore_sprout", "jungle_wasp"], ["jungle_vine"], ["pollen_puff", "jungle_wasp"], ["jungle_vine", "spore_sprout"], ["jungle_wasp", "jungle_wasp", "pollen_puff"], ["spider_bot"], ["drone_tank"]],
};
const CITY_MUSIC = { temperate: "road", desert: "ruins", snow: "snow", tropical: "tropical" };
// What a city looks like besides its streets: battle backdrops (each also by night), and colours for roofs, paving and ground.
// Drawn from their own generator seeded by the name, so adding or changing them never moves a street.
const BACKDROPS = { temperate: ["town", "forest", "meadow", "castle", "ruins"], desert: ["desert", "dunes", "ruins"], snow: ["snow", "castle", "town"], tropical: ["beach", "meadow", "forest"] };
const ROOF_POOL = { temperate: ["slate", "terracotta", "green", "blue"], desert: ["terracotta", "ochre", "slate"], snow: ["slate", "blue", "green"], tropical: ["green", "terracotta", "blue", "ochre"] };
const WALL_POOL = { temperate: ["brick", "plaster", "timber"], desert: ["sand", "plaster"], snow: ["snow", "timber", "plaster"], tropical: ["plaster", "sand", "timber"] };
const WATER = { temperate: "water", desert: "water", snow: "water_ice", tropical: "water_lagoon" };
const STYLES = ["street", "street", "street", "harbor", "harbor", "river", "river"]; // how a city is laid out; the name picks one

/** Water over [x, y, w, h] as solid rectangles that leave out `holes` (the planks laid across it): [tex, x, y, w, h, true]. */
function waterRects(tex, x, y, w, h, holes) {
  const out = [];
  let open = new Map(); // "a,b": the rectangle still growing down over columns a to b
  for (let row = y; row < y + h; row++) {
    let runs = [[x, x + w]];
    for (const [hx, hy, hw, hh] of holes) if (row >= hy && row < hy + hh) runs = runs.flatMap(([a, b]) => [[a, Math.min(b, hx)], [Math.max(a, hx + hw), b]].filter(([p, q]) => q > p));
    const next = new Map();
    for (const [a, b] of runs) {
      const k = `${a},${b}`, rect = open.get(k) || (out.push([tex, a, row, b - a, 0, true]), out[out.length - 1]);
      rect[4]++; next.set(k, rect);
    }
    open = next;
  }
  return out;
}
const GROUND_TINTS = { temperate: [0xffffff, 0xd8f0c0, 0xf0f0c8], desert: [0xffffff, 0xf0c8a0, 0xffe0b0], snow: [0xffffff, 0xd8e8ff], tropical: [0xffffff, 0xc0f0d0, 0xe8ffc0] };
const PAVING_TINTS = [0xffffff, 0xe8d0b8, 0xc8c8d8, 0xd8e8d0, 0xf0d8c0];
const BANDS = [[0, 13], [13, 27], [27, W]]; // the three districts, one per landmark, left to right

/** The solid boxes [x, y, w, h], in pixels, that the walking code collides with. */
export function solidsOf(M) {
  const out = [];
  for (const [, x, y, w, h, solid] of M.paint) if (solid) out.push([x * T, y * T, w * T, h * T]);
  for (const [key, x, y] of M.objects) { const f = STAMPS[key].foot; if (f) out.push([x * T + f[0], y * T + f[1], f[2], f[3]]); }
  for (const n of M.npcs || []) { const p = feet(n.x, n.y); out.push([p.x - 12, p.y - 12, 24, 14]); }
  if (M.boss) { const p = feet(M.boss.x, M.boss.y); out.push([p.x - 24, p.y - 16, 48, 16]); }
  if (M.relay) { const p = feet(M.relay.x, M.relay.y); out.push([p.x - 12, p.y - 12, 24, 14]); }
  return out;
}

/** What the party can reach on foot from the spawn point: open(tx, ty) tells whether a tile is free, seen holds "x,y" of every reachable tile. */
export function walkable(M) {
  const solids = solidsOf(M);
  const open = (tx, ty) => tx >= 0 && ty >= 0 && tx < M.w && ty < M.h && !solids.some(([sx, sy, sw, sh]) => {
    const p = feet(tx, ty); // the hero's feet box, 18 x 10, around the tile's centre
    return p.x - 9 < sx + sw && p.x + 9 > sx && p.y - 8 < sy + sh && p.y + 2 > sy;
  });
  const seen = new Set(), q = [];
  if (open(...M.spawn)) { seen.add(M.spawn.join()); q.push(M.spawn); }
  while (q.length) {
    const [x, y] = q.shift();
    for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) if (open(a, b) && !seen.has(`${a},${b}`)) { seen.add(`${a},${b}`); q.push([a, b]); }
  }
  return { open, seen };
}

/**
 * {map, area} for a destination. The layout is seeded by the name, so the same city always has the same streets; if a
 * layout leaves something unreachable it tries the next seed (up to 40 times, then uses the last one).
 */
export function genCity(dest, atlas, climate = "temperate") {
  const { world, vibe } = buildWorld(dest, atlas);
  const r = rng(hash(dest.toLowerCase())), ri = n => Math.floor(r() * n);
  const sr = rng(hash(dest.toLowerCase() + "|style")), picked = STYLES[Math.floor(sr() * STYLES.length)];
  let city;
  for (const style of picked === "street" ? ["street"] : [picked, "street"]) { // a layout that cannot be made to work falls back to the plain street
    for (let attempt = 0; attempt < 40; attempt++) { city = layout(dest, world, vibe, GROUND[climate] ? climate : "temperate", ri, style); if (city.ok) return city; }
  }
  return city;
}

function layout(dest, world, vibe, climate, ri, style = "street") {
  const id = "city:" + dest;
  const roadY = 11 + ri(3), avX = 17 + ri(6); // the road's first sidewalk row; where the avenue crosses it
  const paint = [
    ["cobble", avX - 4, roadY - 5, 11, 5], // the plaza
    ["cobble", avX, 0, 3, roadY - 5], ["cobble", avX, roadY + 4, 3, H - roadY - 4], // the avenue on both sides of the road
    ["sidewalk", 0, roadY, W, 1], ["road_line", 0, roadY + 1, W, 1], ["road", 0, roadY + 2, W, 1], ["sidewalk", 0, roadY + 3, W, 1],
    ["cobble", avX, roadY, 3, 4], // the crossing
  ];
  const objects = [];
  // a river runs north to south, 3 tiles wide, west or east of the plaza; the road crosses it on planks
  const rx = style === "river" ? (ri(2) ? 6 + ri(4) : 31 + ri(3)) : -99;
  const wet = x => x + 3 > rx - 1 && x < rx + 4; // would a 3-wide thing at x touch the river?
  if (style === "river") {
    paint.unshift(...waterRects(WATER[climate], rx, 0, 3, H, [[rx, roadY, 3, 4]]));
    paint.push(["plank", rx, roadY, 3, 4]);
  }
  // a harbour fills the south: the avenue ends in a quay and a pier, with another pier or two beside it
  if (style === "harbor") {
    const y0 = roadY + 5, holes = [[avX, y0, 3, H - y0]];
    paint.push(["flagstone", 0, roadY + 4, W, 1], ["plank", avX, y0, 3, H - y0]);
    for (const px of [avX - 9 - ri(5), avX + 7 + ri(6)]) {
      const len = 4 + ri(4);
      holes.push([px, y0, 2, len]); paint.push(["plank", px, y0, 2, len]);
    }
    paint.unshift(...waterRects(WATER[climate], 0, y0, W, H - y0, holes));
    for (let i = 0, x = 2 + ri(4); i < 3; i++, x += 8 + ri(6)) if (x + 2 < W && !(x + 2 > avX - 1 && x < avX + 4) && !holes.some(([hx, , hw]) => x + 2 > hx - 1 && x < hx + hw + 1)) objects.push([ri(2) ? "barrel" : "barrels", x, roadY + 4]);
  }
  for (let x = 1 + ri(2); x + 3 <= W - 1; x += 4) if (!(x + 3 > avX - 4 && x < avX + 7) && !wet(x) && ri(100) >= 15) objects.push(["house", x, roadY - 7]); // north of the plaza row
  for (let x = 1 + ri(2); x + 3 <= W - 1; x += 4) if (style !== "harbor" && !(x + 3 > avX - 1 && x < avX + 4) && !wet(x) && ri(100) >= 15) objects.push(["house", x, roadY + 5]);
  const tree = TREE[climate];
  for (let i = 0; i < TREES[climate]; i++) {
    const x = ri(W - 3);
    if (!(x + 3 > avX - 1 && x < avX + 4) && !wet(x) && !objects.some(o => o[0] === tree && Math.abs(o[1] - x) < 4)) objects.push([tree, x, ri(2)]);
  }
  const labels = world.locations.map((l, i) => [l.name.slice(0, 26), (BANDS[i][0] + BANDS[i][1]) / 2, roadY + 0.5]);
  const spawn = [avX + 1, roadY - 2];

  // where people and items may stand: reachable, not under a roof, not on the road, not on top of the spawn point
  const covered = new Set();
  for (const [k, hx, hy] of objects) if (k === "house") for (let x = hx; x < hx + 3; x++) for (let y = hy; y < hy + 6; y++) covered.add(`${x},${y}`);
  const empty = { w: W, h: H, paint, objects, spawn };
  const cand = [...walkable(empty).seen].map(s => s.split(",").map(Number))
    .filter(([x, y]) => !covered.has(`${x},${y}`) && y !== roadY + 1 && y !== roadY + 2 && Math.hypot(x - spawn[0], y - spawn[1]) >= 3);
  const taken = [];
  const choose = pred => {
    const c = cand.filter(([x, y]) => pred(x, y) && taken.every(([a, b]) => Math.hypot(a - x, b - y) >= 4));
    if (!c.length) return null;
    const p = c[ri(c.length)]; taken.push(p); return p;
  };
  const rows = [roadY - 1, roadY, roadY + 3, roadY + 4];
  const spots = [
    choose((x, y) => Math.abs(x - avX) <= 5 && y >= roadY - 4 && y <= roadY - 1), // on the plaza
    choose((x, y) => x < avX - 3 && rows.includes(y)), // west along the street
    choose((x, y) => x > avX + 3 && x < W - 9 && rows.includes(y)), // east along the street
    choose((x, y) => x >= W - 8 && rows.includes(y)), // Kessler waits at the east end
  ];
  const relay = choose((x, y) => Math.hypot(x - spawn[0], y - spawn[1]) >= 8); // the Directorate relay of Act II, away from the spawn point
  const region = anchorOf(dest), rift = region ? choose((x, y) => Math.hypot(x - spawn[0], y - spawn[1]) >= 6 && y !== roadY && y !== roadY + 3) : null; // the Rift Door of an anchor city (Act III)
  if (spots.some(s => !s) || !relay || (region && !rift)) return { ok: false };

  const used = new Set();
  const sprite = name => { let i = hash(name) % LOCALS.length; while (used.has(LOCALS[i])) i = (i + 1) % LOCALS.length; used.add(LOCALS[i]); return LOCALS[i]; };
  const people = world.npcs.filter(n => n.id !== "agent");
  const npcs = people.map((n, i) => ({ id: sprite(n.name), qid: n.id, name: n.name, x: spots[i][0], y: spots[i][1], dir: spots[i][0] < avX ? "right" : "left",
    lines: localLines(dest, n), work: i === 0 })); // the first local offers work
  npcs.push({ id: "agent", qid: "agent", name: "Agent Kessler", x: spots[3][0], y: spots[3][1], dir: "left", lines: AGENT_LINES });

  const itemSpots = {};
  const itemTaken = [...taken];
  for (const [i, it] of world.items.entries()) {
    const c = cand.filter(([x, y]) => x >= BANDS[i][0] && x < BANDS[i][1] && y >= roadY - 8 && y <= roadY + 9 && itemTaken.every(([a, b]) => Math.hypot(a - x, b - y) >= 3));
    if (!c.length) return { ok: false };
    const p = c[ri(c.length)]; itemTaken.push(p); itemSpots[it.id] = [id, p[0], p[1]];
  }

  const look = rng(hash(dest.toLowerCase() + "|look")), pick = list => list[Math.floor(look() * list.length)];
  const wall = pick(WALL_POOL[climate]); // most houses share a wall, each has its own roof
  for (const o of objects) if (o[0] === "house") o[0] = `house_${pick(ROOF_POOL[climate])}_${look() < 0.7 ? wall : pick(WALL_POOL[climate])}`;
  const backdrop = pick(BACKDROPS[climate]), night = backdrop !== "snow" && look() < 0.3;
  const tints = { ground: pick(GROUND_TINTS[climate]), paving: pick(PAVING_TINTS) };
  const map = { name: dest, w: W, h: H, ground: GROUND[climate], style, tints, battle: night ? backdrop + "_night" : backdrop, paint, objects, labels, npcs, zones: [{ x: 0, y: roadY, w: 1, h: 4, world: true }, { x: W - 1, y: roadY, w: 1, h: 4, world: true }], spawn, encounters: ENCOUNTERS[climate], vibe, climate, music: CITY_MUSIC[climate], relay: { x: relay[0], y: relay[1] }, rift: rift ? { x: rift[0], y: rift[1], region } : null };
  const { seen } = walkable(map);
  const reach = (x, y) => [[x, y], [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([a, b]) => seen.has(`${a},${b}`));
  const ok = npcs.every(n => reach(n.x, n.y)) && reach(relay[0], relay[1]) && Object.values(itemSpots).every(([, x, y]) => seen.has(`${x},${y}`));

  const names = {};
  for (const e of [...world.npcs, ...world.locations, ...world.items]) names[e.id] = e.name;
  const area = {
    key: id, label: dest, world, itemSpots, names, personas: personasFor(dest, vibe, world), fallbackQuests: fallbackQuests(dest, world),
    regions: { [id]: world.locations.map((l, i) => [l.id, BANDS[i][0], 0, BANDS[i][1] - BANDS[i][0], H]) },
    theme: `a side job in ${dest} while the Directorate closes in`,
  };
  return { ok, map, area };
}

// ---- words: what the people of a city say when the gateway cannot answer, who they are, and written quests ------------

const AGENT_LINES = ["You jump quickly. We are quicker.", "Every city you visit is a city we visit afterwards. Think about our offer.", "Work for the Directorate, and the running stops."];
const localLines = (dest, n) => [`I'm ${n.name}. ${n.role[0].toUpperCase() + n.role.slice(1)}, if you're asking.`, `Welcome to ${dest}. Watch out for the men in grey suits.`, "They have been asking after newcomers all morning."];

function personasFor(dest, vibe, world) {
  const out = {};
  for (const n of world.npcs) {
    out[n.id] = n.id === "agent"
      ? { bio: `You are Agent Kessler of the Directorate, a shadowy government agency. You have tracked the teleporting hero to ${dest}. You are calm, polite and menacing. You want the hero to work for the Directorate and use their power for its operations; remind them they cannot run forever. Never help them.`,
          acts: "You always choose none.", fallback: AGENT_LINES }
      : { bio: `You are ${n.name}, a ${n.role} in ${dest}. ${vibe} You are wary but kind, and you speak like a real person from ${dest}, mentioning real details of the city when it fits.`,
          acts: "You may choose heal_hero when the hero is hurt and asks for help, or give_supplies when they ask for supplies.",
          fallback: localLines(dest, n).slice(1).concat(["Keep to the busy streets, friend."]) };
  }
  return out;
}

function fallbackQuests(dest, world) {
  const [p0, p1] = world.npcs, agent = world.npcs[3], [l0, l1, l2] = world.locations, [i0, i1, i2] = world.items;
  const q = (title, summary, steps, reward_tier, story_summary) =>
    ({ title, summary, reward_tier, story_summary, steps: steps.map(([objective, target_id, description]) => ({ objective, target_id, description })) });
  return [
    q(`${dest}: A Quiet Word`, `${p0.name} knows which streets the Directorate is watching.`,
      [["talk_to", p0.id, `Ask ${p0.name} which streets are safe.`], ["explore", l1.id, `Check out ${l1.name}.`], ["fetch", i0.id, `Find ${i0.name} for ${p0.name}.`]],
      "small", `In ${dest}, ${p0.name} helped the heroes read the Directorate's patrols.`),
    q(`${dest}: Cover Story`, "A local favour will help the heroes blend in.",
      [["fetch", i1.id, `Find ${i1.name}.`], ["talk_to", p1.id, `Show ${p1.name} what you found.`], ["explore", l2.id, `Slip through ${l2.name}.`]],
      "medium", `In ${dest}, the heroes found ${i1.name} and passed for locals.`),
    q(`${dest}: Leave a Trail`, "The Directorate must follow the wrong footprints.",
      [["explore", l0.id, `Walk through ${l0.name}.`], ["talk_to", agent.id, "Face Agent Kessler."], ["fetch", i2.id, `Find ${i2.name} to leave behind.`]],
      "large", `In ${dest}, the heroes sent the Directorate chasing a false trail.`),
  ];
}
