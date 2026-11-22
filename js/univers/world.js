// Mode Univers (18 nov., cahier de Jose + maquettes « Mode Univers – Menus ») : le monde du jeu.
// Les catcheurs viennent de la base de données de TCC TV (rosters, fiches, photos), avec des stats propres à l'univers :
// Apparence, Ring, Micro, Charisme, Endurance, Star power, Fiabilité + style de catch + face / heel + popularité, barre d'endurance,
// moral, contrat, bilan victoires / défaites / draws. Toutes les autres fédérations sont gérées par l'IA. Pas de vraie année :
// Année 1, Année 2… ; le jour 0 est le lundi 1er janvier de l'Année 1.
import { calYear } from "./cal.js";
import { S } from "../state.js";
import { baseCards } from "../tcg/data.js";
import { norm } from "../wrestlers.js";
import { udata } from "./data.js";

export const ST = ["Apparence", "Ring", "Micro", "Charisme", "Endurance", "Star power", "Fiabilité"];
export const STYLES = {
  aer: ["Aérien", "Saute des cordes, très spectaculaire : le public adore. Se fatigue plus vite et se blesse un peu plus."],
  bag: ["Bagarreur", "Frappe fort, matchs courts et violents. Bon dans les feuds, il use ses adversaires."],
  tec: ["Technique", "Prises et soumissions. Très régulier, se fatigue moins et se blesse moins."],
  pur: ["Puroresu", "Style japonais : coups durs et longs matchs. Adoré des puristes, mais ça use le corps."],
  equ: ["Équilibré", "Un peu de tout : s’adapte à n’importe quel adversaire, sans point fort ni point faible."]
};
export const STY_FAT = { aer: 1.25, bag: 1.1, tec: 0.85, pur: 1.2, equ: 1 };   // fatigue d'un match
export const STY_INJ = { aer: 1.3, bag: 1.1, tec: 0.7, pur: 1.2, equ: 1 };     // risque de blessure
export const ROLES = { me: "Main event", up: "Upper card", mid: "Mid-card", low: "Lower card" };
export const TRAITS = ["Ambitieux", "Leader du vestiaire", "Loyal", "Caractériel", "Bosseur", "Fêtard", "Discret", "Diva", "Mentor", "Râleur", "Perfectionniste", "Showman"];
export const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const MLEN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const WD = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
export const WDL = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

// fédérations de TCC TV (valeurs de départ propres au jeu : audience en millions, argent en k$)
export const FEDS0 = {
  WWE: { aud: 4.8, pres: 95, money: 400000, shows: [["Raw", 1], ["SmackDown", 5], ["NXT", 2], ["Evolve", 3]], brands: true, big: "PLE" },
  AEW: { aud: 1.9, pres: 78, money: 120000, shows: [["Dynamite", 3], ["Collision", 6]], big: "PPV" },
  NJPW: { aud: 1.2, pres: 75, money: 80000, shows: [["NJPW World", 6]], big: "PPV" },
  AAA: { aud: 1.1, pres: 62, money: 40000, shows: [["Lucha Libre AAA", 6]], big: "PPV" },
  TNA: { aud: 0.9, pres: 58, money: 35000, shows: [["Impact", 4]], big: "PPV" },
  CMLL: { aud: 0.8, pres: 60, money: 30000, shows: [["Viernes Espectacular", 5]], big: "PPV" },
  Stardom: { aud: 0.7, pres: 62, money: 30000, shows: [["Stardom World", 0]], big: "PPV" },
  ROH: { aud: 0.5, pres: 55, money: 25000, shows: [["ROH TV", 4]], big: "PPV" },
  Marigold: { aud: 0.3, pres: 45, money: 12000, shows: [["Marigold Fields", 0]], big: "PPV" }
};
export const BIGNAMES = ["Clash of Crowns", "Night of Glory", "Breaking Point", "Last Stand", "Spring Riot", "Golden Ring", "Fire and Fury", "Blood Moon",
  "Final Bell", "Uprising", "Summer Storm", "Hall of Pain", "No Way Back", "Iron Will", "Thunder Dome", "Grand Finale"];
