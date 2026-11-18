// Mode Univers : petites fonctions partagées par la simulation et les écrans (fédération du joueur, catcheurs, courrier, actu,
// buzz, relations d'amitié / rivalité, qualité du staff, trophées).
import { clamp, rnd, uid, hash } from "./world.js";
import { ACH } from "./data.js";

export const cap = (a, n) => { if (a.length > n) a.splice(0, a.length - n); };
export const meF = G => G.F[G.me];
export const wOf = (G, id) => G.W[id];
export const wn = (G, id) => (G.W[id] || (G.staff || {})[id] || {}).n || "?";
export const ini = n => String(n || "?").split(/\s+/).map(x => x[0]).join("").slice(0, 2).toUpperCase();
export const e_ = w => (w && w.sx === "f" ? "e" : "");
// catcheurs actifs d'une fédération (prêtés chez nous compris)
export const roster = (G, fed) => { fed = fed || G.me; return Object.values(G.W).filter(w => !w.ret && (w.fed === fed || (w.guest && w.guest.to === fed && w.guest.until >= G.day))); };
export const injured = (G, w) => !!(w && w.inj && w.inj.until > G.day && !w.inj.play);
// disponible pour un show : pas blessé, pas absent, pas suspendu, pas au placard ; un non exclusif est parfois sur le circuit indé
export const avail = (G, w, day) => {
  if (!w || w.ret) return false; const d = day == null ? G.day : day;
  if (w.inj && w.inj.until > d && !w.inj.play) return false;
  if (w.off && w.off > d) return false; if (w.susp && w.susp > d) return false; if (w.bench) return false;
  if (w.ct && w.ct.exc === false && (hash(w.id + "|" + d) % 10) < 3) return false;
  return true;
};
export const why = (G, w) => !w ? "" : w.ret ? "retraité" + e_(w) : w.inj && w.inj.until > G.day && !w.inj.play ? "blessé" + e_(w) : w.off > G.day ? "absent" + e_(w) : w.susp > G.day ? "suspendu" + e_(w) : w.bench ? "au placard" : w.ct && w.ct.exc === false && !avail(G, w) ? "sur le circuit indé ce jour-là" : "";
export const risk = w => w.en >= 60 ? ["faible", "ok"] : w.en >= 35 ? ["moyen", "mid"] : ["élevé", "ko"];
export const teamName = (G, ids) => (ids || []).map(i => wn(G, i)).join(" et ");
export const sideName = (G, sides) => (sides || []).map(s => teamName(G, s)).join(" contre ");

// ---------- courrier, actu, buzz ----------
export function mail(G, m) {
  G.seq = (G.seq || 1) + 1;
  const x = Object.assign({ id: "m" + G.seq, d: G.day, read: false, done: "" }, m);
  G.mail.push(x); cap(G.mail, 200); G._new = (G._new || 0) + (m.imp === false ? 0 : 1); return x;
}
export function news(G, n) { G.news.push(Object.assign({ d: G.day }, n)); cap(G.news, 260); }
export function buzz(G, b) { G.buzz.push(Object.assign({ d: G.day, n: Math.round(200 + rnd() * 3000), id: "b" + (G.seq = (G.seq || 1) + 1) }, b)); cap(G.buzz, 150); }
export const FANS = ["@ringside_lea", "@prise_du_mois", "@fan_de_catch", "@luchalibre_fr", "@top_rope_tom", "@kayfabe_kev", "@ma_ceinture", "@dropkick_sam", "@la_3e_corde"];

// ---------- amitié / rivalité (−100 grands rivaux … +100 meilleurs amis) ----------
const rk = (a, b) => a < b ? a + "|" + b : b + "|" + a;
export const relGet = (G, a, b) => (G.rel || {})[rk(a, b)] || 0;
export function relAdd(G, a, b, v) {
  if (!a || !b || a === b) return 0; G.rel = G.rel || {};
  const k = rk(a, b), n = Math.max(-100, Math.min(100, Math.round(((G.rel[k] || 0) + v) * 10) / 10));
  if (Math.abs(n) < 0.5) delete G.rel[k]; else G.rel[k] = n; return n;
}
export function relsOf(G, id) {
  const out = []; Object.keys(G.rel || {}).forEach(k => { const p = k.split("|"); if (p[0] === id || p[1] === id) out.push({ id: p[0] === id ? p[1] : p[0], v: G.rel[k] }); });
  return out.sort((a, b) => b.v - a.v);
}

// ---------- staff de la fédération du joueur ----------
export const myStaff = (G, role) => Object.values(G.staff || {}).filter(s => s.fed === G.me && (!role || s.role === role) && !(s.susp > G.day));
// qualité du staff d'un rôle (0 si personne) : le meilleur compte pour 70 %, les autres un peu
export function staffQ(G, role) { const L = myStaff(G, role).map(s => s.q).sort((a, b) => b - a); if (!L.length) return 0; return Math.round(L[0] * 0.7 + (L.length > 1 ? L[1] * 0.3 : L[0] * 0.3)); }

// ---------- trophées ----------
export function ach(G, id) {
  G.ach = G.ach || {}; if (G.ach[id] || !ACH[id]) return false;
  G.ach[id] = G.day; G._ach = (G._ach || []).concat(id);
  mail(G, { k: "info", from: "Trophées", role: "Mode Univers", c: "#f5b13d", ini: "🏆", subj: "Trophée débloqué : " + ACH[id][0], body: ACH[id][1] + ".", imp: false });
  return true;
}
export const isBig = ev => ev && (ev.kind === "ple" || ev.kind === "ppv");
export const champIds = t => !t ? [] : Array.isArray(t.champ) ? t.champ.filter(Boolean) : t.champ ? [t.champ] : [];
export const newId = p => uid(p);
export const sxOk = (cat, ids, G) => cat === "x" || ids.every(i => G.W[i] && G.W[i].sx === cat);
export const kp = v => clamp(v, -100, 100);
