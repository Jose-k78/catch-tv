// Recherche : shows, PLE, promotions, catcheurs (fiche Wikipédia en français + actus + prochains matchs)
import { S } from "../state.js";
import { esc, ICON, fmt, okHttp } from "../util.js";
import { allPle } from "./catalog.js";
import { PREVIEW } from "../content.js";
import { norm, canonical, wInfo, wShows, wTitles, upcomingFor, lastMatches, wNews } from "../wrestlers.js";
import { starBtn } from "./favs.js";
import { okVid, ytSearch, hlHref } from "./highlights.js";
import { noSpoil, champHidden } from "../spoil.js";
let lastQ = "";

function localResults(q) {
  const n = norm(q), out = [];
  if (!n) return out;
  Object.keys(S.P).forEach(k => {
    if (norm(k).indexOf(n) >= 0) out.push({ t: k, s: "Promotion", h: "#/p/" + encodeURIComponent(k) });
    const sh = S.P[k].s || {};
    Object.keys(sh).forEach(x => { if (norm(x).indexOf(n) >= 0 || norm(k + " " + x).indexOf(n) >= 0) out.push({ t: x, s: k + " · " + sh[x].j, h: "#/p/" + encodeURIComponent(k) + "/" + encodeURIComponent(x) }); });
  });
  allPle().forEach(e => { if (norm(e.t).indexOf(n) >= 0) out.push({ t: e.t, s: e.k + " · " + fmt(e.d) + (e.w && e.w !== "—" ? " · " + e.w : ""), h: "#/p/" + encodeURIComponent(e.k) }); });
  return out.slice(0, 12);
}
export function searchView(q) {
  lastQ = q || "";
  return '<div class="searchbar"><input id="q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Show, PLE, catcheur, catcheuse…" value="' + esc(lastQ) + '" aria-label="Rechercher"></div><div id="sres">' + resultsHTML(lastQ) + "</div>";
}
function resultsHTML(q) {
  if (!norm(q)) return '<p class="note">Tape le nom d’un show (Raw, Dynamite…), d’un PLE (Crown Jewel…) ou d’un catcheur (Roman Reigns, Mayu Iwatani…).</p>';
  const loc = localResults(q);
  let h = "";
  if (loc.length) h += '<h2>Shows et événements</h2><div class="list">' + loc.map(r => '<a class="item" href="' + r.h + '"><span class="lbl"><b>' + esc(r.t) + "</b><small>" + esc(r.s) + '</small></span><span class="chev">›</span></a>').join("") + "</div>";
  h += '<h2>Catcheurs et catcheuses</h2><div class="list"><a class="item" href="#/catcheur/' + encodeURIComponent(q.trim()) + '"><span class="lbl"><b>' + esc(q.trim()) +
    "</b><small>Voir sa fiche, son actu et ses prochains matchs</small></span><span class=\"chev\">›</span></a></div>";
  return h;
}
document.addEventListener("input", e => {
  if (e.target.id !== "q") return;
  lastQ = e.target.value;
  const r = document.getElementById("sres"); if (r) r.innerHTML = resultsHTML(lastQ);
  try { history.replaceState(null, "", "#/recherche/" + encodeURIComponent(lastQ)); } catch (err) {}
});
document.addEventListener("keydown", e => {
  if (e.target.id === "q" && e.key === "Enter" && norm(e.target.value) && !localResults(e.target.value).length) location.hash = "#/catcheur/" + encodeURIComponent(e.target.value.trim());
});

