// TCCCG — données du jeu : cartes (générées depuis la base de données de l'app, modifiables par le modo dans data/tcg.json),
// archétypes, raretés, objets, coûts d'éveil, cartes « version show » et cartes champion. Cahier des charges v2 + idées de Jose.
import { S } from "../state.js";
import { fmt } from "../util.js";
import { photoOf } from "../photos.js";
import { wInfo, alignOf, norm } from "../wrestlers.js";
import { groupsOf, groupById, showLogo } from "../assets.js";
import { palmaresOf } from "../views/palmares.js";
import { resultWinner, sideNames } from "../views/mrate.js";

export const RAR = ["N", "R", "SR", "SSR", "UR", "LR"];
export const RNAME = { N: "Bronze", R: "Argent", SR: "Doré", SSR: "Doré brillant", UR: "Arc-en-ciel", LR: "Diamant" };
export const LVMAX = { N: 50, R: 100, SR: 100, SSR: 100, UR: 100, LR: 150 };
export const STATS = ["Force", "Agilité", "Charisme", "Endurance", "Technique"];
export const SK = ["fo", "ag", "ch", "en", "te"];
// 5 archétypes et leur cycle : Dominator → Aggressor → Technician → Opportunist → Showman → Dominator (×2 / ×0,5)
export const ARCH = {
  Dominator: { c: "#e23b3b", beats: "Aggressor", st: [1.45, 0.8, 0.9, 1.15, 0.7], fin: ["Powerbomb", "Stun"] },
  Aggressor: { c: "#f2c230", beats: "Technician", st: [1.2, 1.25, 0.85, 0.95, 0.75], fin: ["Spear", "Boost"] },
  Technician: { c: "#9b5de5", beats: "Opportunist", st: [0.9, 0.95, 0.75, 1.0, 1.4], fin: ["Soumission", "Révélation"] },
  Opportunist: { c: "#3fbf6a", beats: "Showman", st: [0.8, 1.35, 0.95, 0.8, 1.1], fin: ["Roll-up", "Vol de tour"] },
  Showman: { c: "#5cc8f0", beats: "Dominator", st: [0.85, 0.9, 1.45, 1.05, 0.75], fin: ["Coup de coude du peuple", "Soin"] }
};
export const ARCHS = Object.keys(ARCH);
export const typeMult = (a, b) => (ARCH[a] && ARCH[a].beats === b ? 2 : ARCH[b] && ARCH[b].beats === a ? 0.5 : 1);
export const FX = ["Stun", "Vol de tour", "Révélation", "Soin", "Division", "Boost", "Mélange"];
const BASE_TOTAL = { N: 100, R: 130, SR: 160, SSR: 190, UR: 225, LR: 265 };
// progression max (cahier) : N→R, R→SSR, SR→UR, SSR→UR (ou LR selon la popularité)
const MAXR = { N: "R", R: "SSR", SR: "UR", SSR: "UR", UR: "LR", LR: "LR" };
// taux de drop par défaut (%)
export const RATE0 = { N: 50, R: 30, SR: 13, SSR: 5.5, UR: 1.2, LR: 0.3 };
// coûts d'éveil (cahier) : Momentum / Pop / Push + objets d'éveil (C commun, R rare, E épique, L légendaire, M mythique)
export const AWAKE = {
  N: { mpp: 80, items: { C: 3 } }, R: { mpp: 180, items: { C: 5, R: 2 } }, SR: { mpp: 320, items: { R: 4, E: 2 } },
  SSR: { mpp: 550, items: { E: 3, L: 1 } }, UR: { mpp: 900, items: { L: 2, M: 1 }, medals: 5 }
};
// objets liés au catch : d'éveil (par rang) et de combat (utilisables en match)
export const ITEMS0 = [
  { id: "c-bandes", n: "Bandes de poignet", t: "eveil", g: "C", ic: "🩹", d: "Objet d’éveil commun." },
  { id: "r-genou", n: "Genouillères", t: "eveil", g: "R", ic: "🦵", d: "Objet d’éveil rare." },
  { id: "e-bottes", n: "Bottes de ring", t: "eveil", g: "E", ic: "🥾", d: "Objet d’éveil épique." },
  { id: "l-urne", n: "Urne", t: "eveil", g: "L", ic: "⚱️", d: "Objet d’éveil légendaire (achetable ou à gagner en combat)." },
  { id: "m-ceinture", n: "Ceinture en or", t: "eveil", g: "M", ic: "🏆", d: "Objet d’éveil mythique." },
  { id: "f-chaise", n: "Chaise en acier", t: "combat", ic: "🪑", fx: "dmg", v: 25, d: "Inflige 25 dégâts à l’adversaire actif." },
  { id: "f-table", n: "Table", t: "combat", ic: "🪵", fx: "dmg", v: 40, d: "Inflige 40 dégâts (une fois)." },
  { id: "f-echelle", n: "Échelle", t: "combat", ic: "🪜", fx: "fin", v: 50, d: "Remplit la moitié de la barre de Finisher." },
  { id: "f-kendo", n: "Kendo stick", t: "combat", ic: "🎋", fx: "dmg", v: 30, d: "Inflige 30 dégâts." },
  { id: "f-eau", n: "Bouteille d’eau", t: "combat", ic: "💧", fx: "heal", v: 35, d: "Rend 35 PV au catcheur actif." },
  { id: "f-serviette", n: "Serviette", t: "combat", ic: "🧻", fx: "heal", v: 20, d: "Rend 20 PV." },
  { id: "f-poing", n: "Poing américain", t: "combat", ic: "🥊", fx: "boost", v: 1.5, d: "Prochaine attaque ×1,5." },
  { id: "f-masque", n: "Masque de lucha", t: "combat", ic: "🎭", fx: "reveal", v: 4, d: "Révèle 4 cases pendant 1 seconde." }
];
export const MEDAL = name => "md:" + name;