// catcheuses de la WWE (les autres rosters sont déjà séparés : féminin, Knockouts, Amazonas, Stardom, Marigold)
const WWE_F = ["alix brooks", "asuka", "bayley", "becky lynch", "b-fab", "bianca belair", "blake monroe", "brie bella", "candice lerae", "chantel monroe",
  "charlotte flair", "chelsea green", "fallon henley", "gianna capri", "giulia", "iyo sky", "it's gal", "ivy nile", "izzi dame", "jacy jayne", "jade cargill",
  "jaida parker", "jordynne grace", "kali armstrong", "karmen petrovic", "kelani jordan", "kendal grey", "kiana james", "kyoki", "lainey reid", "lash legend",
  "layla diggs", "liv morgan", "lizzy rain", "lola vice", "lyra valkyria", "maxxine dupri", "michin", "myka lockwood", "naomi", "nattie", "nia jax",
  "nikki bella", "nikkita lyons", "paige", "piper niven", "raquel rodriguez", "reina volcan", "rhea ripley", "roxanne perez", "skylar raye", "sloane jacobs",
  "sol ruca", "stephanie vaquer", "tatum paxley", "thea hail", "tiffany stratton", "wren sinclair", "zaria", "zoey stark", "harley riggins", "alba fyre", "isla dawn"];
const FEM = /f[ée]minin|knockouts|amazonas/i;
// quelques voltigeurs connus (les autres styles viennent de l'archétype de la carte TCCCG ; le joueur peut changer le style de ses catcheurs)
const HIGH = new Set(["rey mysterio", "dominik mysterio", "ricochet", "will ospreay", "kota ibushi", "pac", "penta", "rey fenix", "dragon lee", "mustafa ali", "kushida", "hiromu takahashi",
  "darby allin", "jack perry", "andrade", "bandido", "laredo kid", "komander", "aero star", "el hijo del vikingo", "vikingo", "mascara dorada", "mistico", "lio rush", "jeff hardy", "matt hardy",
  "seth rollins", "kofi kingston", "lyra valkyria", "nikkita lyons", "kairi sane", "iyo sky", "mina shirakawa", "saya kamitani", "hazuki", "ultimo guerrero", "atlantis jr", "angelico", "trent seven",
  "zachary wentz", "nathan frazer", "axiom", "kevin knight", "lexis king", "je'von evans", "trick williams", "oro mensah", "shingo takagi", "taiji ishimori", "el phantasmo", "kenny omega", "adam cole",
  "matt jackson", "nick jackson", "the young bucks", "aj styles", "naomi", "alexa bliss", "b-fab", "lince dorado", "gran metalik", "rocky romero", "orange cassidy", "sammy guevara", "kyle o'reilly"]);
const WTITLE = /women|femenil|f[ée]minin|knockouts|reina|amazonas|wonder|world of stardom|marigold|goddess|stardom|nxt women|tbs/i;

// petits outils déterministes
export function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export const h01 = (s) => (hash(s) % 10000) / 10000;
export const clamp = (v, a, b) => Math.max(a == null ? 0 : a, Math.min(b == null ? 100 : b, Math.round(v)));
export const rnd = () => Math.random();
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const uid = p => (p || "x") + Date.now().toString(36).slice(-5) + Math.floor(Math.random() * 1e5).toString(36);

// ---------- calendrier ----------
export function dateOf(d) { const y = Math.floor(d / 365), r = d - y * 365; let m = 0, x = r; while (x >= MLEN[m]) { x -= MLEN[m]; m++; } return { y: y + 1, m: m, dm: x + 1, wd: (1 + d) % 7 }; }
export const dayLabel = (d, long) => { const t = dateOf(d); return WD[t.wd] + " " + t.dm + " " + MONTHS[t.m] + (long ? " · Année " + t.y : ""); };
export const shortDate = d => { const t = dateOf(d); return t.dm + " " + MONTHS[t.m] + (t.y > 1 ? " An " + t.y : ""); };
export function dayOfDate(y, m, dm) { let d = (y - 1) * 365; for (let i = 0; i < m; i++) d += MLEN[i]; return d + dm - 1; }
export const weekOf = d => Math.floor((d % 365) / 7) + 1;
export const monthEnd = (y, m) => dayOfDate(y, m, MLEN[m]);
// dernier samedi du mois (grands événements)
export function lastSat(y, m) { let d = monthEnd(y, m); while (dateOf(d).wd !== 6) d--; return d; }