// ---------- fiche catcheur ----------
const wikiCache = {};
async function wiki(name) {
  if (wikiCache[name]) return wikiCache[name];
  const api = "https://fr.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=6&srsearch=" + encodeURIComponent(name + " catch");
  const j = await (await fetch(api)).json();
  const hits = (j.query && j.query.search) || [];
  for (const hit of hits) {
    const sj = await (await fetch("https://fr.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(hit.title.replace(/ /g, "_")))).json();
    const txt = norm((sj.description || "") + " " + (sj.extract || ""));
    if (sj.type !== "disambiguation" && /catcheu|lutteu|catch professionnel|wrestl/.test(txt)) {
      return (wikiCache[name] = { title: sj.title, desc: sj.description || "", extract: sj.extract || "", url: sj.content_urls && sj.content_urls.desktop && sj.content_urls.desktop.page });
    }
  }
  return (wikiCache[name] = { none: true });
}
export function wrestlerView(raw) {
  const name = canonical(raw), n = norm(name);
  const up = upcomingFor(name), shows = wShows(name), held = wTitles(name), w = wInfo(name);
  const arts = wNews(name, 6);
  const vids = S.matches.filter(m => norm(m.t).indexOf(n) >= 0).slice(0, 5);
  const k = (w && w.k) || (shows[0] && shows[0].k) || "WWE";
  let h = '<a class="back" href="#/recherche/' + encodeURIComponent(raw) + '">' + ICON.back + " Recherche</a>" +
    '<div class="whead"><h1>' + esc(name) + "</h1>" + starBtn(name) + "</div>";
  if (shows.length || held.length) h += '<div class="chips wrap" style="margin:0 16px 10px">' + shows.map(s => '<a class="chip" href="#/p/' + encodeURIComponent(s.k) + (s.n ? "/" + encodeURIComponent(s.n) : "") + '">' + esc(s.n ? s.k + " · " + s.n : s.k) + "</a>").join("") +
    held.map(t => champHidden(t) ? "" : '<a class="chip gold" href="#/titre/' + encodeURIComponent(t.id) + '">🏆 ' + esc(t.n) + "</a>").join("") + "</div>";
  h += '<div id="wiki" class="wiki"><p class="note">' + (PREVIEW ? "La fiche Wikipédia s’affichera une fois l’app en ligne (l’aperçu bloque les connexions vers d’autres sites)." : "Recherche de sa fiche…") + "</p></div>";
  h += "<h2>Prochains matchs annoncés</h2>" + (up.length ? '<div class="list">' + up.map(e => '<a class="item" href="#/p/' + encodeURIComponent(e.k) + (e.show ? "/" + encodeURIComponent(e.show) : "") +
    '"><span class="lbl"><b>' + esc(e.t) + "</b><small>" + esc(e.k) + " · " + fmt(e.d) + (e.line ? " · " + esc(e.line) : "") + '</small></span><span class="chev">›</span></a>').join("") + "</div>"
    : '<p class="note">Rien d’annoncé dans l’app pour l’instant.</p>');
  // 3 derniers matchs : résultats derrière le bouton spoiler
  const last = lastMatches(name, 3), lock = noSpoil();
  h += "<h2>Ses 3 derniers matchs</h2>";
  if (last.length) {
    h += '<div class="list">' + last.map(m => '<div class="item"><span class="lbl"><b>' + esc(m.t || ((m.ev || m.k) + (m.d ? " du " + fmt(m.d) : ""))) + "</b><small>" + esc([m.k, m.ev].filter(Boolean).join(" · ")) + (m.d ? " · " + fmt(m.d) : "") + "</small>" +
      (m.r ? '<span class="spoil inline"><button class="linkbtn spoilbtn" data-act="reveal">👀 Voir le résultat (spoiler)</button><span class="spoilbody">' + esc(m.r) + "</span></span>" : "") + "</span>" +
      (okVid(m.v) && !lock ? '<button class="btn small ghost" data-act="play" data-id="' + esc(m.v) + '" data-t="' + esc(m.vt || m.t || name) + '">▶</button>' : "") +
      (m.d && m.k ? '<a class="chev" href="' + hlHref(m.k, m.show || (m.ev && S.P[m.k] && S.P[m.k].s && S.P[m.k].s[m.ev] ? m.ev : "PLE"), m.d) + '" aria-label="Highlights">›</a>' : "") + "</div>").join("") + "</div>";
  } else h += '<p class="note">Pas encore de résultat récent dans l’app.</p>';
  // 5 matchs de référence (vidéo officielle si connue, sinon recherche sur la chaîne officielle)
  const ref = (w && Array.isArray(w.ref) ? w.ref : []).slice(0, 5);
  h += "<h2>Ses matchs de référence</h2>";
  if (ref.length) h += '<div class="list">' + ref.map(m => {
    const go = okVid(m.v) ? '<button class="btn small" data-act="play" data-id="' + esc(m.v) + '" data-t="' + esc(m.t) + '">▶ Voir</button>'
      : '<a class="btn small ghost" href="' + esc(ytSearch(w.k || k, m.t.replace(/ contre /g, " vs ").replace(/ — .*$/, "") + " highlights")) + '" target="_blank" rel="noopener">Chercher ↗</a>';
    return '<div class="item"><span class="lbl"><b>' + esc(m.t) + "</b><small>" + esc(m.ev || "") + "</small></span>" + go + "</div>";
  }).join("") + "</div>";
  else h += '<p class="note">Ses matchs de référence seront ajoutés lors d’une prochaine mise à jour' + (S.user ? " (ajoute-le à tes favoris pour qu’il soit suivi)" : "") + ".</p>";
  h += '<p class="note small" style="margin-top:8px"><a class="linkbtn" style="padding:0" href="' + esc(ytSearch(k, name + " highlights")) + '" target="_blank" rel="noopener">Ses vidéos sur la chaîne YouTube officielle ↗</a></p>';
  h += "<h2>Son actu</h2>" + (arts.length ? '<div class="list">' + arts.map(a => '<a class="item" href="' + esc(a.u) + '" target="_blank" rel="noopener"><span class="lbl"><b>' + esc(a.t) +
    "</b><small>" + esc(a.s || "") + (a.tr ? " · titre traduit" : "") + '</small></span><span class="rt">' + (a.d ? fmt(a.d) : "") + "</span></a>").join("") + "</div>" : '<p class="note">Pas d’article en français dans l’app qui parle de lui ou d’elle.</p>') +
    '<p class="note" style="margin-top:8px"><a class="linkbtn" style="padding:0" href="https://news.google.com/search?q=' + encodeURIComponent('"' + name + '"') + '&hl=fr&gl=FR&ceid=FR:fr" target="_blank" rel="noopener">Plus d’actu sur Google Actualités ↗</a></p>';
  if (vids.length) h += '<h2>Ses matchs à revoir</h2><div class="list">' + vids.map(m => '<button class="item" data-act="play" data-id="' + esc(m.id) + '" data-t="' + esc(m.t) + '"><span class="lbl"><b>' + esc(m.t) +
    "</b><small>" + esc(m.k) + (m.ev ? " · " + esc(m.ev) : "") + '</small></span><span class="chev">▶</span></button>').join("") + "</div>";
  return h;
}
export async function fillWiki(name) {
  if (PREVIEW) return;
  const box = () => document.getElementById("wiki");
  try {
    const w = await wiki(name); if (!box()) return;
    if (w.none) { box().innerHTML = '<p class="note">Pas de fiche Wikipédia en français trouvée pour ce nom. Vérifie l’orthographe ou essaie son nom de ring complet.</p>'; return; }
    box().innerHTML = '<div class="wikicard"><b>' + esc(w.title) + "</b>" + (w.desc ? "<small>" + esc(w.desc) + "</small>" : "") + "<p>" + esc(w.extract) + "</p>" +
      (okHttp(w.url) ? '<a href="' + esc(w.url) + '" target="_blank" rel="noopener">Lire la suite sur Wikipédia ↗</a>' : "") + '<small class="src">Source : Wikipédia (licence CC BY-SA)</small></div>';
  } catch (e) { if (box()) box().innerHTML = '<p class="note">Impossible de joindre Wikipédia pour le moment.</p>'; }
}
