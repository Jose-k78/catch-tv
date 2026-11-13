// TCCCG — données du jeu : cartes (générées depuis la base de données de l'app, modifiables par le modo dans data/tcg.json),
// archétypes, raretés, objets, coûts d'éveil, cartes « version show » et cartes champion. Cahier des charges v2 + idées de Jose.
import { S } from "../state.js";
import { fmt } from "../util.js";
import { photoOf } from "../photos.js";
import { wInfo, alignOf, norm } from "../wrestlers.js";
import { groupsOf, groupById, showLogo } from "../assets.js";
import { palmaresBase as palmaresOf } from "../views/palmares.js";
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
export const RATE0 = { N: 44, R: 30, SR: 14.5, SSR: 10, UR: 1.2, LR: 0.3 }; // SSR relevé le 11 nov. (demande de Jose)
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
  { id: "f-chaise", n: "Chaise en acier", t: "combat", q: "commun", ic: "🪑", fx: "dmg", v: 25, price: 1500, d: "Inflige 25 dégâts à l’équipe adverse." },
  { id: "f-table", n: "Table", t: "combat", q: "rare", ic: "🪵", fx: "dmg", v: 40, price: 3000, d: "Inflige 40 dégâts à l’équipe adverse." },
  { id: "f-echelle", n: "Échelle", t: "combat", q: "rare", ic: "🪜", fx: "fin", v: 50, price: 3000, d: "Remplit la moitié de ta barre de Finisher." },
  { id: "f-kendo", n: "Kendo stick", t: "combat", q: "commun", ic: "🎋", fx: "dmg", v: 30, price: 1800, d: "Inflige 30 dégâts à l’équipe adverse." },
  { id: "f-eau", n: "Bouteille d’eau", t: "combat", q: "commun", ic: "💧", fx: "heal", v: 35, price: 1500, d: "Rend 35 PV à ton équipe." },
  { id: "f-serviette", n: "Serviette", t: "combat", q: "commun", ic: "🧻", fx: "heal", v: 20, price: 900, d: "Rend 20 PV à ton équipe." },
  { id: "f-poing", n: "Poing américain", t: "combat", q: "rare", ic: "🥊", fx: "boost", v: 1.5, price: 3500, d: "Ta prochaine attaque ×1,5." },
  { id: "f-masque", n: "Masque de lucha", t: "combat", q: "legendaire", ic: "🎭", fx: "stun", v: 1, price: 6000, d: "Étourdit une carte adverse pendant 1 tour." },
  { id: "f-spray", n: "Spray de l’arbitre", t: "combat", q: "legendaire", ic: "🧴", fx: "div", v: 0.5, price: 6000, d: "Les attaques adverses ×0,5 au prochain tour." },
  // équipement : une pièce par carte, pour toujours (on peut la retirer), bonus de stats [Force, Agilité, Charisme, Endurance, Technique]
  { id: "q-gants", n: "Gants de MMA", t: "equip", ic: "🥊", st: [6, 0, 0, 0, 0], price: 4000, d: "+6 Force." },
  { id: "q-chaussons", n: "Chaussons légers", t: "equip", ic: "👟", st: [0, 6, 0, 0, 0], price: 4000, d: "+6 Agilité." },
  { id: "q-micro", n: "Micro doré", t: "equip", ic: "🎤", st: [0, 0, 6, 0, 0], price: 4000, d: "+6 Charisme." },
  { id: "q-coudieres", n: "Coudières renforcées", t: "equip", ic: "🛡️", st: [0, 0, 0, 6, 0], price: 4000, d: "+6 Endurance." },
  { id: "q-carnet", n: "Carnet de prises", t: "equip", ic: "📓", st: [0, 0, 0, 0, 6], price: 4000, d: "+6 Technique." },
  { id: "q-peignoir", n: "Peignoir d’entrée", t: "equip", ic: "🥋", st: [3, 3, 3, 3, 3], price: 7500, d: "+3 à toutes les stats." },
  { id: "q-lunettes", n: "Lunettes de star", t: "equip", ic: "🕶️", st: [0, 2, 8, 0, 0], price: 6000, d: "+8 Charisme, +2 Agilité." },
  { id: "q-bottes", n: "Bottes cloutées", t: "equip", ic: "🥾", st: [5, 0, 0, 5, 0], price: 6500, d: "+5 Force, +5 Endurance." }
];
// chance qu'un objet de combat marche (selon sa qualité) ; sinon il rate, ou se retourne contre toi
export const QCH = { commun: 0.5, rare: 0.65, legendaire: 0.8 }, QNAME = { commun: "Commun", rare: "Rare", legendaire: "Légendaire" };
// niveau de finisher (= ses dégâts) selon la rareté de la carte ; le modo peut le changer carte par carte (cfg.cards[id].fl)
export const FLV = { N: 100, R: 120, SR: 130, SSR: 150, UR: 170, LR: 200 };
// taux du Call Up (validés par Jose le 12 nov.) : rareté de base des cartes ; LRP = SSR qui peut devenir LR
export const RATES2 = {
  week: { N: 55, R: 30, SR: 11, SSR: 3.5, LRP: 0.5 },
  ple: { N: 42, R: 32, SR: 17, SSR: 7.5, LRP: 1.5 },
  free: { N: 65, R: 27, SR: 7, SSR: 1, LRP: 0 },
  start: { N: 62, R: 28, SR: 8, SSR: 2, LRP: 0 },
  special: { N: 45, R: 31, SR: 16, SSR: 7, LRP: 1 }
};
export const rates2 = cat => Object.assign({}, RATES2[cat] || RATES2.week, ((cfg().rates2 || {})[cat]) || {});
export const MEDAL = name => "md:" + name;

