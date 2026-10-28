// Données d'un catcheur : fiche suivie (data/wrestlers.json), shows, prochain combat, derniers matchs, actu
import { S } from "./state.js";
import { diff, okHttp, okDay } from "./util.js";
import { allPle, epis, recapOf, articles } from "./views/catalog.js";
import { okVid } from "./views/highlights.js";

export const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, "'").trim();

// index nom (et autres noms) -> clé de la fiche, reconstruit quand les données changent
let idx = null, idxOf = null;
function index() {
  const W = S.wrestlers || {};
  if (idxOf === W && idx) return idx;
  idx = new Map(); idxOf = W;
  Object.keys(W).forEach(k => { const w = W[k]; if (!w) return; if (!idx.has(norm(k))) idx.set(norm(k), k); (Array.isArray(w.a) ? w.a : []).forEach(a => { if (!idx.has(norm(a))) idx.set(norm(a), k); }); });
  return idx;
}
export function wInfo(name) {
  const k = index().get(norm(name)), W = S.wrestlers || {};
  return k && W[k] ? Object.assign({ name: k }, W[k]) : null;
}
// Face / heel / tweener (d'après The SmackDown Hotel, préparé par la mise à jour quotidienne)
export const ALIGN = { face: ["😇", "Face", "gentil"], heel: ["😈", "Heel", "méchant"], tweener: ["🔀", "Tweener", "entre les deux"] };
export function alignOf(name) { const w = wInfo(name), a = w && String(w.al || "").toLowerCase(); return ALIGN[a] ? { k: a, since: w.alD || "", inj: !!w.inj } : (w && w.inj ? { k: "", since: "", inj: true } : null); }
// Promotion reconnue dans un texte (« World Wrestling Federation » -> WWE…)
const PROMOS = [["WWE", /\bwwe\b|\bwwf\b|world wrestling/], ["AEW", /\baew\b|all elite/], ["TNA", /\btna\b|total nonstop|impact wrestling/], ["NJPW", /\bnjpw\b|new japan/],
  ["Stardom", /stardom/], ["Marigold", /marigold/], ["AAA", /\baaa\b|asistencia asesoria|lucha libre aaa/], ["CMLL", /\bcmll\b|consejo mundial/], ["ROH", /ring of honor|\broh\b/], ["WCW", /\bwcw\b|world championship wrestling/],
  ["ECW", /\becw\b|extreme championship/], ["NWA", /\bnwa\b|national wrestling alliance/], ["NOAH", /pro wrestling noah/], ["All Japan", /all japan/]];
export const promoIn = txt => { const t = norm(txt), f = PROMOS.find(p => p[1].test(t)); return f ? f[0] : ""; };
// Nom « officiel » (celui de la fiche suivie si elle existe)
export function canonical(name) { const w = wInfo(name); return w ? w.name : String(name).trim(); }
const mentions = (txt, name) => {
  const w = wInfo(name), names = [name].concat(w && w.name ? [w.name] : []).concat(w && Array.isArray(w.a) ? w.a : []);
  const t = norm(txt); return names.some(x => x && t.indexOf(norm(x)) >= 0);
};

// Shows où il ou elle apparaît : fiche, sinon titres détenus, sinon la promotion
export function wShows(name) {
  const w = wInfo(name), out = [];
  if (w && Array.isArray(w.sh)) w.sh.forEach(s => out.push({ k: w.k, n: s }));
  (S.titles || []).forEach(t => {
    const who = (t.who || [t.c]).concat([t.c]);
    if (who.some(x => mentions(x, name))) {
      (t.show ? [t.show] : (t.shows || [])).forEach(s => { if (!out.some(o => o.k === t.k && o.n === s)) out.push({ k: t.k, n: s }); });
      if (!t.show && !(t.shows || []).length && !out.some(o => o.k === t.k)) out.push({ k: t.k, n: "" });
    }
  });
  // rosters : show (Raw, SmackDown…) ou promotion
  Object.keys(S.rosters || {}).forEach(k => { const r = S.rosters[k] || {}; Object.keys(r).forEach(g => {
    if ((r[g] || []).some(x => norm(x) === norm(name))) {
      const isShow = S.P[k] && S.P[k].s && S.P[k].s[g];
      if (isShow && !out.some(o => o.k === k && o.n === g)) out.push({ k: k, n: g });
      else if (!isShow && !out.some(o => o.k === k)) out.push({ k: k, n: "" });
    }
  }); });
  if (!out.length && w && w.k) out.push({ k: w.k, n: "" });
  return out;
}
// Titres détenus
export function wTitles(name) { return (S.titles || []).filter(t => (t.who || [t.c]).some(x => norm(x) === norm(name) || mentions(x, name))); }

// Prochains matchs annoncés (cartes et résumés des événements à venir)
export function upcomingFor(name) {
  let evs = allPle();
  Object.keys(S.P).forEach(k => { const s = S.P[k].s || {}; Object.keys(s).forEach(x => { evs = evs.concat(epis(k, x, 0, 2)); }); });
  return evs.filter(e => e.d && diff(e.d) >= 0).map(e => {
    const line = (e.card || []).find(c => mentions(c, name));
    const r = recapOf(e);
    return line ? Object.assign({ line: line }, e) : (r && mentions(r.txt, name) ? Object.assign({ line: "" }, e) : null);
  }).filter(Boolean).sort((a, b) => diff(a.d) - diff(b.d));
}

