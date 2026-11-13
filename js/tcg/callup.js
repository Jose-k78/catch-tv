// TCCCG — Call Up : un booster par show passé (les 7 derniers jours, PLE compris), boosters de départ par promotion (payés en
// Momentum / Pop / Push), booster gratuit du jour (N et R seulement), boosters du modo, booster « agents libres » (modo).
// 5 gimmicks = booster 5 cartes ; 50 gimmicks = Mega booster 15 cartes. Cartes « version show » 2 jours après les résultats.
// Animation (cahier) : 3… 2… 1…, le booster descend la rampe d'entrée, lueurs dans le public selon le tirage, déchirure, slide.
import { S, ACT, changed } from "../state.js";
import { esc, toast, fmt, modal, lsGet, lsSet } from "../util.js";
import { parisDay } from "../time.js";
import { realKey, RAR, LVMAX, rates, rates2, baseCards, showPeople, showKeyLabel, cfg, defOf, titleOf, champsNow, promoLogo, cardById } from "./data.js";
import { freeLeft, freeNextMs, useFree, me, commit, addCard, bump } from "./store.js";
import { summon } from "./summon.js";
import { cardHTML, boosterImg } from "./card.js";
import { showLogo, eventLogo } from "../assets.js";
import { saveCfg } from "./modo.js";
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

