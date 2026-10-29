// Titres : champions actuels par promotion / show, historique d'un titre
import { S, ACT } from "../state.js";
import { esc, ICON, fmt, today, dt, okHttp, okDay, shAttr } from "../util.js";
import { titlesFor, plain, colorOf } from "./catalog.js";
import { champHidden, unlock, noSpoil } from "../spoil.js";
import { resultWinner } from "./mrate.js";
import { norm, linkNames } from "../wrestlers.js";
import { hlHref } from "./highlights.js";

// ---------- défenses de titre ----------
// +1 à chaque résultat de show télévisé ou de PLE où le champion « conserve » son titre (pas les live events) ;
// remis à zéro au changement de champion. La mise à jour quotidienne range le compte dans titles.json (def, defs) ;
// sinon l'app le retrouve elle-même dans les résultats depuis le début du règne.
const KEEP = /\b(?:conserve|conservent|garde|gardent|retain|retains|retained|retaining)\b/i;
const whoOf = t => (Array.isArray(t.who) && t.who.length ? t.who : [t.c]).map(x => norm(String(x).replace(/\s*\(.*\)$/, ""))).filter(Boolean);
const team = t => { const m = String(t.c || "").match(/^(.+?)\s*\(/); return m ? norm(m[1]) : ""; };
export function defensesOf(t) {
  if (Array.isArray(t.defs)) return t.defs.filter(x => x && (!okDay(t.since) || !x.d || x.d >= t.since));
  if (!okDay(t.since)) return [];
  const names = whoOf(t).concat(team(t) ? [team(t)] : []);
  // champion de plusieurs titres : on ne sait pas lequel est en jeu, on laisse la mise à jour compter
  const held = (S.titles || []).filter(x => x.id !== t.id && whoOf(x).some(n => names.indexOf(n) >= 0));
  if (held.length) return [];
  const out = [];
  Object.keys(S.highlights || {}).forEach(key => {
    const p = key.split("|"); if (p[0] !== t.k || !(p[2] > t.since)) return;
    const h = S.highlights[key]; if (!h || !Array.isArray(h.res)) return;
    h.res.forEach(r => {
      if (!KEEP.test(r)) return;
      const w = resultWinner(r), txt = norm(w && w.w ? w.w : r.split(KEEP)[0]);
      if (!names.some(n => n.length >= 3 && txt.indexOf(n) >= 0)) return;
      out.push({ d: p[2], ev: p[1] === "PLE" ? "" : p[1], vs: w && w.l ? w.l : "", k: p[0], show: p[1] });
    });
  });
  return out.sort((a, b) => b.d.localeCompare(a.d));
}
const defCount = t => typeof t.def === "number" && !Array.isArray(t.defs) ? t.def : defensesOf(t).length;
const defLine = t => { const n = defCount(t); return n ? " · 🛡️ " + n + " défense" + (n > 1 ? "s" : "") : ""; };

// Mode sans spoiler : champion récent masqué
const masked = t => '<button class="maskbtn" data-act="unlockt" data-id="' + esc(t.id) + '">🙈 Champion masqué (mode sans spoiler) · toucher pour voir</button>';
ACT.unlockt = el => unlock("t:" + el.dataset.id);

const wlink = n => '<a class="champ" href="#/catcheur/' + encodeURIComponent(String(n).replace(/\s*\(.*\)$/, "")) + '">' + esc(n) + "</a>";
function champLinks(t) {
  const who = Array.isArray(t.who) && t.who.length ? t.who : [t.c];
  const team = t.c.match(/^(.+?)\s*\((.+)\)$/); // « Équipe (A et B) »
  return (team ? '<span class="team">' + esc(team[1]) + "</span> " : "") + who.map(wlink).join('<span class="amp"> · </span>');
}
function days(since) { return okDay(since) ? Math.max(0, Math.round((today() - dt(since)) / 864e5)) : null; }
function sinceLine(t) {
  const n = days(t.since);
  return okDay(t.since) ? "Depuis le " + fmt(t.since) + (t.ev ? " (" + esc(t.ev) + ")" : "") + " · " + n + " jour" + (n > 1 ? "s" : "") : "Date de début du règne à confirmer";
}
function card(t) {
  return '<article class="belt"' + shAttr({ ty: "title", t: t.n, s: t.k + (t.show ? " · " + t.show : ""), h: "#/titre/" + encodeURIComponent(t.id), k: t.k }) + '><div class="beltbar" style="' + esc(plain(colorOf(t.k, t.show || ""))) + '"></div><div class="beltbody">' +
    '<a class="beltname" href="#/titre/' + encodeURIComponent(t.id) + '">' + esc(t.n) + ' <span class="chev">›</span></a>' +
    (champHidden(t) ? masked(t) : '<div class="champs">' + champLinks(t) + "</div><small>" + sinceLine(t) + defLine(t) + "</small>") + "</div></article>";
}
const noteSpoil = () => '<p class="note small" style="margin-top:12px">' + (noSpoil() ? "🙈 Mode sans spoiler activé : les champions couronnés récemment restent masqués tant que tu n’as pas vu un show de la promotion depuis."
  : "⚠️ Les champions actuels peuvent dévoiler des résultats récents. Active le « mode sans spoiler » dans les paramètres pour les masquer.") +
  (okDay(S.titlesUpdated) ? " Mis à jour le " + fmt(S.titlesUpdated).replace(/\.$/, "") + "." : "") + "</p>";

export function titlesView(k, n) {
  if (!S.P[k]) return '<p class="empty">Promotion introuvable.</p>';
  const list = titlesFor(k, n);
  let h = '<a class="back" href="#/p/' + encodeURIComponent(k) + (n ? "/" + encodeURIComponent(n) : "") + '">' + ICON.back + " " + esc(n || k) + "</a><h1>Titres " + (n ? "de " + esc(n) : esc(k)) + "</h1>";
  if (!list.length) return h + '<p class="note">Pas encore de titres pour cette promotion.</p>';
  if (!n && S.P[k].s) {
    // promotion avec plusieurs shows : un groupe par show
    const groups = {};
    list.forEach(t => { const g = t.show || "Plusieurs shows"; (groups[g] = groups[g] || []).push(t); });
    const order = Object.keys(S.P[k].s).concat(["Plusieurs shows"]).filter(g => groups[g]);
    order.forEach(g => { h += "<h2>" + esc(g) + '</h2><div class="belts">' + groups[g].map(card).join("") + "</div>"; });
  } else {
    h += '<div class="belts" style="margin-top:4px">' + list.map(card).join("") + "</div>";
  }
  return h + noteSpoil();
}

export function titleView(id) {
  const t = (S.titles || []).find(x => x.id === id);
  if (!t) return '<a class="back" href="#/">' + ICON.back + ' Accueil</a><p class="empty">Titre introuvable.</p>';
  let h = '<a class="back" href="#/titres/' + encodeURIComponent(t.k) + (t.show ? "/" + encodeURIComponent(t.show) : "") + '">' + ICON.back + " Titres</a>";
  h += '<section class="beltheader" style="' + esc(plain(colorOf(t.k, t.show || ""))) + '"><span class="eyebrow">' + esc(t.k) + (t.show ? " · " + esc(t.show) : "") + "</span><h1>" + esc(t.n) + "</h1>" +
    '<button class="iconbtn sharebtn light" data-act="share"' + shAttr({ ty: "title", t: t.n, s: t.k + (t.show ? " · " + t.show : ""), h: "#/titre/" + encodeURIComponent(t.id), k: t.k }) + ' aria-label="Partager">↗</button></section>';
  if (champHidden(t)) return h + '<h2>Champion actuel</h2><div class="belts"><article class="belt"><div class="beltbody">' + masked(t) + "</div></article></div>" + noteSpoil();
  h += '<h2>Champion actuel</h2><div class="belts"><article class="belt"><div class="beltbody"><div class="champs big">' + champLinks(t) + "</div><small>" + sinceLine(t) + "</small></div></article></div>";
  const defs = defensesOf(t), nd = defCount(t);
  h += "<h2>🛡️ Défenses du titre" + (nd ? ' <small class="cnt">' + nd + "</small>" : "") + "</h2>";
  h += defs.length ? '<ol class="hist defs">' + defs.map(x => "<li><b>" + (x.vs ? "contre " + linkNames(x.vs) : "Titre conservé") + "</b><small>" + (okDay(x.d) ? fmt(x.d) : "") + (x.ev ? " · " + esc(x.ev) : "") +
      (x.k && x.show && okDay(x.d) ? ' · <a href="' + hlHref(x.k, x.show, x.d) + '">résultats ›</a>' : "") + "</small></li>").join("") + "</ol>"
    : '<p class="note">' + (nd ? nd + " défense" + (nd > 1 ? "s" : "") + " réussie" + (nd > 1 ? "s" : "") + " depuis le début du règne." : "Pas encore de défense réussie depuis le début du règne (shows télévisés et PLE, hors live events).") + "</p>";
  h += "<h2>Champions précédents</h2>";
  h += (t.hist && t.hist.length) ? '<ol class="hist">' + t.hist.map(x => "<li>" + wlink(x.c) + "<small>" + (okDay(x.d) ? "Depuis le " + fmt(x.d) : "Date non précisée") + (x.ev ? " · " + esc(x.ev) : "") + "</small></li>").join("") + "</ol>"
    : '<p class="note">L’historique de ce titre sera ajouté lors d’une prochaine mise à jour.</p>';
  if (t.src) h += '<p class="note small" style="margin-top:12px">Source : ' + (okHttp(t.u) ? '<a href="' + esc(t.u) + '" target="_blank" rel="noopener">' + esc(t.src) + "</a>" : esc(t.src)) + "</p>";
  return h + noteSpoil();
}