// 3 derniers matchs : fiche suivie, sinon déduits des résultats des highlights
export function lastMatches(name, n) {
  n = n || 3;
  const w = wInfo(name);
  let out = (w && Array.isArray(w.last) ? w.last : []).map(x => Object.assign({}, x));
  if (out.length < n) {
    const H = S.highlights || {};
    Object.keys(H).sort((a, b) => b.split("|")[2].localeCompare(a.split("|")[2])).forEach(key => {
      if (out.length >= n) return;
      const h = H[key], p = key.split("|"); if (!h || !okDay(p[2])) return;
      const res = (h.res || []).filter(r => mentions(r, name));
      if (!res.length || out.some(o => o.d === p[2] && o.k === p[0])) return;
      const vid = (h.v || []).find(v => okVid(v.id) && mentions(v.t, name));
      const ple = p[1] === "PLE" && S.P[p[0]] ? (S.P[p[0]].e || []).find(x => x.d === p[2]) : null;
      out.push({ k: p[0], show: p[1], d: p[2], ev: p[1] === "PLE" ? (ple ? ple.t : "") : p[1], t: "", r: res.join(" · "), v: vid ? vid.id : "", vt: vid ? vid.t : "" });
    });
  }
  return out.slice(0, n);
}

// 2-3 news : celles de la fiche (françaises d'abord), sinon les articles de l'app qui le ou la citent
export function wNews(name, n) {
  n = n || 3;
  const w = wInfo(name);
  let list = (w && Array.isArray(w.news) ? w.news : []).filter(a => a && okHttp(a.u) && a.t);
  list.sort((a, b) => (b.fr ? 1 : 0) - (a.fr ? 1 : 0) || String(b.d || "").localeCompare(String(a.d || "")));
  if (list.length < n) articles([], 8, name).forEach(a => { if (list.length < n && !list.some(x => x.u === a.u)) list.push(Object.assign({ fr: true }, a)); });
  return list.slice(0, n);
}

// Dernier show où il ou elle est apparu : résultats et vidéos des highlights, résumés des épisodes passés, fiche suivie
export function lastShow(name) {
  let best = null;
  const take = (k, show, d) => { if (okDay(d) && diff(d) <= 0 && (!best || d > best.d)) best = { k: k, show: show, d: d }; };
  const H = S.highlights || {};
  Object.keys(H).forEach(key => {
    const h = H[key], p = key.split("|"); if (!h) return;
    const txt = (h.res || []).join(" ") + " " + (h.v || []).map(v => v.t).join(" ") + " " + (h.m || []).map(m => m.t + " " + (m.r || "")).join(" ");
    if (mentions(txt, name)) take(p[0], p[1], p[2]);
  });
  const R = S.recaps || {};
  Object.keys(R).forEach(key => { const r = R[key], p = key.split("|"); if (r && typeof r.txt === "string" && mentions(r.txt, name)) take(p[0], p[1], p[2]); });
  const w = wInfo(name);
  if (w && Array.isArray(w.last) && w.last[0] && w.last[0].d) {
    const l = w.last[0], k = w.k || "", sh = l.ev && S.P[k] && S.P[k].s && S.P[k].s[l.ev] ? l.ev : "PLE";
    take(k, sh, l.d);
  }
  if (!best) return null;
  const pr = S.P[best.k], isPle = best.show === "PLE";
  let title = best.show;
  if (pr && isPle) { const e = (pr.e || []).find(x => x.d === best.d); title = e ? e.t : "PLE"; }
  const H2 = H[best.k + "|" + best.show + "|" + best.d];
  const href = H2 ? "#/hl/" + encodeURIComponent(best.k) + "/" + encodeURIComponent(best.show) + "/" + best.d
    : "#/p/" + encodeURIComponent(best.k) + (isPle ? "" : "/" + encodeURIComponent(best.show));
  const MO = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."], p = best.d.split("-");
  return Object.assign(best, { label: (isPle ? title : best.k + " " + title) + " · " + (+p[2]) + " " + MO[+p[1] - 1], href: href });
}

// Noms connus de l'app (fiches suivies, catcheurs à découvrir, champions) pour les suggestions de recherche
export function knownNames() {
  const out = [], seen = {};
  const add = (n, s, a) => { const k = norm(n); if (!n || seen[k]) return; seen[k] = 1; out.push({ n: n, s: s, a: a || [] }); };
  const W = S.wrestlers || {};
  Object.keys(W).forEach(k => { const w = W[k] || {}; add(k, [w.k, w.era].filter(Boolean).join(" · ") || "Fiche catcheur", w.a); });
  (S.titles || []).forEach(t => (t.who || []).forEach(x => add(x, t.k + " · " + t.n)));
  Object.keys(S.rosters || {}).forEach(k => { const r = S.rosters[k] || {}; Object.keys(r).forEach(g => (r[g] || []).forEach(x => add(x, k + " · " + g))); });
  return out;
}
