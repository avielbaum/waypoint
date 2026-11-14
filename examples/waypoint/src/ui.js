// Menu windows, dialogue and list choosers. Each returns a Promise so scenes can `await` the player.
/* global Phaser */
import { sfx } from "./audio.js";
export const W = 640, H = 360;
export const FONT = { fontFamily: "monospace", fontSize: "14px", color: "#ffffff" };
const OK = ["ENTER", "SPACE", "Z"], BACK = ["ESC", "X", "BACKSPACE"];
const UI_DEPTH = 10000;
/** A touch screen (or ?touch in the address, to try it with a mouse): the field shows a Menu button. Taps work everywhere regardless. */
export const TOUCH = (() => { try { return navigator.maxTouchPoints > 0 || new URLSearchParams(location.search).has("touch"); } catch { return false; } })();

// SNES-style window: blue gradient with a light double border. Fixed to the screen, above the world.
export function drawWindow(scene, x, y, w, h) {
  const g = scene.add.graphics().setScrollFactor(0).setDepth(UI_DEPTH);
  g.fillGradientStyle(0x2a3a9c, 0x2a3a9c, 0x0c1240, 0x0c1240, 0.96);
  g.fillRoundedRect(x, y, w, h, 6);
  g.lineStyle(3, 0xe8ecff, 1).strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, 6);
  g.lineStyle(1, 0x7a86c8, 1).strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 4);
  return g;
}
export const text = (scene, x, y, s, style = {}) => scene.add.text(x, y, s, { ...FONT, ...style }).setScrollFactor(0).setDepth(UI_DEPTH + 1);

/** Calls fn(keyName) for each key press, and fn("TAP", pointer) for each tap or click, until the returned stop() is called. */
function listen(scene, fn) {
  const h = e => fn(e.key === " " ? "SPACE" : e.key.length === 1 ? e.key.toUpperCase() : e.key.replace(/^Arrow/, "").toUpperCase().replace("ESCAPE", "ESC"));
  const tap = p => fn("TAP", p);
  scene.input.keyboard.on("keydown", h);
  scene.input.on("pointerdown", tap);
  return () => { scene.input.keyboard.off("keydown", h); scene.input.off("pointerdown", tap); };
}

/** One line of dialogue in a box at the bottom, typed out; any confirm key finishes the line, then closes it. */
export async function say(scene, name, line) {
  for (const page of pages(String(line), name ? 180 : 240)) await sayPage(scene, name, page);
}

/** Splits text into pages that fit the box (3 lines under a name, 4 without), at sentence ends where possible. */
export function pages(s, max) {
  const out = [];
  let cur = "";
  for (const sentence of s.split(/(?<=[.!?…])\s+/)) {
    for (const w of sentence.split(/\s+/)) { // a sentence longer than a page breaks between words
      const next = cur ? `${cur} ${w}` : w;
      if (next.length > max && cur) { out.push(cur); cur = w; } else cur = next;
    }
    if (cur.length > max * 0.6) { out.push(cur); cur = ""; } // a mostly full page ends with its sentence
  }
  if (cur) out.push(cur);
  return out.length ? out : [""];
}

/** Speaker name -> portrait file in assets/portraits (loaded in main.js). */
export const PORTRAITS = { Sora: "sora", Ilse: "ilse", Oluwa: "oluwa", Vesper: "vesper", "Agent Kessler": "kessler", "The Director": "director" };

