// TCCCG — Call Up : un booster par show passé (les 7 derniers jours, PLE compris), boosters de départ par promotion (payés en
// Momentum / Pop / Push), booster gratuit du jour (N et R seulement), boosters du modo, booster « agents libres » (modo).
// 5 gimmicks = booster 3 cartes ; 50 gimmicks = Mega booster 15 cartes. Cartes « version show » 2 jours après les résultats.
// Animation (cahier) : 3… 2… 1…, le booster descend la rampe d'entrée, lueurs dans le public selon le tirage, déchirure, slide.
import { S, ACT, changed } from "../state.js";
import { esc, toast, fmt } from "../util.js";
import { parisDay } from "../time.js";
import { RAR, rates, baseCards, showPeople, showKeyLabel, cfg, defOf, titleOf, champsNow, promoLogo } from "./data.js";
import { me, commit, addCard } from "./store.js";
import { cardHTML } from "./card.js";
import { showLogo, eventLogo } from "../assets.js";
import { norm } from "../wrestlers.js";

const DAY = 864e5;
const keyDate = key => key.split("|")[2] || "";
// shows passés des 7 derniers jours qui ont des résultats
export function recentShows(days) {
  const td = parisDay(), from = new Date(Date.parse(td) - (days || 7) * DAY).toISOString().slice(0, 10);
  return Object.keys(S.highlights || {}).filter(k => { const d = keyDate(k); return d && d <= td && d >= from && (S.highlights[k].res || []).length && S.P[k.split("|")[0]]; })
    .sort((a, b) => keyDate(b).localeCompare(keyDate(a)));
}
const showLogoOf = key => { const p = key.split("|"); if (p[1] === "PLE") { const e = ((S.P[p[0]] || {}).e || []).find(x => x.d === p[2]); return (e && eventLogo(Object.assign({ k: p[0] }, e))) || showLogo(p[0], ""); } return showLogo(p[0], p[1]) || showLogo(p[0], ""); };
const colorsOf = k => (S.P[k] && S.P[k].c) || ["#3b321f", "#0a0907"];
const inRoster = () => { const s = new Set(); Object.keys(S.rosters || {}).forEach(k => Object.keys(S.rosters[k] || {}).forEach(g => (S.rosters[k][g] || []).forEach(n => s.add(norm(n))))); return s; };