const hashN = s => { let h = 2166136261; String(s).split("").forEach(c => { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }); return h >>> 0; };
export const cfg = () => (S.tcgCfg && typeof S.tcgCfg === "object" ? S.tcgCfg : {});
export const rates = () => Object.assign({}, RATE0, cfg().rates || {});
export const items = () => { const c = cfg(), ov = c.items || {}; const L = ITEMS0.map(x => Object.assign({}, x, ov[x.id] || {})); (c.itemsNew || []).forEach(x => { if (x && x.id && !L.find(y => y.id === x.id)) L.push(x); }); return L.filter(x => !x.del); };
export const itemById = id => items().find(x => x.id === id);
export const finLv = (inst, def) => { def = def || defOf(inst.c); const o = def && (cfg().cards || {})[def.base || def.id]; return (o && +o.fl) || FLV[inst.r || (def && def.r)] || 100; };

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
// nom « réel » d'une carte (pour la retrouver dans les résultats, rosters, champions) même si le modo l'a renommée
export const realKey = c => norm(c.rn || c.name);
// même nom de fichier que le robot des photos : quand Jose ajoute la photo, la carte garde son identifiant
export const slugOf = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, "-and-").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "carte";
export function baseCards() {
  const c = cfg(), key = Object.keys(S.photos || {}).length + "|" + (S.titles || []).length + "|" + Object.keys(S.wrestlers || {}).length + "|" + Object.keys(S.finishers || {}).length + "|" + JSON.stringify(c.cards || {}).length + "|" + (c.custom || []).length + "|" + Object.keys(S.rosters || {}).length + "|" + Object.keys(S.bank || {}).length;
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
  // catcheurs sans photo (rosters et fiches) : carte vide, le modo mettra l'image
  const seen = new Set(), ids = new Set(list.map(x => x.id));
  list.forEach(x => { seen.add(norm(x.name)); ((S.photos[x.id] || {}).n || []).forEach(a => seen.add(norm(a))); if (x.w && Array.isArray(x.w.a)) x.w.a.forEach(a => seen.add(norm(a))); });
  const extra = []; roster.forEach((v, n) => extra.push(n)); Object.keys(S.wrestlers || {}).forEach(nm => extra.push(norm(nm)));
  const realName = new Map(); Object.keys(S.rosters || {}).forEach(k => Object.keys(S.rosters[k] || {}).forEach(g => (S.rosters[k][g] || []).forEach(nm => { if (!realName.has(norm(nm))) realName.set(norm(nm), nm); }))); Object.keys(S.wrestlers || {}).forEach(nm => realName.set(norm(nm), nm));
  extra.forEach(n => {
    if (seen.has(n)) return; seen.add(n);
    const name = realName.get(n); if (!name) return;
    const w = wInfo(name); if (w && Array.isArray(w.a) && w.a.some(a => seen.has(norm(a)))) return;
    let id = slugOf(name); while (ids.has(id)) id += "-2"; ids.add(id);
    const ro = roster.get(n), al = alignOf(name), gs = groupsOf(name), pal = palmaresOf(name);
    let score = 0; if (w) score += 3; if (champs.has(n)) score += 2.5;
    const y = parseInt((String((w && (w.era || w.debut)) || "").match(/(19|20)\d{2}/) || [])[0], 10); if (y) score += Math.min(4, (2026 - y) / 4);
    score += Math.min(3, pal.reduce((a, x) => a + (x.x || 1), 0) * 0.6) + Math.min(2, gs.cur.length + gs.past.length * 0.5) + (ro ? 1 : 0) + (hashN(name) % 100) / 1000;
    list.push({ id: id, name: name, pic: "", nopic: true, k: (w && w.k) || (ro && ro.k) || "", score: score, al: (al && al.k) || "", inj: !!(al && al.inj), w: w, gs: gs, years: y ? y + "–" : "" });
  });
  (c.custom || []).forEach(x => { if (x && x.id && x.name) list.push({ id: x.id, name: x.name, pic: x.img || "", k: x.k || "", score: -1, al: x.al || "", custom: true, w: null, gs: { cur: [], past: [] }, years: x.years || "" }); });
  // rareté de base selon le rang de célébrité : 2 % SSR à potentiel LR, 8 % SSR, 20 % SR, 35 % R, le reste N
  // (le rang se calcule sur les cartes avec photo ; une carte sans photo prend la rareté de son score)
  list.sort((a, b) => b.score - a.score);
  const PH = list.filter(x => !x.custom && !x.nopic), N = PH.length, cut = [0.02, 0.10, 0.30, 0.65].map(p => Math.round(N * p));
  const th = cut.map(k => (PH[Math.max(0, k - 1)] || { score: 0 }).score);
  let i = 0;
  list.forEach(x => {
    if (x.custom) { x.r = "N"; return; }
    if (x.nopic) { x.r = x.score >= th[1] ? "SSR" : x.score >= th[2] ? "SR" : x.score >= th[3] ? "R" : "N"; x.lrPot = x.score >= th[0]; return; }
    x.r = i < cut[1] ? "SSR" : i < cut[2] ? "SR" : i < cut[3] ? "R" : "N"; x.lrPot = i < cut[0]; i++;
  });
  list.forEach(x => {
    const ov = (c.cards || {})[x.id] || (x.custom ? (c.custom || []).find(y => y.id === x.id) : null) || {};
    x.rn = x.name; if (ov.name && !x.custom) x.name = String(ov.name);
    if (typeof ov.years === "string" && !x.custom) x.years = ov.years;
    if (ov.k && !x.custom) x.k = ov.k;
    if (RAR.indexOf(ov.r) >= 0) x.r = ov.r;
    x.max = RAR.indexOf(ov.max) >= 0 ? ov.max : x.lrPot ? "LR" : MAXR[x.r];
    if (RAR.indexOf(x.max) < RAR.indexOf(x.r)) x.max = x.r;
    x.arch = ARCH[ov.arch] ? ov.arch : guessArch(x.name, x.w, x.al);
    // image : la photo de la fiche gagne (13 nov., Jose) ; l'image du modo sert aux cartes sans photo et aux cartes créées
    if (ov.img && (x.nopic || x.custom)) { x.pic = ov.img; x.nopic = false; }
    // images alternatives (banque d'images) : UR = 1re variante, LR = version « champion » sinon 2e variante ; le modo peut choisir
    const alts = ((S.bank || {})[x.id] || []).map(f => "img/tcg/alt/" + f), ch = alts.find(f => /-champ\d*\.webp$/.test(f)), al2 = alts.filter(f => f !== ch);
    x.alts = alts;
    x.picUR = ov.imgUR === "-" ? "" : ov.imgUR || al2[0] || "";
    x.picLR = ov.imgLR === "-" ? "" : ov.imgLR || ch || al2[1] || "";
    if (ov.al) x.al = ov.al;
    x.buff = +ov.buff || 0; // en % (buff / nerf du modo)
    // 5 stats de base (somme selon la rareté de base, répartie selon l'archétype)
    const tot = BASE_TOTAL[x.r] * (1 + x.buff / 100), m = ARCH[x.arch].st, h = hashN(x.rn), sum = m.reduce((a, b) => a + b, 0);
    x.st = Array.isArray(ov.st) && ov.st.length === 5 ? ov.st.map(Number) : m.map((v, j) => Math.max(5, Math.round(tot * v / sum * (1 + ((((h >> (j * 4)) & 15) - 7.5) / 60)))));
    const fin = (S.finishers || {})[x.name] || (x.w && x.w.fin) || ""; // vrai finisher (data/finishers.json, sinon la fiche)
    x.fin = { n: (ov.fin && ov.fin.n) || (fin ? String(fin).split(/[,;(]/)[0].trim() : ARCH[x.arch].fin[0]), e: (ov.fin && FX.indexOf(ov.fin.e) >= 0 ? ov.fin.e : ARCH[x.arch].fin[1]) };
    x.faction = typeof ov.fac === "string" ? ov.fac : (x.gs.cur[0] || "");
    x.gimmick = ov.gimmick || "";
    x.medalOf = ov.medalOf || partnerOf(x) || x.name; // médailles demandées pour l'éveil vers LR
    x.boosters = Array.isArray(ov.boosters) ? ov.boosters : null;
    x.hide = !!ov.hide;
  });
  BASE = list.filter(x => !x.hide); BKEY = key;
  return BASE;
}
function partnerOf(x) { const g = x.gs.cur[0] || x.gs.past[0]; if (!g) return ""; const G = groupById(g); return G && (G.m || []).find(n => norm(n) !== realKey(x)) || ""; }
// (un catcheur fusionné avec un autre garde ses cartes : l'ancien identifiant mène à la nouvelle carte)
export const cardById = id => baseCards().find(c => c.id === id) || ((S.photosMerged || {})[id] ? baseCards().find(c => c.id === S.photosMerged[id]) : null) || null;
export const cardByName = name => { const n = norm(name); return baseCards().find(c => realKey(c) === n) || baseCards().find(c => norm(c.name) === n) || null; };
export function champsNow() { const s = new Set(); (S.titles || []).forEach(t => { [t.c].concat(t.who || []).forEach(c => { if (c) s.add(norm(String(c).replace(/\s*\(.*\)$/, ""))); }); }); return s; }
export function titleOf(name) { const n = norm(name); return (S.titles || []).find(t => [t.c].concat(t.who || []).some(c => c && norm(String(c).replace(/\s*\(.*\)$/, "")) === n)) || null; }

// ---------- cartes « version show » : 2 jours après les résultats, une carte par catcheur du show (+ bonus selon le résultat) ----------
// id d'une version : <slug>@<K|show|date> ; vainqueur +12 %, perdant +5 %
export function showKeyLabel(key) { const p = key.split("|"); const ple = p[1] === "PLE" ? ((S.P[p[0]] || {}).e || []).find(e => e.d === p[2]) : null; return ple ? ple.t + " " + (p[2] || "").slice(0, 4) : p[1] + (p[2] ? " du " + fmt(p[2]) : ""); }
export function showResults(key) { const h = (S.highlights || {})[key]; return h && Array.isArray(h.res) ? h.res : []; }
// catcheurs d'un show (d'après les résultats, sinon l'affiche) + vainqueurs
export function showPeople(key) {
  const out = new Map(), P = baseCards();
  const find = nm => P.find(c => realKey(c) === nm || (c.w && Array.isArray(c.w.a) && c.w.a.some(a => norm(a) === nm)));
  showResults(key).forEach(line => {
    const r = resultWinner(line);
    const add = (side, win) => sideNames(side).forEach(nm => { const c = find(nm); if (c && !out.has(c.id)) out.set(c.id, { c: c, win: win }); });
    if (r && !r.draw) { add(r.w, true); add(r.l, false); }
    else P.forEach(c => { if (norm(line).indexOf(realKey(c)) >= 0 && !out.has(c.id)) out.set(c.id, { c: c, win: false }); });
  });
  return Array.from(out.values());
}
// matchs d'un show pour les combats : [{ line, a: [cartes camp 1], b: [cartes camp 2] }]
export function showMatches(key) {
  const P = baseCards(), find = nm => P.find(c => realKey(c) === nm || (c.w && Array.isArray(c.w.a) && c.w.a.some(a => norm(a) === nm)));
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
// ---------- évolution par ceinture (11 nov., demande de Jose) ----------
// Donner une ceinture à un catcheur qui a tenu ce titre transforme sa carte : id = <base>~<idTitre> (niveau et rareté gardés).
// Bonus selon le prestige (mondial +15 %, secondaire +10 %, équipe +8 %), répartition des stats propre à chaque type de titre.
// Le modo règle tout dans data/tcg.json : evo["<base>|<titre>"] = { off, name, years, gimmick, img, bonus, st, pw }, evoAdd[base] = [titres].
const WORLD = new Set(["wwe-whc", "wwe-wwe", "wwe-wwc", "wwe-wc", "nxt", "nxt-w", "aew-world", "aew-women", "tna-world", "tna-ko", "cmll-heavy", "cmll-women", "njpw-hw", "aaa-mega", "aaa-reina", "roh-world", "roh-women", "stardom-world", "stardom-wonder", "stardom-iwgpw", "marigold-world", "evolve", "evolve-w"]);
export const EVO_BONUS = { world: 15, sec: 10, tag: 8 }, EVO_NAME = { world: "titre mondial", sec: "titre secondaire", tag: "titre par équipe" };
const TILT = { world: [0.02, -0.03, 0.05, 0, -0.04], sec: [-0.03, 0.05, -0.02, -0.02, 0.02], tag: [0.01, -0.02, -0.03, 0.05, -0.01] };
export const titleById = id => (S.titles || []).find(t => t.id === id) || null;
export function prestige(t) { if (!t) return "sec"; const n = String(t.n || ""); if (/tag|trios|6-man|six-man|twin ?star|goddesses|artist/i.test(n)) return "tag"; return WORLD.has(t.id) ? "world" : "sec"; }
export const beltShort = t => String(t.n || "").replace(/\s*\(.*\)\s*/g, " ").replace(/\s*Championships?\s*/i, " ").replace(new RegExp("^" + String(t.k || "").replace(/[^\w ]/g, "") + "\\s+"), "").replace(/\s+/g, " ").trim() || t.n;
let HKEY = "", HELD = null;
function heldMap() {
  const T = S.titles || [], k = T.length + "|" + (T[0] && T[0].since) + "|" + T.reduce((a, t) => a + (t.hist || []).length, 0);
  if (HELD && HKEY === k) return HELD; HKEY = k; HELD = new Map();
  const add = (c, t, d) => { if (!c) return; String(c).replace(/\s*\(.*\)$/, "").split(/\s*(?:&| et |,)\s*/).forEach(n => { const kk = norm(n); if (!kk) return; let m = HELD.get(kk); if (!m) HELD.set(kk, m = {}); const y = parseInt(String(d || "").slice(0, 4), 10) || 0; if (!(t.id in m) || (y && (!m[t.id] || y < m[t.id]))) m[t.id] = y || m[t.id] || 0; }); };
  T.forEach(t => { (t.hist || []).forEach(h => add(h.c, t, h.d)); [t.c].concat(t.who || []).forEach(c => add(c, t, t.since)); });
  return HELD;
}
export const baseId = id => String(id || "").split(/[@#~]/)[0];
// évolutions possibles d'une carte : titres vraiment tenus + ceux ajoutés par le modo, moins ceux qu'il a retirés
// arbre d'évolution d'une carte (12 nov.) : ceintures tenues en vrai + anciennes gimmicks (catcheurs fusionnés par Jose dans
// photos.json, leurs autres noms) + évolutions du modo (cfg.evoG[base] = [{ k, name, gimmick, years, img, st, pw, cond }]).
// Conditions (1 à 3) : cond = { belt, item: { id, q }, med: { n, q }, lv, wins } ; le modo les règle (cfg.evo[clé].cond).
const GIM0 = { lv: 30, med: { q: 2 } };
function gimmicksOf(b) {
  const c = cfg(), L = [], M = S.photosMerged || {};
  if (Object.keys(M).some(k => M[k] === b.id)) { const ph = (S.photos || {})[b.id]; ((ph && ph.n) || []).filter(n => norm(n) !== norm(b.name) && norm(n) !== norm(b.rn || "")).forEach(n => L.push({ k: "g-" + slugOf(n), name: n, auto: true })); }
  ((c.evoG || {})[b.id] || []).forEach(g => { if (!g || !g.k) return; const i = L.findIndex(x => x.k === g.k); if (i >= 0) L[i] = Object.assign({}, L[i], g); else L.push(g); });
  return L;
}
export function evolutionsOf(defOrId) {
  const b = cardById(baseId(typeof defOrId === "string" ? defOrId : defOrId && defOrId.id)); if (!b) return [];
  const held = heldMap().get(realKey(b)) || {}, c = cfg(), ov = c.evo || {}, add = (c.evoAdd || {})[b.id] || [];
  const belts = Object.keys(held).concat(add).filter((x, i, a) => a.indexOf(x) === i && titleById(x) && !(ov[b.id + "|" + x] || {}).off)
    .map(id => { const o = ov[b.id + "|" + id] || {}; return { kind: "belt", t: titleById(id), year: held[id] || 0, key: b.id + "|" + id, k: id, id: b.id + "~" + id, name: o.name || titleById(id).n, cond: Object.assign({}, o.cond || {}, { belt: id }) }; });
  const gims = gimmicksOf(b).filter(g => !(ov[b.id + "|" + g.k] || {}).off).map(g => { const o = ov[b.id + "|" + g.k] || {}; return { kind: "gim", t: null, year: 0, key: b.id + "|" + g.k, k: g.k, id: b.id + "~" + g.k, name: o.name || g.name, img: o.img || g.img || "", cond: Object.assign({}, o.cond || g.cond || GIM0) }; });
  return belts.concat(gims);
}
export function evoDef(b, tid) {
  if (String(tid).indexOf("g-") === 0) {
    const g = gimmicksOf(b).find(x => x.k === tid); if (!g) return null;
    const ov = (cfg().evo || {})[b.id + "|" + tid] || {}, bonus = ov.bonus != null && ov.bonus !== "" ? +ov.bonus : 8, tl = TILT.sec, h = hashN(b.id + tid);
    const st = Array.isArray(ov.st) && ov.st.length === 5 && ov.st.every(v => +v > 0) ? ov.st.map(Number) : Array.isArray(g.st) && g.st.length === 5 ? g.st.map(Number) : b.st.map((v, i) => Math.round(v * (1 + bonus / 100 + tl[(i + h) % 5] + (((h >>> (i * 3)) % 5) - 2) / 100)));
    const img = ov.img || g.img || "";
    return Object.assign({}, b, { id: b.id + "~" + tid, base: b.id, evo: tid, gim: tid, name: ov.name || g.name || b.name, years: typeof ov.years === "string" && ov.years ? ov.years : g.years || b.years, gimmick: ov.gimmick || g.gimmick || "Gimmick : " + (g.name || b.name), st: st, pic: img || b.pic, picUR: img ? "" : b.picUR, picLR: img ? "" : b.picLR, evoPw: ov.pw || g.pw || "", evoBonus: bonus, evoCls: "gim" });
  }
  const t = titleById(tid); if (!t) return null;
  const ov = (cfg().evo || {})[b.id + "|" + tid] || {}, P = prestige(t), bonus = ov.bonus != null && ov.bonus !== "" ? +ov.bonus : EVO_BONUS[P], tl = TILT[P], h = hashN(b.id + tid);
  const st = Array.isArray(ov.st) && ov.st.length === 5 && ov.st.every(v => +v > 0) ? ov.st.map(Number) : b.st.map((v, i) => Math.round(v * (1 + bonus / 100 + tl[i] + (((h >>> (i * 3)) % 5) - 2) / 100)));
  const held = (heldMap().get(realKey(b)) || {})[tid], fem = /women|knockouts|reina|wonder|stardom|marigold|goddess/i.test(t.n + " " + t.id);
  return Object.assign({}, b, { id: b.id + "~" + tid, base: b.id, evo: tid, belt: tid, name: ov.name || b.name, years: typeof ov.years === "string" && ov.years ? ov.years : held ? String(held) : b.years,
    gimmick: ov.gimmick || ((fem ? "Championne " : "Champion ") + beltShort(t) + " · " + t.k), st: st, pic: ov.img || b.pic, picUR: ov.img ? "" : b.picUR, picLR: ov.img ? "" : b.picLR, evoPw: ov.pw || "", evoBonus: bonus, evoCls: P });
}
// pouvoirs (tirés au hasard à l'évolution ; le modo peut fixer celui d'une évolution)
export const POWERS = {
  crit: ["Coup critique", "+15 % de dégâts sur chaque attaque"], garde: ["Garde haute", "−15 % de dégâts reçus"], foule: ["Chouchou du public", "barre de Finisher +30 % plus vite"],
  regen: ["Second souffle", "+4 % de vie à chaque attaque réussie"], tag: ["Partenaire fidèle", "+5 % de stats aux autres cartes de l’équipe"], entree: ["Entrée fracassante", "1re attaque ×1,5"],
  geant: ["Tueur de géants", "+25 % de dégâts contre plus costaud que lui"], aura: ["Aura de champion", "+8 % à toutes les stats"]
};
export const randomPower = () => { const k = Object.keys(POWERS); return k[Math.floor(Math.random() * k.length)]; };
// définition d'une carte par id (base, version show, champion, évolution)
export function defOf(id) {
  if (!id) return null;
  const ti = id.indexOf("~"); if (ti > 0) { const b = cardById(id.slice(0, ti)); return b ? evoDef(b, id.slice(ti + 1)) : null; }
  const at = id.indexOf("@"), hs = id.indexOf("#champ");
  if (at > 0) { const b = cardById(id.slice(0, at)); return b ? versionCard(b, id.slice(at + 1)) : null; }
  if (hs > 0) { const b = cardById(id.slice(0, hs)); const t = b && titleOf(b.rn || b.name); return b ? championCard(b, t && t.n) : null; }
  return cardById(id);
}
// stats d'un exemplaire : base + 1,2 par niveau (réparti) + boost champion en vrai (+10 %, perdu sans le titre)
export function statsOf(inst, def) {
  def = def || defOf(inst.c); if (!def) return [0, 0, 0, 0, 0];
  const lvBonus = (inst.lv - 1) * 1.2 / 5, rUp = RAR.indexOf(inst.r) - RAR.indexOf(def.r), live = !def.champ && champsNow().has(realKey(def));
  const tr = Array.isArray(inst.tr) ? inst.tr : [], eq = inst.eq ? itemById(inst.eq) : null, eqs = eq && Array.isArray(eq.st) ? eq.st : [];
  return def.st.map((v, i) => Math.round((v + lvBonus) * (1 + rUp * 0.08) * (live ? 1.1 : 1)) + (+tr[i] || 0) + (+eqs[i] || 0));
}
// PV d'une carte = la somme de ses stats : en combat, la vie de l'équipe = les PV de toutes ses cartes additionnés (13 nov.)
export const hpOf = st => st.reduce((a, b) => a + b, 0);
export const isChampLive = def => !!def && champsNow().has(realKey(def));
export const promoLogo = k => (k && showLogo(k, "")) || "";
// lien entre deux cartes (même groupe / équipe) : bonus de soutien
export function linked(a, b) { if (!a || !b) return false; const A = (a.gs || {}).cur || [], Bg = (b.gs || {}).cur || []; return A.some(g => Bg.indexOf(g) >= 0) || ((a.gs || {}).past || []).some(g => (b.gs.past || []).concat(Bg).indexOf(g) >= 0); }
