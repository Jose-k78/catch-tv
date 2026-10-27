// Recherche : shows, PLE, promotions, catcheurs (fiche Wikipédia en français + actus + prochains matchs)
import { S } from "../state.js";
import { esc, ICON, fmt, diff, okHttp } from "../util.js";
import { allPle, epis, recapOf, articles, artList } from "./catalog.js";
import { PREVIEW } from "../content.js";

const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
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
export function wrestlerView(name) {
  const n = norm(name);
  // prochains matchs annoncés : cartes et résumés des événements à venir (ou du jour) qui le mentionnent
  let evs = allPle();
  Object.keys(S.P).forEach(k => { const s = S.P[k].s || {}; Object.keys(s).forEach(x => { evs = evs.concat(epis(k, x, 0, 2)); }); });
  const up = evs.filter(e => e.d && diff(e.d) >= 0).filter(e => {
    const r = recapOf(e); return norm((e.card || []).join(" ") + " " + (r ? r.txt : "")).indexOf(n) >= 0;
  }).sort((a, b) => diff(a.d) - diff(b.d));
  const arts = articles([], 8, name);
  const vids = S.matches.filter(m => norm(m.t).indexOf(n) >= 0).slice(0, 5);
  let h = '<a class="back" href="#/recherche/' + encodeURIComponent(name) + '">' + ICON.back + " Recherche</a><h1>" + esc(name) + "</h1>" +
    '<div id="wiki" class="wiki"><p class="note">' + (PREVIEW ? "La fiche Wikipédia s’affichera une fois l’app en ligne (l’aperçu bloque les connexions vers d’autres sites)." : "Recherche de sa fiche…") + "</p></div>";
  h += "<h2>Prochains matchs annoncés</h2>" + (up.length ? '<div class="list">' + up.map(e => '<a class="item" href="#/p/' + encodeURIComponent(e.k) + (e.show ? "/" + encodeURIComponent(e.show) : "") +
    '"><span class="lbl"><b>' + esc(e.t) + "</b><small>" + esc(e.k) + " · " + fmt(e.d) + '</small></span><span class="chev">›</span></a>').join("") + "</div>"
    : '<p class="note">Rien d’annoncé dans l’app pour l’instant.</p>');
  h += "<h2>Son actu</h2>" + (arts.length ? artList(arts) : '<p class="note">Pas d’article en français dans l’app qui parle de lui ou d’elle.</p>') +
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
