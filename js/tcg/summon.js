// TCCCG — animation d'invocation du Call Up avec Phaser (cahier de Jose du 12 nov.) :
// le booster tombe sur le ring devant le public ; on glisse le doigt sur le haut pour le déchirer ; les cartes se dévoilent
// une par une (glisser à gauche pour la suivante, la carte se retourne). SSR : le public se lève, la carte saute sur la
// 3e corde, petite explosion de lumière, on voit le dos qui brille et on glisse encore pour la dévoiler. SSR qui peut devenir LR :
// feu d'artifice et dos arc-en-ciel. « Passer » va à la prochaine SSR (ou au résultat). Écran de fin : toutes les cartes,
// favori / médaille / virer (plusieurs à la fois), puis invoquer à nouveau (Simple ou Multi) ou revenir au Call Up.
import { S, ACT, changed } from "../state.js";
import { esc, toast, backLayer } from "../util.js";
import { RAR, defOf, cardById } from "./data.js";
import { me, commit, owned } from "./store.js";
import { cardHTML, backHTML, backImg, boosterImg } from "./card.js";
import { packHTML, paintPack, paintGlow, tearJag, packTag } from "./pack.js";
import { loadPhaser, burst, fireworks, flash, confetti, wave } from "./phaser.js";
import { SFX } from "./sfx.js";

const simpleFx = () => { try { return localStorage.getItem("ctv.tgfx") === "simple"; } catch (e) { return false; } };
const tierOf = def => def.r === "SSR" && (def.lrPot || def.max === "LR") ? "lrp" : def.r === "SSR" || RAR.indexOf(def.r) > 3 ? "ssr" : "low";
const sameO = u => { try { return new URL(u, location.href).origin === location.origin; } catch (e) { return false; } };

