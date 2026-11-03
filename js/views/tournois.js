// Rubrique Tournoi : tous les tournois (G1 Climax, 5★STAR Grand Prix, tournois CMLL, Tag Team Classic NXT…)
// d'après data/tournaments.json (rempli par la mise à jour du soir). Avancement (gagnants / éliminés, ou classement des blocs),
// photos des participants, liens et vidéos des matchs (vidéo officielle « v » ou lien du modo « tn:id|match »),
// article de synthèse à la fin. Pages des séries : G1 Climax (NJPW), 5★STAR Grand Prix (Stardom), Marigold.
import { S } from "../state.js";
import { esc, ICON, fmt } from "../util.js";
import { linkNames } from "../wrestlers.js";
import { face, faceImg, versus } from "../photos.js";
import { linksHTML } from "../links.js";
import { eventLogo, showLogo } from "../assets.js";

const T = () => (S.tournaments && Array.isArray(S.tournaments.items) ? S.tournaments.items : []).filter(t => t && t.id && t.n);
const SER = () => (S.tournaments && S.tournaments.series) || {};
export const liveTournaments = k => T().filter(t => t.st === "en cours" && (!k || t.k === k));
const stTag = t => '<span class="tnst ' + (t.st === "en cours" ? "on" : t.st === "terminé" ? "done" : "") + '">' + esc(t.st || "à venir") + "</span>";
const card = t => '<a class="item" href="#/tournoi/' + encodeURIComponent(t.id) + '"><span class="lbl"><b>🏆 ' + esc(t.n) + "</b><small>" + esc([t.k, t.y, t.from ? "du " + fmt(t.from) + (t.to ? " au " + fmt(t.to) : "") : ""].filter(Boolean).join(" · ")) + "</small></span>" + stTag(t) + "</a>";

// tuile de l'accueil / d'une promotion : un tournoi est en cours
export function tournamentTile(k) {
  const L = liveTournaments(k); if (!L.length) return "";
  const t = L[0];
  return '<a class="titletile tntile" href="' + (L.length > 1 && !k ? "#/tournois" : "#/tournoi/" + encodeURIComponent(t.id)) + '"><span class="tt-belt">🏆</span><span class="tt-txt"><b>' + (L.length > 1 ? L.length + " tournois en cours" : "Tournoi en cours : " + esc(t.n)) +
    "</b><small>" + esc(L.map(x => x.k + " · " + x.n).slice(0, 3).join(" · ")) + '</small></span><span class="chev">›</span></a>';
}

export function tournoisView() {
  const all = T(), live = all.filter(t => t.st === "en cours"), soon = all.filter(t => !t.st || t.st === "à venir"), done = all.filter(t => t.st === "terminé");
  let h = '<a class="back" href="#/">' + ICON.back + " Accueil</a><h1>Tournois</h1>";
  h += live.length ? "<h2>En cours</h2><div class=\"list\">" + live.map(card).join("") + "</div>" : '<p class="note">Pas de tournoi en cours en ce moment. Dès qu’un show entre en tournoi, il apparaît ici.</p>';
  if (soon.length) h += "<h2>À venir</h2><div class=\"list\">" + soon.map(card).join("") + "</div>";
  const S2 = SER();
  h += "<h2>Les grands tournois</h2><div class=\"list\">" + Object.keys(S2).map(id => { const s = S2[id];
    return '<a class="item" href="#/tournois/' + encodeURIComponent(id) + '"><span class="lbl"><b>' + esc(s.n) + "</b><small>" + esc(s.k) + ((s.past || [])[0] ? " · dernier vainqueur : " + esc(s.past[0].w) + " (" + s.past[0].y + ")" : "") + '</small></span><span class="chev">›</span></a>'; }).join("") + "</div>";
  if (done.length) h += "<h2>Terminés</h2><div class=\"list\">" + done.slice(0, 20).map(card).join("") + "</div>";
  return h;
}

// page d'une série (G1 Climax…) : explication, anecdotes, anciens gagnants, éditions de l'app
export function serieView(id) {
  const s = SER()[id];
  let h = '<a class="back" href="#/tournois">' + ICON.back + " Tournois</a>";
  if (!s) return h + '<p class="empty">Tournoi introuvable.</p>';
  const lg = s.lg && eventLogo({ t: s.lg, k: s.k });
  h += '<section class="tnhead">' + (lg ? '<img class="tnlogo" src="' + esc(lg) + '" alt="">' : showLogo(s.k, "") ? '<img class="tnlogo sm" src="' + esc(showLogo(s.k, "")) + '" alt="">' : "") + '<span class="eyebrow">' + esc(s.k) + "</span><h1>" + esc(s.n) + "</h1></section>";
  const eds = T().filter(t => t.serie === id).sort((a, b) => String(b.y).localeCompare(String(a.y)));
  if (eds.length) h += "<h2>Les éditions dans l’app</h2><div class=\"list\">" + eds.map(card).join("") + "</div>";
  if ((s.about || []).length) h += "<h2>C’est quoi, le " + esc(s.n) + " ?</h2><article class=\"story\">" + s.about.map(p => "<p>" + linkNames(p) + "</p>").join("") + "</article>";
  if ((s.anec || []).length) h += "<h2>Anecdotes</h2><ul class=\"tnanec\">" + s.anec.map(a => "<li>" + linkNames(a) + "</li>").join("") + "</ul>";
  if ((s.past || []).length) h += "<h2>Les anciens vainqueurs</h2><div class=\"list\">" + s.past.map(p => '<a class="item" href="#/catcheur/' + encodeURIComponent(p.w) + '">' + faceImg(p.w, 36) + '<span class="lbl"><b>' + esc(p.w) + "</b><small>" + esc(p.y) + '</small></span><span class="chev">›</span></a>').join("") + "</div>" +
    '<p class="note small">La liste complète est complétée par la mise à jour.</p>';
  h += '<p class="note small" style="margin-top:10px"><a class="linkbtn" style="padding:0" href="#/player/k/' + encodeURIComponent(s.k) + '">▶ Archives ' + esc(s.k) + " dans le TCC Player</a></p>";
  if ((s.src || []).length) h += '<p class="note small">Sources : ' + s.src.map(x => '<a href="' + esc(x.u) + '" target="_blank" rel="noopener">' + esc(x.n) + "</a>").join(" · ") + "</p>";
  return h;
}

