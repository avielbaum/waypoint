// Which map and which quest "area" a map id belongs to. Old Town and the Undercroft are one area ("home"); every
// generated city ("city:Kyoto") is its own. An area holds what quests and NPC chat need: people, places, items, who
// the NPCs are, and written quests for when the gateway cannot answer.
import { MAPS, QUEST_WORLD, REGIONS, ITEM_SPOTS, SHORT_NAMES, PERSONAS, FALLBACK_QUESTS } from "./data.js";
import { genCity } from "./city.js";
import { G } from "./state.js";

export const HOME = {
  key: "home", label: "Old Town", world: QUEST_WORLD, regions: REGIONS, itemSpots: ITEM_SPOTS, names: SHORT_NAMES, personas: PERSONAS,
  fallbackQuests: FALLBACK_QUESTS, theme: "a side job in Old Town while the Directorate watches",
};

export const cityId = dest => "city:" + dest;
const built = new Map(); // a city's layout is rebuilt from its saved atlas (only the atlas is saved), once per atlas

function cityOf(id) {
  const dest = id.slice(5), c = G.s.cities[dest], key = id + JSON.stringify(c);
  if (!built.has(key)) built.set(key, genCity(dest, c.atlas, c.climate));
  return built.get(key);
}

export const mapFor = id => MAPS[id] || cityOf(id).map;
/** The area for a map id or an area key (an area's key is "home", or the id of its city's map). */
export const areaOf = id => (id.startsWith("city:") ? cityOf(id).area : HOME);
export const areaLabel = key => (key === "home" ? HOME.label : key.slice(5));
