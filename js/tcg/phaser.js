// TCCCG — Phaser (moteur de jeu, js/vendor/phaser.min.js, copié par le robot « Phaser pour le TCCCG ») : chargé seulement
// quand on en a besoin (invocation, combat, mini-jeux, évolution). Si le fichier ne se charge pas, les animations passent
// en version simple : le jeu reste jouable.
let P = null;
export function loadPhaser() {
  if (window.Phaser) return Promise.resolve(window.Phaser);
  if (P) return P;
  P = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = "js/vendor/phaser.min.js"; s.async = true;
    s.onload = () => window.Phaser ? res(window.Phaser) : rej(new Error("phaser"));
    s.onerror = () => { P = null; rej(new Error("phaser")); };
    document.head.appendChild(s);
  });
  return P;
}
const RM = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
// petite texture blanche (étincelle, confetti) fabriquée une fois
function tex(scene) {
  if (scene.textures.exists("tdot")) return;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0xffffff); g.fillCircle(5, 5, 5); g.generateTexture("tdot", 10, 10); g.clear();
  g.fillStyle(0xffffff); g.fillRect(0, 0, 6, 11); g.generateTexture("tconf", 6, 11); g.clear();
  g.fillStyle(0xffffff); g.fillTriangle(0, 6, 22, 0, 22, 12); g.generateTexture("tray", 22, 12); g.destroy();
}
// ---------- calque d'effets : un canvas transparent au-dessus de tout, qui ne bloque pas les doigts ----------
let FX = null, FXP = null;
export function fx() {
  if (FX) return Promise.resolve(FX);
  if (FXP) return FXP;
  FXP = loadPhaser().then(Ph => new Promise(res => {
    let el = document.getElementById("tfxlayer");
    if (!el) { el = document.createElement("div"); el.id = "tfxlayer"; document.body.appendChild(el); }
    class Scene extends Ph.Scene {
      constructor() { super("tfx"); }
      create() {
        tex(this);
        this.spark = this.add.particles(0, 0, "tdot", { speed: { min: 160, max: 460 }, angle: { min: 0, max: 360 }, lifespan: { min: 280, max: 700 }, scale: { start: 0.9, end: 0 }, tint: [0xffd36b, 0xffffff, 0xff8a3d], blendMode: "ADD", emitting: false });
        this.conf = this.add.particles(0, 0, "tconf", { speedY: { min: -640, max: -340 }, speedX: { min: -160, max: 160 }, gravityY: 700, lifespan: 1700, rotate: { min: 0, max: 360 }, tint: [0xf0cf62, 0xe0533d, 0x3d8be0, 0x3dbb6a, 0xffffff, 0xb25ce0], emitting: false });
        this.firew = this.add.particles(0, 0, "tdot", { speed: { min: 80, max: 300 }, angle: { min: 0, max: 360 }, lifespan: 1200, gravityY: 160, scale: { start: 0.7, end: 0 }, tint: [0xff5a5a, 0x5cc8f0, 0xf0cf62, 0x3fdc7a, 0xb25ce0, 0xffffff], blendMode: "ADD", emitting: false });
        FX = this; res(this);
      }
      // éclats lumineux à un point de l'écran (coordonnées de la page)
      burst(x, y, n, tint) { if (RM()) n = Math.min(n, 8); if (tint) this.spark.setParticleTint(tint); this.spark.explode(n || 24, x, y); if (tint) this.spark.setParticleTint(0xffd36b); }
      confetti(x, y, n) { this.conf.explode(RM() ? 12 : n || 40, x == null ? this.scale.width / 2 : x, y == null ? this.scale.height : y); }
      fireworks(k) { const W = this.scale.width, H = this.scale.height; for (let i = 0; i < (k || 5); i++) this.time.delayedCall(i * 260, () => this.firew.explode(RM() ? 10 : 46, W * (0.15 + Math.random() * 0.7), H * (0.12 + Math.random() * 0.35))); }
      // onde de choc (cercle qui s'agrandit)
      wave(x, y, color, r) { const c = this.add.circle(x, y, 10, color || 0xf0cf62, 0).setStrokeStyle(4, color || 0xf0cf62, 0.9); this.tweens.add({ targets: c, radius: r || 160, alpha: 0, duration: 520, ease: "Quad.easeOut", onUpdate: () => c.setStrokeStyle(4, color || 0xf0cf62, c.alpha), onComplete: () => c.destroy() }); }
      // texte qui saute (dégâts, PARFAIT…)
      pop(x, y, s, color, size) { const t = this.add.text(x, y, s, { fontFamily: "system-ui, sans-serif", fontSize: (size || 28) + "px", fontStyle: "900", color: color || "#ffffff", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5); t.setScale(0.4); this.tweens.add({ targets: t, scale: 1, duration: 180, ease: "Back.easeOut" }); this.tweens.add({ targets: t, y: y - 60, alpha: 0, delay: 520, duration: 600, onComplete: () => t.destroy() }); }
      // flash plein écran
      flash(color, ms) { if (RM()) return; const r = this.add.rectangle(0, 0, this.scale.width, this.scale.height, color == null ? 0xffffff : color, 0.85).setOrigin(0); this.tweens.add({ targets: r, alpha: 0, duration: ms || 420, onComplete: () => r.destroy() }); }
      // rayons de lumière tournants (arc-en-ciel pour une carte qui peut devenir LR)
      rays(x, y, rainbow, ms) {
        const g = this.add.container(x, y), cols = rainbow ? [0xff5a5a, 0xf2c230, 0x3fdc7a, 0x5cc8f0, 0x9b5de5, 0xff8ad8] : [0xf0cf62];
        for (let i = 0; i < 14; i++) { const r = this.add.image(0, 0, "tray").setOrigin(0, 0.5).setScale(16, 5).setAlpha(0.22).setTint(cols[i % cols.length]).setBlendMode("ADD"); r.rotation = i * Math.PI * 2 / 14; g.add(r); }
        this.tweens.add({ targets: g, angle: 360, duration: 6000, repeat: -1 });
        g.setAlpha(0); this.tweens.add({ targets: g, alpha: 1, duration: 300 });
        const stop = () => this.tweens.add({ targets: g, alpha: 0, duration: 300, onComplete: () => g.destroy() });
        if (ms) this.time.delayedCall(ms, stop);
        return stop;
      }
    }
    new Ph.Game({ type: Ph.AUTO, parent: el, transparent: true, scale: { mode: Ph.Scale.RESIZE, width: innerWidth, height: innerHeight }, scene: [Scene], banner: false, input: false, audio: { noAudio: true } });
  })).catch(e => { FXP = null; throw e; });
  return FXP;
}
// raccourcis sans erreur si Phaser n'est pas là (le jeu continue sans effets)
const call = (m, a) => fx().then(s => { try { s[m].apply(s, a); } catch (e) {} }).catch(() => {});
export const burst = (...a) => call("burst", a);
export const confetti = (...a) => call("confetti", a);
export const fireworks = (...a) => call("fireworks", a);
export const wave = (...a) => call("wave", a);
export const pop = (...a) => call("pop", a);
export const flash = (...a) => call("flash", a);
export const rays = (...a) => fx().then(s => s.rays.apply(s, a)).catch(() => () => {});
// centre d'un élément de la page
export const mid = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
export function shake(el, ms) { if (!el || RM()) return; el.classList.remove("tshk"); void el.offsetWidth; el.classList.add("tshk"); setTimeout(() => el.classList.remove("tshk"), ms || 400); }
