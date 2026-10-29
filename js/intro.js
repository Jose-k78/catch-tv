// Intro au démarrage : le logo TCC TV est projeté dans les cordes du ring, rebondit et se pose au centre,
// avec un impact grave puis trois coups de cloche (son synthétisé par l'app, original).
// Sur téléphone, le son ne peut partir qu'après un appui : on le joue dès que l'écran est touché pendant l'intro.
import { ACT } from "./state.js";
import { lsGet, lsSet } from "./util.js";

export const INTRO = { son: ["Avec le son", "Animation, impact et trois coups de cloche", "avec son"], muet: ["Sans le son", "Animation seulement", "sans son"], off: ["Désactivée", "L’app s’ouvre directement", "désactivée"] };
export function introMode() { const m = lsGet("ctv.intro"); return INTRO[m] ? m : "son"; }
ACT.intromode = el => { lsSet("ctv.intro", el.dataset.v === "son" ? null : el.dataset.v); document.querySelectorAll("[data-act=intromode] .chev").forEach(c => { c.textContent = c.closest("[data-v]").dataset.v === el.dataset.v ? "✓" : ""; }); };
ACT.introplay = () => playIntro(true);

// ---------- son ----------
let ctx = null;
function audio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  try { ctx = new AC(); } catch (e) { ctx = null; }
  return ctx;
}
// un coup de cloche (trophée gagné…), si le son est permis
export function ding() { try { const c = audio(); if (c && c.state === "suspended") c.resume(); bell(0); } catch (e) {} }
// coup de cloche de ring : frappe métallique (partiels inharmoniques qui s'éteignent) + petit claquement
function bell(at) {
  const c = audio(); if (!c) return;
  const t0 = c.currentTime + Math.max(0, at || 0), out = c.createGain();
  out.gain.value = 0.32; out.connect(c.destination);
  [[830, 1, 1.7], [1660, 0.45, 1.25], [2290, 0.55, 0.95], [2820, 0.3, 0.75], [3400, 0.22, 0.55], [4480, 0.12, 0.38]].forEach(p => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(p[0] * (1 + (Math.random() - 0.5) * 0.004), t0);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(p[1], t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + p[2]);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + p[2] + 0.05);
  });
  const n = noise(c, 0.04), bp = c.createBiquadFilter(), g2 = c.createGain();
  bp.type = "bandpass"; bp.frequency.value = 3200; bp.Q.value = 1.2;
  g2.gain.setValueAtTime(0.5, t0); g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
  n.connect(bp); bp.connect(g2); g2.connect(out); n.start(t0); n.stop(t0 + 0.05);
}
// impact grave quand le logo percute les cordes
function thud(at) {
  const c = audio(); if (!c) return;
  const t0 = c.currentTime + Math.max(0, at || 0), o = c.createOscillator(), g = c.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(130, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + 0.32);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.9, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
  o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + 0.45);
  const n = noise(c, 0.12), lp = c.createBiquadFilter(), g2 = c.createGain();
  lp.type = "lowpass"; lp.frequency.value = 900;
  g2.gain.setValueAtTime(0.35, t0); g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
  n.connect(lp); lp.connect(g2); g2.connect(c.destination); n.start(t0); n.stop(t0 + 0.13);
}
function noise(c, dur) {
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = b; return s;
}
// sons programmés sur la ligne de temps de l'animation (en ms) ; joués depuis le moment présent s'ils sont rattrapés après un appui
const CUES = [[420, thud], [640, bell], [930, bell], [1220, bell]];

