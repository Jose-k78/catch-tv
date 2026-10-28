// Données d'un catcheur : fiche suivie (data/wrestlers.json), shows, prochain combat, derniers matchs, actu
import { S } from "./state.js";
import { diff, okHttp, okDay } from "./util.js";
import { allPle, epis, recapOf, articles } from "./views/catalog.js";
import { okVid } from "./views/highlights.js";

export const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, "'").trim();

export function wInfo(name) {
  const n = norm(name), W = S.wrestlers || {};
  for (const k of Object.keys(W)) {
    const w = W[k]; if (!w) continue;
    if (norm(k) === n || (Array.isArray(w.a) && w.a.some(a => norm(a) === n))) return Object.assign({ name: k }, w);
  }
  return null;
}
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
      out.push({ k: p[0], show: p[1], d: p[2], ev: p[1] === "PLE" ? "" : p[1], t: "", r: res.join(" · "), v: vid ? vid.id : "", vt: vid ? vid.t : "" });
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