// ---------- la scène Phaser : public, projecteurs, ring, booster ----------
function makeScene(Ph, b, glow, label) {
  return class Summon extends Ph.Scene {
    constructor() { super("summon"); }
    preload() { if (b.logo) this.load.image("blogo", b.logo); const bi = boosterImg(b), ci = backImg(); if (bi) this.load.image("bimg", bi); if (ci) this.load.image("cback", ci); }
    create() {
      const W = this.scale.width, H = this.scale.height; let g = this.add.graphics();
      this.W = W; this.H = H;
      // version B « Dans l'arène » : l'écran géant en haut, la rampe d'entrée, les colonnes de feu
      g.fillGradientStyle(0x0b1636, 0x0b1636, 0x070d22, 0x070d22, 1); g.fillRect(0, 0, W, H);
      // public : des têtes et des flashs d'appareils photo
      this.crowd = this.add.graphics();
      for (let i = 0; i < 240; i++) { this.crowd.fillStyle(0x1c2c5e, 0.35 + Math.random() * 0.5); this.crowd.fillCircle(Math.random() * W, H * 0.02 + Math.random() * H * 0.34, 3 + Math.random() * 6); }
      this.time.addEvent({ delay: 140, loop: true, callback: () => { const f = this.add.circle(Math.random() * W, H * 0.03 + Math.random() * H * 0.33, 2 + Math.random() * 2, 0xffffff, 0.9); this.tweens.add({ targets: f, alpha: 0, scale: 2, duration: 300, onComplete: () => f.destroy() }); } });
      // projecteurs qui balaient
      [0.2, 0.8].forEach((x, i) => { const c = this.add.triangle(W * x, -10, 0, 0, -W * 0.22, H * 0.8, W * 0.22, H * 0.8, 0xcfe0ff, 0.07).setOrigin(0.5, 0).setBlendMode("ADD"); c.angle = i ? 12 : -12; this.tweens.add({ targets: c, angle: i ? -14 : 14, duration: 2600 + i * 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }); });
      // l'écran géant et la rampe passent devant le public
      g = this.add.graphics().setDepth(1);
      const poly = (pts, col, al) => { g.fillStyle(col, al == null ? 1 : al); g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fillPath(); };
      // l'écran géant (titantron)
      const tw = W * 0.86, tx = (W - tw) / 2, ty = Math.max(46, H * 0.06), th = Math.min(H * 0.15, 128);
      g.fillStyle(0x16204a); g.fillRoundedRect(tx - 6, ty - 6, tw + 12, th + 12, 14);
      g.fillStyle(0x3b4a7a); g.fillRoundedRect(tx - 3, ty - 3, tw + 6, th + 6, 12);
      g.fillGradientStyle(0x0b1636, 0x0b1636, 0x2a63cc, 0x2a63cc, 1); g.fillRect(tx, ty, tw, th);
      for (let y = ty; y < ty + th; y += 3) { g.fillStyle(0x000000, 0.2); g.fillRect(tx, y, tw, 1); }
      this.tronS = this.add.text(W / 2, ty + th * 0.26, "Invocation", { fontFamily: "'Barlow Condensed', sans-serif", fontSize: Math.round(th * 0.17) + "px", fontStyle: "italic bold", color: "#cfe0ff" }).setOrigin(0.5).setDepth(2);
      this.tronT = this.add.text(W / 2, ty + th * 0.6, String(b.t || "Booster").slice(0, 26).toUpperCase(), { fontFamily: "Anton, Impact, sans-serif", fontSize: Math.round(th * 0.32) + "px", color: "#ffd23f", align: "center" }).setOrigin(0.5).setDepth(2).setShadow(0, 0, "#ffd23f", 14, true, true);
      if (this.tronT.width > tw - 20) this.tronT.setScale((tw - 20) / this.tronT.width);
      this.tron = { x: W / 2, y: ty + th / 2 };
      // la rampe d'entrée, en perspective
      const ry = ty + th + 10, rt = W * 0.24, rb = W * 1.3;
      poly([W / 2 - rt / 2, ry, W / 2 + rt / 2, ry, W / 2 + rb / 2, H, W / 2 - rb / 2, H], 0x163f92);
      poly([W / 2 - rt / 2 + 4, ry, W / 2 + rt / 2 - 4, ry, W / 2 + rb / 2 - 30, H, W / 2 - rb / 2 + 30, H], 0x2156bf, 0.8);
      for (let k = 1; k < 10; k++) { const t = k / 10, y = ry + (H - ry) * t * t, hw = (rt + (rb - rt) * t * t) / 2; g.lineStyle(2, 0xffffff, 0.06); g.lineBetween(W / 2 - hw, y, W / 2 + hw, y); }
      // les colonnes de feu (elles s'allument pour une SSR)
      this.pyro = [W * 0.07, W * 0.93].map(x => { const c = this.add.graphics().setDepth(2); c.fillGradientStyle(0xffd23f, 0xffd23f, 0xe63946, 0xe63946, 0, 0, 1, 1); c.fillRect(-13, -H * 0.36, 26, H * 0.36); c.setPosition(x, H); c.scaleY = 0.25; c.alpha = 0.7; return c; });
      this.corner = { x: this.tron.x, y: this.tron.y }; // SSR : entrée spéciale depuis l'écran géant
      this.center = { x: W / 2, y: H * 0.56 };
      this.tearG = this.add.graphics().setDepth(6);
      this.addPack(glow, label);
    }
    // le sachet (choix de Jose du 15 nov., finition « alu brillant ») : dessiné sur des canvas par pack.js, le corps et la bande du haut
    // à part (pour la déchirure), lueur de la couleur de l'alu, reflet qui passe (effet Shine de Phaser) et petites étoiles.
    // Il tombe de l'écran géant sur le ring ; pour une Méga, un nouveau sachet arrive après chaque série de 5 cartes.
    addPack(glow, label) {
      if (this.pack) { this.tweens.killTweensOf(this.pack.list.concat([this.pack])); this.pack.destroy(); this.pack = null; }
      this.glow = glow; this.packN = (this.packN || 0) + 1;
      const W = this.W, bw = Math.round(Math.min(W * 0.46, 200)), bh = Math.round(bw * 1.7), key = "tpk" + this.packN;
      const tex = (k, cv) => { if (this.textures.exists(k)) this.textures.remove(k); this.textures.addCanvas(k, cv); return k; };
      const src = this.textures.exists("bimg") ? this.textures.get("bimg").getSourceImage() : null, ok = !!(src && sameO(src.src));
      const jag = tearJag(bw, bh), gm = 26;
      const pk = this.add.container(W / 2, this.tron.y).setDepth(3).setScale(0.15);
      pk.add(this.add.ellipse(0, bh / 2 + 18, bw * 1.1, 26, 0x000000, 0.45));
      pk.add(this.add.image(0, 0, tex(key + "g", paintGlow(b, bw, bh, gm))).setDisplaySize(bw + 2 * gm, bh + 2 * gm));
      const body = this.add.image(0, 0, tex(key + "b", paintPack(b, bw, bh, "body", jag, ok ? src : null))).setDisplaySize(bw, bh);
      pk.add(body);
      // image d'un autre site (le canvas ne peut pas la dessiner) : posée entre les soudures
      if (src && !ok) { const im = this.add.image(0, 0, "bimg"), iw = im.width, ih = im.height, tw = bw, th = bh * 0.74, k = Math.max(tw / iw, th / ih), cw = tw / k, ch = th / k; im.setCrop((iw - cw) / 2, (ih - ch) / 2, cw, ch); im.setScale(k); im.y = bh * 0.03; pk.add(im); }
      if (b.logo && this.textures.exists("blogo")) { const im = this.add.image(0, -bh * 0.17, "blogo"); const k = Math.min((bw * 0.62) / im.width, (bh * 0.28) / im.height); im.setScale(k); pk.add(im); }
      pk.add(this.add.text(0, bh * 0.315, String(b.t || "Booster").slice(0, 30).toUpperCase(), { fontFamily: "Anton, Impact, sans-serif", fontSize: Math.round(bw * 0.1) + "px", color: "#ffffff", align: "center", wordWrap: { width: bw * 0.86 }, stroke: "#000", strokeThickness: 4 }).setOrigin(0.5, 1));
      pk.add(this.add.text(0, bh * 0.355, String(label || packTag(b)).toUpperCase(), { fontFamily: "'Barlow Condensed', sans-serif", fontStyle: "bold", fontSize: Math.round(bw * 0.066) + "px", color: "#0b1636", backgroundColor: "#e8f0ff", padding: { x: 8, y: 2 } }).setOrigin(0.5));
      // petites étoiles
      if (!this.textures.exists("tstar")) { const g = this.make.graphics({ add: false }); g.fillStyle(0xffffff); g.fillPoints([{ x: 8, y: 0 }, { x: 9.6, y: 6.4 }, { x: 16, y: 8 }, { x: 9.6, y: 9.6 }, { x: 8, y: 16 }, { x: 6.4, y: 9.6 }, { x: 0, y: 8 }, { x: 6.4, y: 6.4 }], true); g.generateTexture("tstar", 16, 16); g.destroy(); }
      [[-0.34, -0.22, 1], [0.33, -0.1, 0.7], [-0.26, 0.08, 0.75], [0.27, 0.18, 0.55]].forEach((p, i) => { const st = this.add.image(p[0] * bw, p[1] * bh, "tstar").setScale(0.2).setAlpha(0).setBlendMode("ADD"); pk.add(st); this.tweens.add({ targets: st, alpha: 1, scale: p[2], angle: 45, duration: 1300, yoyo: true, repeat: -1, delay: 400 + i * 650, ease: "Sine.easeInOut" }); });
      // la bande du haut (qu'on déchire le long du pointillé) : un morceau à part
      const sy = -bh / 2 + bh * 0.07, strip = this.add.container(0, sy), si = this.add.image(0, -sy, tex(key + "s", paintPack(b, bw, bh, "strip", jag, ok ? src : null))).setDisplaySize(bw, bh);
      strip.add(si); pk.add(strip);
      // le reflet qui passe (WebGL seulement)
      [body, si].forEach(o => { try { if (o.preFX) o.preFX.addShine(0.45, 0.35, 3); } catch (e) {} });
      this.pack = pk; this.strip = strip; this.bw = bw; this.bh = bh;
      // le sachet tombe sur le ring
      this.tweens.add({ targets: pk, y: this.center.y - bh * 0.1, scale: 1, duration: 1000, ease: "Back.easeOut", onComplete: () => { this.cameras.main.shake(220, 0.01); SFX.bell(1); this.events.emit("landed"); this.tweens.add({ targets: pk, scale: 1.035, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }); } });
      this.tweens.add({ targets: pk, angle: { from: -540, to: 0 }, duration: 1000, ease: "Quad.easeOut" });
    }
    // texte de l'écran géant
    say(t, sub) { if (this.tronT) { this.tronT.setText(String(t || "").toUpperCase()).setScale(1); const mw = this.W * 0.86 - 20; if (this.tronT.width > mw) this.tronT.setScale(mw / this.tronT.width); } if (this.tronS && sub != null) this.tronS.setText(sub); }
    // colonnes de feu
    fire(ms) {
      (this.pyro || []).forEach((c, i) => { this.tweens.killTweensOf(c); c.alpha = 1; this.tweens.add({ targets: c, scaleY: 1, duration: 260, ease: "Back.easeOut" }); this.tweens.add({ targets: c, alpha: 0.75, duration: 90, yoyo: true, repeat: Math.round((ms || 1600) / 180) });
        if (this.textures.exists("tdot2")) { const pe = this.add.particles(0, 0, "tdot2", { speed: { min: 80, max: 260 }, angle: { min: 250, max: 290 }, lifespan: 700, scale: { start: 0.7, end: 0 }, tint: [0xffd23f, 0xe63946, 0xffffff], blendMode: "ADD", emitting: false }).setDepth(3); pe.explode(36, c.x, this.H - this.H * 0.36); }
        this.time.delayedCall(ms || 1600, () => this.tweens.add({ targets: c, scaleY: 0.25, alpha: 0.7, duration: 400 })); });
    }
    // zone du haut du booster (pour savoir si le doigt la traverse)
    stripBox() { const p = this.pack; return { x: p.x - this.bw / 2, y: p.y - this.bh / 2, w: this.bw, h: this.bh * 0.24 }; }
    tearLine(x0, x1, y) { this.tearG.clear(); this.tearG.lineStyle(3, 0xffffff, 0.9); this.tearG.lineBetween(x0, y, x1, y); }
    // déchirure : la bande s'envole, la lumière sort du booster (couleur selon la meilleure carte)
    tear() {
      this.tearG.clear(); this.tweens.killTweensOf(this.pack); this.pack.setScale(1);
      const col = { white: 0xffffff, violet: 0xb25ce0, gold: 0xffd23f, rainbow: 0xffffff }[this.glow] || 0xffffff;
      this.tweens.add({ targets: this.strip, y: this.strip.y - 160, x: 80, angle: 70, alpha: 0, duration: 700, ease: "Quad.easeOut" });
      const top = { x: this.pack.x, y: this.pack.y - this.bh * 0.36 };
      for (let i = 0; i < 12; i++) { const r = this.add.rectangle(top.x, top.y, 8, 260, this.glow === "rainbow" ? [0xff5a5a, 0xf2c230, 0x3fdc7a, 0x5cc8f0, 0x9b5de5][i % 5] : col, 0.35).setOrigin(0.5, 1).setBlendMode("ADD").setAngle(-60 + i * 11).setDepth(4); this.tweens.add({ targets: r, scaleY: { from: 0.1, to: 1.6 }, alpha: 0, duration: 900, delay: i * 25, onComplete: () => r.destroy() }); }
      this.cameras.main.flash(300, 255, 245, 220);
      this.tweens.add({ targets: this.pack, y: this.pack.y + 40, alpha: 0.25, duration: 600, delay: 300 });
    }
    // SSR : le dos de la carte saute sur la 3e corde, explosion de lumière, puis revient au centre
    jump(rainbow) {
      return new Promise(res => {
        const w = Math.min(this.W * 0.3, 140), h = w * 1.45, back = this.add.container(this.pack.x, this.pack.y).setDepth(7), bg = this.add.graphics();
        const img = this.textures.exists("cback"), cols = [0xff5a5a, 0xf2c230, 0x3fdc7a, 0x5cc8f0, 0x9b5de5];
        if (img) { const im = this.add.image(0, 0, "cback"); im.setDisplaySize(w, h); back.add(im); }
        if (rainbow) cols.forEach((c, i) => { bg.fillStyle(c, img ? 0.35 : 1); bg.fillRect(-w / 2, -h / 2 + i * h / 5, w, h / 5 + 1); });
        else if (!img) { bg.fillStyle(0x0f1d48); bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10); }
        bg.lineStyle(4, 0xffd23f, 1); bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
        back.add(bg); if (!img) back.add(this.add.text(0, 0, "TCCCG", { fontFamily: "Anton, Impact, sans-serif", fontSize: "22px", color: rainbow ? "#ffffff" : "#ffd23f", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5));
        back.setScale(0.2);
        // le public se lève, les colonnes de feu s'allument, l'écran géant annonce l'entrée
        this.tweens.add({ targets: this.crowd, y: -6, duration: 260, yoyo: true, repeat: 4 });
        this.fire(2200); this.say(rainbow ? "Entrée légendaire !" : "Entrée spéciale !", "Le public se lève");
        SFX.crowd(true); setTimeout(() => SFX.crowd(false), 2600);
        this.tweens.add({ targets: back, x: this.corner.x - 10, y: this.corner.y - h * 0.5, scale: 0.6, angle: 360, duration: 650, ease: "Sine.easeOut", onComplete: () => {
          this.cameras.main.flash(200, 255, 230, 160); this.cameras.main.shake(200, 0.012);
          const ex = this.add.particles(0, 0, "tdot2", { speed: { min: 120, max: 360 }, lifespan: 600, scale: { start: 0.9, end: 0 }, tint: rainbow ? [0xff5a5a, 0xf2c230, 0x3fdc7a, 0x5cc8f0, 0x9b5de5] : [0xffd23f, 0xffffff], blendMode: "ADD", emitting: false }).setDepth(8);
          ex.explode(46, this.corner.x - 10, this.corner.y - h * 0.5);
          this.time.delayedCall(350, () => this.tweens.add({ targets: back, x: this.W / 2, y: this.H * 0.42, scale: 1, angle: 720, duration: 650, ease: "Back.easeOut", onComplete: () => { this.cameras.main.shake(160, 0.008); res(back); } }));
        } });
      });
    }
  };
}

