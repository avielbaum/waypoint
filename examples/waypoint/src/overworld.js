// The overworld: one big walkable map with a gate for every place on the World Map (regions.js) and one for Old Town.
// Walk into a gate to enter that city; every city has an exit at either end of its main street that leads back here.
// Pure and deterministic (seeded), tested by check.mjs: every gate can be reached on foot.
import { hash, rng } from "./atlas.js";
import { REGIONS, REGION_IDS, norm } from "./regions.js";

export const WORLD_W = 128, WORLD_H = 64;
// Where each region lies [x, y, w, h], and its climates by row: [first row, climate]. The climate picks the ground, the wildlife and the battle backdrop.
const LAND = {
  americas: { box: [0, 0, 30, 64], bands: [[0, "temperate"], [36, "tropical"]] },
  europe: { box: [32, 0, 64, 31], bands: [[0, "snow"], [8, "temperate"]] },
  sahara: { box: [32, 33, 64, 31], bands: [[33, "desert"]] },
  pacific: { box: [98, 0, 30, 64], bands: [[0, "temperate"], [24, "tropical"]] },
};
const GROUND = { temperate: "grass", desert: "ground_sand", snow: "ground_snow", tropical: "ground_lush" };
const BACKDROP = { temperate: "meadow", desert: "dunes", snow: "snow", tropical: "beach" };
const TREE = { temperate: "tree", desert: "tree", snow: "pine", tropical: "tree" };
const MUSIC = "road";

const overlap = (a, b, pad = 0) => a[0] - pad < b[0] + b[2] && a[0] + a[2] + pad > b[0] && a[1] - pad < b[1] + b[3] && a[1] + a[3] + pad > b[1];

