// The main story, written by hand so that it holds together whatever the model says in each city: three acts, a boss
// each, and two endings. Pure data and small functions (no Phaser), tested by check.mjs.
//
// Act I   Cold Trail      Beat the Warden under Old Town and learn how the Directorate tracks every jump.
// Act II  The Relays      Every city hides a Directorate relay. Destroy three, in three different cities.
// Act III The Rift Sites  The relays' last signal names four sites where jumpers were made, one in each region of the world.
//                         Free the jumper held at each (they give you a sigil). Kessler ambushes you after the second.
// Act IV  The Traitor     Vesper, the last jumper you freed, takes the sigils to the Director. Catch him in the Rift Gate.
// Act V   The Spire       The Director's tower. Beat him, then choose what happens to his archive.
//
// Dialogue lines are "text" or [speaker, "text"]; the speakers LEAD and MATE stand for the party, "" is the narrator.

export const RELAYS_NEEDED = 3;
export const ACTS = ["", "Act I: Cold Trail", "Act II: The Relays", "Act III: The Rift Sites", "Act IV: The Traitor", "Act V: The Spire"];
export const SITES_NEEDED = 4;
export const ENDINGS = { burn: "Burn the archive", keep: "Keep the keys" };

/** What the companion says on first arriving somewhere new: one line for the climate or, for a harbour or river town, the water. */
const BANTER = {
  desert: ["Whose idea was it to wear a coat? The sand is in my boots already.", "Stay in the shade when you can. The Directorate can't track what it can't see through the glare.", "Funny. Everything out here is the same colour as our luck."],
  snow: ["Cold enough that my teeth are teleporting. Keep moving.", "Footprints. In snow. We might as well leave a map for them.", "Try not to blink-strike anything breakable. It's all ice."],
  tropical: ["I can't tell if that's rain or just the air. Either way, my coat is ruined.", "At least it's hard to be grim somewhere with this many flowers.", "Stick together. I don't trust anything that grows this fast."],
  temperate: ["Quiet streets. I don't trust quiet streets.", "Let's find someone who knows the place before we do anything clever.", "A normal town. For about ten minutes I'd like to pretend we live in one."],
  harbor: ["Smell the salt? Ships mean a way out, if it comes to that.", "Piers are bad places to be cornered. Stay near the street.", "Look at all those barrels. Somebody's smuggling something. Not our problem."],
  river: ["Only one bridge. I'd rather we weren't on it when the Directorate shows up.", "A river splits a town in two. People here must gossip across it.", "Hear the water? Good cover for talking."],
};
export function banter(climate, style, seed) {
  const pool = style === "harbor" || style === "river" ? [...BANTER[style], ...BANTER[climate]] : BANTER[climate] || BANTER.temperate;
  return pool[seed % pool.length];
}

export const newPlot = () => ({ act: 1, relays: [], sites: {}, rival: false, spire: false, ending: null });

/** Notes a freed jumper (one per region). Returns {count, rivalNow, last}: how many sites are done, whether Kessler ambushes now, and whether that was the last. */
export function completeSite(plot, region) {
  const was = Object.keys(plot.sites).length;
  plot.sites[region] = true;
  const count = Object.keys(plot.sites).length;
  return { count, fresh: count > was, rivalNow: count >= 2 && !plot.rival, last: count >= SITES_NEEDED };
}

/** Notes a destroyed relay (one per city). Returns {count, last}: how many are down, and whether that was the one that ends Act II. */
export function destroyRelay(plot, city) {
  if (!plot.relays.includes(city)) plot.relays.push(city);
  return { count: plot.relays.length, last: plot.relays.length >= RELAYS_NEEDED };
}

/** What the player should be doing now, in one or two sentences (the Story page of the menu). */
export function objective(plot) {
  if (plot.act <= 1) return "Go through the gate in the north-east of Old Town, down into the Undercroft, and defeat the Warden.";
  if (plot.act === 2) return `Destroy the Directorate's relays: ${plot.relays.length} of ${RELAYS_NEEDED} are down. Open the menu, choose Teleport, and find the pulsing red light in a city. Each city has one.`;
  if (plot.act === 3) return `Free the jumpers held at the four Rift Sites (${Object.keys(plot.sites).length} of ${SITES_NEEDED}). Each region has an anchor city with a Rift Door: Kyoto, Lisbon, Cairo and Mexico City. Choose Teleport, then World Map.`;
  if (plot.act === 4) return "Vesper has the sigils. Teleport to the Rift Gate (the World Map lists it) and stop him before he reaches the Director.";
  if (plot.ending) return "The Directorate is finished. Explore, or teleport anywhere.";
  return "The Director is waiting at the heart of the Spire. Open the menu and choose Teleport, then Directorate Spire, if you need to get back.";
}

