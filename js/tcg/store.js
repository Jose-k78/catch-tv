// TCCCG — partie du joueur, gardée dans Firebase (tcg/{uid}) : tout le monde commence à zéro.
// { v, lvl (1-50), xp, res: { money, mom, pop, push, gim }, items: { id: n }, medals: { nom: n },
//   cards: { iid: { c: id carte, r: rareté actuelle, lv, xp } }, free: jour du booster gratuit, tuto, cool: { combat: ms }, opened, wins, fav }
import { S, B, changed } from "../state.js";
import { toast } from "../util.js";
import { RAR, LVMAX, defOf } from "./data.js";

export const ZERO = () => ({ v: 1, lvl: 1, xp: 0, res: { money: 0, mom: 0, pop: 0, push: 0, gim: 0 }, items: {}, medals: {}, cards: {}, free: "", tuto: false, cool: {}, opened: 0, wins: 0, fav: [], esc: {} });
export function me() {
  const d = S.tcg ? JSON.parse(JSON.stringify(S.tcg)) : ZERO(), z = ZERO();
  Object.keys(z).forEach(k => { if (d[k] == null) d[k] = z[k]; });
  d.res = Object.assign(z.res, d.res || {});
  delete d.at;
  return d;
}
let saveT = null, pending = null;
// modifie la partie et l'enregistre (affichage immédiat, envoi groupé)
export function commit(fn) {
  const d = me(); fn(d);
  d.name = String((S.profile && S.profile.pseudo) || d.name || "Joueur").slice(0, 30);
  S.tcg = d; changed("tcg");
  pending = d; clearTimeout(saveT);
  saveT = setTimeout(() => { const x = pending; pending = null; if (S.user && x) B.saveTcg(S.user.uid, x).catch(e => toast("Partie non enregistrée : " + (e && e.message || "erreur"), { ms: 4000 })); }, 600);
  return d;
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
export function addInst(d, x) { if (!x || !defOf(x.c)) return null; const iid = Date.now().toString(36) + (seq++).toString(36) + Math.floor(Math.random() * 1e4).toString(36); d.cards[iid] = { c: x.c, r: RAR.indexOf(x.r) >= 0 ? x.r : defOf(x.c).r, lv: +x.lv || 1, xp: +x.xp || 0 }; return iid; }
export const RES = ["money", "mom", "pop", "push", "gim"];
export const RICO = { money: "💵", mom: "⚡", pop: "⭐", push: "📣", gim: "🎟️" };
