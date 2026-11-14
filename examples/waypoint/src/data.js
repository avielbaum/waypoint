// Maps and dialogue for the vertical slice. Positions are in 32px tiles.

// Pieces baked by tools/build_tiles.py. foot: the solid part [x, y, w, h] in pixels from the top-left (null: walk-through).
export const STAMPS = {
  house: { w: 96, h: 192, foot: [0, 100, 96, 92] }, // the roof overhangs: walking behind it hides you, like the SNES games
  tree: { w: 96, h: 160, foot: [34, 124, 28, 18] },
  pine: { w: 96, h: 192, foot: [34, 156, 28, 18] },
  gate: { w: 32, h: 64, foot: [0, 0, 32, 64] },
  chest: { w: 32, h: 32, foot: [2, 8, 28, 24] },
  dungeon_wall: { w: 96, h: 128, foot: null, flat: true },
  barrel: { w: 32, h: 64, foot: [4, 38, 24, 20] },
  barrels: { w: 64, h: 64, foot: [4, 30, 56, 28] },
};
// the colours houses come in (tools/build_tiles.py makes a picture for each pair); each is the same shape as the plain house
export const ROOFS = ["slate", "terracotta", "green", "blue", "ochre"], WALLS = ["brick", "plaster", "sand", "timber", "snow"];
export const HOUSES = ROOFS.flatMap(r => WALLS.map(w => `house_${r}_${w}`));
for (const k of HOUSES) STAMPS[k] = STAMPS.house;

import { SITE_MAPS } from "./sites.js";
import { WORLD } from "./overworld.js";

export const MAPS = {
  town: {
    name: "Old Town", w: 40, h: 26, ground: "grass", battle: "town", music: "town",
    paint: [["cobble", 11, 7, 18, 9], ["cobble", 18, 16, 4, 1], ["sidewalk", 0, 16, 40, 1], ["sidewalk", 0, 19, 40, 1], ["cobble", 18, 16, 4, 1], ["road_line", 0, 17, 40, 1], ["road", 0, 18, 40, 1], ["cobble", 29, 10, 4, 4]],
    objects: [
      ["house", 4, 1], ["house", 9, 1], ["house", 14, 1], ["house", 23, 1], ["house", 28, 1], ["house", 33, 1],
      ["house", 6, 19], ["house", 27, 19],
      ["tree", 0, 7], ["tree", 0, 11], ["pine", 36, 6], ["pine", 36, 10], ["tree", 12, 19], ["pine", 17, 19], ["tree", 21, 19],
      ["pine", 0, 19], ["tree", 34, 19], ["gate", 31, 8],
    ],
    labels: [["Undercroft", 31.5, 7.6]],
    npcs: [
      { id: "shopkeeper", qid: "tobias", name: "Tobias", x: 15, y: 7, dir: "down", talk: "shop" },
      { id: "local_f", qid: "ines", name: "Ines", x: 21, y: 12, dir: "down", talk: "ines", work: true },
      { id: "agent", qid: "agent", name: "Agent Kessler", x: 33, y: 11, dir: "left", talk: "agent" },
    ],
    zones: [{ x: 31, y: 10, w: 1, h: 1, go: { map: "undercroft", x: 3, y: 6 } }, { x: 0, y: 17, w: 1, h: 2, world: true }], // the road west leads out to the overworld
    spawn: [19, 12],
    intro: "arrived",
  },
  undercroft: {
    name: "The Undercroft", w: 30, h: 18, ground: "flagstone", battle: "dungeon", music: "cave",
    paint: [
      ["brick", 0, 0, 30, 3, true], ["brick", 0, 17, 30, 1, true], ["brick", 0, 0, 1, 18, true], ["brick", 29, 0, 1, 18, true],
      ["brick", 8, 3, 1, 9, true], ["brick", 15, 7, 1, 10, true], ["brick", 22, 3, 1, 9, true],
    ],
    objects: [["dungeon_wall", 1, -1], ["dungeon_wall", 10, -1], ["dungeon_wall", 17, -1], ["dungeon_wall", 24, -1],
      ["chest", 5, 15, { chest: "c1", item: "ether", n: 2 }], ["chest", 18, 4, { chest: "c2", equip: "plated_jacket" }]],
    boss: { x: 26, y: 9, enemy: "minotaur_mage", flag: "warden", name: "The Warden", music: "tension" },
    labels: [["▲ Old Town", 2.5, 3.2]],
    zones: [
      { x: 1, y: 3, w: 3, h: 1, go: { map: "town", x: 31, y: 11 } },
      { x: 24, y: 7, w: 1, h: 6, boss: true },
    ],
    encounters: [["bat", "bat"], ["slime"], ["snake", "bat"], ["eyeball", "slime"], ["spider_bot"], ["drone_tank"], ["snake", "snake", "bat"], ["slime", "eyeball", "slime"]],
    spawn: [3, 6],
  },
  spire: {
    name: "The Spire", w: 32, h: 22, ground: "flagstone", battle: "dungeon", music: "spire",
    paint: [
      ["brick", 0, 0, 32, 3, true], ["brick", 0, 21, 32, 1, true], ["brick", 0, 0, 1, 22, true], ["brick", 31, 0, 1, 22, true],
      ["brick", 10, 3, 1, 6, true], ["brick", 10, 13, 1, 8, true], // gap at rows 9-12
      ["brick", 16, 3, 1, 4, true], ["brick", 16, 11, 1, 10, true], // gap at rows 7-10
      ["brick", 22, 3, 1, 6, true], ["brick", 22, 13, 1, 8, true], // gap at rows 9-12
    ],
    objects: [...[1, 4, 7, 10, 13, 16, 19, 22, 25, 28].map(x => ["dungeon_wall", x, -1]),
      ["chest", 5, 17, { chest: "s1", equip: "rift_edge" }], ["chest", 13, 18, { chest: "s2", equip: "spire_helm" }], ["chest", 19, 4, { chest: "s3", equip: "moon_scepter" }]],
    pads: [{ x: 4, y: 10 }, { x: 19, y: 10 }], // recovery pads: confirm to restore the party
    boss: { x: 27, y: 11, enemy: "director", flag: "director", name: "The Director", music: "final" },
    zones: [{ x: 24, y: 8, w: 1, h: 6, boss: true }],
    encounters: [["spire_drone", "spire_guard"], ["spire_guard", "spire_guard"], ["wraith"], ["wraith", "spire_drone"], ["spire_drone", "spire_drone", "spire_drone"]],
    encounterSteps: [350, 700], // more often than elsewhere
    spawn: [3, 10],
    arrival: "spireArrive",
  },
};

