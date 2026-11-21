// Mode Univers v2 : mise à niveau d'une partie (nouvelle ou ancienne sauvegarde) — statuts des personnes (décédés → Hall of Fame,
// staff, légendes retraitées), staff, gimmicks, relations, catégories et prestige des titres, traditions, salles, réglages, objectifs.
import { initRival, initMissions } from "./goals.js";
import { dnaInit, DNA_OF } from "./dna.js";
import { calUpgrade, sisterLink } from "./cal.js";
import { S } from "../state.js";
import { norm } from "../wrestlers.js";
import { clamp, rnd, pick, uid, h01, hash, dateOf, salOf } from "./world.js";
import { udata, GT, GNAME, TRAD0, STRAT0, CITIES } from "./data.js";
import { relAdd, champIds, roster, mail } from "./base.js";

const FN = { h: ["Marc", "Julien", "Kevin", "Antoine", "Rico", "Hiro", "Pablo", "Steve", "Omar", "Victor", "Bruno", "Dante", "Takeshi", "Mike", "Lionel"],
  f: ["Sarah", "Camille", "Nina", "Aya", "Paula", "Jess", "Mei", "Laura", "Elena", "Kim", "Sofia", "Clara", "Rina", "Tess", "Lola"] };
const LN = ["Garnier", "Okada-Ruiz", "Lambert", "Kowalski", "Navarro", "Fontaine", "Walsh", "Yamada", "Castillo", "Moretti", "Duval", "Brennan", "Ishikawa", "Rojas", "Keller"];
export const fakeName = sx => pick(FN[sx]) + " " + pick(LN);
// un membre du staff (fed = "" : libre sur le marché)
export function addStaff(G, o) {
  G.staff = G.staff || {};
  const id = o.id || uid("s");
  const q = o.q || clamp(35 + rnd() * 35);
  G.staff[id] = Object.assign({ id: id, n: o.n || fakeName(o.sx || (rnd() < 0.5 ? "h" : "f")), pic: "", role: "comm", q: q, sal: Math.round((40 + q * 3) / 10) * 10, end: G.day + 365 + Math.floor(rnd() * 365), fed: "", real: false, sx: rnd() < 0.5 ? "h" : "f" }, o, { id: id, q: q });
  if (!o.sal) G.staff[id].sal = Math.round((20 + q * q / 40) / 10) * 10;
  return G.staff[id];
}
// le personnage d'un catcheur qui lui va le mieux (d'après ses stats)
export function fitOf(w, t) { const g = GT[t]; if (!g) return 50; return Math.round(g[1].reduce((s, i) => s + w.st[i], 0) / g[1].length); }
export function bestType(w) { return Object.keys(GT).sort((a, b) => fitOf(w, b) - fitOf(w, a) + (h01(w.n + a) - h01(w.n + b)) * 6)[0]; }
export function gimOf(w) {
  if (w.gim) return w.gim;
  const k = udata().gm[w.n];
  w.gim = { n: k ? k[0] : "", t: k && GT[k[1]] ? k[1] : bestType(w), fresh: 100, wk: Math.floor(h01(w.n + "wk") * 80) };
  return w.gim;
}
function removeW(G, id) {
  delete G.W[id];
  Object.values(G.T).forEach(t => { if (champIds(t).indexOf(id) >= 0) { t.champ = t.div === "tag" ? [] : ""; t.since = G.day; } });
  (G.teams || []).forEach(t => { t.m = t.m.filter(x => x !== id); }); G.teams = (G.teams || []).filter(t => t.m.length >= 2);
  (G.clans || []).forEach(c => { c.m = c.m.filter(x => x !== id); }); G.clans = (G.clans || []).filter(c => c.m.length >= 3);
  G.sl = (G.sl || []).filter(s => s.a.indexOf(id) < 0 && s.b.indexOf(id) < 0);
  G.prom = (G.prom || []).filter(p => p.w !== id); G.merch = (G.merch || []).filter(p => p.w !== id);
}
const PRES = n => /world|undisputed|heavyweight|iwgp|aaa mega|ghc heavy|tna world|roh world|aew world|cmll world heavy|world of stardom|wonder of stardom|women's world|women.s championship$|wwe championship|marigold world|reina|knockouts world/i.test(n) ? 82 : /tag|parejas|trios|6-man|goddess|twin/i.test(n) ? 55 : 62;
export function catOfTitle(G, t) {
  if (t.cat) return t.cat;
  if (t.div === "f") return "f"; if (t.div === "h") return "h";
  const c = champIds(t).map(i => G.W[i]).filter(Boolean);
  if (c.length === 2 && c[0].sx !== c[1].sx) return "x";
  return c.length && c.every(w => w.sx === "f") ? "f" : /women|femenil|f[ée]minin|knockouts|goddess|stardom|marigold/i.test(t.n) ? "f" : "h";
}
// objectifs du propriétaire pour un trimestre (selon la difficulté)
export function makeObj(G, q) {
  const f = G.F[G.me], k = G.diff === "facile" ? 0.9 : G.diff === "difficile" ? 1.15 : 1;
  const base = f.aud.length ? f.aud.slice(-6).reduce((s, v) => s + v, 0) / f.aud.slice(-6).length : f.aud0;
  return { q: q, goals: [{ k: "aud", v: Math.round(base * (0.98 + 0.04 * k) * 100) / 100 }, { k: "money", v: Math.round(Math.max(300, f.money * 0.65 * k) / 50) * 50 }, { k: "rating", v: Math.round(50 + 5 * k) }], sec: (G.obj && G.obj.sec) || 70 };
}

