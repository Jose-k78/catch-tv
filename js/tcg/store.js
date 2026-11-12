// TCCCG — partie du joueur, gardée dans Firebase (tcg/{uid}) : tout le monde commence à zéro.
// { v, lvl (1-50), xp, res: { money, mom, pop, push, gim }, items: { id: n }, medals: { nom: n },
//   cards: { iid: { c: id carte, r: rareté actuelle, lv, xp } }, free: jour du booster gratuit, tuto, cool: { combat: ms }, opened, wins, fav }
import { S, B, changed } from "../state.js";
import { toast } from "../util.js";
import { parisDay } from "../time.js";
import { RAR, LVMAX, defOf } from "./data.js";

export const ZERO = () => ({ v: 1, lvl: 1, xp: 0, res: { money: 0, mom: 0, pop: 0, push: 0, gim: 0 }, items: {}, medals: {}, cards: {}, free: "", tuto: false, cool: {}, opened: 0, wins: 0, fav: [], esc: {} });
export function me() {
  const d = S.tcg ? JSON.parse(JSON.stringify(S.tcg)) : ZERO(), z = ZERO();
  Object.keys(z).forEach(k => { if (d[k] == null) d[k] = z[k]; });
  d.res = Object.assign(z.res, d.res || {});
  delete d.at;
  return d;
}
let saveT = null, pending = null, waitQ = [];
// Protection de la partie (11 nov., Jose a perdu la sienne) : tant que la vraie partie n'est pas arrivée de Firebase
// (S.tcgReady), rien n'est enregistré — les changements attendent. Et on n'enregistre jamais une partie « en recul »
// (niveau ou boosters ouverts plus bas que la dernière version connue sur le serveur, S.tcgSrv).
export const cleanSave = d => { const o = {}; ["v", "lvl", "xp", "res", "items", "medals", "cards", "free", "tuto", "cool", "opened", "wins", "fav", "mis", "mday", "name", "esc"].forEach(k => { if (d && d[k] != null) o[k] = JSON.parse(JSON.stringify(d[k])); }); o.lvl = Math.max(1, Math.min(50, Math.round(+o.lvl || 1))); return o; };
export const behind = (x, srv) => !!srv && ((+x.lvl || 1) < (+srv.lvl || 1) || (+x.opened || 0) < (+srv.opened || 0));
export function flushWait() { const q = waitQ; waitQ = []; q.forEach(fn => commit(fn)); }
// modifie la partie et l'enregistre (affichage immédiat, envoi groupé)
export function commit(fn) {
  if (S.user && !S.tcgReady) { waitQ.push(fn); toast("Ta partie TCCCG se charge : ce sera enregistré dès qu’elle est là", { ms: 3000 }); return me(); }
  const d = me(); fn(d);
  d.name = String((S.profile && S.profile.pseudo) || d.name || "Joueur").slice(0, 30);
  S.tcg = d; changed("tcg");
  pending = d; clearTimeout(saveT);
  saveT = setTimeout(() => {
    const x = pending; pending = null; if (!S.user || !x) return;
    if (behind(x, S.tcgSrv)) { toast("⚠️ Sauvegarde bloquée : la partie affichée était en retard sur ta vraie partie. Rien n’est perdu, recharge la page.", { ms: 6000 }); S.tcg = JSON.parse(JSON.stringify(S.tcgSrv)); changed("tcg"); return; }
    B.saveTcg(S.user.uid, x).catch(e => toast("Partie non enregistrée : " + (e && e.message || "erreur"), { ms: 4000 })); }, 600);
  return d;
}
// compteurs du jour pour les missions (gardés dans d.mis.cnt : { d: jour, open, win, train… })
export function bump(d, k, n) {
  const day = parisDay();
  d.mis = d.mis && typeof d.mis === "object" ? d.mis : {};
  if (!d.mis.cnt || d.mis.cnt.d !== day) d.mis.cnt = { d: day };
  d.mis.cnt[k] = (d.mis.cnt[k] || 0) + (n || 1);
}
export const XP_LV = lv => 100 + lv * 60; // XP pour passer au niveau suivant (joueur)
export function addXp(d, n) { d.xp += n; let up = 0; while (d.lvl < 50 && d.xp >= XP_LV(d.lvl)) { d.xp -= XP_LV(d.lvl); d.lvl++; up++; } return up; }
export const CXP = lv => 40 + lv * 12; // XP d'une carte pour monter d'un niveau
export function cardXp(inst, n) { const max = LVMAX[inst.r] || 50; inst.xp = (inst.xp || 0) + n; let up = 0; while (inst.lv < max && inst.xp >= CXP(inst.lv)) { inst.xp -= CXP(inst.lv); inst.lv++; up++; } if (inst.lv >= max) inst.xp = 0; return up; }
let seq = 0;
export function addCard(d, id) {
  const def = defOf(id); if (!def) return null;
  const iid = Date.now().toString(36) + (seq++).toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  d.cards[iid] = { c: id, r: def.r, lv: 1, xp: 0 };
  return iid;
}
export const owned = d => Object.keys(d.cards).map(iid => Object.assign({ iid: iid }, d.cards[iid])).filter(x => defOf(x.c));
export const rIdx = r => RAR.indexOf(r);
// boosters gratuits : 3 par tranche de 5 heures. d.free = "tranche:nombre ouverts:dernier jour"
export const FREE_N = 3, FREE_MS = 5 * 36e5;
export const freeWin = () => Math.floor(Date.now() / FREE_MS);
export function freeLeft(d) { const p = String(d.free || "").split(":"); return +p[0] === freeWin() ? Math.max(0, FREE_N - (+p[1] || 0)) : FREE_N; }
export const freeNextMs = () => (freeWin() + 1) * FREE_MS - Date.now();
export function useFree(d, day) { const left = freeLeft(d); d.free = freeWin() + ":" + (FREE_N - left + 1) + ":" + day; }
export const freeToday = (d, day) => String(d.free || "").split(":")[2] === day;
// copie d'un exemplaire reçu (échange, enchère) dans la partie
export function addInst(d, x) { if (!x || !defOf(x.c)) return null; const iid = Date.now().toString(36) + (seq++).toString(36) + Math.floor(Math.random() * 1e4).toString(36); d.cards[iid] = { c: x.c, r: RAR.indexOf(x.r) >= 0 ? x.r : defOf(x.c).r, lv: +x.lv || 1, xp: +x.xp || 0 }; if (x.pw) d.cards[iid].pw = String(x.pw).slice(0, 12); if (Array.isArray(x.tr)) d.cards[iid].tr = x.tr.slice(0, 5).map(v => Math.max(0, Math.min(25, +v || 0))); if (x.trn) d.cards[iid].trn = Math.min(5, +x.trn || 0); if (x.eq && typeof x.eq === "string") d.cards[iid].eq = x.eq.slice(0, 30); return iid; }
export const RES = ["money", "mom", "pop", "push", "gim"];
export const RICO = { money: "💵", mom: "⚡", pop: "⭐", push: "📣", gim: "🎟️" };

