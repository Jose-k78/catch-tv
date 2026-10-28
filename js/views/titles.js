// Titres : champions actuels par promotion / show, historique d'un titre
import { S, ACT } from "../state.js";
import { esc, ICON, fmt, today, dt, okHttp, okDay } from "../util.js";
import { titlesFor, plain, colorOf } from "./catalog.js";
import { champHidden, unlock, noSpoil } from "../spoil.js";

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
  return '<article class="belt"><div class="beltbar" style="' + esc(plain(colorOf(t.k, t.show || ""))) + '"></div><div class="beltbody">' +
    '<a class="beltname" href="#/titre/' + encodeURIComponent(t.id) + '">' + esc(t.n) + ' <span class="chev">›</span></a>' +
    (champHidden(t) ? masked(t) : '<div class="champs">' + champLinks(t) + "</div><small>" + sinceLine(t) + "</small>") + "</div></article>";
}
const noteSpoil = () => '<p class="note small" style="margin-top:12px">' + (noSpoil() ? "🙈 Mode sans spoiler activé : les champions couronnés récemment restent masqués tant que tu n’as pas vu un show de la promotion depuis."
  : "⚠️ Les champions actuels peuvent dévoiler des résultats récents. Active le « mode sans spoiler » dans les paramètres pour les masquer.") +
  (okDay(S.titlesUpdated) ? " Mis à jour le " + fmt(S.titlesUpdated) + "." : "") + "</p>";

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
  h += '<section class="beltheader" style="' + esc(plain(colorOf(t.k, t.show || ""))) + '"><span class="eyebrow">' + esc(t.k) + (t.show ? " · " + esc(t.show) : "") + "</span><h1>" + esc(t.n) + "</h1></section>";
  if (champHidden(t)) return h + '<h2>Champion actuel</h2><div class="belts"><article class="belt"><div class="beltbody">' + masked(t) + "</div></article></div>" + noteSpoil();
  h += '<h2>Champion actuel</h2><div class="belts"><article class="belt"><div class="beltbody"><div class="champs big">' + champLinks(t) + "</div><small>" + sinceLine(t) + "</small></div></article></div>";
  h += "<h2>Champions précédents</h2>";
  h += (t.hist && t.hist.length) ? '<ol class="hist">' + t.hist.map(x => "<li>" + wlink(x.c) + "<small>" + (okDay(x.d) ? "Depuis le " + fmt(x.d) : "Date non précisée") + (x.ev ? " · " + esc(x.ev) : "") + "</small></li>").join("") + "</ol>"
    : '<p class="note">L’historique de ce titre sera ajouté lors d’une prochaine mise à jour.</p>';
  if (t.src) h += '<p class="note small" style="margin-top:12px">Source : ' + (okHttp(t.u) ? '<a href="' + esc(t.u) + '" target="_blank" rel="noopener">' + esc(t.src) + "</a>" : esc(t.src)) + "</p>";
  return h + noteSpoil();
}
