// TCCCG — gacha (onglet Call Up) et collection (onglet Roster). Prototype réservé au modérateur.
// Cartes = les catcheurs qui ont une photo dans le dossier de Jose (img/catcheurs). Rareté selon la célébrité
// (fiche, titres, palmarès, groupes…) : N, R, SR, SSR, UR, LR. Stats ATK / DEF selon la rareté, le statut (champion,
// face / heel, blessé) et le gabarit. Boosters = les shows de la base de données (shows hebdo, PLE / PPV, promotions).
// Pièces, cartes et booster gratuit du jour : gardés sur le téléphone (prototype).
import { S, ACT, changed } from "../state.js";
import { esc, lsGet, lsSet, toast, modal, fmt } from "../util.js";
import { photoOf } from "../photos.js";
import { wInfo, alignOf, norm } from "../wrestlers.js";
import { groupsOf, showLogo, eventLogo } from "../assets.js";
import { palmaresOf } from "./palmares.js";
import { allPle, PARENT } from "./catalog.js";
import { parisDay } from "../time.js";

export const RAR = ["N", "R", "SR", "SSR", "UR", "LR"];
const RATE = { N: 55, R: 25, SR: 12, SSR: 5.5, UR: 2, LR: 0.5 };          // taux de drop (%)
const SELL = { N: 10, R: 25, SR: 60, SSR: 150, UR: 400, LR: 1000 };       // prix de revente (pièces)
const BASE = { N: 900, R: 1400, SR: 2000, SSR: 2700, UR: 3400, LR: 4200 }; // stats de base
const PACK = 5, PRICE = 100, START = 1000;
const SHARE = [["LR", 0.01], ["UR", 0.03], ["SSR", 0.08], ["SR", 0.18], ["R", 0.3]]; // part du classement de célébrité

const hashN = s => { let h = 2166136261; String(s).split("").forEach(c => { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }); return h >>> 0; };
// tous les catcheurs avec photo
let POOL = null, POOLKEY = "";
function pool() {
  const key = Object.keys(S.photos || {}).length + "|" + (S.titles || []).length + "|" + Object.keys(S.wrestlers || {}).length;
  if (POOL && POOLKEY === key) return POOL;
  const champs = new Set(); (S.titles || []).forEach(t => { [t.c].concat(t.who || []).forEach(c => { if (c) champs.add(norm(String(c).replace(/\s*\(.*\)$/, ""))); }); });
  const inRoster = new Map(); Object.keys(S.rosters || {}).forEach(k => Object.keys(S.rosters[k] || {}).forEach(g => (S.rosters[k][g] || []).forEach(n => { if (!inRoster.has(norm(n))) inRoster.set(norm(n), { k: k, g: g }); })));
  const list = [];
  Object.keys(S.photos || {}).forEach(slug => {
    const it = S.photos[slug], name = it && Array.isArray(it.n) && it.n[0]; if (!name) return;
    const w = wInfo(name), n = norm(name), pal = palmaresOf(name), gs = groupsOf(name), ro = inRoster.get(n), al = alignOf(name);
    let score = 0;
    if (w) score += 3 + (Array.isArray(w.ref) ? Math.min(2, w.ref.length / 3) : 0);
    if (champs.has(n)) score += 2.5;
    // ancienneté (« WWE, depuis 2012 », « 1996–2015 »…) : les grands noms ont de longues carrières
    const y = parseInt((String((w && (w.era || w.debut)) || "").match(/(19|20)\d{2}/) || [])[0], 10); if (y) score += Math.min(4, (2026 - y) / 4);
    score += Math.min(3, pal.reduce((a, x) => a + (x.x || 1), 0) * 0.6);
    score += Math.min(2, gs.cur.length + gs.past.length * 0.5);
    if (ro) score += 1;
    if (w && w.dc) score += 2; // légende disparue
    score += (hashN(name) % 100) / 1000; // départage
    list.push({ name: name, slug: slug, pic: photoOf(name), k: (w && w.k) || (ro && ro.k) || "", score: score, champ: champs.has(n), al: al && al.k, inj: !!(al && al.inj), w: w });
  });
  // rareté selon le rang de célébrité
  list.sort((a, b) => b.score - a.score);
  let i = 0; const N = list.length;
  // rareté imposée par le modo (champ « tcg » d'une fiche : "LR", "UR"…)
  list.forEach(c => { if (c.w && RAR.indexOf(c.w.tcg) >= 0) c.fixed = c.w.tcg; });
  SHARE.forEach(([r, part]) => { const end = i + Math.max(1, Math.round(N * part)); for (; i < end && i < N; i++) list[i].r = r; });
  for (; i < N; i++) list[i].r = "N";
  list.forEach(c => { if (c.fixed) c.r = c.fixed; });
  // stats
  list.forEach(c => {
    const b = BASE[c.r], h = hashN(c.name), v1 = ((h % 300) - 150) / 1000, v2 = (((h >> 9) % 300) - 150) / 1000;
    let atk = b * (1 + v1), def = b * (1 + v2);
    if (c.al === "heel") { atk *= 1.08; def *= 0.95; } else if (c.al === "face") { def *= 1.08; atk *= 0.97; } else if (c.al === "tweener") { atk *= 1.04; def *= 1.04; }
    if (c.champ) { atk *= 1.1; def *= 1.1; }
    const wt = parseInt(String((c.w && c.w.wt) || "").replace(/\D/g, ""), 10); if (wt > 120) { def *= 1.06; atk *= 0.98; } else if (wt && wt < 80) { atk *= 1.05; }
    if (c.inj) { atk *= 0.85; def *= 0.85; }
    c.atk = Math.round(atk / 10) * 10; c.def = Math.round(def / 10) * 10;
  });
  POOL = list; POOLKEY = key;
  return list;
}
const byName = n => pool().find(c => c.name === n);
export const tcgPool = () => pool();