// ---------- formats ----------
export const fmtM = v => (Math.round(v * 100) / 100).toFixed(2).replace(/0$/, "").replace(".", ",") + " M";
export const fmtK = v => { const a = Math.abs(v); const s = a >= 1000 ? (Math.round(a / 100) / 10).toString().replace(".", ",") + " M$" : Math.round(a) + " k$"; return (v < 0 ? "-" : "") + s; };
export const stars = r => { const s = Math.max(0, Math.min(5, Math.round(r / 5) / 4)); return s.toString().replace(".", ",") + "★"; };
export const recTxt = r => (r && r.length ? r[0] + "-" + r[1] + "-" + r[2] : "0-0-0");

// ---------- génération d'une nouvelle partie ----------
export function femaleSet() {
  const out = new Set(WWE_F);
  Object.keys(S.rosters || {}).forEach(k => { const r = S.rosters[k] || {}; Object.keys(r).forEach(g => { if (FEM.test(g) || k === "Stardom" || k === "Marigold") (r[g] || []).forEach(n => out.add(norm(n))); }); });
  (S.titles || []).forEach(t => { if (WTITLE.test(String(t.n || ""))) [t.c].concat(t.who || [], (t.hist || []).map(h => h.c)).forEach(n => { if (n) out.add(norm(n)); }); });
  ((udata().st || {}).fem || []).forEach(n => out.add(norm(n)));   // catcheuses listées dans data/statuts.json (21 nov.)
  return out;
}
function styleOf(x, k) {
  const h = h01(x.rn + "sty");
  if (k === "NJPW" || k === "Stardom" || k === "Marigold") { if (h < 0.45) return "pur"; }
  if (k === "CMLL" || k === "AAA") { if (h < 0.55) return "aer"; }
  if (HIGH.has(norm(x.rn))) return "aer";
  switch (x.arch) {
    case "Technician": return "tec";
    case "Aggressor": case "Dominator": return h < 0.8 ? "bag" : "equ";
    case "Opportunist": return "equ";
    case "Showman": return HIGH.has(norm(x.rn)) ? "aer" : "equ";
  }
  return "equ";
}
// salaire demandé (k$ par an) selon la cote du catcheur
export const salOf = w => Math.round((30 + Math.pow(w.st[5] / 100, 3) * 2400 + w.pop * 4) / 10) * 10;

