// Everything that talks to the Anansi gateway: what a destination is like, free-text NPC replies and generated side quests.
// The SDK answers from the fallbacks when the gateway is down or slow, so the game never waits on it for long.
import { Anansi } from "../../../sdk/js/anansi.mjs";
import { questFits, tidyQuest } from "./rules.js";
import { cityPrompt, parseAtlas, parseClimate, suggest } from "./atlas.js";
import { situation, epilogueFallback } from "./story.js";
import { G } from "./state.js";

// shortcut: the title keys sit in the page, fine for a local dev gateway; a shipped game proxies through its own server.
const params = new URLSearchParams(location.search);
const playerId = (() => { try { return (localStorage.waypointPid ||= Math.random().toString(36).slice(2)); } catch { return "guest"; } })();
const opts = {
  baseUrl: params.get("gateway") || "http://localhost:8080", key: params.get("key") || "change-me", playerToken: "dev:" + playerId,
  timeoutMs: 45000, generationTimeoutMs: 120000, // CPU-only models are slow
};
const client = new Anansi({ ...opts, title: "waypoint" }); // dialogue and quests
const atlasClient = new Anansi({ ...opts, title: "waypoint-atlas" }); // facts about a place, as plain lines

const history = {}; // "area:npc" -> recent messages, for this session only

function persona(id, area) {
  const p = area.personas[id], [lead, mate] = G.s.party, a = G.s.quest?.area === area.key ? G.s.quest : null;
  const task = a ? ` The hero is working on "${a.q.title}"; the current step: ${a.q.steps[a.step]?.description}` : "";
  const warden = situation(G.s.plot, area.key === "home"); // where the story is, so that what people say fits
  return `${p.bio} The hero, ${lead.name}, and their companion, ${mate.name}, can teleport. They just arrived in ${area.label} on the run from the Directorate.` +
    `${warden}${task} The hero has ${lead.hp} of ${lead.maxhp} health. ${p.acts} Never mention being an AI.`;
}

/** One free-text exchange with an NPC of an area: {say, action, source}. */
export async function ask(id, line, area) {
  const h = (history[`${area.key}:${id}`] ||= []), fallback = area.personas[id].fallback;
  h.push({ role: "user", content: line });
  client.fallback = () => fallback[Math.floor(Math.random() * fallback.length)];
  const r = await client.chat([{ role: "system", content: persona(id, area) }, ...h.slice(-8)], { npcId: id, structured: true });
  h.push({ role: "assistant", content: r.say });
  return r;
}

/** A two-sentence epilogue for the ending, written by the model from the cities the party visited; the written one if it cannot. */
export async function epilogue(ending, cities) {
  const fallback = epilogueFallback(ending, cities);
  // This gateway runs one model, so the request may queue behind a quest being written: wait longer than for a chat reply
  const narrator = new Anansi({ ...opts, title: "waypoint", timeoutMs: 90000, fallback: () => fallback });
  const what = ending === "keep" ? "kept the Directorate's keys, so every relay on Earth now answers to them" : "burned the Directorate's archive, so nobody can be traced by a jump again";
  const r = await narrator.chat([
    { role: "system", content: "You are the narrator of a travel thriller about two teleporting runaways. Answer with exactly two short sentences and nothing else." },
    { role: "user", content: `Write the epilogue. The runaways ${what}. Along the way they visited: ${cities.length ? cities.join(", ") : "only Old Town"}. Mention one or two of those places.` }]);
  return r.say;
}

const atlasKey = dest => "waypoint.atlas:" + dest.toLowerCase();
/**
 * What the model knows about a destination: {atlas, climate, source}. Answers from the gateway are cached in the
 * browser, so going back to a place is instant; without a gateway the atlas is empty and the city gets generic parts.
 */
export async function fetchAtlas(dest) {
  try { const c = JSON.parse(localStorage.getItem(atlasKey(dest))); if (c?.atlas) return { ...c, source: "cache" }; } catch { /* no cache */ }
  const r = await atlasClient.chat([{ role: "user", content: cityPrompt(dest) }]);
  const out = { atlas: parseAtlas(r.say), climate: parseClimate(r.say) };
  if (r.source === "gateway") try { localStorage.setItem(atlasKey(dest), JSON.stringify(out)); } catch { /* private mode */ }
  return { ...out, source: r.source };
}

export const atlasCached = dest => { try { return !!JSON.parse(localStorage.getItem(atlasKey(dest)))?.atlas; } catch { return false; } };
/** The places Teleport suggests: ones not visited yet, a different handful after each trip. */
export const suggestions = () => { const n = Object.keys(G.s.cities).length; return suggest(Object.keys(G.s.cities), 5, n * 3); };

let warming = false;
/**
 * Fetches the atlases of places the player may pick next, one at a time and only while no quest is being written, so
 * choosing one in Teleport answers from the cache. It stops at the first miss (no gateway).
 */
export async function warmAtlases(dests) {
  if (warming) return;
  warming = true;
  try {
    for (const d of dests) {
      if (atlasCached(d)) continue;
      while (inflight) await new Promise(r => setTimeout(r, 5000));
      if ((await fetchAtlas(d)).source === "fallback") break;
    }
  } finally { warming = false; }
}

let inflight = 0; // quests being written right now
const pending = {}; // area key -> the quest being generated
/** Starts generating the next side quest for an area in the background (30-60 s on CPU). */
export function prefetchQuest(area) {
  if (pending[area.key]) return pending[area.key];
  inflight++;
  return (pending[area.key] = client.quest(area.world, {
    steps: 3, theme: area.theme, storySoFar: G.s.story || "", player: `${G.s.party[0].name}, a level ${G.s.party[0].lvl} teleporter`,
  }).then(r => (questFits(r.quest, area.world)
    ? { source: r.source, quest: tidyQuest(r.quest, area.names) }
    : { source: "fallback", quest: area.fallbackQuests[(G.s.questsDone || 0) % area.fallbackQuests.length] })).finally(() => { inflight--; }));
}
/** The prefetched quest for an area (waits for it if needed); the next call starts a new one. */
export function takeQuest(area) { const p = prefetchQuest(area); delete pending[area.key]; return p; }