// page d'un tournoi
export function tournoiView(id) {
  const t = T().find(x => x.id === id);
  let h = '<a class="back" href="#/tournois">' + ICON.back + " Tournois</a>";
  if (!t) return h + '<p class="empty">Tournoi introuvable.</p>';
  h += '<section class="tnhead"><span class="eyebrow">' + esc([t.k, t.y].filter(Boolean).join(" · ")) + "</span><h1>" + esc(t.n) + "</h1>" + stTag(t) +
    (t.from ? "<small>Du " + fmt(t.from) + (t.to ? " au " + fmt(t.to) : "") + "</small>" : "") + "</section>";
  if (t.winner) h += '<div class="bkchamp">' + (face(t.winner, 80) || "") + "<span>🏆 Vainqueur</span><b>" + linkNames(t.winner) + "</b></div>";
  if ((t.about || "") !== "") h += '<p class="note" style="margin:8px 16px">' + linkNames(t.about) + "</p>";
  // blocs (tous contre tous)
  (t.blocs || []).forEach(b => {
    const rows = (b.rows || []).slice().sort((x, y) => (y.pts || 0) - (x.pts || 0));
    h += "<h2>" + esc(b.n || "Bloc") + '</h2><div class="board">' + rows.map((r, i) => '<a class="brow" href="#/catcheur/' + encodeURIComponent(r.w) + '"><span class="brk">' + (i + 1) + "</span>" + faceImg(r.w, 28) + "<b>" + esc(r.w) + '</b><span class="bpts">' + (r.pts || 0) + " pts</span></a>").join("") + "</div>";
  });
  // tableau (élimination)
  if ((t.rounds || []).length) {
    h += '<h2>Le tableau</h2><div class="tntree">' + t.rounds.map((r, ri) => '<div class="bkcol"><small>' + esc(r.n || "Tour " + (ri + 1)) + "</small>" + (r.m || []).map((m, mi) =>
      '<div class="bkmini">' + [m.a, m.b].map(n => '<span class="' + (m.w && n === m.w ? "win" : m.w ? "out" : "") + '">' + (n ? faceImg(n, 18) + esc(n) : "?") + "</span>").join("") + "</div>").join("") + "</div>").join("") + "</div>";
    // matchs : résultat, vidéo officielle ou lien du modo
    h += "<h2>Les matchs</h2>";
    t.rounds.forEach((r, ri) => (r.m || []).forEach((m, mi) => {
      if (!m.a || !m.b) return;
      h += '<div class="tnmatch"><small>' + esc(r.n || "Tour " + (ri + 1)) + "</small>" + versus(m.a + " contre " + m.b, 36) + "<b>" + linkNames(m.a + " contre " + m.b) + "</b>" +
        (m.res ? '<span class="spoil inline"><button class="linkbtn spoilbtn" data-act="reveal">👀 Résultat (spoiler)</button><span class="spoilbody">' + linkNames(m.res) + "</span></span>" : "") +
        (m.v && /^[\w-]{11}$/.test(m.v) ? '<button class="btn small ghost" data-act="play" data-id="' + esc(m.v) + '" data-t="' + esc(m.a + " contre " + m.b) + '">▶ Voir</button>' : "") +
        linksHTML("tn:" + t.id + "|" + ri + "-" + mi, { label: "Vidéo", title: m.a + " contre " + m.b }) + "</div>";
    }));
  }
  if (!(t.blocs || []).length && !(t.rounds || []).length) h += '<p class="note">Le tableau arrive avec la mise à jour du soir.</p>';
  h += "<h2>Vidéos du tournoi</h2>" + linksHTML("tn:" + t.id, { label: "Vidéo", title: t.n, empty: '<p class="note small">Pas encore de lien.</p>' });
  // article de synthèse à la fin du tournoi
  if (t.art && (t.art.txt || []).length) {
    h += "<h2>📰 Le bilan du tournoi</h2><article class=\"story\">" + t.art.txt.map(p => "<p>" + linkNames(p) + "</p>").join("") + "</article>";
    if ((t.art.faits || []).length) h += "<h2>Les faits marquants</h2><ul class=\"tnanec\">" + t.art.faits.map(f => "<li>" + linkNames(f) + "</li>").join("") + "</ul>";
    if (t.art.pop) h += '<p class="note" style="margin:8px 16px">⭐ Le plus populaire du tournoi : <b>' + linkNames(t.art.pop) + "</b></p>";
  }
  if (t.serie && SER()[t.serie]) h += '<p class="note small" style="margin-top:10px"><a class="linkbtn" style="padding:0" href="#/tournois/' + encodeURIComponent(t.serie) + '">Tout savoir sur le ' + esc(SER()[t.serie].n) + " ›</a></p>";
  if ((t.src || []).length) h += '<p class="note small">Sources : ' + t.src.map(x => '<a href="' + esc(x.u) + '" target="_blank" rel="noopener">' + esc(x.n) + "</a>").join(" · ") + "</p>";
  return h;
}