const hashN = s => { let h = 2166136261; String(s).split("").forEach(c => { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }); return h >>> 0; };
export const cfg = () => (S.tcgCfg && typeof S.tcgCfg === "object" ? S.tcgCfg : {});
export const rates = () => Object.assign({}, RATE0, cfg().rates || {});
export const items = () => { const c = cfg(), ov = c.items || {}; const L = ITEMS0.map(x => Object.assign({}, x, ov[x.id] || {})); (c.itemsNew || []).forEach(x => { if (x && x.id && !L.find(y => y.id === x.id)) L.push(x); }); return L.filter(x => !x.del); };
export const itemById = id => items().find(x => x.id === id);

// archétype d'après la fiche (texte, gabarit, alignement), sinon au hasard stable
function guessArch(name, w, al) {
  const t = norm((w && (w.txt + " " + (w.fin || "") + " " + (w.nick || ""))) || "");
  if (/monstre|colosse|geant|puissan|bete|brut|powerhouse/.test(t)) return "Dominator";
  if (/technique|technicien|soumission|lutte|grappl|scientifi|strong style/.test(t)) return "Technician";
  if (/voltige|aerien|high.?fly|lucha|acrobat|rapide/.test(t)) return "Opportunist";
  if (/charisme|promo|showman|star|icone|public|micro/.test(t)) return "Showman";
  if (/agressi|bagarre|brawl|hardcore|violent|extreme|frappe/.test(t)) return "Aggressor";
  const wt = parseInt(String((w && w.wt) || "").replace(/\D/g, ""), 10);
  if (wt > 125) return "Dominator";
  if (al === "heel") return ["Aggressor", "Opportunist", "Dominator"][hashN(name) % 3];
  if (al === "face") return ["Showman", "Technician", "Opportunist"][hashN(name) % 3];
  return ARCHS[hashN(name) % 5];
}
// ---------- toutes les cartes de base (un catcheur = une carte) ----------
let BASE = null, BKEY = "";
export function baseCards() {
  const c = cfg(), key = Object.keys(S.photos || {}).length + "|" + (S.titles || []).length + "|" + Object.keys(S.wrestlers || {}).length + "|" + Object.keys(S.finishers || {}).length + "|" + JSON.stringify(c.cards || {}).length + "|" + (c.custom || []).length;
  if (BASE && BKEY === key) return BASE;
  const champs = champsNow();
  const roster = new Map(); Object.keys(S.rosters || {}).forEach(k => Object.keys(S.rosters[k] || {}).forEach(g => (S.rosters[k][g] || []).forEach(n => { if (!roster.has(norm(n))) roster.set(norm(n), { k: k, g: g }); })));
  const list = [];
  Object.keys(S.photos || {}).forEach(slug => {
    const it = S.photos[slug], name = it && Array.isArray(it.n) && it.n[0]; if (!name) return;
    const w = wInfo(name), n = norm(name), ro = roster.get(n), al = alignOf(name), gs = groupsOf(name), pal = palmaresOf(name);
    let score = 0;
    if (w) score += 3 + (Array.isArray(w.ref) ? Math.min(2, w.ref.length / 3) : 0);
    if (champs.has(n)) score += 2.5;
    const y = parseInt((String((w && (w.era || w.debut)) || "").match(/(19|20)\d{2}/) || [])[0], 10); if (y) score += Math.min(4, (2026 - y) / 4);
    score += Math.min(3, pal.reduce((a, x) => a + (x.x || 1), 0) * 0.6) + Math.min(2, gs.cur.length + gs.past.length * 0.5) + (ro ? 1 : 0) + (w && w.dc ? 2 : 0) + (hashN(name) % 100) / 1000;
    list.push({ id: slug, name: name, pic: photoOf(name), k: (w && w.k) || (ro && ro.k) || "", score: score, al: (al && al.k) || "", inj: !!(al && al.inj), w: w, gs: gs, years: y ? y + "–" : "" });
  });
  (c.custom || []).forEach(x => { if (x && x.id && x.name) list.push({ id: x.id, name: x.name, pic: x.img || "", k: x.k || "", score: -1, al: x.al || "", custom: true, w: null, gs: { cur: [], past: [] }, years: x.years || "" }); });
  // rareté de base selon le rang de célébrité : 2 % SSR à potentiel LR, 8 % SSR, 20 % SR, 35 % R, le reste N
  list.sort((a, b) => b.score - a.score);
  const N = list.filter(x => !x.custom).length, cut = [0.02, 0.10, 0.30, 0.65].map(p => Math.round(N * p));
  let i = 0;
  list.forEach(x => {
    if (x.custom) { x.r = "N"; return; }
    x.r = i < cut[1] ? "SSR" : i < cut[2] ? "SR" : i < cut[3] ? "R" : "N"; x.lrPot = i < cut[0]; i++;
  });
  list.forEach(x => {
    const ov = (c.cards || {})[x.id] || (x.custom ? (c.custom || []).find(y => y.id === x.id) : null) || {};
    if (RAR.indexOf(ov.r) >= 0) x.r = ov.r;
    x.max = RAR.indexOf(ov.max) >= 0 ? ov.max : x.lrPot ? "LR" : MAXR[x.r];
    if (RAR.indexOf(x.max) < RAR.indexOf(x.r)) x.max = x.r;
    x.arch = ARCH[ov.arch] ? ov.arch : guessArch(x.name, x.w, x.al);
    if (ov.img) x.pic = ov.img;
    if (ov.al) x.al = ov.al;
    x.buff = +ov.buff || 0; // en % (buff / nerf du modo)
    // 5 stats de base (somme selon la rareté de base, répartie selon l'archétype)
    const tot = BASE_TOTAL[x.r] * (1 + x.buff / 100), m = ARCH[x.arch].st, h = hashN(x.name), sum = m.reduce((a, b) => a + b, 0);
    x.st = Array.isArray(ov.st) && ov.st.length === 5 ? ov.st.map(Number) : m.map((v, j) => Math.max(5, Math.round(tot * v / sum * (1 + ((((h >> (j * 4)) & 15) - 7.5) / 60)))));
    const fin = (S.finishers || {})[x.name] || (x.w && x.w.fin) || ""; // vrai finisher (data/finishers.json, sinon la fiche)
    x.fin = { n: (ov.fin && ov.fin.n) || (fin ? String(fin).split(/[,;(]/)[0].trim() : ARCH[x.arch].fin[0]), e: (ov.fin && FX.indexOf(ov.fin.e) >= 0 ? ov.fin.e : ARCH[x.arch].fin[1]) };
    x.faction = x.gs.cur[0] || "";
    x.gimmick = ov.gimmick || "";
    x.medalOf = ov.medalOf || partnerOf(x) || x.name; // médailles demandées pour l'éveil vers LR
    x.boosters = Array.isArray(ov.boosters) ? ov.boosters : null;
    x.hide = !!ov.hide;
  });
  BASE = list.filter(x => !x.hide); BKEY = key;
  return BASE;
}
function partnerOf(x) { const g = x.gs.cur[0] || x.gs.past[0]; if (!g) return ""; const G = groupById(g); return G && (G.m || []).find(n => norm(n) !== norm(x.name)) || ""; }
export const cardById = id => baseCards().find(c => c.id === id) || null;
export const cardByName = name => { const n = norm(name); return baseCards().find(c => norm(c.name) === n) || null; };
export function champsNow() { const s = new Set(); (S.titles || []).forEach(t => { [t.c].concat(t.who || []).forEach(c => { if (c) s.add(norm(String(c).replace(/\s*\(.*\)$/, ""))); }); }); return s; }
export function titleOf(name) { const n = norm(name); return (S.titles || []).find(t => [t.c].concat(t.who || []).some(c => c && norm(String(c).replace(/\s*\(.*\)$/, "")) === n)) || null; }

// ---------- cartes « version show » : 2 jours après les résultats, une carte par catcheur du show (+ bonus selon le résultat) ----------
// id d'une version : <slug>@<K|show|date> ; vainqueur +12 %, perdant +5 %
export function showKeyLabel(key) { const p = key.split("|"); const ple = p[1] === "PLE" ? ((S.P[p[0]] || {}).e || []).find(e => e.d === p[2]) : null; return ple ? ple.t + " " + (p[2] || "").slice(0, 4) : p[1] + (p[2] ? " du " + fmt(p[2]) : ""); }
export function showResults(key) { const h = (S.highlights || {})[key]; return h && Array.isArray(h.res) ? h.res : []; }
// catcheurs d'un show (d'après les résultats, sinon l'affiche) + vainqueurs
export function showPeople(key) {
  const out = new Map(), P = baseCards();
  const find = nm => P.find(c => norm(c.name) === nm || (c.w && Array.isArray(c.w.a) && c.w.a.some(a => norm(a) === nm)));
  showResults(key).forEach(line => {
    const r = resultWinner(line);
    const add = (side, win) => sideNames(side).forEach(nm => { const c = find(nm); if (c && !out.has(c.id)) out.set(c.id, { c: c, win: win }); });
    if (r && !r.draw) { add(r.w, true); add(r.l, false); }
    else P.forEach(c => { if (norm(line).indexOf(norm(c.name)) >= 0 && !out.has(c.id)) out.set(c.id, { c: c, win: false }); });
  });
  return Array.from(out.values());
}
// matchs d'un show pour les combats : [{ line, a: [cartes camp 1], b: [cartes camp 2] }]
export function showMatches(key) {
  const P = baseCards(), find = nm => P.find(c => norm(c.name) === nm || (c.w && Array.isArray(c.w.a) && c.w.a.some(a => norm(a) === nm)));
  const out = [];
  showResults(key).forEach(line => {
    const r = resultWinner(line); let A = [], Bc = [];
    if (r && !r.draw) { A = sideNames(r.w).map(find).filter(Boolean); Bc = sideNames(r.l).map(find).filter(Boolean); }
    else { const m = String(line).split(/\s+(?:contre|vs\.?|face à)\s+/i); if (m.length >= 2) { A = sideNames(m[0]).map(find).filter(Boolean); Bc = sideNames(m[1]).map(find).filter(Boolean); } }
    // sans spoiler : noms rangés par ordre alphabétique (on ne devine pas le vainqueur)
    const all = A.concat(Bc).sort((x, y) => x.name.localeCompare(y.name));
    if (all.length >= 2) out.push({ line: line, cards: all.slice(0, 4), sides: [A, Bc] });
  });
  return out;
}
export function versionCard(base, key) {
  const pp = showPeople(key).find(x => x.c.id === base.id), bonus = pp && pp.win ? 12 : 5;
  return Object.assign({}, base, { id: base.id + "@" + key, base: base.id, show: key, gimmick: showKeyLabel(key), st: base.st.map(v => Math.round(v * (1 + bonus / 100))), win: !!(pp && pp.win) });
}
// carte champion (drop) : boost permanent
export function championCard(base, tname) { return Object.assign({}, base, { id: base.id + "#champ", base: base.id, champ: true, gimmick: "Champion" + (tname ? " · " + tname : ""), st: base.st.map(v => Math.round(v * 1.1)) }); }
// définition d'une carte par id (base, version show, champion)
export function defOf(id) {
  if (!id) return null;
  const at = id.indexOf("@"), hs = id.indexOf("#champ");
  if (at > 0) { const b = cardById(id.slice(0, at)); return b ? versionCard(b, id.slice(at + 1)) : null; }
  if (hs > 0) { const b = cardById(id.slice(0, hs)); const t = b && titleOf(b.name); return b ? championCard(b, t && t.n) : null; }
  return cardById(id);
}
// stats d'un exemplaire : base + 1,2 par niveau (réparti) + boost champion en vrai (+10 %, perdu sans le titre)
export function statsOf(inst, def) {
  def = def || defOf(inst.c); if (!def) return [0, 0, 0, 0, 0];
  const lvBonus = (inst.lv - 1) * 1.2 / 5, rUp = RAR.indexOf(inst.r) - RAR.indexOf(def.r), live = !def.champ && champsNow().has(norm(def.name));
  return def.st.map(v => Math.round((v + lvBonus) * (1 + rUp * 0.08) * (live ? 1.1 : 1)));
}
export const hpOf = st => st.reduce((a, b) => a + b, 0) * 2;
export const isChampLive = def => !!def && champsNow().has(norm(def.name));
export const promoLogo = k => (k && showLogo(k, "")) || "";
// lien entre deux cartes (même groupe / équipe) : bonus de soutien
export function linked(a, b) { if (!a || !b) return false; const A = (a.gs || {}).cur || [], Bg = (b.gs || {}).cur || []; return A.some(g => Bg.indexOf(g) >= 0) || ((a.gs || {}).past || []).some(g => (b.gs.past || []).concat(Bg).indexOf(g) >= 0); }