// ---------- animation ----------
const ease = { out: x => 1 - Math.pow(1 - x, 3), in: x => x * x, inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2) };
const lerp = (a, b, x) => a + (b - a) * x;
const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
let running = false;
export function playIntro(force) {
  const root = document.documentElement, box = document.getElementById("intro");
  if (!box || running) return;
  if (!force && !root.classList.contains("introon")) return;
  running = true;
  root.classList.add("introon");
  try { sessionStorage.setItem("ctv.introShown", "1"); } catch (e) {}
  const withSound = introMode() === "son";
  const reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  box.innerHTML = '<div class="intro-ring"><div class="intro-post l"></div><div class="intro-post r"></div><svg class="intro-ropes" preserveAspectRatio="none"><path class="rp r1"/><path class="rp r2"/><path class="rp r3"/></svg></div>' +
    '<div class="intro-logo"><span class="l1">TCC</span><span class="l2">TV</span><span class="intro-shine"></span></div><div class="intro-flash"></div>' +
    '<button class="intro-skip" type="button">Passer ›</button>' + (withSound ? '<div class="intro-hint">🔔 Touche l’écran pour la cloche</div>' : "");
  const logo = box.querySelector(".intro-logo"), flash = box.querySelector(".intro-flash"), svg = box.querySelector(".intro-ropes"), hint = box.querySelector(".intro-hint");
  const ropes = [".r1", ".r2", ".r3"].map(s => box.querySelector(s));
  const begin = performance.now();
  let W = innerWidth, H = innerHeight, raf = 0, played = {}, soundOn = false, done = false;
  const ropeY = () => H * 0.64, gap = () => Math.max(16, Math.min(26, H * 0.028)), center = () => H * 0.42;
  const drawRopes = def => {
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    ropes.forEach((p, i) => { const y = ropeY() + i * gap(), d = def * (1 - i * 0.22); p.setAttribute("d", "M -10 " + y + " Q " + W / 2 + " " + (y + 2 * d) + " " + (W + 10) + " " + y); });
  };
  const sound = () => {
    if (!withSound || soundOn) return;
    const c = audio(); if (!c) return;
    const go = () => {
      if (soundOn || c.state !== "running") return;
      soundOn = true; if (hint) hint.remove();
      const now = performance.now() - begin;
      let late = 0;
      CUES.forEach(q => { if (played[q[0]]) return; played[q[0]] = 1; if (q[0] >= now) q[1]((q[0] - now) / 1000); else { q[1](late); late += 0.29; } });
    };
    if (c.state === "running") go(); else { const p = c.resume(); if (p && p.then) p.then(go).catch(() => {}); }
  };
  const finish = () => {
    if (done) return; done = true; cancelAnimationFrame(raf);
    box.classList.add("out");
    setTimeout(() => { root.classList.remove("introon"); box.classList.remove("out"); box.innerHTML = ""; running = false; }, 330);
    removeEventListener("resize", onResize);
  };
  const onResize = () => { W = innerWidth; H = innerHeight; };
  addEventListener("resize", onResize);
  box.onclick = e => {
    if (e.target.closest(".intro-skip")) return finish();
    if (withSound && !soundOn) { sound(); return; }
    finish();
  };
  const frame = now => {
    const t = Math.max(0, now - begin), cy = center(), contact = ropeY() - 34;
    let y, rot = 0, sc = 1, def = 0, op = 1;
    if (reduced) { y = cy; op = seg(t, 0, 500); }
    else if (t < 420) { const x = ease.in(seg(t, 0, 420)); y = lerp(-H * 0.35, contact, x); rot = lerp(-18, -6, x); }
    else if (t < 600) { const x = ease.out(seg(t, 420, 600)); y = contact + 46 * x; rot = lerp(-6, -2, x); def = 46 * x; sc = lerp(1, 0.94, x); }
    else if (t < 900) { const x = ease.out(seg(t, 600, 900)); y = lerp(contact + 46, cy - 26, x); rot = lerp(-2, 4, x); sc = lerp(0.94, 1.12, x); }
    else if (t < 1150) { const x = ease.inOut(seg(t, 900, 1150)); y = lerp(cy - 26, cy, x); rot = lerp(4, 0, x); sc = 1.12 - 0.16 * Math.sin(Math.PI * x) - 0.12 * x; sc = Math.max(0.96, sc); if (x > 0.85) sc = lerp(sc, 1, (x - 0.85) / 0.15); }
    else { y = cy; sc = 1; }
    // les cordes repartent et vibrent après la poussée
    if (!reduced && t >= 600) { const u = (t - 600) / 1000; def = 46 * Math.exp(-5.5 * u) * Math.cos(2 * Math.PI * 3.2 * u); }
    logo.style.transform = "translate(-50%,-50%) translate(0," + (y - H / 2) + "px) rotate(" + rot + "deg) scale(" + sc + ")";
    logo.style.opacity = op;
    drawRopes(def);
    flash.style.opacity = t >= 880 && t < 1200 ? String(0.75 * (1 - seg(t, 880, 1200))) : "0";
    if (t >= 1150) logo.classList.add("shine");
    if (withSound && soundOn) CUES.forEach(q => { played[q[0]] = played[q[0]] || t >= q[0]; });
    if (t >= 1950) return finish();
    raf = requestAnimationFrame(frame);
  };
  // son direct si le navigateur l'autorise déjà (appli installée sur Android, ordinateur…)
  if (withSound) {
    const c = audio();
    if (c && c.state === "running") { soundOn = true; if (hint) hint.remove(); CUES.forEach(q => { played[q[0]] = 1; q[1](q[0] / 1000); }); }
    else if (c) {
      const p = c.resume();
      if (p && p.then) p.then(() => {
        const el = performance.now() - begin;
        if (!soundOn && c.state === "running" && el < 380) { soundOn = true; if (hint) hint.remove(); CUES.forEach(q => { played[q[0]] = 1; q[1]((q[0] - el) / 1000); }); }
      }).catch(() => {});
    }
  }
  drawRopes(0);
  raf = requestAnimationFrame(frame);
}
// au chargement de l'app
playIntro(false);