export function genWorld() {
  const r = rng(hash("waypoint-overworld")), ri = n => Math.floor(r() * n);
  const paint = [], objects = [], labels = [], zones = [], biomes = [], nodes = {};
  const keep = []; // boxes nothing may be built over: gates and paths, [x, y, w, h]
  const climateAt = (reg, y) => LAND[reg].bands.filter(([y0]) => y >= y0).at(-1)[1];

  // climates: ground paint and wildlife per band
  for (const id of REGION_IDS) {
    const [bx, by, bw, bh] = LAND[id].box, bands = LAND[id].bands;
    bands.forEach(([y0, climate], i) => {
      const y1 = i + 1 < bands.length ? bands[i + 1][0] : by + bh, rect = [bx, y0, bw, y1 - y0];
      if (GROUND[climate] !== "grass") paint.push([GROUND[climate], ...rect]);
      biomes.push({ rect, climate, battle: BACKDROP[climate] });
    });
    labels.push([REGIONS[id].name, bx + bw / 2, by + 1.5]);
  }

  // the main roads, then a gate for every place: a grid of cells in the region, the anchor city in the middle cell
  paint.push(["flagstone", 0, 33, WORLD_W, 1], ["flagstone", 64, 0, 1, WORLD_H]);
  keep.push([0, 33, WORLD_W, 1], [64, 0, 1, WORLD_H]);
  const gate = (name, x, y, zone, anchor) => {
    objects.push(["gate", x, y]);
    zones.push({ x, y: y + 2, w: 1, h: 1, ...zone });
    labels.push([(anchor ? "★ " : "") + name, x + 0.5, y - 0.6]);
    nodes[norm(name)] = { name, x, y };
    keep.push([x - 1, y, 3, 3]);
  };
  gate("Old Town", 64, 30, { go: { map: "town", x: 19, y: 12 } });
  for (const id of REGION_IDS) {
    const [bx, by, bw, bh] = LAND[id].box, places = REGIONS[id].places, n = places.length;
    const cols = Math.ceil(Math.sqrt((n * bw) / bh)), rows = Math.ceil(n / cols), cw = (bw - 6) / cols, ch = (bh - 8) / rows;
    const cells = Array.from({ length: cols * rows }, (_, i) => [i % cols, Math.floor(i / cols)]);
    const mid = [(cols - 1) / 2, (rows - 1) / 2];
    cells.sort((a, b) => Math.hypot(a[0] - mid[0], a[1] - mid[1]) - Math.hypot(b[0] - mid[0], b[1] - mid[1]));
    const used = new Set();
    places.forEach((name, i) => {
      const [c, row] = cells[i];
      let x = Math.round(bx + 3 + cw * (c + 0.5)) + (i ? ri(3) - 1 : 0), y = Math.round(by + 6 + ch * (row + 0.5)) + (i ? ri(2) : 0);
      if (x === 64) x++; // the north-south road
      y = Math.min(y, by + bh - 5);
      if (y >= 31 && y <= 34) y += y < 33 ? -3 : 3; // keep clear of the east-west road
      gate(name, x, y, { enter: name }, i === 0);
      used.add(row);
    });
    // a path along every row of gates, joined to the main roads by a path down the region's middle
    for (const row of used) {
      const ys = Object.values(nodes).filter(nd => nd.x >= bx && nd.x < bx + bw && Math.abs(nd.y - (by + 6 + ch * (row + 0.5))) < ch / 2).map(nd => nd.y);
      if (!ys.length) continue;
      const py = Math.max(...ys) + 2, xs = Object.values(nodes).filter(nd => nd.y + 2 === py && nd.x >= bx && nd.x < bx + bw).map(nd => nd.x);
      paint.push(["flagstone", Math.min(...xs) - 1, py, Math.max(...xs) - Math.min(...xs) + 3, 1]);
      keep.push([Math.min(...xs) - 1, py, Math.max(...xs) - Math.min(...xs) + 3, 1]);
    }
    const tx = Math.round(bx + bw / 2) === 64 ? 65 : Math.round(bx + bw / 2);
    paint.push(["flagstone", tx, by, 1, bh]); keep.push([tx, by, 1, bh]);
  }

  // lakes and trees, wherever they block no gate and no path
  const lakes = [];
  for (let i = 0; i < 28; i++) {
    const box = [2 + ri(WORLD_W - 12), 2 + ri(WORLD_H - 8), 4 + ri(4), 3 + ri(3)];
    if (!keep.some(k => overlap(box, k, 2)) && !lakes.some(l => overlap(box, l, 3))) { lakes.push(box); paint.push(["water", ...box, true]); }
  }
  const trees = [];
  for (let i = 0; i < 420 && trees.length < 160; i++) {
    const x = 1 + ri(WORLD_W - 4), y = 1 + ri(WORLD_H - 6), box = [x, y, 1, 1];
    const reg = REGION_IDS.find(id => { const [bx, by, bw, bh] = LAND[id].box; return x >= bx && x < bx + bw && y >= by && y < by + bh; });
    if (!reg || keep.some(k => overlap(box, k, 2)) || lakes.some(l => overlap(box, l, 1)) || trees.some(t => Math.abs(t[0] - x) < 4 && Math.abs(t[1] - y) < 3)) continue;
    trees.push([x, y]);
    objects.push([TREE[climateAt(reg, y)], x, y]);
  }

  return { name: "The Wide World", w: WORLD_W, h: WORLD_H, ground: "grass", battle: "meadow", music: MUSIC, paint, objects, labels, zones, biomes, nodes, spawn: [64, 33], intro: "worldFirst" };
}

export const WORLD = genWorld();

/** Where the party appears on the overworld after leaving the map `mapId` ("town", "city:Kyoto"...): a step below its gate, else the middle. */
export function worldSpot(mapId) {
  const n = WORLD.nodes[norm(mapId === "town" ? "Old Town" : mapId.startsWith("city:") ? mapId.slice(5).split(",")[0] : "")];
  return n ? [n.x, n.y + 4] : WORLD.spawn;
}
