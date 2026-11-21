// Jeu « Qui suis-je ? » (21 nov., idée de Jose du 19 nov.) — 3e tuile de l'onglet Jeux, pour les membres connectés.
// Chaque jour (heure de Paris) : 3 catcheurs à trouver, facile / moyen / difficile (rang de célébrité des cartes TCCCG : top 10 %,
// 10-35 %, 35-70 %, catcheurs avec photo), même tirage pour tout le monde ; le modo peut en changer un (Firestore qsj/{jour}).
// 5 tuiles face cachée, indices du plus vaste au plus précis (logo de la promotion, groupe, ceinture, finisher… dernière tuile =
// silhouette + initiales). Points : trouvé à la tuile n = (6 − n) × 1 / 2 / 3 selon la difficulté (30 max par jour) ; raté = 0.
// À minuit (Paris), le jeu du jour se ferme. Classement de tous les temps (qsjp/{uid}). Récompense TCCCG : 10 gimmicks par point.
// Idées acceptées : suggestions en tapant (accents ignorés), « Je passe », « Hier, c'était… », partage en cases colorées dans la
// Gorilla Position, gimmicks TCCCG. Pas d'indice spoiler : un règne de moins de 7 jours n'est jamais utilisé.
import { S, B, ACT, FORM, changed } from "../state.js";
import { esc, toast, modal } from "../util.js";
import { parisDay, parisMin, prevDay } from "../time.js";
import { photoOf } from "../photos.js";
import { knownNames, norm } from "../wrestlers.js";
import { showLogo, groupById, groupLogo, beltOf } from "../assets.js";
import { palmaresOf } from "./palmares.js";
import { baseCards, cardByName } from "../tcg/data.js";
import { commit } from "../tcg/store.js";
import { loadUData, udata, GT } from "../univers/data.js";
import { femaleSet } from "../univers/world.js";

export const LV = [["e", "Facile", 1], ["m", "Moyen", 2], ["h", "Difficile", 3]];
const MULT = { e: 1, m: 2, h: 3 }, GIM = 10;
const N = s => norm(s).replace(/[^a-z0-9]+/g, "");
const hashS = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const dayNum = d => Math.round((Date.parse(d + "T12:00:00Z") - Date.parse("2026-01-01T12:00:00Z")) / 864e5);
const addDay = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const dTxt = d => { const p = d.split("-"); return +p[2] + " " + MOIS[+p[1] - 1]; };

