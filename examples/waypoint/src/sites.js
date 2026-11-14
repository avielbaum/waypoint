// The Rift Sites (Act III) and the Rift Gate (Act IV): fixed dungeon maps, one per region, built from one template and
// added to MAPS in data.js. Pure data; check.mjs walks them like every other map.
import { REGIONS, REGION_IDS } from "./regions.js";

const TINTS = { pacific: 0xffe0b0, europe: 0xc8d0ff, sahara: 0xffd890, americas: 0xc8ffc0, gate: 0xe0b8ff };
const GUARDS = [["site_drone", "site_drone"], ["site_guard"], ["site_guard", "site_drone"], ["site_drone", "site_drone", "site_drone"]];

function site(id, name, boss, music) {
  return {
    name, w: 36, h: 20, ground: "flagstone", tints: { ground: TINTS[id] }, battle: "dungeon", music: "cave",
    paint: [
      ["brick", 0, 0, 36, 3, true], ["brick", 0, 19, 36, 1, true], ["brick", 0, 0, 1, 20, true], ["brick", 35, 0, 1, 20, true],
      ["brick", 10, 3, 1, 6, true], ["brick", 10, 13, 1, 6, true], // gap at rows 9-12
      ["brick", 18, 3, 1, 3, true], ["brick", 18, 10, 1, 9, true], // gap at rows 6-9
      ["brick", 26, 3, 1, 6, true], ["brick", 26, 13, 1, 6, true], // gap at rows 9-12
    ],
    objects: [...[1, 4, 7, 13, 16, 21, 24, 29, 32].map(x => ["dungeon_wall", x, -1]),
      ["chest", 5, 15, { chest: `${id}1`, item: "potion", n: 3 }], ["chest", 14, 16, { chest: `${id}2`, item: "ether", n: 1 }], ["chest", 22, 5, { chest: `${id}3`, item: "potion", n: 2 }]],
    pads: [{ x: 4, y: 6 }, { x: 22, y: 11 }],
    boss: { x: 31, y: 10, ...boss, music },
    labels: [["▲ Back", 2.5, 3.2]],
    zones: [{ x: 1, y: 9, w: 1, h: 4, back: true }, { x: 28, y: 8, w: 1, h: 5, boss: true }],
    encounters: GUARDS, encounterSteps: [400, 800],
    spawn: [3, 10],
  };
}

const BOSSES = { pacific: "lantern_warden", europe: "clock_sentinel", sahara: "sand_colossus", americas: "hydra" };
export const SITE_MAPS = Object.fromEntries([
  ...REGION_IDS.map(r => [`site:${r}`, site(r, `Rift Site: ${REGIONS[r].anchor}`, { enemy: BOSSES[r], flag: `site_${r}`, name: REGIONS[r].name }, "tension")]),
  ["site:gate", site("gate", "The Rift Gate", { enemy: "vesper", flag: "vesper", name: "Vesper" }, "final")],
]);
