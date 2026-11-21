// Mode Univers : les segments d'avant / d'après-match en action (lot du 21 nov., demande de Jose).
// - qui joue quel rôle d'après la situation (rivalités, titres, clans, managers, partenaires, personnalités) : cast
// - les 4-5 segments conseillés dans la carte du show : segReco
// - le direct en crée aussi tout seul, en chaînes de 1 à 5, sans répéter les mêmes (historique G.segh) : autoSegs
// - les effets (rivalité, relations, turn, public, sanctions, titre…) : segFx
import { SEG, MT } from "./data.js";
import { CHAIN } from "./segs.js";
import { clamp, rnd, pick, uid } from "./world.js";
import { wn, relGet, relAdd, champIds, isBig, news, cap, avail, roster, e_ } from "./base.js";

const ids = it => (it.sides || []).reduce((s, x) => s.concat(x || []), []).filter(Boolean);
const showIds = ev => (ev.items || []).reduce((s, x) => s.concat(x.it === "m" ? ids(x) : x.w || []), []);
const slOf = (G, a, b) => (G.sl || []).find(x => !x.done && ((x.a.indexOf(a) >= 0 && x.b.indexOf(b) >= 0) || (x.a.indexOf(b) >= 0 && x.b.indexOf(a) >= 0))) || null;
const foesOf = (G, b) => { const L = []; (G.sl || []).forEach(x => { if (x.done) return; if (x.a.indexOf(b) >= 0) L.push(...x.b); else if (x.b.indexOf(b) >= 0) L.push(...x.a); }); return L; };
const clanOf = (G, id, fed) => (G.clans || []).find(c => c.m.indexOf(id) >= 0 && (!fed || c.fed === fed)) || null;
export const pals = (G, id) => { const t = (G.teams || []).filter(x => x.m.indexOf(id) >= 0 && !x.off); return t.reduce((s, x) => s.concat(x.m.filter(i => i !== id)), []); };
export const mgrOf = (G, id, fed) => Object.values(G.staff || {}).find(s => s.role === "mgr" && s.w === id && (!fed || s.fed === fed)) || null;
const champOf = (G, id, fed) => Object.values(G.T || {}).find(t => (!fed || t.fed === fed) && champIds(t).indexOf(id) >= 0) || null;
const DIRTY = ["cheat", "interf", "dq", "co", "dco", "nc", "low", "refbump"];
const FIXED = ["los", "out", "chout", "chout2", "winchp", "chg", "ret", "chpl", "cas", "vetl", "part", "facout", "facl", "retn", "deb", "injb", "exch", "expart", "tagm"];

