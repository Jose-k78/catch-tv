// TCCCG — sons des combats. Par défaut, l'app les fabrique elle-même (cloche, coups, public, provocation, finisher, victoire,
// défaite) ; le modo peut mettre ses propres fichiers dans ⚙️ Modo TCCCG › Musiques et assets (data/tcg.json « bgm »).
import { cfg } from "./data.js";

let C = null, crowdNode = null, music = null;
// réglage « Sons du jeu » (Paramètres du TCCCG)
export const muted = () => { try { return localStorage.getItem("ctv.tgsnd") === "off"; } catch (e) { return false; } };
const ctx = () => { if (muted()) return null; if (!C) { const A = window.AudioContext || window.webkitAudioContext; if (A) C = new A(); } if (C && C.state === "suspended") C.resume(); return C; };
const custom = k => (cfg().bgm || {})[k] || "";
function file(url, vol, loop) { if (muted()) return null; try { const a = new Audio(url); a.volume = vol == null ? 0.8 : vol; a.loop = !!loop; a.play().catch(() => {}); return a; } catch (e) { return null; } }
// un seul exemplaire à la fois par son du modo (13 nov. : la cloche de 2,7 s jouée 3 fois se chevauchait) :
// le même son relancé coupe le précédent ; relancé dans les 0,35 s, il est ignoré (deux appels pour le même coup)
const live = {};
function one(k, vol, loop) {
  const url = custom(k); if (!url || muted()) return null;
  const p = live[k];
  if (p && !p.paused && !p.ended) { if (loop || Date.now() - (p._t || 0) < 350) return p; try { p.pause(); } catch (e) {} }
  const a = file(url, vol, loop); if (a) { a._t = Date.now(); live[k] = a; } return a;
}
// sons fabriqués : le même son n'est pas relancé tant que le précédent n'a pas eu le temps de finir
const lastAt = {};
const gate = (k, ms) => { const n = Date.now(); if (n - (lastAt[k] || 0) < ms) return false; lastAt[k] = n; return true; };
// tout couper (on quitte le TCCCG, on ferme une invocation)
export function stopAll() { Object.keys(live).forEach(k => { try { live[k].pause(); } catch (e) {} delete live[k]; }); }
function noise(c, dur) { const b = c.createBuffer(1, Math.max(1, c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; return s; }
function env(c, g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
// cloche du ring : plusieurs harmoniques métalliques qui s'éteignent
function bell(at) {
  const c = ctx(); if (!c) return; const t = c.currentTime + (at || 0);
  [[880, 0.28], [1328, 0.16], [2212, 0.1], [3150, 0.06]].forEach(([f, v]) => { const o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.value = f; env(c, g, t, 0.004, v, 1.6); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 1.8); });
}
function hit(strong) {
  const c = ctx(); if (!c) return; const t = c.currentTime;
  const n = noise(c, 0.25), f = c.createBiquadFilter(), g = c.createGain(); f.type = "lowpass"; f.frequency.value = strong ? 900 : 1600; env(c, g, t, 0.003, strong ? 0.9 : 0.5, 0.18); n.connect(f).connect(g).connect(c.destination); n.start(t);
  const o = c.createOscillator(), g2 = c.createGain(); o.type = "sine"; o.frequency.setValueAtTime(strong ? 120 : 180, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2); env(c, g2, t, 0.003, strong ? 0.8 : 0.4, 0.22); o.connect(g2).connect(c.destination); o.start(t); o.stop(t + 0.3);
}
// public : souffle filtré qui monte et descend ; « pop » = une clameur plus forte
function crowd(on) {
  const c = ctx(); if (!c) return;
  if (!on) { if (crowdNode) { try { crowdNode.g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.8); crowdNode.s.stop(c.currentTime + 0.9); } catch (e) {} crowdNode = null; } return; }
  if (crowdNode) return;
  const s = noise(c, 4); s.loop = true; const f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  f.type = "bandpass"; f.frequency.value = 700; f.Q.value = 0.6; g.gain.value = 0.05; lfo.frequency.value = 0.25; lg.gain.value = 0.025; lfo.connect(lg).connect(g.gain);
  s.connect(f).connect(g).connect(c.destination); s.start(); lfo.start(); crowdNode = { s: s, g: g };
}
function pop(big) {
  const c = ctx(); if (!c) return; const t = c.currentTime, n = noise(c, big ? 2.2 : 1.2), f = c.createBiquadFilter(), g = c.createGain();
  f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 0.5; env(c, g, t, 0.15, big ? 0.35 : 0.2, big ? 1.8 : 0.9); n.connect(f).connect(g).connect(c.destination); n.start(t);
}
function whoosh() {
  const c = ctx(); if (!c) return; const t = c.currentTime, n = noise(c, 0.6), f = c.createBiquadFilter(), g = c.createGain();
  f.type = "bandpass"; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.5); env(c, g, t, 0.05, 0.5, 0.5); n.connect(f).connect(g).connect(c.destination); n.start(t);
}
function tune(win) {
  const c = ctx(); if (!c) return; const N = win ? [523, 659, 784, 1047, 784, 1047] : [392, 349, 311, 262], dur = win ? 0.16 : 0.32;
  N.forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + 0.4 + i * dur; o.type = win ? "square" : "triangle"; o.frequency.value = f; env(c, g, t, 0.02, 0.16, dur * (i === N.length - 1 ? 3 : 0.95)); o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur * 3.2); });
}
// joue un son : fichier du modo s'il y en a un, sinon le son de l'app
export const SFX = {
  // fichier du modo : joué une seule fois (un fichier de cloche contient déjà ses coups) ; sinon n coups fabriqués
  bell: n => { if (custom("bell")) { one("bell"); return; } if (!gate("bell", 900)) return; for (let i = 0; i < (n || 1); i++) bell(i * 0.42); },
  hit: strong => { const k = strong ? "finisher" : "hit"; if (custom(k)) return one(k); if (!gate(k, strong ? 600 : 90)) return; hit(strong); if (strong && gate("pop", 1500)) pop(true); },
  taunt: () => custom("taunt") ? one("taunt") : gate("pop", 1500) && pop(false),
  finisher: () => { if (custom("finisher")) one("finisher"); else if (gate("fin", 1200)) { whoosh(); setTimeout(() => { hit(true); if (gate("pop", 1500)) pop(true); }, 550); } },
  // petit « tac » discret (pierre-feuille-ciseaux)
  tick: () => { const c = ctx(); if (!c || !gate("tick", 120)) return; const t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = "triangle"; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(260, t + 0.06); env(c, g, t, 0.003, 0.18, 0.07); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.1); },
  crowd: on => { if (custom("crowd")) { if (on) one("crowd", 0.35, true); else if (live.crowd) { try { live.crowd.pause(); } catch (e) {} delete live.crowd; } return; } crowd(on); },
  music: on => { if (!on) { if (music) { try { music.pause(); } catch (e) {} music = null; } return; } if (custom("fight") && !music) music = file(custom("fight"), 0.35, true); },
  end: win => { SFX.bell(3); setTimeout(() => { if (custom(win ? "win" : "lose")) one(win ? "win" : "lose", 0.75); else tune(win); }, 1300); },
  stop: () => { stopAll(); crowd(false); SFX.music(false); },
  unlock: () => ctx()
};
// on quitte le TCCCG : plus aucun son du jeu ne continue derrière
if (typeof window !== "undefined") window.addEventListener("hashchange", () => { if (location.hash.indexOf("#/tccg") !== 0) SFX.stop(); });