// ---------- l'écran d'invocation ----------
export async function summon(b, ids, opt) {
  opt = opt || {};
  const defs = ids.map(defOf).filter(Boolean); if (!defs.length) return;
  const tiers = defs.map(tierOf);
  // Méga = 3 sachets de 5 cartes, déchirés l'un après l'autre (choix de Jose du 15 nov.) ; la lumière d'un sachet = sa meilleure carte
  const per = opt.mega && defs.length > 5 ? 5 : defs.length, nPk = Math.ceil(defs.length / per);
  const glowOf = k => { const T = tiers.slice(k * per, k * per + per); return T.indexOf("lrp") >= 0 ? "rainbow" : T.indexOf("ssr") >= 0 ? "gold" : defs.slice(k * per, k * per + per).some(x => x.r === "SR") ? "violet" : "white"; };
  const pkLabel = k => nPk > 1 ? "Booster " + (k + 1) + " / " + nPk : "";
  let pk = 0, pending = 0;
  const ov = document.createElement("div"); ov.className = "tsum2"; document.body.appendChild(ov); document.body.classList.add("tgfull");
  ov.innerHTML = '<div class="tsstage2"></div><div class="tsui"><button class="tsskip2">Passer ⏭</button><p class="tshint2">Le booster arrive…</p><div class="tsflip" hidden><div class="tsfin"><div class="tsback"></div><div class="tsfront"></div></div></div><p class="tscount2"></p></div>';
  const ui = ov.querySelector(".tsui"), hint = ov.querySelector(".tshint2"), flipEl = ov.querySelector(".tsflip"), inner = ov.querySelector(".tsfin"), backEl = ov.querySelector(".tsback"), frontEl = ov.querySelector(".tsfront"), countEl = ov.querySelector(".tscount2");
  let game = null, scene = null, stage = "drop", idx = 0, busyT = 0, closed = false;
  const rel = backLayer(() => finish(true));
  const finish = (fromBack) => { if (closed) return; closed = true; if (!fromBack) rel(); try { game && game.destroy(true); } catch (e) {} ov.remove(); document.body.classList.remove("tgfull"); SFX.crowd(false); changed("tcg"); };
  SFX.unlock();
  // Phaser (sinon version simple)
  if (!simpleFx() && !opt.quick) {
    try {
      const Ph = await loadPhaser(), Sc = makeScene(Ph, b, glowOf(0), pkLabel(0));
      game = new Ph.Game({ type: Ph.AUTO, parent: ov.querySelector(".tsstage2"), backgroundColor: "#070d22", scale: { mode: Ph.Scale.RESIZE, width: innerWidth, height: innerHeight }, scene: [Sc], banner: false, audio: { noAudio: true } });
      await new Promise(r => { const chk = () => { const s = game.scene.getScene("summon"); if (s && s.pack) { scene = s; if (!s.textures.exists("tdot2")) { const gg = s.make.graphics({ add: false }); gg.fillStyle(0xffffff); gg.fillCircle(5, 5, 5); gg.generateTexture("tdot2", 10, 10); gg.destroy(); } r(); } else setTimeout(chk, 50); }; chk(); setTimeout(r, 4000); });
      await new Promise(r => { if (!scene) return r(); scene.events.once("landed", r); setTimeout(r, 1600); });
    } catch (e) { scene = null; }
  }
  if (closed) return;
  const tearHint = () => (nPk > 1 ? "<b>Booster " + (pk + 1) + " sur " + nPk + "</b> · " : "") + (scene ? "👆 Glisse ton doigt sur le <b>pointillé</b> pour déchirer le booster" : "👆 Touche le booster pour l’ouvrir");
  // sans Phaser (« Animations simples ») : le sachet en HTML
  const htmlPack = () => { ov.querySelector(".tsstage2").innerHTML = '<div class="tspack2">' + packHTML(b, { tag: pkLabel(pk) || undefined }) + "</div>"; };
  stage = "tear"; hint.innerHTML = tearHint();
  if (!scene && !opt.quick) htmlPack();
  const opened = () => { stage = "reveal"; hint.textContent = ""; SFX.finisher(); const hp = ov.querySelector(".tspack2"); if (hp) hp.classList.add("gone"); setTimeout(() => show(Math.max(pending, pk * per)), scene ? 700 : 200); };
  // sachet suivant d'une Méga (on arrive à la carte « target »)
  const nextPack = async (k, target) => {
    pk = k; pending = target; stage = "drop"; flipEl.hidden = true; countEl.textContent = ""; hint.textContent = "Booster " + (k + 1) + " sur " + nPk + "…";
    if (scene) { scene.say(b.t, "Booster " + (k + 1) + " sur " + nPk); scene.addPack(glowOf(k), pkLabel(k)); await new Promise(r => { scene.events.once("landed", r); setTimeout(r, 1600); }); }
    else htmlPack();
    if (closed || stage !== "drop") return;
    stage = "tear"; hint.innerHTML = tearHint();
  };
  // dévoiler la carte i
  const show = async i => {
    idx = i; if (i >= defs.length) return results();
    if (Math.floor(i / per) > pk) return nextPack(Math.floor(i / per), i);
    const def = defs[i], t = tiers[i];
    countEl.textContent = (i + 1) + " / " + defs.length;
    if (scene && scene.say) scene.say("Qui arrive ?", "Carte " + (i + 1) + " sur " + defs.length);
    frontEl.innerHTML = cardHTML(def, { nozoom: true });
    backEl.className = "tsback" + (t === "lrp" ? " rainbow" : t === "ssr" ? " gold" : "");
    backEl.innerHTML = backHTML(false);
    inner.className = "tsfin"; flipEl.hidden = true; busyT = Date.now() + 700;
    if (t !== "low") {
      stage = "spec"; hint.textContent = t === "lrp" ? "🌈 Incroyable !" : "🔥 Le public se lève !";
      if (scene) { const sprite = await scene.jump(t === "lrp"); if (t === "lrp") fireworks(6); else confetti(innerWidth / 2, innerHeight, 40); sprite.destroy(); }
      else { if (t === "lrp") fireworks(6); }
      if (closed) return;
      flipEl.hidden = false; flipEl.classList.add("glow"); stage = "back"; hint.innerHTML = "👈 Glisse pour <b>dévoiler</b> la carte"; busyT = Date.now() + 500;
      return;
    }
    flipEl.hidden = false; flipEl.classList.remove("glow"); reveal();
  };
  const reveal = () => {
    stage = "face"; inner.classList.add("flip"); busyT = Date.now() + 900;
    if (scene && scene.say) { const dd = defs[idx]; scene.say(dd.r + " : " + dd.name, "Carte " + (idx + 1) + " sur " + defs.length); if (tiers[idx] !== "low") scene.fire(1400); }
    const t = tiers[idx], c = flipEl.getBoundingClientRect(), x = c.left + c.width / 2, y = c.top + c.height / 2;
    setTimeout(() => { if (t === "lrp") { flash(0xffffff, 600); burst(x, y, 70, 0xff8ad8); wave(x, y, 0xffd23f, 260); fireworks(4); } else if (t === "ssr") { flash(0xfff2c4, 420); burst(x, y, 50); wave(x, y, 0xffd23f, 200); } else if (defs[idx].r === "SR") burst(x, y, 20, 0xb25ce0); if (t !== "low") { SFX.hit(true); try { navigator.vibrate && navigator.vibrate([30, 40, 60]); } catch (e) {} } }, 380);
    hint.innerHTML = idx < defs.length - 1 ? "👈 Glisse à gauche pour la suivante" : "👈 Glisse pour voir toutes tes cartes";
  };
  const next = () => { if (Date.now() < busyT) return; flipEl.classList.add("out"); setTimeout(() => { flipEl.classList.remove("out"); show(idx + 1); }, 260); };
  // « Passer » : jusqu'à la prochaine SSR (qui garde son animation), sinon le résultat
  ov.querySelector(".tsskip2").addEventListener("click", e => {
    e.stopPropagation();
    if (stage === "drop" || stage === "tear") { if (scene) scene.tear(); return opened(); }
    if (stage === "res") return;
    const k = tiers.findIndex((t, i) => i > idx && t !== "low");
    if (stage === "back") return reveal();
    if (k > 0) show(k); else results();
  });
  // gestes : glisser (déchirer, dévoiler, suivante) ou toucher
  let p0 = null, tearing = false;
  ov.addEventListener("dragstart", e => e.preventDefault());
  ov.addEventListener("pointerdown", e => { if (e.target.closest(".tsres, .tsskip2")) return; p0 = { x: e.clientX, y: e.clientY }; tearing = false;
    if (stage === "tear" && scene) { const sb = scene.stripBox(); tearing = e.clientY >= sb.y - 30 && e.clientY <= sb.y + sb.h + 30; } });
  ov.addEventListener("pointermove", e => { if (!p0 || !tearing || !scene) return; scene.tearLine(p0.x, e.clientX, scene.stripBox().y + scene.bh * 0.125); });
  ov.addEventListener("pointerup", e => {
    if (!p0) return; const dx = e.clientX - p0.x, dy = e.clientY - p0.y, sw = Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy); const was = p0; p0 = null;
    if (stage === "tear") { if (!scene) return opened(); if (tearing && Math.abs(dx) > scene.bw * 0.45) { scene.tear(); opened(); } else { scene.tearG.clear(); if (!tearing) hint.innerHTML = (nPk > 1 ? "<b>Booster " + (pk + 1) + " sur " + nPk + "</b> · " : "") + "👆 Glisse ton doigt sur le <b>pointillé</b>, d’un bord à l’autre"; } return; }
    if (stage === "back" && (sw || Math.abs(dx) < 10)) return reveal();
    if (stage === "face" && (sw && dx < 0 || Math.abs(dx) < 10 && Math.abs(dy) < 10)) return next();
    void was;
  });
  // ---------- résultat ----------
  const results = () => {
    stage = "res"; ui.querySelector(".tsskip2").hidden = true; flipEl.hidden = true; hint.textContent = ""; countEl.textContent = "";
    const iids = (opt.iids || []).slice(), pick = new Set();
    const box = document.createElement("div"); box.className = "tsres"; ui.appendChild(box);
    const draw = () => {
      const d = me(), A = opt.again;
      box.innerHTML = "<h2>" + esc(b.t) + '</h2><p class="tnote">' + defs.length + " carte" + (defs.length > 1 ? "s" : "") + (iids.length ? " · touche des cartes pour les choisir" : "") + "</p>" +
        '<div class="trgrid">' + defs.map((x, i) => { const iid = iids[i], inst = iid && d.cards[iid]; return '<div class="tsrc' + (pick.has(i) ? " pick" : "") + (inst ? "" : " gone") + '" data-i="' + i + '">' + cardHTML(inst ? Object.assign({ iid: iid }, inst) : x, { small: true, cls: inst && d.fav.indexOf(iid) >= 0 ? "isfav" : "" }) + "</div>"; }).join("") + "</div>" +
        (iids.length ? '<div class="tsrbar"><button class="btn small ghost" data-r="all">Tout</button><button class="btn small ghost" data-r="fav"' + (pick.size ? "" : " disabled") + '>⭐ Favori</button><button class="btn small ghost" data-r="med"' + (pick.size ? "" : " disabled") + '>🏅 Médaille</button><button class="btn small danger" data-r="fire"' + (pick.size ? "" : " disabled") + ">💸 Virer</button></div>" : "") +
        '<div class="tsragain">' + (A && A.simple ? '<button class="btn" data-r="again"' + (A.ok() ? "" : " disabled") + ">↻ Simple · " + esc(A.price) + "</button>" : "") + (A && A.multi ? '<button class="btn gold" data-r="againm"' + (A.okm() ? "" : " disabled") + ">↻ Multi ×15 · 🎟️ " + A.mprice + "</button>" : "") + "</div>" +
        '<div class="btns"><button class="btn ghost" data-r="back">Retour au Call Up</button><button class="btn ghost" data-r="roster">Mon roster</button></div>';
    };
    draw();
    let armed = "";
    box.addEventListener("click", e => {
      const c = e.target.closest(".tsrc"); if (c && !c.classList.contains("gone") && iids.length) { const i = +c.dataset.i; if (pick.has(i)) pick.delete(i); else pick.add(i); armed = ""; return draw(); }
      const r = (e.target.closest("[data-r]") || {}).dataset; if (!r || !r.r) return;
      if (r.r === "all") { defs.forEach((x, i) => { if (me().cards[iids[i]]) pick.add(i); }); return draw(); }
      if (r.r === "back") { finish(); location.hash = "#/tccg/callup"; return; }
      if (r.r === "roster") { finish(); location.hash = "#/tccg/roster"; return; }
      if (r.r === "again" || r.r === "againm") { finish(); setTimeout(() => ACT.tcgopen({ dataset: { id: opt.again.id, mega: r.r === "againm" ? "1" : "" } }), 50); return; }
      const L = [...pick].map(i => iids[i]).filter(Boolean);
      if (r.r === "fav") { commit(d => { L.forEach(iid => { if (d.cards[iid] && d.fav.indexOf(iid) < 0) d.fav.push(iid); }); }); toast("⭐ En favori"); pick.clear(); return draw(); }
      if (r.r === "med" || r.r === "fire") {
        if (armed !== r.r) { armed = r.r; e.target.textContent = r.r === "med" ? "Confirmer : " + L.length + " médaille(s)" : "Confirmer : virer " + L.length; return; }
        armed = "";
        const SELL = { N: 50, R: 120, SR: 300, SSR: 800, UR: 2000, LR: 5000 };
        commit(d => { L.forEach(iid => { const it = d.cards[iid]; if (!it || d.fav.indexOf(iid) >= 0) return; if (it.eq) d.items[it.eq] = (d.items[it.eq] || 0) + 1;
          if (r.r === "med") { const bc = cardById(String(it.c).split(/[@#~]/)[0]), n = bc ? bc.name : ((defOf(it.c) || {}).name || "Catcheur"); d.medals[n] = (d.medals[n] || 0) + 1; } else d.res.money += SELL[it.r] || 0;
          delete d.cards[iid]; }); });
        toast(r.r === "med" ? "🏅 Médailles ajoutées" : "💸 Cartes virées (les favorites sont gardées)"); pick.clear(); return draw();
      }
    });
  };
  // ouverture rapide (Call Up) : toutes les cartes d'un coup, sans l'entrée
  if (opt.quick) { SFX.finisher(); results(); }
}
void owned;
