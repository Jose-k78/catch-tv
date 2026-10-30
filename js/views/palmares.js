// Palmarès d'un catcheur (titres des 9 promotions, nombre de règnes, durée totale) et lignée d'un titre.
// Les règnes viennent de data/titles.json : règne actuel (c, who, since) + champions précédents (hist : c, who, d, j = jours).
// La mise à jour du soir complète l'historique de chaque titre ; en attendant, l'app compte avec ce qu'elle connaît.
// Le champ « tt » d'une fiche (data/wrestlers.json) peut donner le palmarès complet : [{ t, k, x (fois), j (jours) }].
// Toujours derrière un bouton spoiler (un palmarès dévoile les changements de titre récents).
import { S } from "../state.js";
import { esc, today, dt, okDay } from "../util.js";
import { norm, wInfo } from "../wrestlers.js";
import { peopleOf } from "../photos.js";
import { beltOf } from "../assets.js";

const clean = s => String(s || "").replace(/\s*\(.*\)$/, "").trim();
// les catcheurs d'un règne : who, sinon « Équipe (A et B) », sinon c
function holders(r) {
  if (Array.isArray(r.who) && r.who.length) return r.who.map(clean);
  const m = String(r.c || "").match(/^(.+?)\s*\((.+)\)$/);
  return m ? peopleOf(m[2]).concat([m[1]]) : [clean(r.c)];
}
// règnes d'un titre, du plus récent au plus ancien, avec leur durée en jours
export function reignsOf(t) {
  const list = [];
  if (t.c) list.push({ c: t.c, who: t.who, d: t.since, ev: t.ev, cur: true });
  (Array.isArray(t.hist) ? t.hist : []).forEach(x => { if (x && x.c) list.push(x); });
  list.sort((a, b) => String(b.d || "").localeCompare(String(a.d || "")));
  const now = today();
  list.forEach((r, i) => {
    if (typeof r.j === "number") { r.days = r.j; return; }
    if (!okDay(r.d)) { r.days = null; return; }
    const end = r.cur ? now : (i > 0 && okDay(list[i - 1].d) ? dt(list[i - 1].d) : null);
    r.days = end ? Math.max(0, Math.round((end - dt(r.d)) / 864e5)) : null;
  });
  return list;
}
// records d'un titre : plus long règne, le plus de règnes
export function recordsOf(t) {
  const rs = reignsOf(t), cnt = {};
  let longest = null;
  rs.forEach(r => {
    if (r.days != null && (!longest || r.days > longest.days)) longest = r;
    const k = clean(r.c); cnt[k] = (cnt[k] || 0) + 1;
  });
  const most = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
  return { n: rs.length, longest: longest, most: most && cnt[most] > 1 ? { c: most, x: cnt[most] } : null };
}
export const daysTxt = n => (n == null ? "durée à confirmer" : n.toLocaleString("fr-FR") + " jour" + (n > 1 ? "s" : ""));

// palmarès calculé : { id, t, k, x, j, cur }
export function palmaresOf(name) {
  const w = wInfo(name), keys = [name].concat(w ? [w.name].concat(Array.isArray(w.a) ? w.a : []) : []).map(n => norm(clean(n))).filter(Boolean);
  if (w && Array.isArray(w.tt) && w.tt.length) return w.tt.map(x => ({ id: x.id || "", t: x.t, k: x.k, x: x.x, j: x.j, cur: !!x.cur })).filter(x => x.t);
  const out = [];
  (S.titles || []).forEach(t => {
    let x = 0, j = 0, unknown = false, cur = false;
    reignsOf(t).forEach(r => {
      if (!holders(r).some(h => keys.indexOf(norm(h)) >= 0)) return;
      x++; if (r.days == null) unknown = true; else j += r.days; if (r.cur) cur = true;
    });
    if (x) out.push({ id: t.id, t: t.n, k: t.k, x: x, j: unknown && !j ? null : j, cur: cur });
  });
  return out.sort((a, b) => (b.cur - a.cur) || (b.x - a.x) || ((b.j || 0) - (a.j || 0)));
}

export function palmaresHTML(name) {
  const p = palmaresOf(name), w = wInfo(name), full = !!(w && Array.isArray(w.tt) && w.tt.length);
  let h = "<h2>🏆 Palmarès</h2>";
  if (!p.length) return h + '<p class="note">Pas encore de titre enregistré pour ' + esc(name) + " dans l’app (9 promotions). La mise à jour du soir complète les palmarès.</p>";
  const rows = p.map(x => '<a class="item palm" href="' + (x.id ? "#/titre/" + encodeURIComponent(x.id) : "#/recherche/" + encodeURIComponent(x.t)) + '">' +
    (x.id && beltOf(x.id) ? '<img class="glogo0" src="' + esc(beltOf(x.id)) + '" alt="" loading="lazy">' : '<span class="wnone">🏆</span>') +
    '<span class="lbl"><b>' + esc(x.t) + "</b><small>" + esc(x.k) + " · " + x.x + " fois · " + daysTxt(x.j) + (x.cur ? " · champion actuel" : "") + '</small></span><span class="chev">›</span></a>').join("");
  return h + '<div class="spoil"><button class="btn ghost spoilbtn" data-act="reveal">👀 Voir son palmarès (' + p.length + " titre" + (p.length > 1 ? "s" : "") + ", spoiler)</button>" +
    '<div class="spoilbody"><div class="list">' + rows + "</div>" + (full ? "" : '<p class="note small">D’après les règnes connus par l’app ; la mise à jour du soir complète l’historique de chaque titre.</p>') + "</div></div>";
}
