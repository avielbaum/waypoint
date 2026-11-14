// Turning a destination and what the model says about it into a cast and a quest world. Pure functions (no DOM),
// shared by the game and the prototype, and tested in Node.

export const AGENT = { id: "agent", name: "Agent Kessler", role: "Directorate handler" };

export function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; }
export function rng(seed) { // mulberry32
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// The player's destination goes into prompts: keep it one short line of plain text.
export const cleanDest = s => String(s).replace(/[\u0000-\u001f<>{}\[\]`|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 50);
const clip = s => (/\p{L}/u.test(s) ? s.replace(/[*_#"]/g, "").replace(/\s+/g, " ").trim().slice(0, 40) : ""); // "..." is not a place

// Labeled lines when the model follows the format; otherwise the first lines in order (places, people, items, vibe).
export function parseAtlas(text) {
  const a = { places: [], people: [], items: [], vibe: "" };
  const lines = String(text).split("\n").map(l => l.replace(/[*_#`]/g, "").trim()).filter(Boolean);
  const keys = { PLACE: "places", PERSON: "people", PEOPLE: "people", ITEM: "items", VIBE: "vibe" };
  const LABEL = /^[-\d.)\s]*(PLACES?|PERSONS?|PEOPLE|ITEMS?|VIBE)\s*[:\-]\s*(.+)$/i, labeled = lines.some(l => LABEL.test(l));
  let pos = 0;
  for (const line of lines) {
    const m = line.match(LABEL);
    if (!m && labeled) continue; // chatter around a labeled answer
    const key = m ? keys[m[1].toUpperCase().replace(/S$/, "")] || keys[m[1].toUpperCase()] : ["places", "people", "items", "vibe"][pos++];
    if (!key) break;
    const v = (m ? m[2] : line.replace(/^[^:|]{1,40}:\s*/, "")).trim();
    if (key === "vibe") { a.vibe ||= v.slice(0, 160); continue; }
    for (const part of v.split(/\s*\|\s*|\s*;\s*/)) {
      if (key !== "people") { if (clip(part)) a[key].push(clip(part)); continue; }
      const pm = part.match(/^([^(,]+?)\s*(?:\(([^)]+)\)|,\s*(.+)|\s+[–-]\s+(.+))?$/);
      const first = clip(pm?.[1] || ""), role = clip(pm?.[2] || pm?.[3] || pm?.[4] || "");
      if (!first) continue;
      if (role || !first.includes(" ")) a.people.push({ name: first.split(" ")[0], role: role || "local" });
      else a.people.push({ name: "", role: first }); // only a job was given; buildWorld picks a first name
    }
  }
  return a;
}

// Pads a thin or failed atlas so every destination has 3 places, 3 people and 3 items.
export function buildWorld(dest, atlas) {
  const gen = {
    places: [`the old quarter of ${dest}`, `${dest} central station`, `the waterfront of ${dest}`],
    people: [{ name: "Nia", role: "café owner" }, { name: "Marco", role: "taxi driver" }, { name: "Iris", role: "street medic" }],
    items: ["a hand-drawn city map", "a famous local snack", "an old transit token"],
  };
  const pick = (got, fill, key) => [...new Map([...got, ...fill].map(e => [key(e).toLowerCase(), e])).values()].slice(0, 3);
  const places = pick(atlas.places.filter(Boolean), gen.places, e => e);
  const people = pick(atlas.people.map((p, i) => (p.name ? p : { ...p, name: gen.people[i % 3].name })), gen.people, e => e.name);
  const items = pick(atlas.items.filter(Boolean), gen.items, e => e);
  return {
    dest, vibe: atlas.vibe || `You blink into ${dest}. Nobody saw you arrive. Probably.`,
    world: {
      npcs: [...people.map((p, i) => ({ id: "p" + i, name: p.name, role: p.role })), AGENT],
      locations: places.map((n, i) => ({ id: "l" + i, name: n })),
      items: items.map((n, i) => ({ id: "i" + i, name: n })),
    },
  };
}

// ---- the game's own atlas question: the prototype's four lines plus a climate that picks the look of the town --------

export const CLIMATES = ["temperate", "desert", "snow", "tropical"];

export const DESTINATIONS = ["Kyoto", "Marrakech", "Reykjavik", "Buenos Aires", "Istanbul", "Cape Town", "New Orleans", "Hanoi", "Lisbon",
  "Mexico City", "Mumbai", "Sydney", "Cairo", "Oslo", "Singapore", "Nairobi"];
/** n places the player has not been to, starting at a moving offset so the list changes as they travel. */
export function suggest(visited, n = 5, offset = 0) {
  const seen = new Set(visited.map(v => v.toLowerCase())), pool = DESTINATIONS.filter(d => !seen.has(d.toLowerCase()));
  return Array.from({ length: Math.min(n, pool.length) }, (_, i) => pool[(offset + i) % pool.length]);
}

// Examples with different climates: with one example a small model copies its climate for every place.
export const cityPrompt = dest =>
  `List real things a visitor finds in ${dest}. Answer in exactly five lines, like these examples. PEOPLE are first names with a job in brackets. CLIMATE is one of temperate, desert, snow, tropical.

Lisbon:
PLACES: Alfama | Belém Tower | LX Factory
PEOPLE: Joana (fado singer) | Rui (tram driver) | Inês (pastry baker)
ITEMS: pastel de nata | azulejo tile | sardine tin
VIBE: Steep sunny hills, yellow trams and sad songs at night.
CLIMATE: temperate

Dubai:
PLACES: Burj Khalifa | Gold Souk | Jumeirah Beach
PEOPLE: Omar (gold trader) | Layla (camel trainer) | Samir (taxi driver)
ITEMS: gold bracelet | date palm | dallah coffee pot
VIBE: Glass towers rising out of hot sand, and markets that never close.
CLIMATE: desert

Tromsø:
PLACES: Arctic Cathedral | Polaria | Storsteinen
PEOPLE: Ingrid (aurora guide) | Henrik (fisherman) | Sigrid (reindeer herder)
ITEMS: reindeer pelt | cod liver oil | northern lights lantern
VIBE: Blue snowy streets under a sky that dances green at night.
CLIMATE: snow

Now ${dest}:`;

const CLIMATE_WORDS = { desert: /desert|arid|dry|sahara/, snow: /snow|cold|polar|arctic|tundra|\bice\b|frozen/, tropical: /tropic|humid|jungle|rainforest|monsoon/ };
/** The climate named on a CLIMATE line; anything unclear is temperate. */
export function parseClimate(text) {
  const m = String(text).match(/CLIMATE\s*[:\-]\s*([^\n]+)/i);
  const words = (m ? m[1] : "").toLowerCase().replace(/\(.*$/, ""); // the example's "(one of ...)" must not count
  return Object.keys(CLIMATE_WORDS).find(k => CLIMATE_WORDS[k].test(words)) || "temperate";
}