export function boosters() {
  const out = [], C = cfg(), td = parisDay();
  out.push({ id: "free", t: "Booster du jour", sub: "N et R · gratuit chaque jour", n: 3, price: { free: 1 }, only: ["N", "R"], cat: "Cadeau" });
  recentShows(7).forEach(key => {
    const p = key.split("|"), ver = Date.parse(td) - Date.parse(keyDate(key)) >= 2 * DAY;
    out.push({ id: "s:" + key, key: key, t: showKeyLabel(key), sub: p[0] + " · " + fmt(p[2]) + (ver ? " · cartes du show !" : " · cartes du show dans " + Math.ceil((2 * DAY - (Date.parse(td) - Date.parse(keyDate(key)))) / DAY) + " j"), n: 3, price: { gim: 5 }, logo: showLogoOf(key), c: colorsOf(p[0]), cat: p[1] === "PLE" ? "PLE et PPV" : "Shows de la semaine", ver: ver });
  });
  ["WWE", "AEW", "NJPW"].concat(Object.keys(S.P || {}).filter(k => ["WWE", "AEW", "NJPW"].indexOf(k) < 0)).filter(k => S.P[k]).forEach(k => out.push({ id: "p:" + k, k: k, t: k + " Pack", sub: "Booster de départ · 3 cartes", n: 3, price: { mom: 60, pop: 60, push: 60 }, logo: showLogo(k, ""), c: colorsOf(k), cat: "Boosters de départ" }));
  (C.boosters || []).filter(b => b && b.id && !b.del && (b.on !== false || S.isAdmin)).forEach(b => out.push(Object.assign({ cat: "Boosters spéciaux", price: { gim: +b.gim || 5 }, n: +b.n || 3 }, b, { id: "c:" + b.id, t: b.t || b.n || "Booster" })));
  if (S.isAdmin) out.push({ id: "fa", t: "Agents libres", sub: "Visible par le modo · catcheurs hors des rosters", n: 3, price: { gim: 0 }, cat: "Modo" });
  return out;
}
// catcheurs d'un booster
function poolOf(b) {
  const P = baseCards();
  if (b.id === "free") return P;
  if (b.key) { const pp = showPeople(b.key).map(x => x.c); return pp.length >= 3 ? pp : P.filter(c => c.k === b.key.split("|")[0]); }
  if (b.k) { const ro = S.rosters && S.rosters[b.k], s = new Set(); if (ro) Object.keys(ro).forEach(g => (ro[g] || []).forEach(n => s.add(norm(n)))); const L = P.filter(c => c.k === b.k || s.has(norm(c.name))); return L.length >= 10 ? L : P; }
  if (b.id === "fa") { const r = inRoster(); return P.filter(c => !r.has(norm(c.name)) && (!c.boosters || !c.boosters.length)); }
  if (b.id.indexOf("c:") === 0) {
    if (Array.isArray(b.cards) && b.cards.length) { const want = b.cards.map(norm); return P.filter(c => want.indexOf(norm(c.name)) >= 0 || want.indexOf(norm(c.id)) >= 0); }
    return P.filter(c => (!b.k || c.k === b.k) && (!c.boosters || c.boosters.indexOf(b.id.slice(2)) >= 0 || true));
  }
  return P;
}
function drawR(only, minR) {
  const R = rates(), keys = (only || RAR).filter(r => !minR || RAR.indexOf(r) >= RAR.indexOf(minR)), tot = keys.reduce((a, r) => a + (+R[r] || 0), 0);
  let x = Math.random() * tot; for (const r of keys) { x -= +R[r] || 0; if (x < 0) return r; } return keys[0];
}
export function pull(b, n) {
  const L = poolOf(b).filter(c => !c.boosters || !c.boosters.length || (b.id.indexOf("c:") === 0 && c.boosters.indexOf(b.id.slice(2)) >= 0) || b.id === "free" || b.key);
  const out = [], champ = champsNow();
  for (let i = 0; i < n; i++) {
    const want = drawR(b.only, i === n - 1 && !b.only ? "R" : "");
    let cand = L.filter(c => c.r === want), j = RAR.indexOf(want);
    while (!cand.length && j > 0) { j--; cand = L.filter(c => c.r === RAR[j]); }
    if (!cand.length) cand = L.length ? L : baseCards();
    const c = cand[Math.floor(Math.random() * cand.length)];
    let id = c.id;
    if (b.key && b.ver && Math.random() < 0.4) id = c.id + "@" + b.key; // carte « version show »
    else if (champ.has(norm(c.name)) && Math.random() < 0.04) id = c.id + "#champ"; // carte champion (boost permanent)
    out.push(id);
  }
  return out;
}
const priceTxt = p => p.free ? "🎁 Gratuit" : p.gim != null && !p.mom ? (p.gim ? "🎟️ " + p.gim + " gimmicks" : "Gratuit (modo)") : "⚡" + p.mom + " ⭐" + p.pop + " 📣" + p.push;
function canPay(d, p, mega) {
  if (p.free) return d.free !== parisDay();
  if (mega) return d.res.gim >= 50;
  return ["gim", "mom", "pop", "push"].every(k => !p[k] || d.res[k] >= p[k]);
}
export function callUpView() {
  const d = me(), B = boosters(), cats = {};
  B.forEach(b => { (cats[b.cat] = cats[b.cat] || []).push(b); });
  let h = '<section class="tccghead"><h1>Call Up</h1></section><p class="tnote">5 gimmicks = booster de 3 cartes · 50 gimmicks = Mega booster de 15 cartes. Les cartes « version show » arrivent 2 jours après les résultats.</p>' +
    '<details class="trates"><summary>Taux d’apparition</summary><p>' + RAR.map(r => '<span class="tcr r-' + r + '">' + r + "</span> " + rates()[r] + " %").join(" · ") + "</p></details>";
  ["Cadeau", "PLE et PPV", "Shows de la semaine", "Boosters de départ", "Boosters spéciaux", "Modo"].forEach(cat => {
    if (!cats[cat]) return;
    h += "<h2>" + cat + '</h2><div class="row tbrow">' + cats[cat].map(b => {
      const c = b.c || ["#3b321f", "#0a0907"], ok = canPay(d, b.price);
      return '<div class="tbwrap"><button class="tbooster' + (ok ? "" : " off") + '" data-act="tcgopen" data-id="' + esc(b.id) + '" style="background:' + (b.img ? "url('" + esc(b.img) + "') center/cover," : "") + "linear-gradient(160deg," + c[0] + "," + (c[1] || "#0a0907") + ')">' +
        (b.logo ? '<img src="' + esc(b.logo) + '" alt="">' : b.id === "free" ? '<span class="tbgift">🎁</span>' : "") + "<b>" + esc(b.t) + "</b><small>" + esc(b.sub || "") + '</small><span class="tbprice">' + (b.id === "free" && !ok ? "Demain" : priceTxt(b.price)) + "</span></button>" +
        (b.price.gim && b.key ? '<button class="tbmega" data-act="tcgopen" data-id="' + esc(b.id) + '" data-mega="1">Mega ×15 · 🎟️ 50</button>' : "") + "</div>";
    }).join("") + "</div>";
  });
  return h;
}
ACT.tcgopen = el => {
  const b = boosters().find(x => x.id === el.dataset.id); if (!b) return;
  const mega = el.dataset.mega === "1", d0 = me();
  if (!canPay(d0, b.price, mega)) { toast(b.price.free ? "Ton booster gratuit revient demain" : "Pas assez de ressources : gagne-en dans les combats"); return; }
  const ids = pull(b, mega ? 15 : b.n || 3);
  commit(d => {
    if (b.price.free) d.free = parisDay();
    else if (mega) d.res.gim -= 50;
    else ["gim", "mom", "pop", "push"].forEach(k => { if (b.price[k]) d.res[k] -= b.price[k]; });
    ids.forEach(id => addCard(d, id)); d.opened++;
  });
  summon(b, ids);
};
// ---------- animation d'invocation ----------
function summon(b, ids) {
  const defs = ids.map(defOf), best = defs.reduce((m, x) => Math.max(m, RAR.indexOf(x.r)), 0), nSR = defs.filter(x => x.r === "SR").length, lrPot = defs.some(x => x.lrPot || x.max === "LR" && RAR.indexOf(x.r) >= 3);
  const glow = best >= 3 ? (lrPot ? "gold stars" : "gold") : nSR >= 2 ? "violet" : "white";
  const c = b.c || ["#3b321f", "#0a0907"];
  const ov = document.createElement("div"); ov.className = "tsum glow-" + glow.replace(" ", "-");
  ov.innerHTML = '<div class="tsstage"><div class="tscrowd"></div><div class="tsramp"></div><div class="tscount">3</div>' +
    '<div class="tspack" style="background:linear-gradient(160deg,' + c[0] + "," + (c[1] || "#0a0907") + ')">' + (b.logo ? '<img src="' + esc(b.logo) + '" alt="">' : "") + "<b>" + esc(b.t) + '</b><span class="tstear"></span></div></div><button class="tsskip">Passer ›</button>';
  document.body.appendChild(ov);
  const cnt = ov.querySelector(".tscount"); let n = 3, stage = 0, idx = 0, x0 = null;
  const tick = setInterval(() => { n--; if (n > 0) { cnt.textContent = n; cnt.classList.remove("pop"); void cnt.offsetWidth; cnt.classList.add("pop"); } else { clearInterval(tick); cnt.remove(); ov.classList.add("walk"); setTimeout(() => { ov.classList.add("lights"); }, 900); setTimeout(() => { ov.classList.add("center"); stage = 1; }, 2300); } }, 650);
  const reveal = () => {
    stage = 2;
    ov.innerHTML = '<div class="tsreveal"><div class="tsfx fx-' + defs[idx].r + '"></div><div class="tscard">' + cardHTML(defs[idx]) + '</div><p class="tphint">' + (idx + 1) + " / " + defs.length + ' · glisse ou touche ‹ ›</p><div class="tsnav"><button data-nav="-1">‹</button><button data-nav="1">›</button></div></div><button class="tsskip">Tout voir ›</button>';
    if (navigator.vibrate && RAR.indexOf(defs[idx].r) >= 3) try { navigator.vibrate([30, 40, 60]); } catch (e) {}
  };
  const recap = () => {
    stage = 3;
    ov.innerHTML = '<div class="trecap"><h2>' + esc(b.t) + '</h2><div class="trgrid">' + defs.map(x => cardHTML(x, { small: true })).join("") + '</div><div class="btns"><a class="btn" href="#/tccg/roster" data-close>Voir mon roster</a><button class="btn ghost" data-close>Continuer</button></div></div>';
  };
  const go = dir => { idx += dir; if (idx < 0) idx = 0; if (idx >= defs.length) return recap(); reveal(); };
  ov.addEventListener("click", e => {
    if (ov._sw && Date.now() - ov._sw < 450) return;
    if (stage === 3) { if (e.target.closest("[data-close]")) { ov.remove(); changed("tcg"); } return; }
    if (e.target.closest(".tsskip")) { clearInterval(tick); return stage === 2 ? recap() : (idx = 0, reveal()); }
    if (stage === 0 && n <= 0) { ov.classList.add("lights", "center"); stage = 1; return; } // un appui pendant la marche : le booster arrive tout de suite
    if (stage === 1) { ov.querySelector(".tspack").classList.add("open"); stage = 1.5; setTimeout(reveal, 700); return; }
    if (stage === 2) { const nv = e.target.closest("[data-nav]"); go(nv ? +nv.dataset.nav : 1); }
  });
  ov.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
  ov.addEventListener("touchend", e => { if (stage !== 2 || x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) { ov._sw = Date.now(); go(dx < 0 ? 1 : -1); } x0 = null; });
}