// un catcheur de l'univers d'après sa carte (p = rang de 0 à 1, k = sa fédération ou "" pour un agent libre, r = sa place dans les rosters)
// (22 nov.) aussi pour les nouveaux venus ajoutés aux parties déjà commencées (v2.js addNewcomers)
let DBY = null, DBYof = null;
const debutOf = nm => { const src = S.bdd && S.bdd.y; if (!src) return 0; if (DBYof !== src) { DBYof = src; DBY = new Map(); Object.keys(src).forEach(k => DBY.set(norm(k), src[k])); } return DBY.get(norm(nm)) || 0; };
// rang des catcheurs de NOAH, TJPW et des promotions du 22 nov. : leur popularité dans la base de données du jeu de Jose (bdd.json « p »)
export function popRank(L) {
  const pp = (S.bdd && S.bdd.p) || {}, T = L.filter(x => x.late).sort((a, b) => ((pp[a.rn] || 0) - (pp[b.rn] || 0)) || (a.score - b.score)), m = new Map();
  T.forEach((c, i) => m.set(c.id, T.length > 1 ? 0.12 + 0.72 * i / (T.length - 1) : 0.4));
  return m;
}
export function mkW(x, p, k, r, fem) {
  const h = i => h01(x.rn + "|" + i);
  const debut = parseInt(String(x.years || "").slice(0, 4), 10) || debutOf(x.rn);
  const age = debut ? clamp(19 + (2026 - debut) + Math.round(h(9) * 3), 18, 62) : clamp(22 + h(10) * 16, 18, 60);
  const sty = styleOf(x, k);
  const st = [
    clamp(40 + p * 35 + h(1) * 25), clamp(42 + p * 38 + h(2) * 18 + (sty === "tec" ? 6 : sty === "pur" ? 5 : sty === "aer" ? 4 : 0)),
    clamp(30 + p * 45 + h(3) * 22 + (x.arch === "Showman" ? 8 : 0)), clamp(35 + p * 45 + h(4) * 18),
    clamp(45 + h(5) * 35 + p * 15 + (sty === "pur" ? 6 : 0) - Math.max(0, age - 40) * 1.5, 20), clamp(25 + p * 70 + h(6) * 5), clamp(45 + h(7) * 45 + p * 8)
  ];
  const id = x.id, n = norm(x.rn);
  const w = {
    id: id, n: x.rn, pic: x.pic || "", fed: k, br: k === "WWE" && r ? r.g : "", sx: fem.has(n) ? "f" : "h", st: st, sty: sty,
    al: x.al === "heel" ? "heel" : x.al === "face" ? "face" : (h(11) < 0.55 ? "face" : "heel"),
    pop: clamp(15 + p * 80 + h(8) * 6, 5, 99), en: clamp(80 + h(12) * 20), mor: clamp(58 + h(13) * 25), age: age,
    rec: [0, 0, 0], car: [Math.round((age - 18) * (8 + h(14) * 20) * 0.6), Math.round((age - 18) * (5 + h(15) * 12) * 0.6), Math.round((age - 18) * h(16) * 1.2)],
    pers: [TRAITS[hash(x.rn + "t1") % TRAITS.length]].concat(h(17) < 0.5 ? [TRAITS[hash(x.rn + "t2") % TRAITS.length]] : []).filter((v, i, a) => a.indexOf(v) === i),
    inj: null, hist: [], ct: null, p0: 0, last: -99
  };
  w.p0 = w.pop;
  if (x.inj) w.inj = { until: 14 + Math.round(h(18) * 42), what: "Blessure (avant le début de la partie)", grave: false };
  if (k) w.ct = { sal: Math.round(salOf(w) * (k === "WWE" ? 1.3 : FEDS0[k].pres / 80) / 10) * 10, end: 60 + Math.round(h(19) * 660), role: "mid" };
  return w;
}