export function upgrade(G, opt) {
  opt = opt || {};
  if ((G.v || 1) < 2) up2(G, opt);
  // v3 (21 nov.) : la fédération rivale et les missions du propriétaire
  if (G.v < 3) { initRival(G); initMissions(G); G._ach = []; G.v = 3; }
  applyStatus(G, opt);
  if (!G.dna && G.me) dnaInit(G, DNA_OF[G.me] || "wwe");
  if (!opt || !opt.fresh) calUpgrade(G); else G.calv = 1;   // vrai calendrier (21 nov.)
  sisterLink(G);   // ADN (21 nov.) : les anciennes parties prennent celui de leur fédération
  return G;
}
// 21 nov. (2e lot) : à chaque ouverture, si data/statuts.json a changé : vraies années de naissance (born), catcheuses (fem),
// retraités (ret : jamais actifs), décès (Hall of Fame), personnel (staff)
function applyStatus(G, opt) {
  const st = udata().st || {};
  // vrais noms qui ont changé (statuts.json « rn », ex. Brutus / Julius Creed → Drew / Jacob Kasper) : renommés sans changer de fédération
  const rn = {}; Object.keys(st.rn || {}).forEach(n => { rn[norm(n)] = st.rn[n]; });
  if (Object.keys(rn).length) Object.values(G.W).forEach(w => { const to = w.n && rn[norm(w.n)]; if (to && w.n !== to) { w.rn0 = w.rn0 || w.n; (w.hist = w.hist || []).push({ d: G.day || 0, t: "S’appelle maintenant " + to }); w.n = to; } });
  const rg = {}; Object.keys(st.rnG || {}).forEach(n => { rg[norm(n)] = st.rnG[n]; });
  if (Object.keys(rg).length) (G.teams || []).concat(G.clans || []).forEach(t => { const to = t.n && rg[norm(t.n)]; if (to) t.n = to; });
  if (!st.born && !st.fem) return;
  const stamp = (st.updated || "") + "|" + Object.keys(st.born || {}).length + "|" + (st.ret || []).length + "|" + Object.keys(st.dead || {}).length + "|" + (st.fem || []).length;
  if (G.stv === stamp) return;
  const born = {}; Object.keys(st.born || {}).forEach(n => { born[norm(n)] = st.born[n]; });
  const fem = new Set((st.fem || []).map(norm)), ret = new Set((st.ret || []).map(norm));
  const dead = {}; Object.keys(st.dead || {}).forEach(n => { dead[norm(n)] = [n, st.dead[n]]; });
  const staffN = {}; Object.keys(st.staff || {}).forEach(n => { staffN[norm(n)] = [n].concat(st.staff[n]); });
  const yr = 2026 + Math.floor((G.day || 0) / 365), fixed = [];
  G.hof = G.hof || []; G.staff = G.staff || {};
  Object.values(G.W).forEach(w => {
    if (!w.n || /^y/.test(w.id)) return;
    const n = norm(w.n);
    if (dead[n]) { if (!G.hof.some(x => x.n === dead[n][0])) G.hof.push({ n: dead[n][0], pic: w.pic, y: dead[n][1], k: "mem" }); if (w.fed === G.me) fixed.push(w.n); removeW(G, w.id); return; }
    if (staffN[n] && !Object.values(G.staff).some(s => s.n === w.n)) {
      const sf = w.fed === G.me ? G.me : staffN[n][2] && G.F[staffN[n][2]] ? staffN[n][2] : "";
      addStaff(G, { n: w.n, pic: w.pic, role: staffN[n][1], fed: sf, q: clamp(58 + h01(w.n + "q") * 30), real: true, sx: w.sx, sal: w.fed === G.me && w.ct ? w.ct.sal : 0 });
      if (w.fed === G.me) fixed.push(w.n); removeW(G, w.id); return;
    }
    if (fem.has(n)) w.sx = "f";
    if (born[n] && w.by !== born[n]) { w.by = born[n]; w.age = clamp(yr - born[n], 16, 90); }
    if (ret.has(n) && !w.ret) {
      if (w.fed === G.me) fixed.push(w.n);
      Object.values(G.T || {}).forEach(t => { if (champIds(t).indexOf(w.id) >= 0) t.champ = Array.isArray(t.champ) ? [] : null; });
      w.fed = ""; w.ct = null; w.ret = true; w.leg = true;
    }
  });
  G.stv = stamp;
  if (fixed.length && !(opt && opt.fresh)) mail(G, { k: "info", from: "Ton comptable", role: "Mise à jour du jeu", c: "#ffd27a", ini: "MAJ", subj: "Mise à jour : ton effectif a été corrigé", body: "Ces personnes ne sont plus des catcheurs actifs (retraite, décès ou staff) : " + fixed.join(", ") + ".", imp: false });
}
function up2(G, opt) {
  const D = udata(), st = D.st || {};
  const dead = {}; Object.keys(st.dead || {}).forEach(n => { dead[norm(n)] = [n, st.dead[n]]; });
  const out = new Set((st.out || []).map(norm)), ret = new Set((st.ret || []).map(norm));
  const staffN = {}; Object.keys(st.staff || {}).forEach(n => { staffN[norm(n)] = [n].concat(st.staff[n]); });
  G.hof = G.hof || []; G.staff = G.staff || {};
  const fixed = [];
  Object.values(G.W).forEach(w => {
    const n = norm(w.n);
    if (/\sv\d+$/i.test(w.n) || /\smw[a-z0-9]{5,}$/i.test(w.n) || out.has(n)) { if (w.fed === G.me) fixed.push(w.n); removeW(G, w.id); return; }
    if (dead[n]) { G.hof.push({ n: dead[n][0], pic: w.pic, y: dead[n][1], k: "mem" }); if (w.fed === G.me) fixed.push(w.n); removeW(G, w.id); return; }
    if (staffN[n]) {
      const sf = w.fed === G.me ? G.me : staffN[n][2] && G.F[staffN[n][2]] ? staffN[n][2] : "";
      addStaff(G, { n: w.n, pic: w.pic, role: staffN[n][1], fed: sf, q: clamp(58 + h01(w.n + "q") * 30), real: true, sx: w.sx, sal: w.fed === G.me && w.ct ? w.ct.sal : 0 });
      if (w.fed === G.me) fixed.push(w.n); removeW(G, w.id); return;
    }
    if (ret.has(n) && !w.fed) { w.ret = true; w.leg = true; }
    gimOf(w);
    if (w.mom == null) w.mom = 0;
    if (w.crowd == null) w.crowd = clamp(20 + h01(w.n + "cr") * 30 + (w.st[3] > 75 ? 10 : 0));
    if (w.push == null) w.push = 0;
    if (w.nm == null) { w.nm = 0; w.sr = 0; }
    if (w.ct && w.ct.exc == null) w.ct.exc = true;
    if (w.pot == null) w.pot = w.age <= 25 ? 1 + Math.floor(h01(w.n + "pot") * 5) : 0;
  });
  // nouvelle partie avec sa propre fédération : les légendes retraitées ne font pas partie du roster de départ, et on complète à 10 + 6
  if (opt.fresh && G.me === "ME") {
    Object.values(G.W).forEach(w => { if (w.fed === "ME" && ret.has(norm(w.n))) { w.fed = ""; w.ct = null; w.ret = true; w.leg = true; } });
    ["h", "f"].forEach(sx => { const need0 = sx === "h" ? 10 : 6; let have = Object.values(G.W).filter(w => w.fed === "ME" && w.sx === sx).length;
      Object.values(G.W).filter(w => !w.fed && !w.ret && w.sx === sx && w.pop < 58 && w.age < 45).sort((a, b) => b.pop - a.pop).forEach(w => { if (have < need0) { w.fed = "ME"; w.ct = { sal: Math.round(salOf(w) * 0.6 / 10) * 10, end: 365 + Math.round(h01(w.n + "c") * 365), role: "mid", exc: true, cl: {} }; have++; } }); });
    fixed.length = 0;
  }
  if (fixed.length) mail(G, { k: "info", from: "Ton comptable", role: "Mise à jour du jeu", c: "#ffd27a", ini: "MAJ", subj: "Mise à jour : ton effectif a été corrigé", body: "Ces personnes ne sont pas (ou plus) des catcheurs actifs : " + fixed.join(", ") + ".\nLes décédés sont au Hall of Fame, les commentateurs et managers sont dans ton staff." });
  // titres : catégorie (masculin / féminin / intergender) et prestige
  Object.values(G.T).forEach(t => { t.cat = catOfTitle(G, t); if (t.pres == null) t.pres = clamp(PRES(t.n) - (G.F[t.fed] ? (100 - G.F[t.fed].pop) / 6 : 0) + h01(t.id) * 8); if (!t.hist) t.hist = champIds(t).length ? [{ w: champIds(t), from: t.since, defs: t.defs || 0 }] : []; });
  // relations de départ : équipes et clans
  G.rel = G.rel || {};
  (G.teams || []).forEach(t => { if (t.m.length >= 2) relAdd(G, t.m[0], t.m[1], 55); });
  (G.clans || []).forEach(c => c.m.forEach((a, i) => c.m.slice(i + 1).forEach(b => relAdd(G, a, b, 35))));
  // fédérations
  Object.values(G.F).forEach((f, i) => {
    if (!f.strat) f.strat = STRAT0[f.id] || pick(["stars", "jeunes", "econome", "agressif"]);
    if (f.venue == null) f.venue = f.pop >= 90 ? 3 : f.pop >= 60 ? 2 : 1;
    if (f.tix == null) f.tix = [15, 25, 40, 60, 90][f.venue];
    if (f.mixed == null) f.mixed = false;
    if (f.split == null) f.split = f.id === "WWE";
    if (!f.reg) f.reg = { us: f.id === "NJPW" || f.id === "Stardom" || f.id === "Marigold" ? 30 : f.id === "AAA" || f.id === "CMLL" ? 35 : f.pop, eu: Math.round(f.pop * 0.6), jp: f.id === "NJPW" || f.id === "Stardom" || f.id === "Marigold" ? f.pop : Math.round(f.pop * 0.4), mx: f.id === "AAA" || f.id === "CMLL" ? f.pop : Math.round(f.pop * 0.45), au: Math.round(f.pop * 0.4), me: Math.round(f.pop * 0.3) };
    if (!f.home) f.home = { WWE: 2, AEW: 11, NJPW: 18, Stardom: 18, Marigold: 18, AAA: 21, CMLL: 21, TNA: 6, ROH: 1 }[f.id] != null ? { WWE: 2, AEW: 11, NJPW: 18, Stardom: 18, Marigold: 18, AAA: 21, CMLL: 21, TNA: 6, ROH: 1 }[f.id] : hash(f.id) % CITIES.length;
    if (!f.slot) f.slot = { h: 20, len: f.id === "WWE" ? 180 : 120 };
    if (!f.exp) f.exp = {};
    if (!f.tv) f.tv = { n: "Diffuseur", pay: 50, min: f.aud0 * 0.85, end: G.day + 365 };
  });
  // traditions des fédérations (Royal Rumble, Money in the Bank, G1 Climax…)
  if (!G.trad) { G.trad = []; Object.keys(TRAD0).forEach(k => { if (G.F[k]) TRAD0[k].forEach((x, i) => G.trad.push(Object.assign({ id: k + "-tr" + i, fed: k, on: true, ed: 0, pres: 60 }, x))); }); }
  // tournois de l'ancienne version
  (G.tours || []).forEach(t => { if (!t.fmt) { t.fmt = "bracket"; t.size = 8; t.cat = t.div === "f" ? "f" : "h"; t.played = []; } });
  // shows : la carte devient une liste ordonnée (matchs et segments)
  (G.ev || []).forEach(e => { if (!e.items && !e.done) { e.items = (e.card || []).map(m => ({ it: "m", t: m.kind === "equipe" ? "tag" : "simple", sides: [m.a || [], m.b || []], title: m.title || "", dur: m.dur === "long" ? "long" : m.dur === "court" ? "court" : "moyen", win: m.win === "a" ? 0 : m.win === "b" ? 1 : m.win === "nul" ? "nul" : "ia", spots: m.spots || [], fin: "auto", cons: "", stip: "" })).concat((e.seg || []).filter(s => s.w).map(s => ({ it: "s", k: "promo", w: [s.w] }))); } });
  // staff de départ
  const f = G.F[G.me], created = G.me === "ME", need = created ? { comm: 1, prod: 1, writer: 1, coach: 1, med: 1, ref: 1, ann: 1 } : { comm: 2, prod: 1, writer: 1, coach: 1, med: 1, ref: 2, ann: 1 };
  Object.keys(need).forEach(r => { let have = Object.values(G.staff).filter(s => s.fed === G.me && s.role === r).length; while (have < need[r]) { addStaff(G, { role: r, fed: G.me, q: clamp((created ? 32 : 50) + rnd() * 25) }); have++; } });
  ["comm", "prod", "writer", "coach", "med", "scout", "ref", "ann", "gm", "mgr", "social", "biz"].forEach(r => { for (let i = 0; i < 2; i++) addStaff(G, { role: r, fed: "", q: clamp(30 + rnd() * 45) }); });
  // réglages, objectifs, réputation
  G.mode = G.mode || opt.mode || "carriere"; G.diff = G.diff || opt.diff || "normal";
  G.cfg = Object.assign({ speed: 1, stopInj: true, stopOff: true, stopWk: true, tips: true, motn: false }, G.cfg || {});
  if (G.rep == null) G.rep = created ? 30 : G.me === "WWE" ? 55 : 45;
  if (G.diff === "facile" && opt.fresh) f.money = Math.round(f.money * 1.5); if (G.diff === "difficile" && opt.fresh) f.money = Math.round(f.money * 0.7);
  ["part", "neg", "cont", "ment", "aiShows", "mag", "wk", "ach", "hofDone", "img"].forEach(k => { if (!G[k]) G[k] = {}; });
  ["shots", "mitb", "lic", "weeks", "topM", "topS", "appear", "tens", "prom", "dev"].forEach(k => { if (!G[k]) G[k] = []; });
  if (!G.obj) G.obj = makeObj(G, Math.floor(dateOf(G.day).m / 3) + (dateOf(G.day).y - 1) * 4);
  G.v = 2;
  return G;
}
