// Side-view battle: every fighter has a time gauge; a hero whose gauge fills gets the command menu (time waits).
/* global Phaser */
import { G } from "./state.js";
import { sfx, musicStop } from "./audio.js";
import { ENEMIES, HEROES, SKILLS, ITEMS, damage, atbFill, gainXp, useItem } from "./rules.js";
import { W, H, drawWindow, text, choose, pickTarget, say, tween, wait } from "./ui.js";

const FOE_SPOTS = { 1: [[170, 200]], 2: [[130, 165], [225, 225]], 3: [[115, 140], [220, 190], [120, 245]] };
const HERO_SPOTS = n => (n > 2 ? [[505, 105], [550, 165], [505, 225]] : [[500, 150], [545, 215]]);

export class Battle extends Phaser.Scene {
  constructor() { super("battle"); }

  create(d) {
    this.d = d; this.busy = false; this.over = false;
    this.add.image(0, 0, `tile-battle_${d.bg}`).setOrigin(0);
    this.foes = d.enemies.map((id, i) => {
      const [x, y] = FOE_SPOTS[d.enemies.length][i], e = ENEMIES[id];
      this.add.ellipse(x, y, 60, 14, 0x000000, 0.3);
      const img = this.add.image(x, y, `enemy-${e.sprite || id}`).setOrigin(0.5, 1).setScale(e.scale || (e.boss ? 2 : 1.5));
      if (e.tint) img.setTint(e.tint);
      return { ...e, id, maxhp: e.hp, atb: Math.random() * 60, turns: 0, img };
    });
    // the same name twice gets letters: Rift Bat A, Rift Bat B
    const seen = {};
    this.foes.forEach(f => { seen[f.name] = (seen[f.name] || 0) + 1; });
    const n = {};
    this.foes.forEach(f => { if (seen[f.name] > 1) f.name += " " + "ABC"[(n[f.name] = (n[f.name] || 0) + 1) - 1]; });

    this.spots = HERO_SPOTS(G.s.party.length);
    this.heroes = G.s.party.map((h, i) => {
      const [x, y] = this.spots[i];
      this.add.ellipse(x, y + 2, 40, 10, 0x000000, 0.3);
      const s = this.add.sprite(x, y, `${h.id}-walk`).setOrigin(0.5, 58 / 64).setScale(1.6);
      const b = { h, s, home: x, atb: Math.random() * 60, defending: false };
      this.pose(b);
      return b;
    });

    drawWindow(this, 8, H - 98, 220, 90);
    this.foeList = text(this, 22, H - 86, "", { lineSpacing: 6 });
    drawWindow(this, 232, H - 98, W - 240, 90);
    this.rows = this.heroes.map((b, i) => text(this, 246, H - 88 + i * 25, ""));
    this.bars = this.add.graphics().setDepth(10001);
    this.refresh();
    this.time.delayedCall(10, () => this.note(d.boss ? "The Warden attacks!" : "Enemies appear!"));
  }

  pose(b) { b.s.stop().setTexture(b.h.hp > 0 ? `${b.h.id}-walk` : `${b.h.id}-hurt`, b.h.hp > 0 ? this.cache.json.get("cast")[b.h.id].anims.walk.frames : 5); }

  refresh() {
    this.foeList.setText(this.foes.filter(f => f.hp > 0).map(f => f.name).join("\n"));
    const g = this.bars.clear();
    this.heroes.forEach((b, i) => {
      const h = b.h;
      this.rows[i].setText(`${h.name.padEnd(6)} HP ${String(h.hp).padStart(3)}/${String(h.maxhp).padEnd(3)} MP ${String(h.mp).padStart(2)}`).setColor(h.hp <= 0 ? "#ff7a7a" : h.hp < h.maxhp / 4 ? "#ffd76a" : "#ffffff");
      const y = H - 70 + i * 25;
      g.fillStyle(0x10163a, 1).fillRect(246, y + 4, 200, 5);
      g.fillStyle(b.atb >= 100 ? 0xfff4b0 : 0x6fb8ff, 1).fillRect(246, y + 4, 2 * Math.min(100, b.atb), 5);
    });
  }

  async note(msg, ms = 900) {
    const win = drawWindow(this, W / 2 - 160, 8, 320, 34), t = text(this, W / 2, 25, msg).setOrigin(0.5);
    await wait(this, ms); win.destroy(); t.destroy();
  }

