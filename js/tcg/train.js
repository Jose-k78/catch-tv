// TCCCG — entraînement (cahier de Jose du 12 nov.) : on choisit une carte, une stat (ou le niveau) et la difficulté
// (Low / Mid / Top = +1 / +3 / +5). Un mini-jeu rapide (Phaser) : Force = maintenir puis relâcher au bon moment pour soulever
// la barre ; Agilité = sauter les obstacles 10 s ; Charisme = toucher les ronds autour du micro ; Endurance = taper le plus
// vite sur le tapis ; Technique = sauter à la corde au bon moment 10 s ; Niveau = combat rapide (toucher / glisser façon osu)
// qui donne de l'XP. 5 entraînements de stats par carte ; un mini-jeu raté se recommence (rien n'est payé).
// Coût (payé seulement si c'est réussi) : Momentum, Pop et Push.
import { S, ACT, changed } from "../state.js";
import { esc, toast, backLayer } from "../util.js";
import { STATS, defOf, statsOf, ARCH } from "./data.js";
import { me, commit, owned, cardXp, CXP, bump } from "./store.js";
import { cardHTML } from "./card.js";
import { loadPhaser, burst, confetti } from "./phaser.js";
import { SFX } from "./sfx.js";

const DIFF = { low: { n: "Low", b: 1, cost: 20, k: 0 }, mid: { n: "Mid", b: 3, cost: 45, k: 1 }, top: { n: "Top", b: 5, cost: 80, k: 2 } };
const GAMES = [
  { st: 0, ic: "🏋️", n: "Force", d: "Maintiens pour soulever, relâche dans la zone verte" },
  { st: 1, ic: "🏃", n: "Agilité", d: "Touche pour sauter les obstacles pendant 10 s" },
  { st: 2, ic: "🎤", n: "Charisme", d: "Touche les ronds autour du micro avant qu’ils disparaissent" },
  { st: 3, ic: "🏃‍♂️", n: "Endurance", d: "Tape le plus vite possible sur l’écran" },
  { st: 4, ic: "🪢", n: "Technique", d: "Saute à la corde : touche quand la corde passe en bas" },
  { st: -1, ic: "⚡", n: "Niveau", d: "Combat rapide : touche les ronds, glisse sur les traits. Donne de l’XP" }
];
const MAXTR = 5;
let tdiff = "low";
ACT.tcgtdiff = el => { tdiff = el.dataset.v; changed("tcg"); };
// la page Entraînement (dans le Roster)
export function trainView(iid) {
  const d = me();
  if (!iid || !d.cards[iid]) {
    const L = owned(d).sort((a, b) => (a.trn || 0) - (b.trn || 0) || b.lv - a.lv);
    return '<p class="tnote">Choisis la carte à entraîner. 5 entraînements de stats par carte (+1, +3 ou +5 selon la difficulté) ; l’entraînement « Niveau » donne de l’XP sans limite.</p><div class="trgrid">' +
      L.map(x => '<a class="ttrpick" href="#/tccg/roster/entrainement/' + encodeURIComponent(x.iid) + '">' + cardHTML(x, { small: true }) + "<small>🏋️ " + (x.trn || 0) + " / " + MAXTR + "</small></a>").join("") + "</div>";
  }
  const inst = Object.assign({ iid: iid }, d.cards[iid]), def = defOf(inst.c), st = statsOf(inst), D = DIFF[tdiff], left = MAXTR - (inst.trn || 0), ok = d.res.mom >= D.cost && d.res.pop >= D.cost && d.res.push >= D.cost;
  return '<a class="back" href="#/tccg/roster/entrainement">‹ Autre carte</a><div class="ttrhead">' + cardHTML(inst, { small: true }) + "<div><b>" + esc(def.name) + "</b><small>Entraînements de stats : " + (inst.trn || 0) + " / " + MAXTR + "</small><small>Coût si réussi : ⚡⭐📣 " + D.cost + " chacun</small></div></div>" +
    '<div class="tdiff">' + Object.keys(DIFF).map(k => '<button class="tdf ' + k + (tdiff === k ? " on" : "") + '" data-act="tcgtdiff" data-v="' + k + '"><b>' + DIFF[k].n + "</b><small>+" + DIFF[k].b + " · plus dur</small></button>").join("") + "</div>" +
    '<div class="list ttrlist">' + GAMES.map(g => { const can = g.st < 0 || left > 0;
      return '<button class="item ttrg" data-act="tcgtrain" data-iid="' + esc(iid) + '" data-s="' + g.st + '"' + (can && ok ? "" : " disabled") + '><span class="ttric">' + g.ic + '</span><span class="lbl"><b>' + g.n + (g.st >= 0 ? " · " + st[g.st] + " → " + (st[g.st] + D.b) : " · Nv " + inst.lv) + "</b><small>" + esc(g.d) + (g.st >= 0 && !left ? " · plus d’entraînement possible" : "") + "</small></span><span>▶</span></button>"; }).join("") + "</div>" +
    (ok ? "" : '<p class="tnote">Il te faut ⚡⭐📣 ' + D.cost + " de chaque : gagne-en en combat.</p>");
}
ACT.tcgtrainview = trainView;
ACT.tcgtrain = el => {
  const iid = el.dataset.iid, si = +el.dataset.s, d = me(), inst = d.cards[iid]; if (!inst) return;
  const D = DIFF[tdiff], g = GAMES.find(x => x.st === si);
  if (si >= 0 && (inst.trn || 0) >= MAXTR) return toast("Cette carte a fait ses 5 entraînements");
  if (!(d.res.mom >= D.cost && d.res.pop >= D.cost && d.res.push >= D.cost)) return toast("Pas assez de Momentum / Pop / Push");
  play(g, D, inst).then(r => {
    if (!r || !r.ok) { if (r && !r.quit) toast("Raté… tu peux recommencer (rien n’a été payé)"); return; }
    let msg = "";
    commit(dd => { const it = dd.cards[iid]; if (!it) return; if (!(dd.res.mom >= D.cost && dd.res.pop >= D.cost && dd.res.push >= D.cost)) return;
      dd.res.mom -= D.cost; dd.res.pop -= D.cost; dd.res.push -= D.cost;
      if (si >= 0) { if ((it.trn || 0) >= MAXTR) return; it.tr = Array.isArray(it.tr) ? it.tr.slice(0, 5) : [0, 0, 0, 0, 0]; while (it.tr.length < 5) it.tr.push(0); it.tr[si] += D.b; it.trn = (it.trn || 0) + 1; msg = "🏋️ " + STATS[si] + " +" + D.b + " !"; }
      else { const xp = Math.round(CXP(it.lv) * (D.k + 1) * 1.2 * Math.max(0.3, r.score || 1)); const up = cardXp(it, xp); msg = "⚡ +" + xp + " XP" + (up ? " · +" + up + " niveau" + (up > 1 ? "x" : "") : ""); }
      bump(dd, "train"); });
    if (msg) { toast(msg); confetti(); }
  });
};
// ---------- les mini-jeux ----------
function play(g, D, inst) {
  return new Promise(async res => {
    let Ph; try { Ph = await loadPhaser(); } catch (e) { toast("Le mini-jeu n’a pas pu se charger"); return res(null); }
    const ov = document.createElement("div"); ov.className = "ttrain"; ov.innerHTML = '<div class="ttstage"></div><button class="ttquit" aria-label="Quitter">✕</button>';
    document.body.appendChild(ov); document.body.classList.add("tgfull");
    let game = null, done = false;
    const finish = (r, fromBack) => { if (done) return; done = true; if (!fromBack) rel(); setTimeout(() => { try { game && game.destroy(true); } catch (e) {} ov.remove(); document.body.classList.remove("tgfull"); res(r); }, r && !r.quit ? 900 : 0); };
    const rel = backLayer(() => finish({ ok: false, quit: true }, true));
    ov.querySelector(".ttquit").addEventListener("click", () => finish({ ok: false, quit: true }));
    const def = defOf(inst.c), col = parseInt(((ARCH[def.arch] || {}).c || "#f0cf62").slice(1), 16);
    const Scene = makeGame(Ph, g, D, col, def.name, r => { if (r.ok) { SFX.bell(1); burst(innerWidth / 2, innerHeight / 2, 50); } finish(r); });
    SFX.unlock();
    game = new Ph.Game({ type: Ph.AUTO, parent: ov.querySelector(".ttstage"), backgroundColor: "#0b0a08", scale: { mode: Ph.Scale.RESIZE, width: innerWidth, height: innerHeight }, scene: [Scene], banner: false, audio: { noAudio: true } });
  });
}
function makeGame(Ph, g, D, col, name, done) {
  const k = D.k;
  return class G extends Ph.Scene {
    constructor() { super("tg"); }
    txt(x, y, s, size, color) { return this.add.text(x, y, s, { fontFamily: "system-ui, sans-serif", fontSize: (size || 18) + "px", fontStyle: "800", color: color || "#f4e8c8", align: "center", stroke: "#000", strokeThickness: 4, wordWrap: { width: this.W - 40 } }).setOrigin(0.5); }
    // petit catcheur dessiné (la couleur de son type)
    guy(x, y, s) { const c = this.add.container(x, y), gg = this.add.graphics(); s = s || 1; gg.fillStyle(0x1b1b1b); gg.fillRect(-10 * s, 10 * s, 8 * s, 26 * s); gg.fillRect(2 * s, 10 * s, 8 * s, 26 * s); gg.fillStyle(col); gg.fillRect(-13 * s, 0, 26 * s, 14 * s); gg.fillStyle(0xd9a37c); gg.fillRoundedRect(-14 * s, -30 * s, 28 * s, 32 * s, 8 * s); gg.fillCircle(0, -40 * s, 11 * s); c.add(gg); return c; }
    end(ok, score) { if (this.over) return; this.over = true; this.time.removeAllEvents(); this.input.removeAllListeners(); const t = this.txt(this.W / 2, this.H * 0.42, ok ? "RÉUSSI !" : "RATÉ", 46, ok ? "#f0cf62" : "#ff6b5a"); t.setScale(0.4); this.tweens.add({ targets: t, scale: 1, duration: 300, ease: "Back.easeOut" }); this.time.delayedCall(10, () => done({ ok: ok, score: score })); }
    create() {
      this.W = this.scale.width; this.H = this.scale.height; this.over = false;
      this.add.rectangle(0, 0, this.W, this.H, 0x0b0a08).setOrigin(0);
      this.txt(this.W / 2, 60, g.ic + " " + g.n + " · " + D.n, 22, "#f0cf62");
      this.help = this.txt(this.W / 2, 96, g.d, 14, "#cdbb85");
      const go = () => this["g" + (g.st < 0 ? 5 : g.st)]();
      const c = this.txt(this.W / 2, this.H / 2, "3", 70, "#ffffff"); let n = 3;
      this.time.addEvent({ delay: 600, repeat: 3, callback: () => { n--; if (n > 0) c.setText(String(n)); else if (n === 0) c.setText("GO !"); else { c.destroy(); go(); } } });
    }
    bar(y, w) { const bg = this.add.rectangle(this.W / 2, y, w, 16, 0x2a241a).setStrokeStyle(1, 0x5a4a2a), f = this.add.rectangle(this.W / 2 - w / 2, y, w, 16, 0xf0cf62).setOrigin(0, 0.5); f.scaleX = 0.001; return f; }
    timer(sec, cb) { const t = this.txt(this.W / 2, 130, sec + " s", 18); let s = sec; this.time.addEvent({ delay: 1000, repeat: sec - 1, callback: () => { s--; t.setText(s + " s"); if (s <= 0) cb(); } }); }
    // Force : maintenir, la jauge monte et redescend ; relâcher dans la zone verte. 2 levers réussis sur 3.
    g0() {
      const W = this.W, H = this.H, gy = H * 0.62, man = this.guy(W / 2, gy, 1.6), bar = this.add.rectangle(W / 2, gy - 50, 160, 8, 0x9a9a9a);
      const w1 = this.add.rectangle(W / 2 - 80, gy - 50, 18, 46, 0x333333), w2 = this.add.rectangle(W / 2 + 80, gy - 50, 18, 46, 0x333333);
      const gx = W - 50, gh = H * 0.42, gtop = H * 0.26, zone = [0.62 + k * 0.06, 0.82 - k * 0.04];
      this.add.rectangle(gx, gtop + gh / 2, 26, gh, 0x2a241a).setStrokeStyle(1, 0x5a4a2a);
      this.add.rectangle(gx, gtop + gh * (1 - zone[1]), 26, gh * (zone[1] - zone[0]), 0x3fdc7a, 0.6).setOrigin(0.5, 0);
      const cur = this.add.rectangle(gx, gtop + gh, 34, 6, 0xffffff);
      let hold = false, v = 0, dir = 1, tries = 0, good = 0; const info = this.txt(W / 2, H * 0.85, "Levers réussis : 0 / 2 (3 essais)", 16);
      this.input.on("pointerdown", () => { if (!this.over) { hold = true; v = 0; dir = 1; } });
      this.input.on("pointerup", () => { if (!hold || this.over) return; hold = false; tries++;
        const ok = v >= zone[0] && v <= zone[1]; if (ok) { good++; this.tweens.add({ targets: [bar, w1, w2], y: gy - 110, duration: 300, yoyo: true }); SFX.hit(true); } else { this.cameras.main.shake(150, 0.01); }
        info.setText("Levers réussis : " + good + " / 2 (" + (3 - tries) + " essai" + (3 - tries > 1 ? "s" : "") + " restant" + (3 - tries > 1 ? "s" : "") + ")");
        if (good >= 2) this.end(true); else if (tries - good >= 2 || tries >= 3) this.end(false); });
      this.events.on("update", () => { if (!hold || this.over) return; v += dir * (0.012 + k * 0.006); if (v >= 1) { v = 1; dir = -1; } if (v <= 0) { v = 0; dir = 1; } cur.y = gtop + gh * (1 - v); man.scaleY = 1 - v * 0.08; });
    }
    // Agilité : courir et sauter les obstacles pendant 10 s
    g1() {
      const W = this.W, H = this.H, gy = H * 0.66; this.add.rectangle(0, gy + 36, W, 4, 0x5a4a2a).setOrigin(0);
      const man = this.guy(70, gy, 1); let vy = 0, y = gy; const obs = [];
      this.input.on("pointerdown", () => { if (y >= gy - 1 && !this.over) { vy = -11 - k * 0.5; SFX.taunt(); } });
      const sp = 4.2 + k * 1.6;
      this.time.addEvent({ delay: 1100 - k * 230, loop: true, callback: () => { const h = 22 + Math.random() * (16 + k * 8), o = this.add.rectangle(W + 20, gy + 36 - h / 2, 22, h, 0xc0392b); obs.push(o); } });
      this.timer(10, () => this.end(true, 1));
      this.events.on("update", () => { if (this.over) return; vy += 0.6; y = Math.min(gy, y + vy); man.y = y; obs.forEach(o => { o.x -= sp; if (o.active && Math.abs(o.x - 70) < 22 && y + 36 > o.y - o.height / 2) { this.cameras.main.shake(200, 0.015); this.end(false); } }); });
    }
    // Charisme : des ronds autour du micro, à toucher avant qu'ils disparaissent
    g2() {
      const W = this.W, H = this.H; this.guy(W / 2, H * 0.78, 1.2); this.add.rectangle(W / 2 + 22, H * 0.78 - 40, 6, 20, 0x999999); this.add.circle(W / 2 + 22, H * 0.78 - 52, 7, 0x333333);
      const need = 8 + k * 2, total = 12 + k * 2; let hit = 0, shown = 0; const info = this.txt(W / 2, H * 0.9, "0 / " + need, 18);
      const spawn = () => { if (this.over) return; if (shown >= total) return this.time.delayedCall(900, () => this.end(hit >= need, hit / total)); shown++;
        const x = 50 + Math.random() * (W - 100), y = 160 + Math.random() * (H * 0.5), life = 1100 - k * 220, c = this.add.circle(x, y, 30, col, 0.9).setStrokeStyle(4, 0xffffff), ring = this.add.circle(x, y, 60, 0, 0).setStrokeStyle(3, 0xf0cf62);
        c.setInteractive(); c.on("pointerdown", () => { if (!c.active) return; hit++; info.setText(hit + " / " + need); burst(x + this.game.canvas.getBoundingClientRect().left, y + this.game.canvas.getBoundingClientRect().top, 12); c.destroy(); ring.destroy(); SFX.hit(false); });
        this.tweens.add({ targets: ring, scale: 0.5, duration: life, onComplete: () => { if (c.active) { c.destroy(); ring.destroy(); } } });
        this.time.delayedCall(life * 0.7, spawn); };
      spawn();
    }
    // Endurance : taper le plus vite possible (8 s)
    g3() {
      const W = this.W, H = this.H, need = 35 + k * 15, man = this.guy(W / 2, H * 0.6, 1.4); this.add.rectangle(W / 2, H * 0.6 + 52, 180, 14, 0x333333);
      const f = this.bar(H * 0.8, W - 80); let n = 0; const info = this.txt(W / 2, H * 0.86, "0 / " + need, 18);
      this.input.on("pointerdown", () => { if (this.over) return; n++; f.scaleX = Math.min(1, n / need); info.setText(n + " / " + need); man.y = H * 0.6 - (n % 2) * 6; if (n >= need) this.end(true, 1); });
      this.timer(8, () => this.end(n >= need, n / need));
    }
    // Technique : sauter à la corde quand elle passe en bas (10 s)
    g4() {
      const W = this.W, H = this.H, gy = H * 0.62, man = this.guy(W / 2, gy, 1.4), rope = this.add.graphics(); let a = 0, y = gy, vy = 0, miss = 0, last = -1;
      const allow = 2 - k, info = this.txt(W / 2, H * 0.86, "Ratés permis : " + allow, 16), sp = 0.07 + k * 0.025;
      this.input.on("pointerdown", () => { if (y >= gy - 1 && !this.over) vy = -9; });
      this.timer(10, () => this.end(true, 1));
      this.events.on("update", () => { if (this.over) return; a += sp; vy += 0.55; y = Math.min(gy, y + vy); man.y = y;
        const ry = gy + 10 - Math.cos(a) * 90; rope.clear(); rope.lineStyle(4, 0xf0cf62, 1); rope.beginPath(); rope.moveTo(W / 2 - 70, gy - 20); rope.lineTo(W / 2, ry + 40); rope.lineTo(W / 2 + 70, gy - 20); rope.strokePath();
        const turn = Math.floor((a - Math.PI) / (Math.PI * 2)); if (Math.cos(a) < -0.97 && turn !== last) { last = turn; if (y > gy - 18) { miss++; this.cameras.main.shake(120, 0.01); info.setText("Ratés permis : " + Math.max(0, allow - miss)); if (miss > allow) this.end(false); } } });
    }
    // Niveau : combat rapide façon osu (toucher les ronds numérotés, glisser sur les traits)
    g5() {
      const W = this.W, H = this.H, total = 10 + k * 2; let hit = 0, shown = 0; const info = this.txt(W / 2, H * 0.9, "0 / " + total, 18);
      this.guy(W * 0.25, H * 0.8, 1); const foe = this.guy(W * 0.75, H * 0.8, 1); foe.setScale(-1, 1);
      const spawn = () => { if (this.over) return; if (shown >= total) return this.time.delayedCall(800, () => this.end(true, hit / total)); shown++;
        const slide = Math.random() < 0.35, x = 60 + Math.random() * (W - 120), y = 170 + Math.random() * (H * 0.45), life = 1400 - k * 250;
        const c = this.add.circle(x, y, 28, col, 0.95).setStrokeStyle(4, 0xffffff), t = this.txt(x, y, String(shown), 18);
        let x2 = x, y2 = y, line = null, end2 = null;
        if (slide) { x2 = Math.max(50, Math.min(W - 50, x + (Math.random() < 0.5 ? -1 : 1) * 120)); y2 = Math.max(160, Math.min(H * 0.7, y + (Math.random() - 0.5) * 120)); line = this.add.line(0, 0, x, y, x2, y2, 0xf0cf62, 0.7).setOrigin(0).setLineWidth(10); end2 = this.add.circle(x2, y2, 18, 0xf0cf62, 0.8); c.setDepth(2); t.setDepth(3); }
        const kill = () => { [c, t, line, end2].forEach(o => o && o.destroy()); };
        c.setInteractive(); let drag = false;
        c.on("pointerdown", () => { if (!slide) { hit++; info.setText(hit + " / " + total); SFX.hit(false); this.cameras.main.shake(80, 0.004); return kill(); } drag = true; });
        if (slide) { this.input.on("pointerup", p => { if (!drag || !c.active) return; drag = false; if (Math.hypot(p.x - x2, p.y - y2) < 40) { hit++; info.setText(hit + " / " + total); SFX.hit(true); } kill(); }); }
        this.time.delayedCall(life, () => { if (c.active && !drag) kill(); });
        this.time.delayedCall(life * 0.65, spawn); };
      spawn();
    }
  };
}