// ---------- sauvegarde (téléphone) ----------
const KEY = "ctv.tcg";
function st() { let d; try { d = JSON.parse(lsGet(KEY) || "null"); } catch (e) {} d = d || {}; if (d.coins == null) d.coins = START; d.cards = d.cards || {}; d.opened = d.opened || 0; return d; }
const save = d => lsSet(KEY, JSON.stringify(d));

// ---------- boosters = shows de la base de données ----------
function boosters() {
  const out = [];
  Object.keys(S.P || {}).forEach(k => {
    const pr = S.P[k];
    Object.keys(pr.s || {}).forEach(n => out.push({ id: "s:" + k + "|" + n, cat: "Shows hebdo", t: n, k: k, show: n, logo: showLogo(k, n) || showLogo(k, ""), c: (pr.s[n].c || pr.c || []) }));
    out.push({ id: "p:" + k, cat: "Promotions", t: k, k: k, logo: showLogo(k, ""), c: pr.c || [] });
  });
  const td = parisDay();
  allPle().filter(e => e.d).sort((a, b) => Math.abs(Date.parse(a.d) - Date.parse(td)) - Math.abs(Date.parse(b.d) - Date.parse(td))).slice(0, 12)
    .forEach(e => out.push({ id: "e:" + e.k + "|" + e.d, cat: "PLE et PPV", t: e.t, k: e.k, d: e.d, logo: eventLogo(e) || showLogo(e.k, ""), c: (S.P[e.k] && S.P[e.k].c) || [], card: e.card || [] }));
  return out;
}
// catcheurs d'un booster : roster du show, sinon de la promotion (+ affiche du PLE), sinon tout le monde
function boosterPool(b) {
  const P = pool(), names = new Set();
  const ro = S.rosters && S.rosters[b.k];
  if (ro) {
    if (b.show && ro[b.show]) ro[b.show].forEach(n => names.add(norm(n)));
    else Object.keys(ro).forEach(g => (ro[g] || []).forEach(n => names.add(norm(n))));
  }
  Object.keys(PARENT).filter(c => PARENT[c] === b.k && !b.show).forEach(c => { const r2 = S.rosters && S.rosters[c]; if (r2) Object.keys(r2).forEach(g => (r2[g] || []).forEach(n => names.add(norm(n)))); });
  (b.card || []).forEach(line => P.forEach(c => { if (norm(line).indexOf(norm(c.name)) >= 0) names.add(norm(c.name)); }));
  let L = P.filter(c => names.has(norm(c.name)) || (c.k && c.k === b.k && !b.show));
  if (L.length < 15) L = P;
  return L;
}
function drawRarity(min) {
  for (;;) { let x = Math.random() * 100, r = "N"; for (const k of RAR.slice().reverse()) { x -= RATE[k]; if (x < 0) { r = k; break; } } if (!min || RAR.indexOf(r) >= RAR.indexOf(min)) return r; }
}
function openPack(b) {
  const L = boosterPool(b), out = [];
  for (let i = 0; i < PACK; i++) {
    const want = drawRarity(i === PACK - 1 ? "R" : ""); // dernière carte : R ou mieux
    let cand = L.filter(c => c.r === want), j = RAR.indexOf(want);
    while (!cand.length && j > 0) { j--; cand = L.filter(c => c.r === RAR[j]); }
    if (!cand.length) cand = L;
    out.push(cand[Math.floor(Math.random() * cand.length)]);
  }
  return out;
}