Object.assign(MAPS, SITE_MAPS, { world: WORLD }); // the Rift Sites and the Rift Gate (Acts III and IV)

// Dialogue: lines are "text" (spoken by the NPC) or [speaker, "text"]; LEAD and MATE stand for the party.
export const TALK = {
  arrived: [["MATE", "So this is where we landed. Quiet little town."],
    ["LEAD", "Too quiet. The Directorate has followed every jump since we walked out of the Waypoint program."],
    ["MATE", "Then let's find out how. Ask around. Esc opens the menu, and Teleport there can take us anywhere on Earth when we're ready."]],
  ines: { before: ["The old tram tunnels run under the town. Men in grey suits go down there at night.", "If you're heading down, buy potions from Tobias first."],
    after: ["The suits are gone! I don't know what you did, but thank you."] },
  agent: { before: ["You must be the jumper. The Directorate has a job offer for you.", "Folding space is wasted on errands for shopkeepers. Work for us.",
    "Our Warden waits in the Undercroft. Go and see what refusing us costs."],
    after: ["...You broke the Warden.", "The Director will hear of this. Blink wherever you like. We will be there first."] },
  worldFirst: [["MATE", "Open country. Every gate on this map is a town, and the roads between them are ours to walk."], ["LEAD", "Then let's walk. Every city has a road out at either end, and Teleport in the menu still works when we're in a hurry."]],
  shop: ["Welcome to Tobias' Provisions! What'll it be?"],
};

// ---- Anansi: the world quests are built from, and who the NPCs are when you talk to them freely ------------------