// ---------- les indices d'un catcheur ----------
const STYLE = { Dominator: "Dominateur (la puissance)", Aggressor: "Agressif (la bagarre)", Technician: "Technicien (les prises)", Opportunist: "Opportuniste (la ruse)", Showman: "Showman (le spectacle)" };
const yearOf = c => { const w = c.w || {}; const m = String(w.debut || w.era || c.years || "").match(/(19|20)\d{2}/); return m ? +m[0] : 0; };
function namesOf(c) { const L = [c.rn || c.name, c.name]; ((S.photos || {})[c.id] || {}).n && L.push(...S.photos[c.id].n); if (c.w && Array.isArray(c.w.a)) L.push(...c.w.a); return L.filter(Boolean); }
function leaks(c, txt) {
  const t = " " + norm(txt).replace(/[^a-z0-9]+/g, " ") + " ";
  return namesOf(c).some(n => norm(n).replace(/[^a-z0-9]+/g, " ").split(" ").some(p => p.length >= 4 && t.indexOf(" " + p + " ") >= 0));
}
// rang dans les rosters (show, division, unité), catcheuse ou non
let RO = null, ROK = "", FEMS = null;
function rosterOf(c) {
  const k0 = Object.keys(S.rosters || {}).length + "|" + Object.keys(S.titles || {}).length;
  if (!RO || ROK !== k0) { RO = new Map(); Object.keys(S.rosters || {}).forEach(k => Object.keys(S.rosters[k] || {}).forEach(g => (S.rosters[k][g] || []).forEach(n => { if (!RO.has(norm(n))) RO.set(norm(n), [k, g]); }))); FEMS = femaleSet(); ROK = k0; }
  for (const n of namesOf(c)) { const r = RO.get(norm(n)); if (r) return r; }
  return null;
}
const isF = c => { rosterOf(c); return namesOf(c).some(n => FEMS.has(norm(n))); };
function cluesOf(c) {
  const w = c.w || {}, L = { 1: [], 2: [], 3: [], 4: [] }, add = (l, o) => { if (o.t && !leaks(c, o.t)) L[l].push(o); };
  const ro = rosterOf(c), fem = isF(c), gm = (udata().gm || {})[c.rn || c.name] || null;
  if (fem) add(1, { t: "Je suis une catcheuse.", ic: "♀" }); else if (ro && /masculin|poids lourds|juniors/i.test(ro[1])) add(1, { t: "Je suis un catcheur.", ic: "♂" });
  if (ro && ro[0] === "WWE" && /^(Raw|SmackDown|NXT)$/.test(ro[1])) add(2, { t: "Mon show à la WWE : " + ro[1] + ".", img: showLogo("WWE", ro[1]) || "", ic: "📺" });
  else if (ro && ro[0] === "NJPW") add(2, { t: "Ma division à la NJPW : " + ro[1] + ".", ic: "⚖" });
  else if (ro && ro[0] === "CMLL" && /mini|micro/i.test(ro[1])) add(2, { t: "Ma division au CMLL : " + ro[1] + ".", ic: "⚖" });
  else if (ro && ro[0] === "Stardom") add(3, { t: "Mon unité à Stardom : " + ro[1] + ".", ic: "🤝" });
  if (gm && GT[gm[1]]) add(2, { t: "Mon personnage : " + GT[gm[1]][0].toLowerCase() + ".", ic: "🎭" });
  if (gm && gm[0] && !w.nick) add(4, { t: "On m’appelle « " + gm[0] + " ».", ic: "🏷" });
  // 1 : le plus vaste
  if (c.fa) add(1, { t: "Je n’ai pas de contrat en ce moment : je suis agent libre.", ic: "⛓" });
  else if (c.k) add(1, { t: "Aujourd’hui, je catche à : " + c.k + ".", img: showLogo(c.k, "") || "", ic: "🏟" });
  const y = yearOf(c); if (y) add(1, { t: "J’ai fait mes débuts dans les années " + Math.floor(y / 10) * 10 + ".", ic: "🗓" });
  if (c.al === "face") add(1, { t: "En ce moment, le public me voit comme un gentil (face).", ic: "😇" }); else if (c.al === "heel") add(1, { t: "En ce moment, je joue les méchants (heel).", ic: "😈" });
  if (STYLE[c.arch]) add(1, { t: "Mon type de carte au TCCCG : " + STYLE[c.arch] + ".", ic: "🃏" });
  // 2
  if (w.from) add(2, { t: "Je viens de " + w.from + ".", ic: "📍" });
  if (w.trainer) add(2, { t: "J’ai été entraîné par " + w.trainer + ".", ic: "🎓" });
  if (w.ht && w.wt) add(2, { t: "Je mesure " + w.ht + " pour " + w.wt + ".", ic: "📏" });
  ((c.gs && c.gs.past) || []).slice(0, 2).forEach(id => { const g = groupById(id); if (g && g.n) add(2, { t: "J’ai fait partie de « " + g.n + " ».", img: groupLogo(id) || "", ic: "🤝" }); });
  // 3 : un titre (jamais un règne de moins de 7 jours : pas de spoiler), le groupe actuel, un grand match
  const pal = palmaresOf(c.rn || c.name).filter(x => !(x.cur && (x.j == null || x.j < 7)));
  const ti = pal.find(x => !x.ty) , tu = pal.find(x => x.ty);
  if (ti) add(3, { t: "J’ai été champion : " + ti.t + (ti.x > 1 ? " (" + ti.x + " fois)." : "."), img: (ti.id && beltOf(ti.id)) || "", ic: "🏆" });
  if (tu) add(3, { t: "J’ai gagné : " + tu.t + (tu.y ? " (" + tu.y + ")." : "."), ic: "🎖" });
  ((c.gs && c.gs.cur) || []).slice(0, 1).forEach(id => { const g = groupById(id); if (g && g.n) add(3, { t: "Je fais partie de « " + g.n + " ».", img: groupLogo(id) || "", ic: "🤝" }); });
  const ref = Array.isArray(w.ref) && w.ref[0];
  if (ref && ref.t) { const opp = ref.t.split(/\s+—\s+/)[0].split(/\s+contre\s+|\s+et\s+|,\s*/).map(s => s.trim()).filter(s => s && !namesOf(c).some(n => N(n) === N(s))); if (opp.length) add(3, { t: "Un de mes grands matchs : contre " + opp.join(" et ") + (ref.ev ? " (" + ref.ev + ")." : "."), ic: "🎬" }); }
  // 4 : le plus précis
  const fin = (S.finishers || {})[c.rn || c.name] || w.fin; if (fin) add(4, { t: "Ma prise de finition : " + String(fin).split(/[,;(]/)[0].trim() + ".", ic: "💥" });
  if (w.nick) add(4, { t: "On m’appelle « " + String(w.nick).split(/[,;]/)[0].trim() + " ».", ic: "🏷" });
  return L;
}
// les 5 tuiles (tirage fixé par le jour et le nom)
function tilesOf(c, day) {
  const L = cluesOf(c), h = k => hashS(day + "|" + c.id + "|" + k), take = (lv, k) => { for (const l of lv) { const a = L[l]; if (a.length) return a.splice(h(k) % a.length, 1)[0]; } return null; };
  const nm = c.rn || c.name, words = nm.split(/\s+/).filter(Boolean), letters = N(nm).length;
  const T = [take([1, 2], 1), take([1, 2], 2), take([3, 2], 3), take([4, 3], 4)];
  if (!T[2]) T[2] = { t: "Mon nom de ring compte " + letters + " lettres.", ic: "🔤" };
  if (!T[3]) T[3] = words.length > 1 ? { t: "Mon nom de ring compte " + words.length + " mots.", ic: "🔤" } : { t: "Mon nom de ring tient en un seul mot.", ic: "🔤" };
  if (!T[0]) T[0] = T[1] || { t: isF(c) ? "Je suis une catcheuse." : "Je catche dans une des promotions de l’app.", ic: "🤼" };
  if (!T[1]) T[1] = { t: "Mon nom de ring compte " + words.length + " mot" + (words.length > 1 ? "s" : "") + ".", ic: "🔤" };
  T.push({ t: "Mes initiales : " + words.map(x => x[0].toUpperCase() + ".").join(" ") + " (" + letters + " lettres).", img: c.pic || photoOf(nm), sil: true, ic: "👤" });
  return T;
}
// indices « solides » (hors type de carte et catcheur / catcheuse) : il en faut assez pour un tirage auto
const realClues = c => { const L = cluesOf(c), l1 = L[1].filter(x => x.ic !== "🃏" && x.ic !== "♀" && x.ic !== "♂").length; return { all: l1 + L[2].length + L[3].length + L[4].length, deep: L[2].length + L[3].length + L[4].length }; };
const goodFor = c => { const r = realClues(c); return r.all >= 4 && r.deep >= 2; };

// ---------- le tirage du jour ----------
let POOL = null, PKEY = "";
function pools() {
  const B0 = baseCards(), key = B0.length + "|" + Object.keys(S.photos || {}).length + "|" + Object.keys(udata().gm || {}).length;
  if (POOL && PKEY === key) return POOL;
  // jamais les personnes exclues partout (data/statuts.json « out »)
  const out = new Set(((udata().st || {}).out || []).map(norm));
  const ph = B0.filter(x => !x.nopic && !x.custom && x.pic && !namesOf(x).some(n => out.has(norm(n)))), n = ph.length;
  // seulement les catcheurs qui ont assez d'indices (sinon le même reviendrait plusieurs jours de suite)
  // facile = les grands noms (fiche détaillée dans l'app, dans le top 25 %), moyen = le reste du top 40 %, difficile = 40 à 75 %
  const band = (a, b) => ph.slice(Math.floor(n * a), Math.floor(n * b)).filter(goodFor);
  const top = band(0, 0.40), easy = top.filter((x, i) => x.w && ph.indexOf(x) < n * 0.25);
  POOL = { e: easy, m: top.filter(x => easy.indexOf(x) < 0), h: band(0.40, 0.75) };
  Object.keys(POOL).forEach(k => POOL[k].sort((a, b) => hashS(a.id + "|" + k) - hashS(b.id + "|" + k)));
  PKEY = key; return POOL;
}
const CACHE = {};
export function picks(day) {
  const ov = ((S.qsj && S.qsj.days) || {})[day] || {}, key = day + "|" + JSON.stringify(ov) + "|" + PKEY + "|" + Object.keys(udata().gm || {}).length;
  if (CACHE[day] && CACHE[day].k === key) return CACHE[day].v;
  const P = pools(), D = dayNum(day), v = {};
  LV.forEach(l => {
    const k = l[0]; let c = ov[k] ? cardByName(ov[k]) : null;
    if (!c) { const A = P[k]; if (A.length) c = A[((D % A.length) + A.length) % A.length]; }
    v[k] = c ? { c: c, tiles: tilesOf(c, day), mod: !!ov[k] } : null;
  });
  CACHE[day] = { k: key, v: v };
  return v;
}

// ---------- la partie du joueur (Firestore qsjp/{uid}) ----------
const today = () => parisDay();
export function qsjLoad(force) {
  if (!S.user || !B || !B.qsjGet) return;
  let Q = S.qsj = S.qsj || { st: "", days: {}, me: null, list: [], at: 0 };
  if (Q.uid && Q.uid !== S.user.uid) Q = S.qsj = { st: "", days: {}, me: null, list: [], at: 0 };
  if (Q.busy || (!force && Q.st === "ok" && Date.now() - Q.at < 60000 && Q.day === today())) return;
  Q.busy = true; if (Q.st !== "ok") Q.st = "load"; const rev = Q.rev || 0, d0 = today(), ds = [prevDay(d0), d0]; if (S.realAdmin) for (let i = 1; i <= 7; i++) ds.push(addDay(d0, i));
  Promise.all([B.qsjDays(ds), B.qsjGet(S.user.uid), B.qsjList().catch(() => []), loadUData().catch(() => null)]).then(r => {
    // une partie enregistrée pendant le chargement est plus récente que celle du serveur : on la garde
    Q.days = r[0] || {}; if ((Q.rev || 0) === rev) { Q.me = r[1]; if (Q.me) Q.me.days = fromDb(Q.me.days); } Q.list = r[2] || []; Q.st = "ok"; Q.at = Date.now(); Q.uid = S.user.uid; Q.day = d0; Q.busy = false; changed("qsj");
  }).catch(e => { Q.busy = false; if (Q.st !== "ok") { Q.st = "err"; Q.err = (e && e.message) || "erreur"; } changed("qsj"); });
}
// Firestore refuse les tableaux dans un tableau (21 nov. : les tuiles ne se retournaient plus) : la base garde { t, e, p, g }
const toDb = days => { const o = {}; Object.keys(days || {}).forEach(d => { const x = days[d] || {}, y = {}; Object.keys(x).forEach(k => { const v = x[k]; y[k] = Array.isArray(v) ? { t: v[0] | 0, e: v[1] | 0, p: v[2] | 0, g: (v[3] || []).map(String).slice(-5) } : v; }); o[d] = y; }); return o; };
const fromDb = days => { const o = {}; Object.keys(days || {}).forEach(d => { const x = days[d] || {}, y = {}; Object.keys(x).forEach(k => { const v = x[k]; y[k] = v && typeof v === "object" && !Array.isArray(v) && "t" in v ? [v.t | 0, v.e | 0, v.p | 0, Array.isArray(v.g) ? v.g : []] : v; }); o[d] = y; }); return o; };
const myDoc = () => { const Q = S.qsj || {}; return Q.me || { name: "", pts: 0, n: 0, g: 0, days: {} }; };
const stOf = (doc, day, k) => ((doc.days || {})[day] || {})[k] || null; // [tuiles montrées, état 0 en cours / 1 trouvé / 2 raté, points, [essais]]
function save(doc) {
  doc.name = String((S.profile && S.profile.pseudo) || doc.name || "Joueur").slice(0, 40);
  const keys = Object.keys(doc.days || {}).sort(); if (keys.length > 90) keys.slice(0, keys.length - 90).forEach(k => delete doc.days[k]);
  S.qsj.me = doc; S.qsj.rev = (S.qsj.rev || 0) + 1;
  // l'écran se met à jour même si l'envoi échoue (avant : une erreur de Firebase bloquait tout)
  let p = null; const fail = e => toast("Partie non enregistrée : " + ((e && e.message) || "erreur"), { ms: 4000 });
  try { p = Promise.resolve(B.qsjSave(S.user.uid, { name: doc.name, pts: doc.pts | 0, n: doc.n | 0, g: doc.g | 0, days: toDb(doc.days) })).then(() => { S.qsj.at = 0; }).catch(fail); } catch (e) { fail(e); }
  changed("qsj"); return p;
}
function play(k, guess) {
  if (!S.user || !S.qsj || S.qsj.st !== "ok") return;
  const day = today(), P = picks(day), p = P[k]; if (!p) return;
  const doc = JSON.parse(JSON.stringify(myDoc())); doc.days = doc.days || {}; doc.days[day] = doc.days[day] || {};
  const st = doc.days[day][k] = doc.days[day][k] || [1, 0, 0, []];
  if (st[1]) return;
  S.qsjLvl = k; let res = "";
  if (guess != null) {
    const g = N(guess); if (!g) return;
    if (namesOf(p.c).some(n => N(n) === g)) { st[1] = 1; st[2] = (6 - st[0]) * MULT[k]; res = "ok"; }
    else { st[3] = (st[3] || []).concat(String(guess).slice(0, 40)).slice(-5); res = "no"; }
  }
  if (res !== "ok") { if (st[0] >= 5) { st[1] = 2; st[2] = 0; res = "ko"; } else { st[0]++; S.qsjFlip = k + st[0]; } }
  if (st[1]) {
    doc.pts = (doc.pts | 0) + st[2]; doc.g = (doc.g | 0) + 1; if (st[1] === 1) doc.n = (doc.n | 0) + 1;
    if (st[2] > 0) { const gim = st[2] * GIM; doc.days[day].r = (doc.days[day].r || 0) + gim; commit(d => { d.res.gim = (d.res.gim || 0) + gim; }); }
    S.qsjWin = { k: k, ok: st[1] === 1, pts: st[2] };
  }
  if (res === "no") toast("Non, ce n’est pas " + guess + " : une nouvelle tuile se retourne", { ms: 2500 });
  save(doc);
}
FORM.qsjguess = f => { const v = (f.g.value || "").trim(); if (!v) { toast("Écris un nom"); return; } play(f.dataset.k, v); };
ACT.qsjpass = el => play(el.dataset.k, null);
ACT.qsjlv = el => { S.qsjLvl = el.dataset.k; S.qsjWin = null; changed("qsj"); };
ACT.qsjsug = el => { const f = document.querySelector("form[data-form=qsjguess]"); if (!f) return; f.g.value = el.dataset.n; play(f.dataset.k, el.dataset.n); };
ACT.qsjshare = async () => {
  if (!S.user) return; const day = today(), doc = myDoc(), txt = shareText(doc, day);
  try { await B.sendRoom(S.user.uid, txt); toast("Partagé dans la Gorilla Position"); } catch (e) { toast("Partage impossible : " + ((e && e.message) || "erreur")); }
};
function shareText(doc, day) {
  let tot = 0; const rows = LV.map(l => { const st = stOf(doc, day, l[0]); if (!st || !st[1]) return l[1] + " : pas encore joué"; tot += st[2];
    const sq = st[1] === 2 ? "🟥🟥🟥🟥🟥" : "🟨".repeat(st[0] - 1) + "🟩" + "⬜".repeat(5 - st[0]); return l[1] + " " + sq + " " + st[2] + " pt" + (st[2] > 1 ? "s" : ""); });
  return "🕵️ Qui suis-je ? · " + dTxt(day) + "\n" + rows.join("\n") + "\nTotal : " + tot + " / 30";
}
// suggestions pendant la frappe (accents ignorés)
let NAMES = null, NKEY = "";
function names() { const k = Object.keys(S.photos || {}).length + "|" + Object.keys(S.wrestlers || {}).length; if (NAMES && NKEY === k) return NAMES; const set = new Map(); knownNames().forEach(x => { [x.n].concat(x.a || []).forEach(n => { if (n && !set.has(N(n))) set.set(N(n), n); }); }); NAMES = Array.from(set.entries()); NKEY = k; return NAMES; }
if (typeof document !== "undefined") document.addEventListener("input", e => {
  if (!e.target || e.target.id !== "qsjin") return; const box = document.getElementById("qsjsug"); if (!box) return;
  const q = N(e.target.value); if (q.length < 2) { box.innerHTML = ""; return; }
  const L = names(), a = L.filter(x => x[0].indexOf(q) === 0), b = L.filter(x => x[0].indexOf(q) > 0);
  box.innerHTML = a.concat(b).slice(0, 6).map(x => '<button type="button" class="qsjs" data-act="qsjsug" data-n="' + esc(x[1]) + '">' + esc(x[1]) + "</button>").join("");
});

// ---------- l'écran ----------
function tileHTML(t, i, open, flip, mult) {
  if (!open) return '<li class="qsjt"><span class="qsjb"><b>?</b></span><span class="qsjtx"><small>Indice ' + (i + 1) + "</small>Trouvé ici : " + (5 - i) * mult + " pt" + ((5 - i) * mult > 1 ? "s" : "") + "</span></li>";
  return '<li class="qsjt on' + (flip ? " flip" : "") + '"><span class="qsjb' + (t.sil ? " sil" : "") + '">' + (t.img ? '<img src="' + esc(t.img) + '" alt="" loading="lazy">' : "<i>" + esc(t.ic || "•") + "</i>") + '</span><span class="qsjtx"><small>Indice ' + (i + 1) + "</small>" + esc(t.t) + "</span></li>";
}
// 21 nov. (demande de Jose) : les tuiles sont des cartes posées sur un ring ; on les retourne une à une, les indices s'écrivent dessous
const RING = '<svg class="qsjrsvg" viewBox="0 0 360 230" aria-hidden="true" preserveAspectRatio="none">' +
  '<defs><linearGradient id="qsjmat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfd6e3"/><stop offset="1" stop-color="#f1f3f8"/></linearGradient>' +
  '<linearGradient id="qsjapr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8101a"/><stop offset="1" stop-color="#5c060b"/></linearGradient></defs>' +
  '<polygon points="40,46 320,46 356,196 4,196" fill="url(#qsjmat)"/><polygon points="4,196 356,196 356,228 4,228" fill="url(#qsjapr)"/>' +
  '<text x="180" y="219" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="15" fill="#fff" letter-spacing="3">QUI SUIS-JE ?</text>' +
  '<g stroke-linecap="round" fill="none"><path d="M40 30H320" stroke="#e5322d" stroke-width="3"/><path d="M40 38H320" stroke="#fff" stroke-width="3"/><path d="M40 46H320" stroke="#2f6fe0" stroke-width="3"/>' +
  '<path d="M40 30L4 170M40 38L4 183M40 46L4 196" stroke="#cfd6e3" stroke-width="2.2"/><path d="M320 30L356 170M320 38L356 183M320 46L356 196" stroke="#cfd6e3" stroke-width="2.2"/></g>' +
  '<rect x="36" y="18" width="8" height="32" rx="2" fill="#2a2d36"/><rect x="316" y="18" width="8" height="32" rx="2" fill="#2a2d36"/>' +
  '<rect x="0" y="150" width="9" height="50" rx="2" fill="#2a2d36"/><rect x="351" y="150" width="9" height="50" rx="2" fill="#2a2d36"/>' +
  '<g fill="none" stroke-linecap="round"><path d="M9 152H351" stroke="#e5322d" stroke-width="3.5" opacity=".95"/><path d="M9 166H351" stroke="#fff" stroke-width="3.5" opacity=".95"/><path d="M9 180H351" stroke="#2f6fe0" stroke-width="3.5" opacity=".95"/></g></svg>';
function ringHTML(tiles, shown, flipKey, mult, k) {
  return '<div class="qsjring" role="list" aria-label="Les 5 cartes indices">' + RING + tiles.map((t, i) => {
    const open = i < shown, flip = flipKey === k + (i + 1);
    return '<div class="qsjc c' + i + (open ? " on" : "") + (flip ? " flip" : "") + '" role="listitem" aria-label="' + (open ? "Indice " + (i + 1) + " : " + esc(t.t) : "Carte " + (i + 1) + " cachée, " + (5 - i) * mult + " points si tu trouves ici") + '"><div class="qsjci">' +
      '<div class="qsjcb"><b>?</b><small>' + (5 - i) * mult + " pt" + ((5 - i) * mult > 1 ? "s" : "") + "</small></div>" +
      '<div class="qsjcf' + (t.sil ? " sil" : "") + '"><span class="qsjcn">' + (i + 1) + "</span>" + (t.img ? '<img src="' + esc(t.img) + '" alt="" loading="lazy">' : "<i>" + esc(t.ic || "•") + "</i>") + "</div></div></div>";
  }).join("") + "</div>";
}
const midnight = () => { const m = 1440 - parisMin(); return Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0"); };
export function qsjView(tab) {
  if (!S.user) return '<section class="qsj"><a class="uvback" href="#/jeux">‹ Jeux</a><h1>Qui suis-je ?</h1><p class="jxlead">Connecte-toi pour jouer : 3 catcheurs à deviner chaque jour, et un classement entre membres.</p><a class="btn" href="#/connexion">Se connecter</a></section>';
  qsjLoad();
  const Q = S.qsj || {};
  if (Q.st !== "ok") return '<section class="qsj"><a class="uvback" href="#/jeux">‹ Jeux</a><h1>Qui suis-je ?</h1><p class="jxlead" role="status">' + (Q.st === "err" ? "Chargement impossible (" + esc(Q.err || "") + "). " + '<button type="button" class="btn" data-act="qsjretry">Réessayer</button>' : "Chargement…") + "</p></section>";
  if (tab === "modo" && S.realAdmin) return modoView();
  const day = today(), P = picks(day), doc = myDoc();
  const st = k => stOf(doc, day, k), first = (LV.find(l => !(st(l[0]) || [])[1]) || LV[0])[0], k = S.qsjLvl && P[S.qsjLvl] ? S.qsjLvl : first, p = P[k], s = st(k) || [1, 0, 0, []], mult = MULT[k];
  const totDay = LV.reduce((a, l) => a + ((st(l[0]) || [])[2] || 0), 0), allDone = LV.every(l => (st(l[0]) || [])[1]);
  let h = '<section class="qsj"><a class="uvback" href="#/jeux">‹ Jeux</a><header class="qsjh"><h1>Qui suis-je ?</h1><p>Trouve le catcheur caché. Moins tu retournes de tuiles, plus tu gagnes de points.</p><span class="qsjclk">Nouveaux catcheurs dans ' + midnight() + "</span></header>" +
    '<nav class="qsjlv" aria-label="Difficulté">' + LV.map(l => { const x = st(l[0]); return '<button type="button" class="qsjl' + (l[0] === k ? " on" : "") + (x && x[1] === 1 ? " ok" : x && x[1] === 2 ? " ko" : "") + '" data-act="qsjlv" data-k="' + l[0] + '" aria-pressed="' + (l[0] === k) + '"><b>' + l[1] + "</b><small>" + (x && x[1] ? (x[1] === 1 ? "✓ " + x[2] + " pts" : "✗ raté") : "×" + l[2]) + "</small></button>"; }).join("") + "</nav>";
  if (!p) h += '<p class="qsjempty">Pas de catcheur pour ce niveau aujourd’hui.</p>';
  else {
    const done = s[1], shown = done ? 5 : s[0];
    h += ringHTML(p.tiles, shown, S.qsjFlip, mult, k) + '<ol class="qsjtiles">' + p.tiles.map((t, i) => i < shown ? tileHTML(t, i, true, S.qsjFlip === k + (i + 1), mult) : "").reverse().join("") + "</ol>";
    if (!done) h += '<form class="qsjf" data-form="qsjguess" data-k="' + k + '" autocomplete="off"><label class="sr-only" for="qsjin">Qui est-ce ?</label><input id="qsjin" name="g" type="search" placeholder="Qui suis-je ? Écris un nom…" autocomplete="off" spellcheck="false"><div id="qsjsug" class="qsjsug"></div>' +
      '<div class="qsjbt"><button class="btn primary">Valider</button><button type="button" class="btn" data-act="qsjpass" data-k="' + k + '">Je passe</button></div>' + ((s[3] || []).length ? '<p class="qsjno">Déjà essayé : ' + s[3].map(esc).join(", ") + "</p>" : "") + "</form>";
    else { const won = s[1] === 1, w = S.qsjWin && S.qsjWin.k === k;
      h += '<div class="qsjrev' + (won ? " ok" : " ko") + (w ? " new" : "") + '"><img src="' + esc(p.c.pic) + '" alt=""><div><small>' + (won ? "Bravo, trouvé à l’indice " + s[0] + " !" : "Raté… c’était :") + '</small><b><a href="#/catcheur/' + encodeURIComponent(p.c.rn || p.c.name) + '">' + esc(p.c.name) + "</a></b>" + (won ? "<p>+" + s[2] + " pts · +" + s[2] * GIM + " 🎟️ gimmicks au TCCCG</p>" : "<p>0 point cette fois.</p>") + "</div></div>";
      const nx = LV.find(l => !(st(l[0]) || [])[1]); if (nx) h += '<button type="button" class="btn primary qsjnext" data-act="qsjlv" data-k="' + nx[0] + '">Catcheur suivant : ' + nx[1] + "</button>"; }
  }
  h += '<div class="qsjday"><span>Aujourd’hui : <b>' + totDay + " / 30</b></span>" + (LV.some(l => (st(l[0]) || [])[1]) ? '<button type="button" class="btn" data-act="qsjshare">Partager dans la Gorilla Position</button>' : "") + "</div>" + (allDone ? '<p class="qsjnote">Reviens après minuit pour 3 nouveaux catcheurs.</p>' : "");
  // hier
  const yd = prevDay(day), Y = picks(yd);
  h += '<h2 class="qsjh2">Hier, c’était…</h2><div class="qsjy">' + LV.map(l => { const y = Y[l[0]], x = stOf(doc, yd, l[0]); return y ? '<a class="qsjyc" href="#/catcheur/' + encodeURIComponent(y.c.rn || y.c.name) + '"><img src="' + esc(y.c.pic) + '" alt="" loading="lazy"><small>' + l[1] + "</small><b>" + esc(y.c.name) + "</b><i>" + (x && x[1] === 1 ? "✓ " + x[2] + " pts" : x && x[1] === 2 ? "✗ raté" : x ? "pas fini" : "pas joué") + "</i></a>" : ""; }).join("") + "</div>";
  // classement
  const L = (Q.list || []).filter(x => x.pts > 0), me = S.user.uid, rank = L.findIndex(x => x.uid === me);
  h += '<h2 class="qsjh2">Classement de tous les temps</h2>' + (L.length ? '<ol class="qsjrank">' + L.slice(0, 30).map((x, i) => '<li class="' + (x.uid === me ? "me" : "") + '"><span>' + (i + 1) + '</span><a href="#/profil/' + esc(x.uid) + '">' + esc(x.name || "Membre") + "</a><small>" + x.n + " trouvé" + (x.n > 1 ? "s" : "") + "</small><b>" + x.pts + " pts</b></li>").join("") + "</ol>" + (rank >= 30 ? '<p class="qsjnote">Toi : ' + (rank + 1) + "e avec " + L[rank].pts + " pts.</p>" : "") : '<p class="qsjnote">Personne n’a encore de points : sois le premier !</p>');
  if (S.realAdmin) h += '<a class="btn" href="#/qsj/modo">Modo : choisir les catcheurs des prochains jours</a>';
  return h + "</section>";
}
ACT.qsjretry = () => qsjLoad(true);

// ---------- modo : changer un catcheur du jour (Firestore qsj/{jour}) ----------
function modoView() {
  const d0 = today(), Q = S.qsj, days = []; for (let i = 0; i <= 7; i++) days.push(addDay(d0, i));
  return '<section class="qsj"><a class="uvback" href="#/qsj">‹ Qui suis-je ?</a><h1>Choisir les catcheurs</h1><p class="jxlead">Par défaut, l’app tire les catcheurs au sort. Tu peux en changer un à l’avance. Attention pour aujourd’hui : ceux qui ont déjà commencé verront le nouveau catcheur.</p>' +
    days.map(d => { const P = picks(d), ov = Q.days[d] || {}; return '<div class="qsjmd"><h2 class="qsjh2">' + (d === d0 ? "Aujourd’hui · " : "") + dTxt(d) + "</h2>" + LV.map(l => { const p = P[l[0]]; return '<div class="qsjmr">' + (p ? '<img src="' + esc(p.c.pic) + '" alt="">' : "") + '<span><small>' + l[1] + (ov[l[0]] ? " · choisi par toi" : " · tirage auto") + "</small><b>" + esc(p ? p.c.name : "—") + '</b></span><button type="button" class="btn" data-act="qsjmset" data-d="' + d + '" data-k="' + l[0] + '">Changer</button>' + (ov[l[0]] ? '<button type="button" class="btn" data-act="qsjmauto" data-d="' + d + '" data-k="' + l[0] + '">Tirage auto</button>' : "") + "</div>"; }).join("") + "</div>"; }).join("") + "</section>";
}
function setOv(d, k, name) {
  const Q = S.qsj, cur = Object.assign({}, Q.days[d] || {}); if (name) cur[k] = name; else delete cur[k];
  const o = Object.keys(cur).length ? cur : null;
  B.qsjSetDay(d, o).then(() => { if (o) Q.days[d] = o; else delete Q.days[d]; toast("Enregistré"); changed("qsj"); }).catch(e => toast("Impossible : " + ((e && e.message) || "erreur")));
}
ACT.qsjmauto = el => setOv(el.dataset.d, el.dataset.k, "");
ACT.qsjmset = el => {
  const d = el.dataset.d, k = el.dataset.k, all = baseCards().filter(x => !x.nopic && !x.custom && x.pic);
  modal((box, close) => {
    box.innerHTML = "<h3>Catcheur à faire deviner</h3><input class=\"qsjmin\" type=\"search\" placeholder=\"Chercher un nom…\" aria-label=\"Chercher un nom\"><div class=\"qsjml\"></div><button type=\"button\" class=\"btn\" data-x=\"1\">Fermer</button>";
    const paint = q => { const n = N(q); box.querySelector(".qsjml").innerHTML = all.filter(x => !n || N(x.name).indexOf(n) >= 0).slice(0, 40).map(x => '<button type="button" class="qsjmp" data-n="' + esc(x.rn || x.name) + '"><img src="' + esc(x.pic) + '" alt="" loading="lazy"><span>' + esc(x.name) + "<small>" + realClues(x).all + " indices · rareté " + esc(x.r) + "</small></span></button>").join(""); };
    paint(""); box.querySelector("input").addEventListener("input", e => paint(e.target.value));
    box.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.x) close(); if (b.dataset.n) { close(); setOv(d, k, b.dataset.n); } });
  });
};
// tuile de l'onglet Jeux : fait aujourd'hui ?
export function qsjDone() { const Q = S.qsj; if (!S.user || !Q || Q.st !== "ok") return null; const doc = myDoc(), d = today(); return LV.filter(l => (stOf(doc, d, l[0]) || [])[1]).length; }