export function newWorld(opt) {
  // opt = { take: "WWE" } (prendre une fédération) ou { create: { n, sh, c, show, wd } } (créer la sienne)
  const fem = femaleSet();
  const ro = new Map(); Object.keys(S.rosters || {}).forEach(k => Object.keys(S.rosters[k] || {}).forEach(g => (S.rosters[k][g] || []).forEach(n => { const nn = norm(n); if (!ro.has(nn)) ro.set(nn, { k: k, g: g }); })));
  const L = baseCards().filter(c => !c.custom && !(c.w && c.w.dc) && c.rn);
  const sorted = L.slice().sort((a, b) => a.score - b.score), N = sorted.length;
  const pct = new Map(); sorted.forEach((c, i) => pct.set(c.id, N > 1 ? i / (N - 1) : 0.5));
  const W = {};
  const lp = popRank(L);
  L.forEach(x => {
    const n = norm(x.rn), r = ro.get(n) || ((x.w && Array.isArray(x.w.a)) ? x.w.a.map(a => ro.get(norm(a))).find(Boolean) : null);
    const k = r && FEDS0[r.k] ? r.k : "";
    W[x.id] = mkW(x, lp.has(x.id) ? lp.get(x.id) : pct.get(x.id), k, r, fem);
  });
  // fédérations
  const F = {};
  Object.keys(FEDS0).forEach(k => {
    const c = ((S.P || {})[k] || {}).c || ((((S.cal || {})[k]) || {}).c) || null;
    F[k] = { id: k, n: k, sh: k, c: (c && c[0]) || "#6fb3ff", ai: true, pop: FEDS0[k].pres, aud0: FEDS0[k].aud, money: FEDS0[k].money,
      shows: FEDS0[k].shows.map(s => ({ n: s[0], wd: s[1] })), big: FEDS0[k].big, onlyF: k === "Stardom" || k === "Marigold", aud: [], last: null, tv: { n: "Diffuseur", pay: Math.round(FEDS0[k].aud * 250), min: FEDS0[k].aud * 0.85, end: 730 } };
  });
  let me = opt.take && F[opt.take] ? opt.take : "";
  if (opt.create) {
    const c = opt.create, id = "ME";
    F[id] = { id: id, n: c.n || "Ma fédération", sh: (c.sh || "MOI").toUpperCase().slice(0, 5), c: c.c || "#f5b13d", ai: false, pop: 28, aud0: 0.25, money: 3000,
      shows: [{ n: c.show || "Mon show", wd: +c.wd || 1 }], big: "PPV", aud: [], last: null, tv: { n: "Canal Fight", pay: 90, min: 0.22, end: 365 } };
    me = id;
    // on commence avec des agents libres peu connus (cahier : « recruter des agents libres avec réputation basse »)
    const fa = Object.values(W).filter(w => !w.fed && w.pop < 58 && w.age < 45).sort((a, b) => b.pop - a.pop);
    const men = fa.filter(w => w.sx === "h").slice(0, 10), women = fa.filter(w => w.sx === "f").slice(0, 6);
    // presque toutes les catcheuses de TCC TV sont sous contrat : on complète avec des catcheuses (et catcheurs) du circuit indépendant, inventés
    while (women.length < 6) { const w = indie("f", 0); W[w.id] = w; women.push(w); }
    while (men.length < 10) { const w = indie("h", 0); W[w.id] = w; men.push(w); }
    men.concat(women).forEach(w => { w.fed = id; w.ct = { sal: Math.round(salOf(w) * 0.6 / 10) * 10, end: 365 + Math.round(h01(w.n + "c") * 365), role: "mid" }; });
  }
  F[me].ai = false;
  // rôles selon la popularité dans chaque fédération
  Object.keys(F).forEach(k => {
    const ro2 = Object.values(W).filter(w => w.fed === k).sort((a, b) => b.pop - a.pop), n = ro2.length;
    ro2.forEach((w, i) => { w.ct.role = i < Math.max(1, n * 0.1) ? "me" : i < n * 0.35 ? "up" : i < n * 0.75 ? "mid" : "low"; });
  });
  // titres (les vrais champions, sauf un changement de moins de 7 jours : pas de spoiler)
  const T = {}, byName = new Map(); Object.values(W).forEach(w => byName.set(norm(w.n), w.id));
  const now = Date.now();
  (S.titles || []).forEach(t => {
    if (!F[t.k] || !t.id) return;
    const n = String(t.n || ""), div = /tag|parejas|pareja|trios|6-man|six-man|twin ?star|goddesses|artist|duo|par [ée]quipe/i.test(n) ? "tag" : WTITLE.test(n) ? "f" : "h";
    const fresh = t.since && (now - Date.parse(t.since)) < 7 * 864e5;
    let who = fresh ? (t.hist && t.hist[0] ? [t.hist[0].c] : []) : (Array.isArray(t.who) && t.who.length ? t.who : [t.c]);
    const ids = (who || []).map(x => byName.get(norm(x))).filter(Boolean);
    T[t.id] = { id: t.id, fed: t.k, n: n, div: div, champ: div === "tag" ? (ids.length >= 2 ? ids.slice(0, 2) : []) : (ids[0] || ""), since: -Math.round(30 + h01(t.id) * 200), defs: 0 };
  });
  if (opt.create) {
    const s = F.ME.sh;
    [["Championnat " + s, "h"], ["Championnat féminin " + s, "f"], ["Championnat par équipes " + s, "tag"]].forEach((x, i) => { T["me" + i] = { id: "me" + i, fed: "ME", n: x[0], div: x[1], champ: x[1] === "tag" ? [] : "", since: 0, defs: 0 }; });
  }
  // équipes et clans (groupes actifs de data/groups.json)
  const teams = [], clans = [];
  Object.keys(S.groups || {}).forEach(gk => {
    const g = S.groups[gk];
    if (!g || !g.on || !F[g.k] || !Array.isArray(g.m)) return;
    const m = g.m.map(x => byName.get(norm(x))).filter(id => id && W[id].fed === g.k);
    if (m.length === 2) teams.push({ id: uid("t"), fed: g.k, n: g.n, m: m, chem: 70, g: gk });
    else if (m.length >= 3) clans.push({ id: uid("c"), fed: g.k, n: g.n, m: m.slice(0, 6), al: W[m[0]].al, g: gk });
  });
  // grands événements de l'année : les vrais PLE / PPV de 2026 (data/univers-calendrier.json), inventés seulement pour une fédé sans aucun
  const ev = calYear(F, 1, me);
  const G = {
    v: 1, me: me, day: 0, W: W, F: F, T: T, teams: teams, clans: clans, ev: ev, sl: [], tours: [], divs: [{ id: "h", n: "Division masculine" }, { id: "f", n: "Division féminine" }, { id: "tag", n: "Équipes" }],
    dv: {}, mail: [], news: [], buzz: [], hype: {}, prom: [], tens: [], dev: [], merch: [], spons: [], offers: [], fin: { cur: { tv: 0, tix: 0, merch: 0, pub: 0, sal: 0, prod: 0 }, hist: [] },
    best: { match: null, show: null }, awards: {}, watch: [], rest: {}, seq: 1
  };
  // pour la fédération du joueur : ses shows TV des 2 prochaines semaines + un jeune au centre de développement
  return G;
}
// noms fictifs (centre de développement)
const FN_H = ["Lucas", "Hugo", "Nathan", "Tom", "Enzo", "Mateo", "Kenji", "Diego", "Leo", "Yanis", "Samuel", "Rafael", "Theo", "Kai", "Noah"];
const FN_F = ["Inès", "Lina", "Jade", "Emma", "Chloé", "Maya", "Sakura", "Lucia", "Zoé", "Nora", "Alicia", "Yuna", "Léa", "Mia", "Rose"];
const LN = ["Moreau", "Haddad", "Becker", "Silva", "Tanaka", "Ruiz", "Martin", "Kovac", "Okafor", "Dubois", "Novak", "Ferreira", "Sato", "Leroy", "Brandt"];
// catcheur inventé du circuit indépendant (pas de photo : initiales ; l'image peut être changée dans la partie)
export function indie(sx, day) {
  const b = 34 + rnd() * 14, id = uid("i"), sty = pick(["aer", "bag", "tec", "pur", "equ"]);
  const st = [clamp(b + rnd() * 20), clamp(b + rnd() * 16 + (sty === "tec" ? 5 : 0)), clamp(b - 4 + rnd() * 16), clamp(b + rnd() * 14), clamp(b + 8 + rnd() * 20), clamp(b - 12 + rnd() * 10), clamp(55 + rnd() * 35)];
  const age = 20 + Math.floor(rnd() * 12);
  const w = { id: id, n: pick(sx === "f" ? FN_F : FN_H) + " " + pick(LN), pic: "", fed: "", br: "", sx: sx, st: st, sty: sty, al: rnd() < 0.55 ? "face" : "heel",
    pop: clamp(14 + rnd() * 18, 5, 99), en: 100, mor: 70, age: age, rec: [0, 0, 0], car: [Math.round((age - 18) * 9), Math.round((age - 18) * 7), Math.round(rnd() * 4)],
    pers: [pick(TRAITS)], inj: null, hist: [{ d: day || 0, t: "Catcheu" + (sx === "f" ? "se" : "r") + " du circuit indépendant" }], ct: null, p0: 0, last: -99, fic: true };
  w.p0 = w.pop; return w;
}
export function trainee() {
  const sx = rnd() < 0.5 ? "h" : "f";
  return { id: uid("y"), n: pick(sx === "h" ? FN_H : FN_F) + " " + pick(LN), sx: sx, age: 18 + Math.floor(rnd() * 6), pot: 1 + Math.floor(rnd() * 5), prog: Math.floor(rnd() * 25), coach: pick(["Coach Ruiz", "Coach Sato", "Coach Martin"]) };
}