// copies sur ce téléphone (en plus de celles du robot dans Firebase) : la dernière, la plus avancée, une par jour (2 jours)
const LK = uid => "ctv.tcgbak." + uid;
export const scoreOf = d => [+d.lvl || 1, +d.opened || 0, +d.wins || 0, Object.keys(d.cards || {}).length];
export const atLeast = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]; return true; };
let lastKeep = 0;
export function keepLocal(uid, d) {
  if (!uid || !d || (!Object.keys(d.cards || {}).length && (+d.lvl || 1) <= 1 && !(+d.opened))) return;
  try {
    const k = LK(uid), o = JSON.parse(localStorage.getItem(k) || "{}"), c = { at: Date.now(), d: cleanSave(d) }, day = new Date().toISOString().slice(0, 10);
    const best = !o.best || atLeast(scoreOf(d), scoreOf(o.best.d));
    if (!best && o.days && o.days[day] && Date.now() - lastKeep < 30e3) return;
    lastKeep = Date.now(); o.last = c; if (best) o.best = c;
    o.days = o.days || {}; if (!o.days[day]) o.days[day] = c; Object.keys(o.days).sort().slice(0, -2).forEach(x => { delete o.days[x]; });
    localStorage.setItem(k, JSON.stringify(o));
  } catch (e) {}
}
export function localCopies(uid) { try { return JSON.parse(localStorage.getItem(LK(uid)) || "{}"); } catch (e) { return {}; } }