// ---------- template d'une carte ----------
export function cardHTML(c, opt) {
  opt = opt || {};
  const lg = c.k && showLogo(c.k, "");
  return '<div class="tcard r-' + c.r + (opt.small ? " sm" : "") + '"' + (opt.act ? ' data-act="' + opt.act + '" data-n="' + esc(c.name) + '"' : "") + '>' +
    '<div class="tcfoil"></div><div class="tctop"><span class="tcr">' + c.r + "</span>" + (lg ? '<img class="tclogo" src="' + esc(lg) + '" alt="">' : '<span class="tck">' + esc(c.k || "") + "</span>") + "</div>" +
    '<div class="tcpic" style="background-image:url(\'' + esc(c.pic) + '\')"></div>' +
    '<div class="tcname">' + esc(c.name) + (c.champ ? " 🏆" : "") + "</div>" +
    '<div class="tcstats"><span>ATK <b>' + c.atk + "</b></span><span>DEF <b>" + c.def + "</b></span></div>" +
    (opt.count > 1 ? '<span class="tccount">×' + opt.count + "</span>" : "") + "</div>";
}

// ---------- Call Up ----------
export function callUpView() {
  const d = st(), B = boosters(), free = d.free !== parisDay();
  const cats = {}; B.forEach(b => { (cats[b.cat] = cats[b.cat] || []).push(b); });
  let h = '<section class="tccghead"><h1>Call Up</h1><div class="tcoins">🪙 <b>' + d.coins + '</b> pièces</div></section>' +
    '<p class="tnote">Choisis un booster : ' + PACK + " cartes, la dernière est R ou mieux. Prix : " + PRICE + " pièces" + (free ? " · 🎁 ton booster gratuit du jour t’attend !" : "") + "</p>" +
    '<details class="trates"><summary>Taux de drop</summary><p>' + RAR.map(r => '<span class="tcr r-' + r + '">' + r + "</span> " + RATE[r] + " %").join(" · ") + "</p></details>";
  ["Shows hebdo", "PLE et PPV", "Promotions"].forEach(cat => {
    if (!cats[cat]) return;
    h += "<h2>" + cat + '</h2><div class="row tbrow">' + cats[cat].map(b => {
      const c = b.c || [];
      return '<button class="tbooster" data-act="tcgopen" data-id="' + esc(b.id) + '" style="background:linear-gradient(160deg,' + (c[0] || "#3b321f") + "," + (c[1] || "#0a0907") + ')">' +
        (b.logo ? '<img src="' + esc(b.logo) + '" alt="">' : "") + "<b>" + esc(b.t) + "</b><small>" + esc(b.k + (b.d ? " · " + fmt(b.d) : "")) + '</small><span class="tbprice">' + (free ? "🎁 Gratuit" : "🪙 " + PRICE) + "</span></button>";
    }).join("") + "</div>";
  });
  return h;
}
ACT.tcgopen = el => {
  const b = boosters().find(x => x.id === el.dataset.id); if (!b) return;
  const d = st(), free = d.free !== parisDay();
  if (!free && d.coins < PRICE) { toast("Pas assez de pièces : vends des cartes en double dans Roster"); return; }
  if (free) d.free = parisDay(); else d.coins -= PRICE;
  const got = openPack(b); got.forEach(c => { d.cards[c.name] = (d.cards[c.name] || 0) + 1; }); d.opened++;
  save(d);
  packAnim(b, got);
};
// animation : le booster tremble et se déchire, puis les cartes défilent une à une (effet selon la rareté)
function packAnim(b, cards) {
  const best = cards.reduce((m, c) => Math.max(m, RAR.indexOf(c.r)), 0), c0 = b.c || [];
  const ov = document.createElement("div"); ov.className = "tpackov best-" + RAR[best];
  ov.innerHTML = '<div class="tpack" style="background:linear-gradient(160deg,' + (c0[0] || "#3b321f") + "," + (c0[1] || "#0a0907") + ')">' + (b.logo ? '<img src="' + esc(b.logo) + '" alt="">' : "") + "<b>" + esc(b.t) + '</b><span class="tptear"></span></div><p class="tphint">Touche le booster pour l’ouvrir</p>';
  document.body.appendChild(ov);
  let i = -1;
  const next = () => {
    i++;
    if (i === 0) { ov.querySelector(".tpack").classList.add("open"); setTimeout(show, 650); return; }
    show();
  };
  const show = () => {
    if (i >= cards.length) return recap();
    const c = cards[i];
    ov.innerHTML = '<div class="tfx fx-' + c.r + '"></div><div class="treveal">' + cardHTML(c) + '</div><p class="tphint">' + (i + 1) + " / " + cards.length + " · touche pour la suivante</p>";
    if (navigator.vibrate && RAR.indexOf(c.r) >= 3) try { navigator.vibrate([30, 40, 60]); } catch (e) {}
  };
  const recap = () => {
    ov.innerHTML = '<div class="trecap"><h2>Ton booster ' + esc(b.t) + '</h2><div class="trgrid">' + cards.map(c => cardHTML(c, { small: true })).join("") + '</div><div class="btns"><a class="btn" href="#/tccg/roster" data-close>Voir mon roster</a><button class="btn ghost" data-close>Continuer</button></div></div>';
    i = 999;
  };
  ov.addEventListener("click", e => {
    if (i >= 999) { if (e.target.closest("[data-close]")) { ov.remove(); changed("profile"); } return; }
    next();
  });
}