/** A sentence for the NPCs' prompts, so that what they say fits how far along the story is. */
export function situation(plot, isHome) {
  if (plot.act <= 1) return isHome ? " The Directorate's Warden guards the Undercroft." : "";
  if (plot.act === 2) return ` They have defeated the Warden and are destroying the Directorate's relays (${plot.relays.length} of ${RELAYS_NEEDED} so far).`;
  if (plot.act === 3) return ` They have destroyed the relays and are freeing jumpers from the Rift Sites (${Object.keys(plot.sites).length} of ${SITES_NEEDED} so far).`;
  if (plot.act === 4) return " The jumper Vesper has betrayed them and run to the Director with the sigils.";
  return plot.ending ? " They have brought down the Director and the Directorate." : " They have freed the jumpers, and the Director is expected to strike.";
}

const ALL_DOWN = [
  ["", "The last relay dies. Every red light in every city goes dark at once, and a final packet of data scrolls across the wreckage."],
  ["", "RIFT SITES: KYOTO. LISBON. CAIRO. MEXICO CITY. SUBJECTS HELD: 4. SIGILS: 4. DIRECTOR: AWAITING ALL FOUR."],
  ["MATE", "Four places where they made jumpers. Four people, still locked up."],
  ["LEAD", "And four sigils that open the Director's door. Then we get them out."],
  ["", "Act III. Open the menu and choose Teleport, then World Map. Each anchor city has a Rift Door."],
];

/** The Rift Sites: what the party finds at each door (enter), who is held (ally), the guardian's challenge, and what follows. */
export const SITE_BEATS = {
  pacific: {
    door: "A seam of lantern-light hangs in the wall of an alley. Through it, a corridor that does not belong to this city.",
    boss: ["The Lantern Warden turns its single eye on you.", "The light keeps what it is given. Leave, or burn."],
    won: [["", "The Warden dims and goes out. In a cell of paper and wire, a woman looks up."],
      ["Sora", "Forty-one jumps, and you came here anyway. I'm Sora. I drew the Directorate's lantern maps until they wired me into the machine."],
      ["Sora", "Take my sigil. It is a quarter of the key to the Director's door. Don't let them gather all four."],
      ["MATE", "Then we get to the others first."]],
  },
  europe: {
    door: "Behind a clockmaker's shutters a second door ticks out of time with the street. Beyond it is a corridor of gears.",
    boss: ["The Clock Sentinel unfolds, one plate at a time.", "Time is up. Everyone's."],
    won: [["", "The Sentinel winds down mid-stride. A thin woman looks up from a cot bolted to the floor."],
      ["Ilse", "You're late. I counted every day. Ilse. They used me to time the jumps."],
      ["Ilse", "My sigil keeps the beat of the program. Keep it close, and the Director's machines will stumble."],
      ["LEAD", "Two sigils is a start."]],
  },
  sahara: {
    door: "The sand at the base of the old wall is shaped into a doorway, and it has been swept clean. Someone expects visitors.",
    boss: ["The Sand Colossus rises out of the floor.", "GRRRRRRM."],
    won: [["", "The Colossus collapses into a drift of sand. In the dust, a tall man stands up slowly, rubbing his wrists."],
      ["Oluwa", "I am Oluwa. They used me to carry the heaviest jumps. It is good to be carried for once."],
      ["Oluwa", "Take the sigil. And watch the last jumper they hold. The Director chose him for his charm, not his courage."],
      ["MATE", "That sounds like a warning."]],
  },
  americas: {
    door: "A crack in the plaster glows green, and vines have been trained around its edge. They are not natural.",
    boss: ["The Jungle Hydra uncoils from the ceiling.", "Hsssss. Everything grows back."],
    won: [["", "The Hydra withers into green mist. In a greenhouse cell, a man in a stained suit stands, brushing leaves from his sleeves."],
      ["Vesper", "At last. I'm Vesper. I keep things growing, even in a place like this. It's a gift, or a curse."],
      ["Vesper", "Take my sigil and go. I'll find my own way out. Don't look back for me."],
      ["", "He smiles a moment too long. You step back through the door."]],
  },
};