function sayPage(scene, name, line) {
  return new Promise(done => {
    const parts = [drawWindow(scene, 8, H - 96, W - 16, 88)];
    const face = PORTRAITS[name] && scene.textures.exists("face-" + PORTRAITS[name]) ? PORTRAITS[name] : null;
    if (face) parts.push(scene.add.image(18, H - 88, "face-" + face).setOrigin(0).setScrollFactor(0).setDepth(UI_DEPTH + 1));
    const x = face ? 92 : 22;
    if (name) parts.push(text(scene, x, H - 88, name, { color: "#ffd76a" }));
    const body = text(scene, x, H - (name ? 68 : 82), "", { wordWrap: { width: W - x - 26 }, lineSpacing: 4 });
    const more = text(scene, W - 34, H - 28, "▼", { color: "#ffd76a" }).setVisible(false);
    parts.push(body, more);
    let shown = 0;
    const timer = scene.time.addEvent({ delay: 22, loop: true, callback: () => {
      shown = Math.min(line.length, shown + 1); body.setText(line.slice(0, shown));
      if (shown % 3 === 0 && line[shown - 1] !== " ") sfx("blip", { volume: 0.3, rate: 0.9 + Math.random() * 0.3 });
      if (shown === line.length) { timer.remove(); more.setVisible(true); }
    } });
    const stop = listen(scene, k => {
      if (!OK.includes(k) && k !== "TAP") return; // a tap anywhere is Confirm
      if (shown < line.length) { shown = line.length; body.setText(line); timer.remove(); more.setVisible(true); return; }
      sfx("page", { volume: 0.5 }); stop(); parts.forEach(p => p.destroy()); done();
    });
  });
}

/** Several lines; each entry is "text" or [name, "text"]. */
export async function talk(scene, lines, name) {
  for (const l of lines) Array.isArray(l) ? await say(scene, l[0], l[1]) : await say(scene, name, l);
}

/**
 * A vertical list in a window. items: strings or {label, disabled}. Resolves with the chosen index, or -1 when
 * cancelled (if cancel is allowed). onMove(i) runs as the cursor moves, e.g. to show a description.
 */
export function choose(scene, x, y, w, items, { cancel = true, onMove, keep = false, rowH = 22, start = 0 } = {}) {
  return new Promise(done => {
    items = items.map(i => (typeof i === "string" ? { label: i } : i));
    const win = drawWindow(scene, x, y, w, items.length * rowH + 20);
    const lx = items.some(it => it.icon) ? x + 58 : x + 30; // room for the 24px icons
    const icons = items.map((it, i) => it.icon && scene.add.image(x + 44, y + 11 + i * rowH + 11, it.icon).setScrollFactor(0).setDepth(10002).setAlpha(it.disabled ? 0.45 : 1));
    const labels = items.map((it, i) => text(scene, lx, y + 11 + i * rowH, it.label, { color: it.disabled ? "#7f86a8" : "#ffffff" }));
    const cur = text(scene, x + 12, 0, "▶", { color: "#ffd76a" });
    let i = items[start] && !items[start].disabled ? start : Math.max(0, items.findIndex(it => !it.disabled));
    const move = d => { i = (i + d + items.length) % items.length; cur.setY(y + 11 + i * rowH); onMove?.(i); };
    move(0);
    const close = r => { stop(); if (!keep) [win, cur, ...labels, ...icons].forEach(o => o?.destroy()); done(r); };
    const stop = listen(scene, (k, ptr) => {
      if (k === "TAP") { // tap a row to choose it (with a description to show: first tap moves the cursor, a second one chooses); tap outside to go back
        const row = Math.floor((ptr.y - y - 10) / rowH), inside = ptr.x >= x && ptr.x <= x + w && ptr.y >= y && ptr.y <= y + items.length * rowH + 20;
        if (inside && row >= 0 && row < items.length && !items[row].disabled) {
          if (row !== i && onMove) { sfx("move", { volume: 0.5 }); i = row; cur.setY(y + 11 + i * rowH); onMove(i); }
          else { i = row; sfx("accept"); close(row); }
        } else if (!inside && cancel) { sfx("cancel"); close(-1); }
      }
      else if (k === "UP") { sfx("move", { volume: 0.5 }); move(-1); }
      else if (k === "DOWN") { sfx("move", { volume: 0.5 }); move(1); }
      else if (OK.includes(k) && !items[i].disabled) { sfx("accept"); close(i); }
      else if (BACK.includes(k) && cancel) { sfx("cancel"); close(-1); }
    });
    choose.last = { win, cur, labels: [...labels, ...icons.filter(Boolean)] }; // for callers that keep the window open (keep: true) and destroy it later
  });
}