  pop(target, value, color = "#ffffff") {
    const t = this.add.text(target.x, target.y - target.displayHeight * 0.7, String(value), { fontFamily: "monospace", fontSize: "18px", color, stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(20000);
    tween(this, { targets: t, y: t.y - 26, alpha: 0, duration: 800, ease: "Cubic.easeOut" }).then(() => t.destroy());
  }

  update(_t, dt) {
    if (this.busy || this.over) return;
    for (const b of this.heroes) if (b.h.hp > 0) b.atb = Math.min(100, b.atb + atbFill(b.h.spd, dt));
    for (const f of this.foes) if (f.hp > 0) f.atb = Math.min(100, f.atb + atbFill(f.spd, dt));
    this.refresh();
    const hero = this.heroes.find(b => b.h.hp > 0 && b.atb >= 100);
    if (hero) return void this.heroTurn(hero);
    const foe = this.foes.find(f => f.hp > 0 && f.atb >= 100);
    if (foe) this.foeTurn(foe);
  }

  aliveFoes() { return this.foes.filter(f => f.hp > 0); }
  aliveHeroes() { return this.heroes.filter(b => b.h.hp > 0); }

  async pickFoe() {
    const live = this.aliveFoes();
    const i = await pickTarget(this, live.map(f => ({ x: f.img.x - f.img.displayWidth / 2 - 2, y: f.img.y - f.img.displayHeight / 2 })));
    return i < 0 ? null : live[i];
  }
  async pickAlly() {
    const live = this.aliveHeroes();
    const i = await pickTarget(this, live.map(b => ({ x: b.s.x - 22, y: b.s.y - 40 })));
    return i < 0 ? null : live[i];
  }

  async heroTurn(b) {
    this.busy = true;
    b.defending = false;
    const h = b.h;
    await tween(this, { targets: b.s, x: b.home - 14, duration: 120 });
    let done = false;
    while (!done) {
      const cmd = await choose(this, 8, H - 152, 120, ["Fight", "Skill", "Item", "Defend", "Flee"], { cancel: false });
      if (cmd === 0) {
        const f = await this.pickFoe();
        if (f) { await this.strike(b, f); done = true; }
      } else if (cmd === 1) {
        const ids = HEROES[h.id].skills, help = text(this, 18, 18, "").setDepth(20001);
        const k = await choose(this, 8, H - 152, 220, ids.map(id => ({ label: `${SKILLS[id].name.padEnd(13)}${String(SKILLS[id].mp).padStart(2)} MP`, icon: "icon-skill_" + id, disabled: SKILLS[id].mp > h.mp })),
          { rowH: 28, onMove: i => help.setText(SKILLS[ids[i]].desc) });
        help.destroy();
        if (k < 0) continue;
        const sk = SKILLS[ids[k]];
        const targets = sk.target === "enemies" ? this.aliveFoes() : sk.target === "enemy" ? [await this.pickFoe()] : [await this.pickAlly()];
        if (!targets[0]) continue;
        h.mp -= sk.mp;
        await this.skill(b, sk, targets);
        done = true;
      } else if (cmd === 2) {
        const ids = Object.keys(G.s.items).filter(id => G.s.items[id] > 0);
        if (!ids.length) { await this.note("No items."); continue; }
        const k = await choose(this, 8, H - 152, 200, ids.map(id => `${ITEMS[id].name.padEnd(9)} x${G.s.items[id]}`));
        if (k < 0) continue;
        const t = await this.pickAlly();
        if (!t) continue;
        const before = [t.h.hp, t.h.mp];
        if (useItem(ids[k], t.h)) {
          G.s.items[ids[k]]--;
          sfx("potion");
          await this.cast(b);
          this.pop(t.s, ITEMS[ids[k]].hp ? t.h.hp - before[0] : `+${t.h.mp - before[1]} MP`, "#7dff9a");
        }
        done = true;
      } else if (cmd === 3) {
        b.defending = true; sfx("defend"); this.pop(b.s, "Defend", "#9fd3ff"); done = true;
      } else if (cmd === 4) {
        if (this.d.boss) { await this.note("Can't escape!"); done = true; }
        else if (Math.random() < 0.65) { sfx("flee"); await this.note("Got away!"); return this.finish("fled"); }
        else { await this.note("Couldn't escape!"); done = true; }
      }
    }
    b.atb = 0;
    await tween(this, { targets: b.s, x: b.home, duration: 120 });
    this.pose(b);
    this.busy = false;
    this.checkEnd();
  }

  async playOnce(b, anim) {
    const key = `${b.h.id}-${anim}-left`;
    if (!this.anims.exists(key)) return wait(this, 250);
    await new Promise(r => { b.s.play(key); b.s.once("animationcomplete", r); });
  }
  cast(b) { return this.playOnce(b, "spellcast"); }

  hurtFoe(f, dmg) {
    sfx(f.hp - dmg <= 0 ? "foedown" : "hit");
    f.hp = Math.max(0, f.hp - dmg);
    this.pop(f.img, dmg);
    this.tweens.add({ targets: f.img, x: f.img.x - 6, yoyo: true, repeat: 2, duration: 50 });
    f.img.setTintFill(0xffffff); this.time.delayedCall(90, () => { f.img.clearTint(); if (f.tint) f.img.setTint(f.tint); });
    if (f.hp <= 0) this.tweens.add({ targets: f.img, alpha: 0, duration: 400, delay: 150 });
    this.refresh();
  }

  async strike(b, f) {
    await tween(this, { targets: b.s, x: f.img.x + f.img.displayWidth / 2 + 30, y: f.img.y, duration: 220 });
    sfx(HEROES[b.h.id].attack === "slash" ? "slash" : "thrust");
    await this.playOnce(b, HEROES[b.h.id].attack);
    this.hurtFoe(f, damage(b.h.atk, f.def));
    await tween(this, { targets: b.s, x: b.home - 14, y: this.spots[this.heroes.indexOf(b)][1], duration: 220 });
  }

  async skill(b, sk, targets) {
    sfx(sk.sound);
    if (sk.kind === "phys") { // Blink Strike: vanish, reappear at the foe, strike, blink home
      const f = targets[0], y0 = b.s.y;
      await tween(this, { targets: b.s, alpha: 0, duration: 120 });
      b.s.setPosition(f.img.x + f.img.displayWidth / 2 + 26, f.img.y);
      await tween(this, { targets: b.s, alpha: 1, duration: 120 });
      await this.playOnce(b, sk.anim);
      this.hurtFoe(f, damage(b.h.atk, f.def, sk.power));
      await tween(this, { targets: b.s, alpha: 0, duration: 120 });
      b.s.setPosition(b.home - 14, y0);
      await tween(this, { targets: b.s, alpha: 1, duration: 120 });
      return;
    }
    await this.cast(b);
    for (const t of targets) {
      const tgt = t.img || t.s;
      const ring = this.add.circle(tgt.x, tgt.y - tgt.displayHeight / 2, 6, sk.kind === "heal" ? 0x7dff9a : 0xb48cff, 0.7).setDepth(15000);
      tween(this, { targets: ring, scale: 6, alpha: 0, duration: 450 }).then(() => ring.destroy());
      if (sk.kind === "heal") { const amt = Math.min(t.h.maxhp - t.h.hp, sk.power + b.h.mag); t.h.hp += amt; this.pop(t.s, amt, "#7dff9a"); }
      else this.hurtFoe(t, damage(b.h.mag, Math.round(t.def * 0.6), sk.power));
    }
    await wait(this, 350);
  }

  async foeTurn(f) {
    this.busy = true;
    f.atb = 0; f.turns++;
    const live = this.aliveHeroes();
    if (live.length) {
      const raged = f.rage && f.hp <= f.maxhp * f.rage.at, atk = raged ? f.rage.atk : f.atk;
      if (raged && !f.raging) { f.raging = true; sfx("rage"); await this.note(f.rage.note || "It grows furious!", 1000); }
      const wave = f.boss && f.turns % (raged ? f.rage.waveEvery : f.waveEvery || 3) === 0, hex = !wave && f.magic && Math.random() < 0.5;
      if (wave || hex) { sfx(wave ? "wave" : "magic"); await this.note(wave ? "Null Wave" : "Hex", 600); }
      await tween(this, { targets: f.img, x: f.img.x + 28, duration: 140, yoyo: true });
      for (const b of wave ? live : [Phaser.Utils.Array.GetRandom(live)]) {
        const dmg = wave ? damage(f.mag, b.h.def / 2, 0.9) : hex ? damage(f.mag, b.h.def / 2, 1.2) : damage(atk, b.h.def, 1, Math.random, b.defending);
        b.h.hp = Math.max(0, b.h.hp - dmg);
        sfx("hurt");
        this.pop(b.s, dmg);
        b.s.setTint(0xff6060); this.time.delayedCall(150, () => b.s.clearTint());
        this.tweens.add({ targets: b.s, x: b.s.x + 6, yoyo: true, repeat: 2, duration: 50 });
        if (b.h.hp <= 0) { b.atb = 0; this.pose(b); }
      }
      await wait(this, 400);
    }
    this.refresh();
    this.busy = false;
    this.checkEnd();
  }

  async checkEnd() {
    if (this.over) return;
    if (!this.aliveFoes().length) {
      this.over = true;
      const xp = this.foes.reduce((a, f) => a + f.xp, 0), gold = this.foes.reduce((a, f) => a + f.gold, 0);
      G.s.gold += gold;
      await wait(this, 500);
      musicStop(200); sfx("victory");
      await say(this, "", `Victory! ${xp} XP and ${gold} G.`);
      for (const b of this.aliveHeroes()) {
        const ups = gainXp(b.h, xp);
        if (ups) { sfx("levelup"); await say(this, "", `${b.h.name} reached level ${b.h.lvl}!`); }
      }
      this.finish("won");
    } else if (!this.aliveHeroes().length) {
      this.over = true;
      await wait(this, 500);
      musicStop(300); sfx("gameover");
      await say(this, "", "The party has fallen...");
      this.scene.stop("menu"); this.scene.stop("field");
      this.scene.start("title");
    }
  }

  finish(result) {
    this.over = true;
    G.s.party.forEach(h => { if (h.hp <= 0) h.hp = 1; }); // the fallen get up after the fight
    this.scene.stop();
    this.d.onEnd(result);
  }
}