// Only these ids can appear in a generated quest. Each NPC id is an npc's qid above; each location is a REGIONS entry;
// each item has a spot in ITEM_SPOTS where it sparkles while a quest asks for it.
export const QUEST_WORLD = {
  npcs: [
    { id: "tobias", name: "Tobias", role: "shopkeeper on the plaza" },
    { id: "ines", name: "Ines", role: "tram mechanic" },
    { id: "agent", name: "Agent Kessler", role: "Directorate agent watching the town" },
  ],
  locations: [
    { id: "plaza", name: "the town plaza" },
    { id: "high_street", name: "the high street" },
    { id: "undercroft", name: "the Undercroft tram tunnels" },
  ],
  items: [
    { id: "lost_letter", name: "a lost letter, blown onto the high street" }, // where it lies helps the model place it
    { id: "tram_token", name: "an old tram token, lying in the Undercroft tunnels" },
    { id: "brass_key", name: "a brass signal key, dropped in the Undercroft tunnels" },
  ],
};
export const REGIONS = { // [location id, x, y, w, h] in tiles, per map
  town: [["plaza", 11, 7, 18, 9], ["high_street", 0, 16, 40, 4]],
  undercroft: [["undercroft", 0, 0, 30, 18]],
};
// Short names put back into quest text where a small model wrote a raw id ("the tram_token").
export const SHORT_NAMES = { tobias: "Tobias", ines: "Ines", agent: "Agent Kessler", plaza: "plaza", high_street: "high street",
  undercroft: "Undercroft", lost_letter: "lost letter", tram_token: "tram token", brass_key: "signal key" };
export const ITEM_SPOTS = { lost_letter: ["town", 3, 15], tram_token: ["undercroft", 19, 9], brass_key: ["undercroft", 11, 14] };

export const PERSONAS = {
  tobias: {
    bio: "You are Tobias, the cheerful, gossipy owner of Tobias' Provisions on the plaza of Old Town. You sell potions and ethers. You worry about the men in grey suits who go down into the Undercroft, the old tram tunnels under the town.",
    acts: "You may choose give_supplies when the hero asks for help or supplies.",
    fallback: ["Business is slow with those suits about.", "Potions are on the shelf if you need them.", "Mind the tunnels, friend. Folk go down and come back quiet."],
  },
  ines: {
    bio: "You are Ines, a young tram mechanic who grew up in Old Town. You are curious, brave and practical. You know the Undercroft tunnels well because the trams used to run there, and you carry a first-aid kit.",
    acts: "You may choose heal_hero when the hero is hurt and asks for help, or give_supplies when they ask for supplies.",
    fallback: ["The old tram lines still hum some nights.", "If you go down there, keep to the left tunnel.", "I fixed those trams for years. Now nobody rides them."],
  },
  agent: {
    bio: "You are Agent Kessler of the Directorate, a shadowy government agency. You are calm, polite and menacing. You want the teleporting hero to work for the Directorate and use their power for its operations. Remind them they cannot run forever. Never help them.",
    acts: "You always choose none.",
    fallback: ["The Directorate is patient. Mostly.", "Every jump leaves a trace. We read them all.", "Think about our offer while you still can."],
  },
};

// Written quests for when the gateway cannot answer; they use the same ids as generated ones.
const q = (title, summary, steps, reward_tier, story_summary) =>
  ({ title, summary, reward_tier, story_summary, steps: steps.map(([objective, target_id, description]) => ({ objective, target_id, description })) });
export const FALLBACK_QUESTS = [
  q("Return to Sender", "Ines found an unsent letter's envelope; the letter itself blew away near the high street.", [
    ["explore", "high_street", "Search the high street."],
    ["fetch", "lost_letter", "Find the lost letter."],
    ["talk_to", "tobias", "Ask Tobias who it belongs to."],
  ], "small", "The heroes returned a lost letter, and Tobias now trusts them with town gossip."),
  q("End of the Line", "Ines wants proof the old trams still have power down in the tunnels.", [
    ["explore", "undercroft", "Go down into the Undercroft."],
    ["fetch", "tram_token", "Find an old tram token by the platform."],
    ["talk_to", "ines", "Bring the token back to Ines."],
  ], "medium", "The heroes brought Ines a tram token from the tunnels, and she suspects the Directorate is powering the old lines."),
  q("Signals Crossed", "Someone locked the tunnel signals. Ines needs the brass key to switch them back.", [
    ["fetch", "brass_key", "Find the brass signal key in the Undercroft."],
    ["talk_to", "agent", "Confront Agent Kessler about the locked signals."],
    ["talk_to", "ines", "Give the key to Ines."],
  ], "large", "The heroes recovered the signal key and told Kessler to his face that the town would not be bullied."),
];
