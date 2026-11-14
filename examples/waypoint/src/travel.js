// Arriving in a place by name: a city the party has been to opens at once, a new one is folded out of the gateway first
// (the Teleport menu and the overworld's gates both come through here).
import { G } from "./state.js";
import { cityId } from "./world.js";
import { fetchAtlas } from "./anansi.js";
import { waitFor } from "./ui.js";

/** The map id of the city `dest`, generating it (and saving its atlas in the game state) if this is the first visit. */
export async function ensureCity(scene, dest) {
  const known = Object.keys(G.s.cities).find(d => d.toLowerCase() === dest.toLowerCase());
  if (known && !G.s.cities[known].generic) return cityId(known);
  const name = known || dest, key = cityId(name);
  const r = await waitFor(scene, fetchAtlas(name), `Folding space to ${name}`);
  G.s.cities[name] = { atlas: r.atlas, climate: r.climate, generic: r.source === "fallback" }; // generic: the gateway could not say anything about it
  if (G.s.quest?.area === key) G.s.quest = null; // a rebuilt city has new people: an old job there no longer fits
  if (G.s.offer?.area === key) G.s.offer = null;
  return key;
}