// la situation d'un match : avant (ph "pre") ou après (ph "post", avec son résultat)
export function segCtx(G, ev, it, res, ph, L) {
  const sides = ((res && res.sides) || (it && it.sides) || []).filter(s => s && s.length);
  return { ph: ph, ev: ev, it: it || null, res: res || null, sides: sides, ids: sides.reduce((s, x) => s.concat(x), []), title: it && it.title ? G.T[it.title] : null,
    win: res && typeof res.win === "number" ? res.win : -1, show: new Set(showIds(ev)), main: !!it && ev.items.indexOf(it) === ev.items.length - 1, L: L || null, used: new Set() };
}
// même show (WWE en plusieurs shows : pas de Raw qui débarque à SmackDown, sauf aux grands événements)
const sameBr = (X, w, B) => !w || !B || !w.br || !B.br || w.br === B.br || isBig(X.ev);
// quelqu'un qui n'est pas dans le match (rival de {b} de préférence)
function outsider(G, X, b, f) {
  const fed = X.ev.fed, B = G.W[b], ok = w => w && !w.ret && (w.fed === fed || w.fed === X.ev.part) && X.ids.indexOf(w.id) < 0 && avail(G, w, X.ev.day) && (!B || w.sx === B.sx) && sameBr(X, w, B) && (!f || f(w));
  const foes = foesOf(G, b).map(i => G.W[i]).filter(ok); if (foes.length) return pick(foes).id;
  if (f) { const L = Object.values(G.W).filter(ok); return L.length ? pick(L).id : ""; }
  const L = roster(G, fed).filter(w => ok(w) && !X.show.has(w.id)).sort((x, y) => y.pop - x.pop).slice(0, 12); return L.length ? pick(L).id : "";
}
const condOK = (G, X, c, R) => {
  const A = G.W[R.a], B = G.W[R.b], d = X.ev.day;
  switch (c) {
    case "riv": return !!(A && B && slOf(G, R.a, R.b));
    case "tit": return !!X.title;
    case "chp": return !!(A && champOf(G, R.a, X.ev.fed));
    case "chpnt": return !!(A && !X.title && X.ph === "pre" && X.sides.length === 2 && X.sides.every(s => s.length === 1) && (R.t = Object.values(G.T).find(t => t.fed === X.ev.fed && t.div !== "tag" && champIds(t)[0] === R.a)));
    case "heel": return !!(A && A.al === "heel"); case "face": return !!(A && A.al === "face");
    case "fac": { const cl = A && clanOf(G, R.a, X.ev.fed); if (cl) R.f = cl.n; return !!cl; }
    case "fac2": { const c1 = A && clanOf(G, R.a), c2 = B && clanOf(G, R.b); return !!(c1 && c2 && c1 !== c2); }
    case "mgr": { const m = A && (mgrOf(G, R.a, X.ev.fed) || accOf(G, X.it, R.a)); if (m) R.m = m.n; return !!m; }
    case "mgr2": return !!(A && B && mgrOf(G, R.a, X.ev.fed) && mgrOf(G, R.b, X.ev.fed));
    case "tm": { const p = A && pals(G, R.a).filter(i => G.W[i] && !G.W[i].ret)[0]; if (p) R.c = wn(G, p); return !!p; }
    case "frd": return !!(A && B && relGet(G, R.a, R.b) >= 40);
    case "enemy": return !!(A && B && relGet(G, R.a, R.b) <= -20);
    case "vet": return !!(A && B && A.age >= 36 && B.age <= 30);
    case "big": return isBig(X.ev); case "main": return X.main;
    case "win": return X.win >= 0;
    case "dirty": return !!(X.res && DIRTY.indexOf(X.res.fin) >= 0); case "clean": return !!(X.res && (X.res.fin === "clean" || X.res.fin === "subm"));
    case "fw": return !!(A && A.farewell && A.farewell.until >= d);
    case "lucha": return ["AAA", "CMLL"].indexOf(X.ev.fed) >= 0;
    case "mark": return !!G.mark;
    case "hot": return !!(X.L && X.L.crowd >= 70);
    default: return true;   // les conditions « de rôle » ont déjà été réglées par cast
  }
};
// qui joue {a} et {b} (+ {c} partenaire, {m} manager, {f} clan) ; null si le segment ne colle pas à la situation
export function cast(G, S, X, pref) {
  if (!S || !X.sides.length) return null;
  const c = S.c || [], has = k => c.indexOf(k) >= 0;
  let A = X.sides[0], B = X.sides.slice(1).reduce((s, x) => s.concat(x), []);
  if (X.ph === "post" && X.win >= 0) { A = X.sides[X.win]; B = X.sides.filter((s, i) => i !== X.win).reduce((s, x) => s.concat(x), []); }
  if (X.ph === "pre" && X.title) { const ch = champIds(X.title), ci = X.sides.findIndex(s => ch.some(i => s.indexOf(i) >= 0)); if (ci > 0) { A = X.sides[ci]; B = X.sides.filter((s, i) => i !== ci).reduce((s, x) => s.concat(x), []); } }
  const R = { a: pick(A) || "", b: pick(B) || "" };
  if (pref && pref.a && X.ids.concat([pref.a]).indexOf(pref.a) >= 0) { R.a = pref.a; R.b = pref.b || R.b; }
  const winner = R.a, loser = R.b, fed = X.ev.fed;
  // les rôles imposés par la situation
  if ((has("los") || has("win") || has("chg") || has("ret") || has("winchp") || has("chpl") || has("vetl") || has("dirty") || has("clean")) && X.ph === "post" && X.win < 0) return null;
  if (has("los")) { R.a = loser; R.b = winner; }
  if (has("chg")) { if (!X.res || !X.res.change) return null; }
  if (has("ret")) { if (!X.title || !X.res || X.res.change || X.win < 0) return null; }
  if (has("chpl")) { if (!champOf(G, R.b, fed)) return null; }
  if (has("vetl")) { const a = G.W[R.a], b = G.W[R.b]; if (!a || !b || !(a.age <= 30 && b.age >= 36)) return null; }
  if (has("tagm")) { const s = X.sides.find(x => x.length >= 2 && pals(G, x[0]).indexOf(x[1]) < 0); if (!s || s.length < 2) return null; R.a = s[0]; R.b = s[1]; }
  if (has("part")) { const s = X.sides.find(x => x.length >= 2 && pals(G, x[0]).indexOf(x[1]) >= 0); if (!s) return null; R.a = s[0]; R.b = s[1]; if (X.ph === "post" && X.win >= 0 && X.sides[X.win] !== s && rnd() < 0.5) { R.a = s[1]; R.b = s[0]; } }
  if (has("out")) { const b = X.ph === "post" && X.win >= 0 ? pick(X.sides[X.win]) : R.b || R.a; const o = outsider(G, X, b); if (!o) return null; R.a = o; R.b = b; }
  if (has("chout")) { const b = X.ph === "post" && X.win >= 0 ? pick(X.sides[X.win]) : R.b; const B2 = G.W[b]; const t = B2 && Object.values(G.T).find(t => t.fed === fed && t.div !== "tag" && (t.cat === B2.sx || t.cat === "x") && champIds(t)[0] && X.ids.indexOf(champIds(t)[0]) < 0 && G.W[champIds(t)[0]] && sameBr(X, G.W[champIds(t)[0]], B2) && avail(G, G.W[champIds(t)[0]], X.ev.day)); if (!t) return null; R.a = champIds(t)[0]; R.b = b; }
  if (has("chout2")) { const b = X.ids.find(i => champOf(G, i, fed)); if (!b) return null; const o = outsider(G, X, b); if (!o) return null; R.a = o; R.b = b; }
  if (has("winchp")) { const a = G.W[R.a]; if (!a || champOf(G, R.a, fed)) return null; const t = Object.values(G.T).find(t => t.fed === fed && t.div !== "tag" && (t.cat === a.sx || t.cat === "x") && champIds(t)[0] && X.ids.indexOf(champIds(t)[0]) < 0); if (!t) return null; R.b = champIds(t)[0]; }
  if (has("cas")) { const m = (G.mitb || []).find(x => x.fed === fed && x.until >= G.day && G.W[x.w] && X.ids.indexOf(x.w) < 0 && avail(G, G.W[x.w], X.ev.day)); if (!m) return null; R.a = m.w; R.case = m; if (X.title) { const ch = champIds(X.title); R.b = X.ph === "post" && X.res && X.res.change && X.win >= 0 ? X.sides[X.win][0] : ch[0] || R.b; } }
  if (has("facout")) { const tgt = X.ph === "post" && X.win >= 0 ? pick(X.sides[X.win]) : R.b; const cl = (G.clans || []).filter(cl => cl.fed === fed && cl.m.indexOf(tgt) < 0 && cl.m.some(i => G.W[i] && X.ids.indexOf(i) < 0 && sameBr(X, G.W[i], G.W[tgt]) && avail(G, G.W[i], X.ev.day))); if (!cl.length) return null; const k = pick(cl); R.a = k.m.find(i => G.W[i] && X.ids.indexOf(i) < 0 && sameBr(X, G.W[i], G.W[tgt]) && avail(G, G.W[i], X.ev.day)); R.b = tgt; R.f = k.n; R.clan = k.id; }
  if (has("facl")) { const cl = clanOf(G, R.b, fed); if (!cl) return null; const o = cl.m.find(i => i !== R.b && G.W[i] && !G.W[i].ret); if (!o) return null; R.a = o; R.f = cl.n; R.clan = cl.id; }
  if (has("retn")) { const o = outsider(G, X, R.b || R.a, w => !X.show.has(w.id) && (w.last || 0) > 0 && (w.last || 0) < G.day - 45 && (w.nm || 0) > 0); if (!o) return null; R.b = R.a; R.a = o; }
  if (has("deb")) { const o = outsider(G, X, R.b || R.a, w => !X.show.has(w.id) && (w.secret || (w.sgd != null && w.sgd > G.day - 45 && !(w.nm > 0)))); if (!o) return null; R.b = R.a; R.a = o; }
  if (has("injb")) { const o = outsider(G, X, R.b || R.a, w => !X.show.has(w.id) && w.inj && w.inj.until <= G.day && w.inj.until > G.day - 21 && (w.last || 0) < w.inj.until); if (!o) return null; R.b = R.a; R.a = o; }
  if (has("exch")) { const held = new Set(); Object.values(G.T).forEach(t => { if (t.fed === fed) (t.hist || []).forEach(h => (h.w || []).forEach(i => held.add(i))); });
    const o = outsider(G, X, R.b || R.a, w => held.has(w.id) && !champOf(G, w.id, fed)); if (!o) return null; if (X.ph === "pre") { R.b = R.b || R.a; } R.a = o; }
  if (has("expart")) { const b = R.b || R.a, P = new Set(); (G.teams || []).forEach(t => { if (t.m.indexOf(b) >= 0) t.m.forEach(i => i !== b && P.add(i)); });
    const o = outsider(G, X, b, w => P.has(w.id) && relGet(G, w.id, b) <= 10); if (!o) return null; R.a = o; R.b = b; }
  // les autres conditions ; si ça ne colle pas, on essaie en échangeant {a} et {b}
  const test = () => c.every(k => condOK(G, X, k, R));
  if (!test()) { if (c.some(k => FIXED.indexOf(k) >= 0) || !R.b) return null; const t = R.a; R.a = R.b; R.b = t; delete R.f; delete R.m; delete R.c; if (!test()) return null; }
  if (S.p >= 1 && !G.W[R.a]) return null; if (S.p >= 2 && (!G.W[R.b] || R.b === R.a)) return null;
  if (/\{c\}/.test(S.d || "") && !R.c) { const p = pals(G, R.a)[0]; if (!p) return null; R.c = wn(G, p); }
  if (/\{m\}/.test(S.d || "") && !R.m) { const m = mgrOf(G, R.a, fed) || accOf(G, X.it, R.a); if (!m) return null; R.m = m.n; }
  if (/\{f\}/.test(S.d || "") && !R.f) { const cl = clanOf(G, R.a, fed); if (!cl) return null; R.f = cl.n; R.clan = cl.id; }
  return R;
}
// un accompagnateur du match qui sert de manager à {a}
function accOf(G, it, a) { if (!it || !it.mgr || !it.sides) return null; const sd = it.sides.findIndex(s => s.indexOf(a) >= 0); const x = (it.mgr || []).find(m => m.sd === sd); return x ? { n: wn(G, x.id) } : null; }
export function segText(G, S, R) {
  const A = G.W[R.a], B = G.W[R.b], f = A && A.sx === "f", fb = B && B.sx === "f";
  return (S.d || S.n).replace(/\{a\}/g, wn(G, R.a)).replace(/\{b\}/g, R.b ? wn(G, R.b) : "son adversaire").replace(/\{c\}/g, R.c || "son partenaire").replace(/\{m\}/g, R.m || "son manager")
    .replace(/\{f\}/g, R.f || "son clan").replace(/\{il\}/g, f ? "elle" : "il").replace(/\{il2\}/g, f ? "la" : "le").replace(/\{eb\}/g, fb ? "e" : "").replace(/\{e\}/g, f ? "e" : "");
}
// poids d'un segment : fréquence, conditions remplies, personnalités, et pas vu récemment dans cette fédé
const FRW = [10, 4, 1.2, 0.3];
function weight(G, X, k, S, R) {
  let w = FRW[S.fr || 0] * (1 + 0.45 * (S.c || []).length);
  const last = (G.segh || {})[X.ev.fed + "|" + k]; if (last != null) { const d = G.day - last; w *= d < 7 ? 0.05 : d < 30 ? 0.3 : d < 90 ? (S.fr >= 2 ? 0.15 : 0.7) : S.fr >= 2 && d < 200 ? 0.4 : 1; }
  const A = G.W[R.a]; if (A) { const atk = ["att", "surp", "cha"].indexOf(S.fam) >= 0 || S.fx.gm; if (atk) w *= A.al === "heel" ? 1.5 : 0.7; if (["emo", "pub"].indexOf(S.fam) >= 0) w *= A.al === "face" ? 1.4 : 0.8; if (["def", "mind", "conf"].indexOf(S.fam) >= 0 && A.st[2] >= 70) w *= 1.25; }
  if (S.c && S.c.indexOf("riv") >= 0) { const sl = slOf(G, R.a, R.b); if (sl) w *= 1 + sl.heat / 100; }
  return w;
}
export function segCands(G, X) {
  const out = [];
  Object.keys(SEG).forEach(k => { const S = SEG[k]; if (S.ph !== X.ph || X.used.has(k)) return; const R = cast(G, S, X); if (!R) return; out.push({ k: k, R: R, w: weight(G, X, k, S, R) }); });
  return out.sort((a, b) => b.w - a.w);
}
const wpick = L => { const T = L.reduce((s, x) => s + x.w, 0); let r = rnd() * T; for (const x of L) { r -= x.w; if (r <= 0) return x; } return L[L.length - 1]; };
// 4-5 segments conseillés pour la carte (un pour chaque famille au plus, les plus adaptés d'abord)
export function segReco(G, X, n) {
  const L = segCands(G, X), out = [], fam = new Set();
  L.forEach(x => { if (out.length < (n || 5) && !fam.has(SEG[x.k].fam)) { fam.add(SEG[x.k].fam); out.push(x); } });
  return out;
}
// le direct crée des segments tout seul : probabilité selon l'enjeu
export function autoChance(G, X) {
  const sl = X.sides.length >= 2 && X.sides[0].some(a => X.sides[1].some(b => slOf(G, a, b)));
  let p = X.ph === "pre" ? 0.18 : 0.22;
  if (sl) p += 0.12; if (X.title) p += 0.08; if (isBig(X.ev)) p += 0.08; if (X.main) p += 0.08;
  if (X.ph === "post" && X.res) { if (X.res.change) p += 0.2; if (DIRTY.indexOf(X.res.fin) >= 0) p += 0.1; }
  return Math.min(0.7, p);
}
// une chaîne de 1 à 5 segments (le 1er au hasard pondéré, puis ses suites possibles)
export function autoSegs(G, X) {
  if (!X.sides.length || rnd() > autoChance(G, X)) return [];
  const L = segCands(G, X); if (!L.length) return [];
  const out = []; let cur = wpick(L);
  while (cur && out.length < 5) {
    out.push(cur); X.used.add(cur.k);
    const nx = (CHAIN[cur.k] || []).filter(k => SEG[k] && !X.used.has(k)); if (!nx.length || rnd() > [0.55, 0.4, 0.3, 0.2][out.length - 1]) break;
    const k = pick(nx), R = cast(G, SEG[k], X, cur.R); cur = R ? { k: k, R: R, w: 1 } : null;
  }
  return out;
}
// ---------- les effets d'un segment ----------
// X.mod = ordres pour le match qui suit (avant-match) ; renvoie { notes, gm, now }
export function segFx(G, ev, k, R, X) {
  const S = SEG[k] || {}, F = S.fx || {}, A = G.W[R.a], B = G.W[R.b], mine = ev.fed === G.me && !ev.ai, notes = [], out = { notes: notes, gm: !!F.gm, now: null };
  G.segh = G.segh || {}; G.segh[ev.fed + "|" + k] = G.day;
  if (Object.keys(G.segh).length > 600) Object.keys(G.segh).slice(0, 200).forEach(x => delete G.segh[x]);
  let sl = A && B ? slOf(G, R.a, R.b) : null;
  const busy = id => (G.sl || []).some(x => !x.done && (x.a.indexOf(id) >= 0 || x.b.indexOf(id) >= 0)), open = A ? (G.sl || []).filter(x => !x.done && x.fed === A.fed).length : 99;
  if (!sl && A && B && A.fed && A.fed === B.fed && A.sx === B.sx && (!A.br || !B.br || A.br === B.br) && F.h >= 4 && open < 8 && !busy(A.id) && !busy(B.id) && rnd() < (F.sl ? 0.6 : F.h >= 7 ? 0.3 : 0)) {
    sl = { id: uid("s"), fed: A.fed, n: A.n + " contre " + B.n, a: [A.id], b: [B.id], len: 5, wk: 0, heat: 25, turn: null, done: false, from: G.day }; G.sl = G.sl || []; G.sl.push(sl);
    if (mine) notes.push("Une rivalité commence entre " + A.n + " et " + B.n);
  }
  if (sl && F.h) { sl.heat = clamp(sl.heat + F.h); sl.met = G.day; sl.kinds = (sl.kinds || []).concat(k); cap(sl.kinds, 30); }
  if (A && B && F.r) relAdd(G, R.a, R.b, F.r);
  if (F.b && rnd() < F.b) { notes.push("Ça tourne à la bagarre !"); if (sl) sl.heat = clamp(sl.heat + 4); out.gm = true; }
  if (F.c && X && X.L) X.L.crowd = clamp(X.L.crowd + F.c);
  if (F.t === -1 && A && A.al === "heel") { A.al = "face"; (A.hist = A.hist || []).push({ d: G.day, t: "Face turn" }); notes.push(A.n + " devient gentil" + e_(A) + " : face turn !"); news(G, { seg: "ecran", f: mine ? "nous" : "autres", t: A.n + " : face turn !", txt: "Le public n’en revient pas." }); }
  if (F.t === 1 && A && A.al === "face") { A.al = "heel"; (A.hist = A.hist || []).push({ d: G.day, t: "Heel turn" }); notes.push(A.n + " trahit " + (B ? B.n : "les siens") + " : heel turn !"); news(G, { seg: "ecran", f: mine ? "nous" : "autres", t: A.n + " trahit " + (B ? B.n : "les siens") + " !", txt: "Le public n’en revient pas." }); }
  if (F.pop && A) A.pop = clamp(A.pop + 1.5, 1, 99);
  if (F.hurt && B) { B.en = clamp(B.en - 12); notes.push(B.n + " part avec un handicap"); }
  if (F["crd+"] && A) A.crowd = clamp((A.crowd || 40) + 5); if (F["crd-"] && A) A.crowd = clamp((A.crowd || 40) - 5);
  if (F["mor+"] && A) A.mor = clamp(A.mor + 5); if (F["mor-"] && A) A.mor = clamp(A.mor - 6);
  if (X && X.mod) { if (F.nodq) X.mod.nodq = true; if (F.ban) X.mod.ban = true; if (F.sanc) X.mod.sanc = true; }
  if (F.add3 && X && X.it && A && X.it.t === "simple" && MT.triple && X.ids.indexOf(R.a) < 0 && X.it.sides.length === 2) { X.it.t = "triple"; X.it.sides.push([R.a]); X.ids.push(R.a); notes.push(A.n + " entre dans le match !"); }
  if (F.tion && X && X.it && R.t && !X.it.title) { X.it.title = R.t.id; X.title = R.t; notes.push(R.t.n + " en jeu !"); }
  if (F.shot && A) { const ch = R.b && champOf(G, R.b, ev.fed); const t = ch || Object.values(G.T).find(t => t.fed === ev.fed && t.div !== "tag" && (t.cat === A.sx || t.cat === "x") && champIds(t).indexOf(R.a) < 0);
    if (t && !(G.shots || []).some(s => s.w === R.a && s.t === t.id)) { G.shots = (G.shots || []).concat({ w: R.a, t: t.id, by: S.n, d: G.day }); notes.push(A.n + " aura un match pour le " + t.n); } }
  if (F.x && A && B) { const t = (G.teams || []).find(t => t.m.indexOf(R.a) >= 0 && t.m.indexOf(R.b) >= 0 && !t.off); if (t) { t.off = G.day; notes.push("C’est fini pour " + t.n); } }
  if (F.team && A && B && A.fed === B.fed && A.sx === B.sx && !(G.teams || []).some(t => !t.off && t.m.indexOf(R.a) >= 0 && t.m.indexOf(R.b) >= 0)) { G.teams = G.teams || []; G.teams.push({ id: uid("t"), fed: A.fed, n: A.n.split(" ")[0] + " & " + B.n.split(" ")[0], m: [A.id, B.id], chem: 55 }); notes.push("Nouvelle équipe : " + A.n + " et " + B.n); }
  if (F.endsl && sl) { sl.done = true; notes.push("La rivalité entre " + A.n + " et " + B.n + " est terminée"); }
  if ((F.kick || F.join || F.disband) && R.clan) { const cl = (G.clans || []).find(c => c.id === R.clan);
    if (cl && F.kick && B) { cl.m = cl.m.filter(i => i !== R.b); notes.push(B.n + " ne fait plus partie de " + cl.n); }
    if (cl && F.join && B && cl.m.indexOf(R.b) < 0 && B.pop < 80 && rnd() < (!cl.al || cl.al === B.al ? 0.3 : 0.06)) { cl.m.push(R.b); notes.push(B.n + " rejoint " + cl.n + " !"); } else if (cl && F.join && B) notes.push(B.n + " refuse de rejoindre " + cl.n);
    if (cl && F.disband) { G.clans = G.clans.filter(c => c !== cl); notes.push(cl.n + ", c’est fini"); } }
  if (F.disband && !R.clan && A) { const cl = clanOf(G, R.a, ev.fed); if (cl) { G.clans = G.clans.filter(c => c !== cl); notes.push(cl.n + ", c’est fini"); } }
  if (F.mgrq && A) { const m = mgrOf(G, R.a, ev.fed); if (m) { m.w = ""; notes.push(m.n + " n’est plus le manager de " + A.n); } }
  if (F.cash && A && R.case && X && X.title && X.title.div !== "tag") { const t = X.title; G.mitb = (G.mitb || []).filter(m => m !== R.case);
    if (rnd() < 0.8) { if (t.hist && t.hist.length) t.hist[t.hist.length - 1].to = G.day; t.champ = R.a; t.since = G.day; t.defs = 0; t.hist = (t.hist || []).concat({ w: [R.a], from: G.day, defs: 0 }); cap(t.hist, 60);
      A.pop = clamp(A.pop + 4, 1, 99); A.mor = clamp(A.mor + 10); (A.hist = A.hist || []).push({ d: G.day, t: "Encaisse la mallette : " + t.n }); notes.push(A.n + " encaisse la mallette et devient champion" + e_(A) + " !"); out.cash = t.id;
      news(G, { seg: "ecran", f: t.fed === G.me ? "nous" : "autres", t: A.n + " encaisse sa mallette !", txt: A.n + " remporte le " + t.n + " par surprise." }); }
    else notes.push(A.n + " encaisse la mallette… et échoue !"); }
  if (F.now && A && B && X && X.ph === "post") out.now = [R.a, R.b];
  if (F.dem && mine && A && A.fed === G.me) { G.gmq = (G.gmq || []).concat({ k: "sanc", w: R.a, o: R.b || "", why: S.n, d: G.day }); cap(G.gmq, 12); }
  if (A && A.secret && (k === "a_debut" || k === "p_debut")) { const big = !A.leak; A.secret = false; A.pop = clamp(A.pop + (big ? 4 : 1.5), 1, 99); if (X && X.L) X.L.crowd = clamp(X.L.crowd + (big ? 8 : 2)); notes.push(big ? "Personne ne s’y attendait : énorme réaction pour " + A.n + " !" : "Les fans savaient déjà (fuite)…"); }
  // les segments rares deviennent de vrais événements
  if ((S.fr >= 2 || F.n1) && A) { (A.hist = A.hist || []).push({ d: G.day, t: S.n + (ev.n ? " (" + ev.n + ")" : "") }); cap(A.hist, 40);
    const hl = /[!?…]$/.test(S.n) ? S.n : S.n + " !";
    if (mine || ((S.fr >= 3 || F.n1) && A.pop >= 75)) news(G, { seg: "ecran", f: mine ? "nous" : "autres", t: (mine ? "" : ((G.F[ev.fed] || {}).n || "") + " : ") + hl, txt: segText(G, S, R) }); }
  if (S.fx.y && mine && X && X.next) X.next(S.fx.y);
  return out;
}