// ---------- Roster ----------
let rFilter = "", rSort = "rar";
export function rosterTcgView() {
  const d = st(), own = Object.keys(d.cards).filter(n => d.cards[n] > 0).map(n => byName(n)).filter(Boolean);
  const total = pool().length;
  let L = own.filter(c => !rFilter || c.r === rFilter);
  L.sort((a, b) => rSort === "atk" ? b.atk - a.atk : rSort === "def" ? b.def - a.def : rSort === "nom" ? a.name.localeCompare(b.name) : RAR.indexOf(b.r) - RAR.indexOf(a.r) || b.atk - a.atk);
  const dup = own.reduce((s, c) => s + Math.max(0, d.cards[c.name] - 1) * SELL[c.r], 0);
  let h = '<section class="tccghead"><h1>Roster</h1><div class="tcoins">🪙 <b>' + d.coins + "</b></div></section>" +
    '<p class="tnote">' + own.length + " / " + total + " catcheurs · " + d.opened + " booster" + (d.opened > 1 ? "s" : "") + " ouvert" + (d.opened > 1 ? "s" : "") + "</p>" +
    '<div class="tfilt">' + ['<button class="chip' + (!rFilter ? " on" : "") + '" data-act="tcgf" data-r="">Toutes</button>'].concat(RAR.map(r => '<button class="chip tcr r-' + r + (rFilter === r ? " on" : "") + '" data-act="tcgf" data-r="' + r + '">' + r + " " + own.filter(c => c.r === r).length + "</button>")).join("") + "</div>" +
    '<div class="tfilt">' + [["rar", "Rareté"], ["atk", "ATK"], ["def", "DEF"], ["nom", "Nom"]].map(x => '<button class="chip' + (rSort === x[0] ? " on" : "") + '" data-act="tcgs" data-s="' + x[0] + '">' + x[1] + "</button>").join("") +
    (dup ? '<button class="chip" data-act="tcgselldup">💰 Vendre les doublons (+' + dup + ")</button>" : "") + "</div>";
  h += L.length ? '<div class="trgrid">' + L.map(c => cardHTML(c, { small: true, act: "tcgcard", count: d.cards[c.name] })).join("") + "</div>" : '<p class="tnote">Pas encore de carte' + (rFilter ? " " + rFilter : "") + ". Ouvre un booster dans Call Up !</p>";
  return h;
}
ACT.tcgf = el => { rFilter = el.dataset.r || ""; changed("profile"); };
ACT.tcgs = el => { rSort = el.dataset.s || "rar"; changed("profile"); };
ACT.tcgcard = el => {
  const c = byName(el.dataset.n); if (!c) return;
  modal((box, close) => {
    const draw = () => {
      const d = st(), n = d.cards[c.name] || 0;
      box.innerHTML = '<div class="tczoom">' + cardHTML(c) + "</div><p class=\"sub\">Tu en as " + n + " · revente : " + SELL[c.r] + ' pièces</p>' +
        '<a class="btn wide ghost" href="#/catcheur/' + encodeURIComponent(c.name) + '" data-close>Voir sa fiche</a>' +
        (n > 0 ? '<button class="btn wide" style="margin-top:8px" data-sell>Vendre 1 carte (+' + SELL[c.r] + ")</button>" : "") +
        '<button class="btn wide ghost" style="margin-top:8px" data-close>Fermer</button>';
    };
    draw();
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) { close(); return; }
      if (e.target.closest("[data-sell]")) { const d = st(); if (d.cards[c.name] > 0) { d.cards[c.name]--; d.coins += SELL[c.r]; if (!d.cards[c.name]) delete d.cards[c.name]; save(d); toast("+" + SELL[c.r] + " pièces"); draw(); changed("profile"); } }
    });
  });
};
ACT.tcgselldup = () => {
  const d = st(); let gain = 0;
  Object.keys(d.cards).forEach(n => { const c = byName(n); if (c && d.cards[n] > 1) { gain += (d.cards[n] - 1) * SELL[c.r]; d.cards[n] = 1; } });
  d.coins += gain; save(d); toast("Doublons vendus : +" + gain + " pièces"); changed("profile");
};