export const BEATS = {
  bossIntro: {
    kessler: ["Agent Kessler leans on his Walker's leg.", "One more time, then. Politely."],
    vesper: ["Vesper waits at the end of the Rift Gate, the four sigils floating at his shoulder.", "I was going to take the Director's seat. Now I'm going to take yours."],
    warden: ["The jumper, at last. The Directorate does not ask twice.", "Come quietly, or come in pieces."],
    director: [["The Director", "Forty-one jumps, and you never once asked why you could do it."],
      ["The Director", "Because I made you. The Waypoint program was mine, and so are you."],
      ["LEAD", "We were never yours."],
      ["The Director", "Then let me take back what I lent you."]],
  },
  kesslerAmbush: [
    ["", "A grey car rolls to a stop in the street. Agent Kessler steps out, and behind him a Directorate Walker unfolds."],
    ["Agent Kessler", "Two sigils. You are almost out of my price range. Let me end this courteously."],
    ["LEAD", "You said that last time."],
    ["Agent Kessler", "Last time I was working for the Director. Today I work for myself. Hand them over."],
  ],
  kesslerWon: [
    ["Agent Kessler", "Well. I never wanted to win."],
    ["MATE", "Then why chase us?"],
    ["Agent Kessler", "The Director's program was built to hold four jumpers. Four, and one of them, I will say, has been listening to him for years."],
    ["Agent Kessler", "Don't trust the one that smiles. Now go, before my superiors learn that I lost on purpose."],
  ],
  allFree: [
    ["", "The fourth jumper steps out of the Rift Site, and the four sigils hum together in the air."],
    ["Vesper", "Thank you. Thank you, all of you. You have been so very patient."],
    ["Vesper", "Four sigils, in one pair of hands. The Director has been waiting for this since before you could jump."],
    ["LEAD", "Vesper, what are you doing?"],
    ["Vesper", "Ending it. My way. Do come to the Rift Gate. I'd rather say goodbye properly."],
    ["", "The sigils tear themselves out of the air, and Vesper steps into a seam of light that closes behind him."],
    ["MATE", "He had it planned from the beginning."],
    ["", "Act IV. Choose Teleport, then World Map, then the Rift Gate."],
  ],
  vesperWon: [
    ["Vesper", "I wanted it to stop being the Director's. That's all."],
    ["LEAD", "So did we."],
    ["", "The sigils fall out of the air and back into your hands. Through the open seam, a tower stands against a dark sky."],
    ["MATE", "The Spire. He opened it for us, at least."],
  ],
  wardenWon: [
    ["LEAD", "That's the Warden down."],
    ["", "A cracked tablet flickers on the floor. JUMP LOG: 41 jumps, 41 traces. RELAYS: 3 ACTIVE."],
    ["MATE", "Every jump leaves a thread. The Directorate has relays in cities all over the world, listening for them."],
    ["LEAD", "Then we cut them. Three of them, anywhere on Earth. Look for a red light."],
    ["", "Act II. Open the menu (Esc), choose Teleport and name any real place. Every city hides a relay."],
  ],
  relayDark: "A Directorate device is bolted to the wall, humming. Its light is dark. Whatever it is, it is not listening to you yet.",
  relayDead: "The relay here is only wreckage now. Nothing listens.",
  relayFound: city => [["", `A Directorate relay hums in ${city}, its red eye turning towards you.`], ["MATE", "It's tracing our jump. Break it before it calls anyone!"]],
  relayDown: (n, city) => (n >= RELAYS_NEEDED ? ALL_DOWN : [
    ["", `The relay shorts out in a shower of sparks. Relays down: ${n} of ${RELAYS_NEEDED}.`],
    ["LEAD", `${city} is off their map. ${RELAYS_NEEDED - n} more.`]]),
  spireArrive: [
    ["MATE", "This is where all the traces lead. A tower in the middle of nowhere."],
    ["LEAD", "Floor after floor of relays. Whatever he wants us for, it ends here."],
    ["", "Dormant Directorate pads glow here and there. Step up to one and press confirm to restore the party."],
  ],
  directorWon: [
    ["The Director", "Fold... me... back..."],
    ["", "The Director falls, and the Spire shudders. His archive lies open: a file on every jumper, and the keys to every relay on Earth."],
    ["MATE", "It's all here. Every trace, every name."],
    ["LEAD", "So what do we do with it?"],
  ],
  endings: {
    burn: [["", "You feed the files to the Spire's furnace, and the keys after them. The relays go dead for good."],
      ["MATE", "No one can follow a jump again."], ["LEAD", "And no one can find us by one. That will do."]],
    keep: [["", "You take the keys. Every relay on Earth now answers to you."],
      ["MATE", "Nobody will chase us now."], ["LEAD", "No. Perhaps we are the ones who decide who gets chased."]],
  },
};

for (const r of Object.keys(SITE_BEATS)) BEATS.bossIntro["site_" + r] = SITE_BEATS[r].boss;

/** The epilogue to show if the gateway cannot write one. */
export function epilogueFallback(ending, cities) {
  const route = cities.length ? `${cities.slice(0, 4).join(", ")} still remember two strangers who came and went` : "The towns they passed through remember two strangers who came and went";
  return ending === "keep"
    ? `${route}, and a quiet voice on every relay that never says who is listening. The jumpers were never chased again.`
    : `${route} without a trace. The Directorate's files burned for three days, and nobody has been tracked by a jump since.`;
}