/** Moves a ▶ between on-screen targets ({x, y}); resolves with the index or -1 on cancel. */
export function pickTarget(scene, targets, start = 0) {
  return new Promise(done => {
    const cur = text(scene, 0, 0, "▶", { color: "#ffd76a", fontSize: "20px" }).setOrigin(1, 0.5);
    let i = start;
    const place = () => cur.setPosition(targets[i].x, targets[i].y);
    place();
    const stop = listen(scene, (k, ptr) => {
      if (k === "TAP") { // tap a target to pick it, anywhere else to go back
        const d = targets.map(t => Math.hypot(t.x - ptr.x, t.y - ptr.y)), near = d.indexOf(Math.min(...d));
        const ok = d[near] < 90;
        sfx(ok ? "accept" : "cancel"); stop(); cur.destroy(); done(ok ? near : -1);
      }
      else if (["UP", "LEFT"].includes(k)) { sfx("move", { volume: 0.5 }); i = (i - 1 + targets.length) % targets.length; place(); }
      else if (["DOWN", "RIGHT"].includes(k)) { sfx("move", { volume: 0.5 }); i = (i + 1) % targets.length; place(); }
      else if (OK.includes(k) || BACK.includes(k)) { sfx(OK.includes(k) ? "accept" : "cancel"); stop(); cur.destroy(); done(OK.includes(k) ? i : -1); }
    });
  });
}

export const tween = (scene, cfg) => new Promise(r => scene.tweens.add({ ...cfg, onComplete: r }));
export const wait = (scene, ms) => new Promise(r => scene.time.delayedCall(ms, r));

/**
 * A one-line text box in the dialogue window (a real <input>, so any keyboard and IME work). Resolves with the text,
 * or null on Esc. Game keys are off while it is open, so typing W or X does not walk or open the menu.
 */
export function prompt(scene, label) {
  return new Promise(done => {
    const parts = [drawWindow(scene, 8, H - 96, W - 16, 88), text(scene, 22, H - 88, label, { color: "#ffd76a" }),
      text(scene, W - 190, H - 26, "Enter send · Esc done", { fontSize: "11px", color: "#9aa3d8" }),
      ...[["Send", W - 130, () => input.value.trim() && finish(input.value.trim())], ["Done", W - 70, () => finish(null)]].map(([label, bx, fn]) => // for touch screens, which have no Enter or Esc
        text(scene, bx, H - 90, `[${label}]`, { color: "#ffd76a" }).setInteractive({ useHandCursor: true }).on("pointerdown", fn))];
    const el = scene.add.dom(W / 2, H - 50).createFromHTML(
      `<input maxlength="200" autocomplete="off" aria-label="${label}" style="width:${W - 60}px;font:14px monospace;color:#fff;background:#0c1240;border:1px solid #7a86c8;padding:4px 6px;outline:none">`)
      .setScrollFactor(0).setDepth(UI_DEPTH + 2);
    const input = el.node.querySelector("input");
    const onKey = e => {
      e.stopPropagation(); // keep keys away from the game's own keyboard handling
      if (e.key === "Enter" && input.value.trim()) finish(input.value.trim());
      else if (e.key === "Escape") finish(null);
    };
    const finish = v => {
      input.removeEventListener("keydown", onKey);
      el.destroy(); parts.forEach(p => p.destroy());
      scene.input.keyboard.enabled = true; scene.input.keyboard.resetKeys();
      done(v);
    };
    input.addEventListener("keydown", onKey);
    scene.input.keyboard.enabled = false;
    setTimeout(() => input.focus(), 0);
  });
}

/** Shows "label..." with moving dots until the promise settles; resolves with its value. */
export async function waitFor(scene, promise, label) {
  const win = drawWindow(scene, W / 2 - 150, H - 70, 300, 40), t = text(scene, W / 2 - 130, H - 58, label);
  let n = 0;
  const timer = scene.time.addEvent({ delay: 350, loop: true, callback: () => t.setText(label + ".".repeat((n = (n + 1) % 4))) });
  try { return await promise; } finally { timer.remove(); win.destroy(); t.destroy(); }
}