// Boosters (cahier du 12 nov.) : PLE / PPV (1 mois), shows de la semaine (7 jours, cartes moins fortes), 3 gratuits toutes
// les 5 h (tout le monde, show ou agent libre), boosters spéciaux du modo, packs de départ (MPP, taux plus faibles).
// Simple = 5 gimmicks pour 5 cartes ; Multi = 50 gimmicks pour 15 cartes, taux plus hauts et 1 SSR garantie.
export function boosters() {
  const out = [], C = cfg(), td = parisDay(), promo = (C.vogue || {}).promo || {};
  out.push({ id: "free", t: "Booster gratuit", sub: "3 toutes les 5 heures · tous les catcheurs", n: 5, price: { free: 1 }, c: ["#7a1f3d", "#c9971f"], cat: "Cadeau", rc: "free" });
  out.push({ id: "mitb", t: "Booster Agent Libre", sub: "💼 Mallette Money In The Bank : la carte SSR de ton choix", n: 1, price: { mitb: 1 }, c: ["#0d4a2a", "#c9971f"], cat: "Cadeau" });
  recentShows(31).forEach(key => {
    const p = key.split("|"), ple = p[1] === "PLE", age = Date.parse(td) - Date.parse(keyDate(key)), ver = age >= 2 * DAY;
    if (!ple && age > 7 * DAY) return;
    out.push({ id: "s:" + key, key: key, t: showKeyLabel(key), sub: p[0] + " · " + fmt(p[2]) + (ver ? " · cartes du show !" : " · cartes du show dans " + Math.ceil((2 * DAY - age) / DAY) + " j") + (ple ? " · encore " + Math.max(1, Math.ceil((31 * DAY - age) / DAY)) + " j" : ""), n: 5, price: { gim: 5 }, multi: true, logo: showLogoOf(key), c: colorsOf(p[0]), cat: ple ? "PLE et PPV" : "Shows de la semaine", ver: ver, rc: ple ? "ple" : "week" });
  });
  (C.boosters || []).filter(b => b && b.id && !b.del && (b.on !== false || S.isAdmin)).forEach(b => out.push(Object.assign({ cat: "Boosters spéciaux", price: { gim: +b.gim || 5 }, n: 5, multi: true, rc: "special" }, b, { id: "c:" + b.id, t: b.t || b.n || "Booster" })));
  ["WWE", "AEW", "NJPW"].concat(Object.keys(S.P || {}).filter(k => ["WWE", "AEW", "NJPW"].indexOf(k) < 0)).filter(k => S.P[k]).forEach(k => out.push({ id: "p:" + k, k: k, t: k + " Pack", sub: "Pack de départ · 5 cartes", n: 5, price: { mom: 60, pop: 60, push: 60 }, logo: showLogo(k, ""), c: colorsOf(k), cat: "Boosters de départ", rc: "start" }));
  if (S.isAdmin) out.push({ id: "fa", t: "Hors rosters (modo)", sub: "Visible par le modo · catcheurs hors des rosters", n: 5, price: { gim: 0 }, cat: "Modo", rc: "special" });
  // promo du modo : prix en gimmicks réduit
  out.forEach(b => { const pc = +promo[b.id] || 0; if (pc > 0 && b.price.gim) { b.promo = pc; b.price = Object.assign({}, b.price, { gim: Math.max(1, Math.round(b.price.gim * (100 - pc) / 100)), mprice: Math.max(1, Math.round(50 * (100 - pc) / 100)) }); } });
  return out;
}
const megaPrice = b => (b.price && b.price.mprice) || 50;
// catcheurs d'un booster (automatique), puis les changements du modo (cfg.bx[id] : add, del, feat, nofeat)
const bxOf = b => ((cfg().bx || {})[b.id]) || {};
const inPromo = k => { const ro = S.rosters && S.rosters[k], s = new Set(); if (ro) Object.keys(ro).forEach(g => (ro[g] || []).forEach(n => s.add(norm(n)))); return c => c.k === k || s.has(realKey(c)); };
function autoPool(b) {
  const P = baseCards();
  if (b.id === "free") return P;
  if (b.id === "mitb") return P.filter(c => c.r === "SSR" && !c.custom);
  // booster d'un show : les catcheurs de sa promotion, ceux du show en vedette
  if (b.key) { const pp = showPeople(b.key).map(x => x.c), ids = new Set(pp.map(c => c.id)), f = inPromo(b.key.split("|")[0]); return pp.concat(P.filter(c => !ids.has(c.id) && f(c))); }
  if (b.k && b.id.indexOf("p:") === 0) { const L = P.filter(inPromo(b.k)); return L.length >= 10 ? L : P; }
  if (b.id === "fa") { const r = inRoster(); return P.filter(c => !r.has(realKey(c)) && (!c.boosters || !c.boosters.length)); }
  if (b.id.indexOf("c:") === 0) {
    if (Array.isArray(b.cards) && b.cards.length) { const want = b.cards.map(norm); return P.filter(c => want.indexOf(realKey(c)) >= 0 || want.indexOf(norm(c.name)) >= 0 || want.indexOf(norm(c.id)) >= 0); }
    return P.filter(c => (!b.k || c.k === b.k) && (!c.boosters || !c.boosters.length || c.boosters.indexOf(b.id.slice(2)) >= 0));
  }
  return P;
}
export function poolOf(b) {
  const x = bxOf(b), del = new Set(x.del || []), seen = new Set();
  const L = autoPool(b).filter(c => !del.has(c.id) && (!c.boosters || !c.boosters.length || b.id === "free" || b.key || (b.id.indexOf("c:") === 0 && c.boosters.indexOf(b.id.slice(2)) >= 0)));
  (x.add || []).forEach(id => { const c = cardById(id); if (c && !del.has(id)) L.push(c); });
  return L.filter(c => !seen.has(c.id) && seen.add(c.id));
}
// cartes vedettes : catcheurs du show (booster d'un show), champions (booster d'une promotion), + choix du modo
export function featOf(b) {
  const x = bxOf(b), no = new Set(x.nofeat || []), out = new Set();
  if (b.key) showPeople(b.key).forEach(p => out.add(p.c.id));
  else if (b.k && b.id.indexOf("p:") === 0) { const ch = champsNow(); poolOf(b).forEach(c => { if (ch.has(realKey(c))) out.add(c.id); }); }
  (x.feat || []).forEach(id => out.add(id));
  ((cfg().vogue || {}).cards || []).forEach(id => out.add(id)); // cartes « en vogue » du modo : plus fréquentes partout
  no.forEach(id => out.delete(id));
  return out;
}
const featX = () => +((cfg().featx)) || 3;
// tirage de la rareté de base selon les taux du booster ; LRP = SSR qui peut devenir LR ; le Multi monte les taux
function drawCat(b, multi, minSSR) {
  const R = rates2(b.rc || "week"), w = {};
  Object.keys(R).forEach(k => { w[k] = +R[k] || 0; if (multi && (k === "SR" || k === "SSR" || k === "LRP")) w[k] *= 1.4; });
  const keys = Object.keys(w).filter(k => !minSSR || k === "SSR" || k === "LRP"), tot = keys.reduce((a, k) => a + w[k], 0) || 1;
  let x = Math.random() * tot; for (const k of keys) { x -= w[k]; if (x < 0) return k; } return keys[keys.length - 1];
}
const pickW = (L, F) => { const fx = featX(), w = L.map(c => (F.has(c.id) ? fx : 1)), t = w.reduce((a, b) => a + b, 0); let x = Math.random() * t; for (let i = 0; i < L.length; i++) { x -= w[i]; if (x < 0) return L[i]; } return L[L.length - 1]; };
const isLRP = c => c.r === "SSR" && (c.lrPot || c.max === "LR");
export function pull(b, n, multi) {
  const L = poolOf(b), F = featOf(b), out = [], champ = champsNow();
  for (let i = 0; i < n; i++) {
    const cat = drawCat(b, multi, multi && i === n - 1); // Multi : la dernière carte est une SSR garantie
    const fit = c => cat === "LRP" ? isLRP(c) : cat === "SSR" ? c.r === "SSR" && !isLRP(c) : c.r === cat;
    let cand = L.filter(fit);
    if (!cand.length && cat === "LRP") cand = L.filter(c => c.r === "SSR");
    if (!cand.length && cat === "SSR") cand = L.filter(c => c.r === "SSR");
    let j = RAR.indexOf(cat === "LRP" ? "SSR" : cat); while (!cand.length && j > 0) { j--; cand = L.filter(c => c.r === RAR[j]); }
    if (!cand.length) cand = L.length ? L : baseCards();
    const c = pickW(cand, F);
    let id = c.id;
    if (b.key && b.ver && F.has(c.id) && Math.random() < 0.4) id = c.id + "@" + b.key; // carte « version show »
    else if (champ.has(realKey(c)) && Math.random() < 0.04) id = c.id + "#champ"; // carte champion (boost permanent)
    out.push(id);
  }
  return out;
}
const priceTxt = p => p.mitb ? "💼 1 mallette" : p.free ? "🎁 Gratuit" : p.gim != null && !p.mom ? (p.gim ? "🎟️ " + p.gim + " gimmicks" : "Gratuit (modo)") : "⚡" + p.mom + " ⭐" + p.pop + " 📣" + p.push;
function canPay(d, p, mega) {
  if (p.free) return freeLeft(d) > 0;
  if (p.mitb) return (d.items.mitb || 0) > 0;
  if (mega) return d.res.gim >= (p.mprice || 50);
  return ["gim", "mom", "pop", "push"].every(k => !p[k] || d.res[k] >= p[k]);
}
const RC_NAME = { week: "Show de la semaine", ple: "PLE / PPV", free: "Gratuit", start: "Pack de départ", special: "Spécial" };
const ratesTxt = rc => { const R = rates2(rc); return ["N", "R", "SR", "SSR", "LRP"].filter(k => +R[k]).map(k => (k === "LRP" ? "SSR → LR" : k) + " " + String(R[k]).replace(".", ",") + " %").join(" · "); };
// ---------- Call Up « le grand écran » (13 nov., maquette 1 choisie par Jose) ----------
// Tous les boosters côte à côte, on glisse pour changer ; catégories en haut ; pour chaque booster : son image, les têtes
// d'affiche, les chances, Simple / Méga ; « Ouverture rapide » (toutes les cartes d'un coup) ; le dernier booster vu est gardé.
const CATS = [["Cadeau", "Cadeaux"], ["Shows de la semaine", "Shows"], ["PLE et PPV", "PLE"], ["Boosters spéciaux", "Spéciaux"], ["Boosters de départ", "Départ"], ["Modo", "Modo"]];
const RCOL = { N: "#9aa8d4", R: "#4f8cff", SR: "#3ddc84", SSR: "#ffd23f", LRP: "#ff5c66" };
export const quickOn = () => lsGet("ctv.tgquick") === "1";
const ordered = () => { const all = boosters(), out = []; CATS.forEach(c => all.filter(b => b.cat === c[0]).forEach(b => out.push(b))); all.forEach(b => { if (out.indexOf(b) < 0) out.push(b); }); return out; };
const leftH = ms => { const h = Math.floor(ms / 36e5), m = Math.ceil((ms % 36e5) / 6e4); return h ? h + " h " + String(m).padStart(2, "0") : m + " min"; };
function stars(b) {
  const L = poolOf(b), F = featOf(b), byMax = (a, c) => RAR.indexOf(c.max) - RAR.indexOf(a.max) || c.score - a.score;
  const top = L.filter(c => F.has(c.id)).sort(byMax);
  return { feat: top.length > 0, list: (top.length ? top : L.slice().sort(byMax)).slice(0, 3), n: L.length };
}
function slide(d, b) {
  const img = boosterImg(b), c = b.c || ["#2a3a72", "#0b1636"], ok = canPay(d, b.price), vog = ((cfg().vogue || {}).boosters || []).indexOf(b.id) >= 0, st = stars(b);
  let h = '<article class="tcus" data-id="' + esc(b.id) + '" data-cat="' + esc(b.cat) + '">' +
    '<button class="tcupack' + (ok ? "" : " off") + '" data-act="tcgopen" data-id="' + esc(b.id) + '" style="background:' + (img ? "url('" + esc(img) + "') center/cover," : "") + "linear-gradient(160deg," + esc(c[0]) + "," + esc(c[1] || "#0b1636") + ')" aria-label="Ouvrir ' + esc(b.t) + '">' +
    (b.promo ? '<span class="tcupromo">−' + b.promo + " %</span>" : vog ? '<span class="tcupromo hot">🔥 En vogue</span>' : "") +
    (b.logo ? '<img class="tculogo" src="' + esc(b.logo) + '" alt="">' : img ? "" : b.id === "free" ? '<span class="tcugift">🎁</span>' : b.id === "mitb" ? '<span class="tcugift">💼</span>' : "") +
    '<span class="tcuplate"><b>' + esc(b.t) + "</b></span></button>" +
    '<p class="tcusub">' + esc(b.sub || "") + "</p>";
  if (b.id === "mitb") h += '<div class="tcustars"><div class="tcust"><b>Une carte SSR au choix</b><small>' + st.n + " SSR possibles</small></div></div>";
  else h += '<div class="tcustars"><div class="tcust"><b>' + (st.feat ? "Les têtes d’affiche" : "Les meilleures cartes") + "</b><small>" + (st.feat ? "Plus fréquentes dans ce booster" : "Jusqu’où il peut aller") + ", " + st.n + " catcheurs possibles</small></div>" +
    st.list.map(x => '<span class="tcuc">' + cardHTML({ c: x.id, r: st.feat ? x.r : x.max, lv: 1 }, { small: true }) + "</span>").join("") + "</div>";
  if (b.id !== "mitb") { const R = rates2(b.rc || "week"), K = ["N", "R", "SR", "SSR", "LRP"].filter(k => +R[k]), tot = K.reduce((a, k) => a + (+R[k]), 0) || 1;
    h += '<div class="tcurates"><div class="tcurh"><b>Tes chances par carte</b><small>5 cartes' + (b.multi ? ", Méga : 15 dont 1 SSR" : "") + '</small></div><div class="tcubar">' + K.map(k => '<i style="width:' + (100 * R[k] / tot).toFixed(1) + "%;background:" + RCOL[k] + '"></i>').join("") + '</div><div class="tculeg">' + K.map(k => '<span><b style="color:' + RCOL[k] + '">' + (k === "LRP" ? "LR" : k) + "</b> " + String(R[k]).replace(".", ",") + " %</span>").join("") + "</div></div>"; }
  if (b.id === "free") h += '<div class="tcubtns"><button class="btn tcubig" data-act="tcgopen" data-id="free"' + (ok ? "" : " disabled") + ">" + (ok ? "OUVRIR <small>gratuit, il t’en reste " + freeLeft(d) + "</small>" : "REVIENT DANS " + leftH(freeNextMs()).toUpperCase()) + "</button></div>";
  else if (b.id === "mitb") h += '<div class="tcubtns"><button class="btn tcubig" data-act="tcgopen" data-id="mitb"' + ((d.items.mitb || 0) > 0 ? "" : " disabled") + ">CHOISIR MA SSR <small>💼 mallettes : " + (d.items.mitb || 0) + "</small></button></div>";
  else h += '<div class="tcubtns' + (b.multi ? " two" : "") + '"><button class="btn ghost tcubig" data-act="tcgopen" data-id="' + esc(b.id) + '"' + (ok ? "" : " disabled") + ">SIMPLE <small>5 cartes, " + esc(priceTxt(b.price)) + "</small></button>" +
    (b.multi ? '<button class="btn tcubig" data-act="tcgopen" data-id="' + esc(b.id) + '" data-mega="1"' + (canPay(d, b.price, true) ? "" : " disabled") + ">MÉGA <small>15 cartes dont 1 SSR, 🎟️ " + megaPrice(b) + "</small></button>" : "") + "</div>";
  h += '<div class="tcumore"><button class="tculink" data-act="tcgbinfo" data-id="' + esc(b.id) + '">👁️ Toutes les cartes du booster</button>' +
    (S.isAdmin && b.id !== "mitb" ? '<button class="tculink" data-act="tcgvogb" data-id="' + esc(b.id) + '">' + (vog ? "🔥 En vogue" : "☆ Vogue") + '</button><button class="tculink" data-act="tcgpromo" data-id="' + esc(b.id) + '">％ Promo</button>' : "") + "</div>";
  return h + "</article>";
}
export function callUpView() {
  const d = me(), B = ordered(), V = cfg().vogue || {}, saved = lsGet("ctv.tcu") || "";
  let cur = B.findIndex(b => b.id === saved); if (cur < 0) cur = 0;
  const cats = CATS.filter(c => B.some(b => b.cat === c[0])), fl = freeLeft(d);
  let h = '<section class="tccghead"><h1>Call Up</h1><small>Glisse pour changer de booster</small></section>' +
    '<nav class="tcucats" aria-label="Catégories">' + cats.map(c => '<button class="' + (B[cur] && B[cur].cat === c[0] ? "on" : "") + '" data-act="tcucat" data-c="' + esc(c[0]) + '">' + c[1] + (c[0] === "Cadeau" && fl ? ' <i class="tcunb">' + fl + "</i>" : "") + "</button>").join("") + "</nav>" +
    '<div class="tcuwrap"><button class="tcunav prev" data-act="tcunav" data-v="-1" aria-label="Booster précédent">‹</button><div class="tcu" id="tcu">' + B.map(b => slide(d, b)).join("") + '</div><button class="tcunav next" data-act="tcunav" data-v="1" aria-label="Booster suivant">›</button></div>' +
    (B.length > 12 ? '<div class="tcudots num" aria-hidden="true"><b>' + (cur + 1) + "</b> / " + B.length + "</div>" : '<div class="tcudots" aria-hidden="true">' + B.map((b, i) => '<i class="' + (i === cur ? "on" : "") + '"></i>').join("") + "</div>") +
    '<div class="tcuquick"><span><b>Ouverture rapide</b><small>Toutes les cartes d’un coup, sans l’entrée</small></span><button class="tcusw' + (quickOn() ? " on" : "") + '" data-act="tcuquick" role="switch" aria-checked="' + quickOn() + '" aria-label="Ouverture rapide"></button></div>';
  const VC = (V.cards || []).map(id => cardById(id)).filter(Boolean);
  if (VC.length) h += '<h2>⭐ Cartes en vogue <small class="tsmall">plus fréquentes dans les boosters</small></h2><div class="tfavs">' + VC.map(c => cardHTML({ c: c.id, r: c.max, lv: LVMAX[c.max] }, { small: true })).join("") + "</div>";
  h += vitrine() + '<details class="trates"><summary>Taux d’apparition de tous les boosters</summary><p>' + Object.keys(RC_NAME).map(k => "<b>" + RC_NAME[k] + "</b> : " + ratesTxt(k)).join("<br>") + "<br>Méga : SR, SSR et SSR → LR ×1,4 et la 15e carte est une SSR (ou mieux). Les cartes « version show » arrivent 2 jours après les résultats.</p></details>";
  setTimeout(() => cuInit(cur), 0);
  return h;
}
// le carrousel : on revient sur le dernier booster, les points et la catégorie suivent le doigt
function cuInit(cur) {
  const box = document.getElementById("tcu"); if (!box || box.dataset.ok) return; box.dataset.ok = "1";
  const S2 = box.querySelectorAll(".tcus"); if (S2[cur]) box.scrollLeft = S2[cur].offsetLeft - (box.clientWidth - S2[cur].clientWidth) / 2;
  let t = 0;
  box.addEventListener("scroll", () => { clearTimeout(t); t = setTimeout(() => cuSync(box), 90); }, { passive: true });
}
function cuIdx(box) { const S2 = box.querySelectorAll(".tcus"), mid = box.scrollLeft + box.clientWidth / 2; let bi = 0, bd = 1e9; S2.forEach((x, i) => { const dd = Math.abs(x.offsetLeft + x.clientWidth / 2 - mid); if (dd < bd) { bd = dd; bi = i; } }); return bi; }
function cuSync(box) {
  const S2 = box.querySelectorAll(".tcus"), i = cuIdx(box), el = S2[i]; if (!el) return;
  lsSet("ctv.tcu", el.dataset.id);
  document.querySelectorAll(".tcudots i").forEach((x, k) => x.classList.toggle("on", k === i));
  const nb = document.querySelector(".tcudots.num b"); if (nb) nb.textContent = i + 1;
  document.querySelectorAll(".tcucats button").forEach(x => x.classList.toggle("on", x.dataset.c === el.dataset.cat));
}
const cuGo = i => { const box = document.getElementById("tcu"); if (!box) return; const S2 = box.querySelectorAll(".tcus"), el = S2[Math.max(0, Math.min(S2.length - 1, i))]; if (el) box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.clientWidth) / 2, behavior: "smooth" }); };
ACT.tcunav = el => { const box = document.getElementById("tcu"); if (box) cuGo(cuIdx(box) + (+el.dataset.v || 0)); };
ACT.tcucat = el => { const box = document.getElementById("tcu"); if (!box) return; const S2 = [...box.querySelectorAll(".tcus")], i = S2.findIndex(x => x.dataset.cat === el.dataset.c); if (i >= 0) cuGo(i); };
ACT.tcuquick = el => { const on = !quickOn(); lsSet("ctv.tgquick", on ? "1" : null); el.classList.toggle("on", on); el.setAttribute("aria-checked", String(on)); toast(on ? "⚡ Ouverture rapide : toutes les cartes d’un coup" : "✨ L’entrée des cartes est de retour"); };
// modo : booster en vogue, promo
ACT.tcgvogb = el => { if (!S.isAdmin) return; const id = el.dataset.id; saveCfg(c => { c.vogue = c.vogue || {}; const L = c.vogue.boosters = c.vogue.boosters || [], i = L.indexOf(id); if (i >= 0) L.splice(i, 1); else L.push(id); }, "booster en vogue : " + id).then(ok => ok && toast("Enregistré ✓")); };
ACT.tcgpromo = el => {
  if (!S.isAdmin) return; const id = el.dataset.id, cur = +(((cfg().vogue || {}).promo || {})[id]) || 0;
  modal((box, close) => {
    box.innerHTML = '<h3>％ Promo</h3><p class="sub">Réduction sur le prix en gimmicks (Simple et Multi). 0 = pas de promo.</p><form data-pf><label class="fld">Réduction (%)<input name="v" type="number" min="0" max="90" value="' + cur + '"></label><button class="btn wide">Enregistrer</button></form><button class="btn wide ghost" style="margin-top:6px" data-close>Annuler</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-close]")) close(); });
    box.querySelector("[data-pf]").addEventListener("submit", e => { e.preventDefault(); const v = Math.max(0, Math.min(90, Math.round(+e.target.v.value || 0))); close();
      saveCfg(c => { c.vogue = c.vogue || {}; c.vogue.promo = c.vogue.promo || {}; if (v) c.vogue.promo[id] = v; else delete c.vogue.promo[id]; }, "promo " + id + " : " + v + " %").then(ok => ok && toast("Enregistré ✓")); });
  });
};
// Call Up : on confirme toujours avant d'invoquer (coût, nombre de cartes)
ACT.tcgopen = el => {
  const b = boosters().find(x => x.id === el.dataset.id); if (!b) return;
  const mega = el.dataset.mega === "1", d0 = me();
  if (b.id === "mitb") return mitbPick();
  if (!canPay(d0, b.price, mega)) { toast(b.price.free ? "Tes 3 boosters gratuits reviennent dans " + Math.ceil(freeNextMs() / 6e4) + " min" : "Pas assez de ressources : gagne-en dans les combats"); return; }
  const c = b.c || ["#3b321f", "#0a0907"];
  modal((box, close) => {
    const bi = boosterImg(b);
    box.innerHTML = '<h3>Invoquer ' + (mega ? "en Méga" : "ce booster") + ' ?</h3><div class="tcfm"><div class="tbooster" style="background:' + (bi ? "url('" + esc(bi) + "') center/cover," : "") + "linear-gradient(160deg," + esc(c[0]) + "," + esc(c[1] || "#0a0907") + ')">' + (b.logo ? '<img src="' + esc(b.logo) + '" alt="">' : "") + "<b>" + esc(b.t) + "</b></div>" +
      "<ul><li>" + (mega ? "15 cartes, dont 1 SSR garantie" : "5 cartes") + "</li><li>Coût : " + esc(mega ? "🎟️ " + megaPrice(b) + " gimmicks" : b.price.free ? "🎁 Gratuit (il t’en reste " + freeLeft(d0) + ")" : priceTxt(b.price)) + "</li>" + (featOf(b).size ? "<li>⭐ Cartes vedettes plus fréquentes</li>" : "") + "</ul></div>" +
      '<button class="btn wide" data-y>✨ Invoquer</button><button class="btn wide ghost" style="margin-top:6px" data-close>Annuler</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-close]")) return close(); if (e.target.closest("[data-y]")) { close(); openNow(b, mega); } });
  });
};
export function openNow(b, mega) {
  if (typeof b === "string") b = boosters().find(x => x.id === b);
  if (!b) return;
  if (!canPay(me(), b.price, mega)) { toast("Pas assez de ressources"); return; }
  const ids = pull(b, mega ? 15 : 5, mega), iids = [];
  commit(d => {
    if (b.price.free) { useFree(d, parisDay()); bump(d, "free"); }
    else if (mega) d.res.gim -= megaPrice(b);
    else ["gim", "mom", "pop", "push"].forEach(k => { if (b.price[k]) d.res[k] -= b.price[k]; });
    ids.forEach(id => iids.push(addCard(d, id))); d.opened++; bump(d, "open");
  });
  summon(b, ids, { mega: mega, again: canAgain(b), iids: S.tcgReady ? iids : [], quick: quickOn() });
}
// pour l'écran de fin : peut-on réinvoquer ce booster ?
const canAgain = b => ({ id: b.id, simple: !b.price.mitb, multi: !!b.multi, ok: () => canPay(me(), b.price, false), okm: () => canPay(me(), b.price, true), price: priceTxt(b.price), mprice: megaPrice(b) });
// Booster Agent Libre : la mallette Money In The Bank donne la carte SSR de son choix (une fois par mallette)
function mitbPick() {
  if (!(me().items.mitb > 0)) { toast("Il te faut une mallette Money In The Bank 💼"); return; }
  let q = "", pick = "";
  modal((box, close) => {
    box.classList.add("tbibox");
    const list = () => baseCards().filter(c => c.r === "SSR" && !c.custom && (!q || norm(c.name).indexOf(norm(q)) >= 0)).slice(0, 60).map(c => '<div class="tpk' + (pick === c.id ? " on" : "") + '" data-p="' + esc(c.id) + '">' + cardHTML(c, { small: true }) + "</div>").join("") || '<p class="tnote">Aucune carte SSR à ce nom.</p>';
    box.innerHTML = '<h3>💼 Booster Agent Libre</h3><p class="sub">Ta mallette Money In The Bank : choisis la carte SSR que tu veux. Ce choix est définitif.</p><div class="search"><input id="mq" type="search" placeholder="Chercher un catcheur"></div><div class="trgrid tpick" id="mgrid">' + list() + '</div><button class="btn wide" data-go disabled>Encaisser la mallette</button><button class="btn wide ghost" style="margin-top:6px" data-close>Plus tard</button>';
    box.addEventListener("input", e => { if (e.target.id === "mq") { q = e.target.value; box.querySelector("#mgrid").innerHTML = list(); } });
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return close();
      const p = e.target.closest("[data-p]"); if (p) { pick = p.dataset.p; box.querySelectorAll(".tpk").forEach(x => x.classList.toggle("on", x.dataset.p === pick)); box.querySelector("[data-go]").disabled = false; return; }
      if (e.target.closest("[data-go]") && pick) { const id = pick, b = boosters().find(x => x.id === "mitb"); close();
        if (!(me().items.mitb > 0)) return;
        commit(d => { if (!(d.items.mitb > 0)) return; d.items.mitb--; addCard(d, id); d.opened++; });
        summon(b, [id], { quick: quickOn() }); }
    });
  });
}
// vitrine : des exemples de cartes au maximum (rareté max, niveau max) pour donner envie
function vitrine() {
  const P = baseCards().filter(c => c.pic && (c.max === "LR" || c.max === "UR")).sort((a, b) => RAR.indexOf(b.max) - RAR.indexOf(a.max) || b.score - a.score), day = Math.floor(Date.now() / 864e5);
  if (!P.length) return "";
  const pick = [0, 1, 2, 3].map(i => P[(day * 7 + i * 13) % Math.min(P.length, 40)]).filter((c, i, a) => a.indexOf(c) === i);
  return '<h2>✨ Vitrine <small class="tsmall">jusqu’où tes cartes peuvent aller</small></h2><div class="tfavs tvit">' + pick.map(c => cardHTML({ c: c.id, r: c.max, lv: LVMAX[c.max] }, { small: true })).join("") + "</div>";
}
// contenu d'un booster : vitrine, vedettes, toutes les cartes possibles ; le modo ajoute, retire, met en vedette, modifie, duplique
ACT.tcgbinfo = el => {
  const b = boosters().find(x => x.id === el.dataset.id); if (!b) return;
  let q = "";
  modal((box, close) => {
    box.classList.add("tbibox");
    const draw = () => {
      const L = poolOf(b), F = featOf(b), ed = S.isAdmin, keys = RAR.slice(0, 4), VC = new Set((cfg().vogue || {}).cards || []);
      const tile = c => '<div class="tbtile">' + cardHTML(c, { small: true }) + (ed ? '<div class="tbed"><button data-f="' + esc(c.id) + '" title="Vedette">' + (F.has(c.id) ? "⭐" : "☆") + '</button><button data-vg="' + esc(c.id) + '" title="En vogue partout">' + (VC.has(c.id) ? "🔥" : "♨") + '</button><button data-e="' + esc(c.id) + '" title="Modifier">✏️</button><button data-dup="' + esc(c.id) + '" title="Dupliquer">⧉</button><button data-x="' + esc(c.id) + '" title="Retirer du booster">✕</button></div>' : "") + "</div>";
      const best = L.slice().sort((a, b2) => RAR.indexOf(b2.max) - RAR.indexOf(a.max) || b2.score - a.score).slice(0, 3);
      let h = "<h3>" + esc(b.t) + '</h3><p class="sub">' + L.length + " cartes possibles · " + ratesTxt(b.rc || "week") + (F.size ? " · vedettes ×" + featX() : "") + "</p>";
      if (best.length) h += '<h4>Vitrine</h4><div class="tfavs">' + best.map(c => cardHTML({ c: c.id, r: c.max, lv: LVMAX[c.max] }, { small: true })).join("") + "</div>";
      const FL = L.filter(c => F.has(c.id));
      if (FL.length) h += '<h4>⭐ Cartes vedettes <small>(plus de chances de tomber)</small></h4><div class="trgrid">' + FL.map(tile).join("") + "</div>";
      keys.slice().reverse().forEach(r => { const X = L.filter(c => c.r === r && !F.has(c.id)); if (X.length) h += '<h4><span class="tcr r-' + r + '">' + r + "</span> " + X.length + "</h4>" + '<div class="trgrid">' + X.slice(0, ed ? 400 : 120).map(tile).join("") + (X.length > 120 && !ed ? '<p class="tnote">… et ' + (X.length - 120) + " autres</p>" : "") + "</div>"; });
      if (ed) {
        const del = bxOf(b).del || [];
        h += '<h4>＋ Ajouter une carte</h4><div class="search"><input id="tbq" type="search" placeholder="Nom du catcheur" value="' + esc(q) + '"></div><div class="trgrid" id="tbadd">' + addList() + "</div>";
        if (del.length) h += "<h4>Retirées</h4><div class=\"tfilt\">" + del.map(id => { const c = cardById(id); return c ? '<button class="chip" data-un="' + esc(id) + '">↩ ' + esc(c.name) + "</button>" : ""; }).join("") + "</div>";
      }
      box.innerHTML = h + '<button class="btn wide ghost" style="margin-top:10px" data-close>Fermer</button>';
    };
    const addList = () => { if (!q) return ""; const have = new Set(poolOf(b).map(c => c.id)); return baseCards().filter(c => !have.has(c.id) && norm(c.name).indexOf(norm(q)) >= 0).slice(0, 12).map(c => '<div class="tbtile">' + cardHTML(c, { small: true }) + '<div class="tbed"><button data-add="' + esc(c.id) + '">＋ Ajouter</button></div></div>').join(""); };
    const mod = (fn, msg) => saveCfg(d => { d.bx = d.bx || {}; const x = d.bx[b.id] = d.bx[b.id] || {}; fn(x, d); }, msg).then(ok => { if (ok) { toast("Enregistré ✓"); draw(); } }).catch(e => toast("Pas enregistré : " + (e && e.message || ""), { ms: 4000 }));
    const tog = (arr, id, on) => { const s2 = new Set(arr || []); if (on) s2.add(id); else s2.delete(id); return Array.from(s2); };
    draw();
    box.addEventListener("input", e => { if (e.target.id === "tbq") { q = e.target.value; const g = box.querySelector("#tbadd"); if (g) g.innerHTML = addList(); } });
    box.addEventListener("click", e => {
      const t = e.target.closest("button,[data-close]"); if (!t) return;
      if (t.hasAttribute("data-close")) return close();
      const ds = t.dataset;
      if (ds.vg) return saveCfg(c => { c.vogue = c.vogue || {}; const L2 = c.vogue.cards = c.vogue.cards || [], i = L2.indexOf(ds.vg); if (i >= 0) L2.splice(i, 1); else L2.push(ds.vg); }, "carte en vogue : " + ds.vg).then(ok => { if (ok) { toast("Enregistré ✓"); draw(); } });
      if (ds.f) { const on = !featOf(b).has(ds.f); return mod(x => { x.feat = tog(x.feat, ds.f, on); x.nofeat = tog(x.nofeat, ds.f, !on); }, (on ? "vedette : " : "plus vedette : ") + ds.f); }
      if (ds.x) return mod(x => { x.del = tog(x.del, ds.x, true); x.add = tog(x.add, ds.x, false); }, "carte retirée du booster " + b.t);
      if (ds.un) return mod(x => { x.del = tog(x.del, ds.un, false); }, "carte remise dans le booster " + b.t);
      if (ds.add) return mod(x => { x.add = tog(x.add, ds.add, true); x.del = tog(x.del, ds.add, false); }, "carte ajoutée au booster " + b.t);
      if (ds.e) { close(); return ACT.tcgmedit({ dataset: { c: ds.e } }); }
      if (ds.dup) { const c = cardById(ds.dup); if (!c) return; const nid = "oc-" + c.id.slice(0, 30) + "-" + Date.now().toString(36).slice(-4);
        return mod((x, d) => { d.custom = d.custom || []; d.custom.push({ id: nid, name: c.name, img: c.pic || "", k: c.k, arch: c.arch, al: c.al, r: c.r, max: c.max, st: c.st.slice(), fin: Object.assign({}, c.fin), gimmick: (c.gimmick ? c.gimmick + " · " : "") + "copie" }); x.add = tog(x.add, nid, true); }, "carte dupliquée : " + c.name); }
    });
  });
};
