// Music and sound effects (the Ninja Adventure audio, CC0; see tools/build_audio.py).
// Effects are loaded at start. Music is loaded one track at a time, because a decoded track takes about 20 MB: the old
// track fades out as the new one fades in, and a battle track plays over a paused field track that comes back afterwards.
// Nothing here uses Phaser at the top level, so the UI helpers that call sfx() still load in Node (check.mjs).

const BASE = "assets/audio/", KEY = "waypoint.audio";
const DEFAULTS = { music: 0.6, sfx: 0.6, muted: false }; // volumes are one of the steps in cycleVolume

export const settings = (() => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { ...DEFAULTS }; } })();
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode: the choice lasts this session */ } };

let game = null, manifest = null, current = null, wanted = null, base = null;
const stack = []; // field tracks paused under a battle
const KEEP = new Set(["battle", "tension"]); // short and heard often: kept decoded, so a fight's music starts at once

/** Queues the effects for the loader of the Boot scene. */
export function preloadAudio(scene) {
  scene.load.json("audio", BASE + "manifest.json");
  scene.load.once("filecomplete-json-audio", (_k, _t, m) => { for (const [k, v] of Object.entries(m.sfx)) scene.load.audio("sfx-" + k, BASE + v.file); });
}

/** After loading. M mutes and unmutes from anywhere, except while typing in the text box. */
export function initAudio(g) {
  game = g; manifest = g.cache.json.get("audio");
  g.sound.mute = settings.muted;
  window.addEventListener("keydown", e => { if ((e.key === "m" || e.key === "M") && !e.repeat && e.target.tagName !== "INPUT") setMuted(!settings.muted); });
}

export function sfx(key, { volume = 1, rate = 1 } = {}) {
  if (!game || settings.sfx <= 0 || !game.cache.audio.exists("sfx-" + key)) return;
  game.sound.play("sfx-" + key, { volume: volume * settings.sfx, rate });
}

const volumeOf = key => manifest.music[key].gain * settings.music;
const fadeTo = (sound, volume, ms, done) => game.scene.getScene("sound").tweens.add({ targets: sound, volume, duration: ms, onComplete: done });

function load(key) {
  const name = "music-" + key;
  if (game.cache.audio.exists(name)) return Promise.resolve(true);
  const ld = game.scene.getScene("sound").load;
  return new Promise(res => {
    ld.once("filecomplete-audio-" + name, () => res(true));
    ld.once("loaderror", () => res(false)); // an unsupported format or a missing file: stay silent
    ld.audio(name, BASE + manifest.music[key].file);
    ld.start();
  });
}

async function play(key, fade) {
  if (!game || !manifest.music[key] || wanted === key) return;
  wanted = key;
  stopCurrent(fade);
  if (!(await load(key)) || wanted !== key) return; // another track was asked for while this one loaded
  const sound = game.sound.add("music-" + key, { loop: true, volume: 0 });
  sound.play();
  current = { key, sound };
  fadeTo(sound, volumeOf(key), fade);
}

function stopCurrent(fade) {
  const c = current;
  current = null;
  if (c) fadeTo(c.sound, 0, fade, () => { c.sound.destroy(); if (c.key !== wanted && !stack.some(s => s.key === c.key) && !KEEP.has(c.key)) game.cache.audio.remove("music-" + c.key); });
}

/** The music for the place the party is in; asking for the track that is already playing does nothing. */
export function music(key, fade = 700) {
  for (const s of stack.splice(0)) { s.sound.destroy(); game.cache.audio.remove("music-" + s.key); } // a battle that ended in defeat leaves its field track paused
  base = key;
  return play(key, fade);
}
export function musicStop(fade = 400) { wanted = null; stopCurrent(fade); }

/** A battle track over the field music, which is paused and comes back with musicPop(). */
export function musicPush(key) {
  if (current) { const c = current; stack.push(c); current = null; fadeTo(c.sound, 0, 300, () => c.sound.pause()); }
  wanted = null;
  play(key, 300);
}
export function musicPop() {
  stopCurrent(500);
  const c = stack.pop();
  if (!c) { wanted = null; return base && play(base, 500); } // the field music had not finished loading when the battle began
  wanted = c.key; current = c;
  c.sound.resume();
  fadeTo(c.sound, volumeOf(c.key), 600);
}

export function setMuted(m) { settings.muted = m; if (game) game.sound.mute = m; persist(); }
/** Steps a volume (music or sfx) through off, low, medium, full. */
export function cycleVolume(which) {
  const steps = [0, 0.3, 0.6, 1];
  const near = steps.reduce((b, s, k) => (Math.abs(s - settings[which]) < Math.abs(steps[b] - settings[which]) ? k : b), 0);
  settings[which] = steps[(near + 1) % steps.length];
  if (current) current.sound.setVolume(volumeOf(current.key));
  persist();
}
