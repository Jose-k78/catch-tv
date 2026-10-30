// Recherche : shows, PLE, promotions, catcheurs ; fiche catcheur (résumé, promotion, dernière apparition,
// 3 derniers matchs, 5 matchs de référence, favori ⭐, commentaires) ; homonymes : choix du bon catcheur
import { S } from "../state.js";
import { esc, ICON, fmt, okHttp, shAttr } from "../util.js";
import { allPle, evHref, artCard, evCard } from "./catalog.js";
import { PREVIEW } from "../content.js";
import { norm, canonical, wInfo, wShows, wTitles, upcomingFor, lastMatches, wNews, lastShow, knownNames, promoIn, alignOf, ALIGN, linkNames } from "../wrestlers.js";
import { starBtn } from "./favs.js";
import { okVid, ytSearch, hlHref } from "./highlights.js";
import { noSpoil, champHidden } from "../spoil.js";
import { commentsBox } from "./comments.js";
import { TECH, techHTML, fillTech } from "../tech.js";
import { searchEvents, EVENT_WORDS } from "./event.js";
import { wImageBox } from "./wimage.js";
import { photoOf, faceImg } from "../photos.js";
import { wGroups, refButton } from "./groups.js";
import { palmaresHTML } from "./palmares.js";
import { searchGroups, groupById, groupLogo, groupHref, archivedBelts, beltOf } from "../assets.js";

// Champs de fiche technique préparés en français dans data/wrestlers.json
function localTech(w) { const f = {}; if (w) TECH.forEach(t => { if (w[t[0]]) f[t[0]] = w[t[0]]; }); return f; }
let lastQ = "";

function localResults(q) {
  const n = norm(q), out = [];
  if (!n) return out;
  Object.keys(S.P).forEach(k => {
    if (norm(k).indexOf(n) >= 0) out.push({ t: k, s: "Promotion", h: "#/p/" + encodeURIComponent(k) });
    const sh = S.P[k].s || {};
    Object.keys(sh).forEach(x => { if (norm(x).indexOf(n) >= 0 || norm(k + " " + x).indexOf(n) >= 0) out.push({ t: x, s: k + " · " + sh[x].j, h: "#/p/" + encodeURIComponent(k) + "/" + encodeURIComponent(x) }); });
  });
  allPle().forEach(e => { if (norm(e.t).indexOf(n) >= 0) out.push({ t: e.t, s: e.k + " · " + fmt(e.d) + (e.w && e.w !== "—" ? " · " + e.w : ""), h: evHref(e) }); });
  return out.slice(0, 12);
}
// Catcheurs connus de l'app dont le nom contient la recherche
function nameResults(q) {
  const n = norm(q); if (n.length < 2) return [];
  return knownNames().filter(x => norm(x.n).indexOf(n) >= 0 || (x.a || []).some(a => norm(a).indexOf(n) >= 0)).slice(0, 8);
}
export function searchView(q) {
  lastQ = q || "";
  return '<div class="searchbar"><input id="q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Show, PLE, catcheur, catcheuse…" value="' + esc(lastQ) + '" aria-label="Rechercher"></div><div id="sres">' + resultsHTML(lastQ) + "</div>";
}
// La recherche ressemble-t-elle à un show ou un événement (WrestleMania 13, Raw, Crown Jewel…) plutôt qu'à un catcheur ?
function eventLike(q, loc, names) {
  const n = norm(q);
  if (names.some(x => norm(x.n) === n || (x.a || []).some(a => norm(a) === n))) return false;
  return EVENT_WORDS.test(q) || loc.some(r => norm(r.t) === n || norm(r.t).indexOf(n) === 0);
}
function resultsHTML(q) {
  if (!norm(q)) return '<p class="note">Tape le nom d’un show (Raw, Dynamite…), d’un PLE (Crown Jewel…), d’un événement passé (WrestleMania 13, Starrcade 1997…) ou d’un catcheur (Roman Reigns, Mayu Iwatani…), puis valide.</p>';
  const loc = localResults(q), names = nameResults(q), ev = eventLike(q, loc, names);
  const showsH = loc.length ? '<h2>Shows et événements</h2><div class="list">' + loc.map(r => '<a class="item" href="' + r.h + '"><span class="lbl"><b>' + esc(r.t) + "</b><small>" + esc(r.s) + '</small></span><span class="chev">›</span></a>').join("") + "</div>" : "";
  // archives : PLE et shows passés trouvés sur Wikipédia (WrestleMania 13, Starrcade 1997…)
  const archH = norm(q).length >= 3 && !PREVIEW ? '<h2>' + (ev ? "Événements passés" : "Archives") + ' <small class="cnt">Wikipédia</small></h2><div id="evres"><p class="note small">Recherche des événements passés…</p></div>' : "";
  // tag teams et factions, titres actuels, anciennes ceintures (archives : seulement quand on les cherche)
  const nq = norm(q), gids = searchGroups(q);
  const gH = gids.length ? '<h2>Tag teams et factions</h2><div class="list">' + gids.map(id => { const g = groupById(id), lg = groupLogo(id); return '<a class="item" href="' + groupHref(id) + '">' +
    (lg ? '<img class="glogo0" src="' + esc(lg) + '" alt="" loading="lazy">' : '<span class="wnone">' + esc(g.n.replace(/^the\s+/i, "").slice(0, 2)) + "</span>") + '<span class="lbl"><b>' + esc(g.n) + "</b><small>" + esc([g.k, g.y].filter(Boolean).join(" · ")) + '</small></span><span class="chev">›</span></a>'; }).join("") + "</div>" : "";
  const tl = nq.length >= 3 ? (S.titles || []).filter(t => norm(t.n).indexOf(nq) >= 0).slice(0, 8) : [];
  const tH = tl.length ? '<h2>Titres</h2><div class="list">' + tl.map(t => '<a class="item" href="#/titre/' + encodeURIComponent(t.id) + '">' + (beltOf(t.id) ? '<img class="glogo0" src="' + esc(beltOf(t.id)) + '" alt="" loading="lazy">' : '<span class="wnone">🏆</span>') +
    '<span class="lbl"><b>' + esc(t.n) + "</b><small>" + esc(t.k + (t.show ? " · " + t.show : "")) + '</small></span><span class="chev">›</span></a>').join("") + "</div>" : "";
  const ab = nq.length >= 3 ? archivedBelts().filter(b => norm(b.label + " " + b.key).indexOf(nq) >= 0).slice(0, 12) : [];
  const aH = ab.length ? '<h2>Anciennes ceintures <small class="cnt">archives</small></h2><div class="list">' + ab.map(b => '<a class="item" href="#/ceinture/' + encodeURIComponent(b.key) + '"><img class="glogo0" src="' + esc(b.src) + '" alt="" loading="lazy">' +
    '<span class="lbl"><b>' + esc(b.label) + '</b><small>Archives · ceinture qui n’est plus en jeu ou ancien modèle</small></span><span class="chev">›</span></a>').join("") + "</div>" : "";
  // un nom de show, d'événement ou de groupe ne propose jamais de fiche catcheur
  const offer = !ev && !names.some(x => norm(x.n) === nq) && !gids.some(id => norm(groupById(id).n).replace(/^the /, "") === nq.replace(/^the /, "")) && !tl.length && !ab.length;
  const wH = names.length || offer ? '<h2>Catcheurs et catcheuses</h2><div class="list">' + names.map(x => '<a class="item" href="#/catcheur/' + encodeURIComponent(x.n) + '"' + shAttr({ ty: "w", t: x.n, s: x.s, h: "#/catcheur/" + encodeURIComponent(x.n) }) + '>' + faceImg(x.n, 40) + '<span class="lbl"><b>' + esc(x.n) + "</b><small>" + esc(x.s) +
    '</small></span><span class="chev">›</span></a>').join("") +
    (offer ? '<a class="item" href="#/catcheur/' + encodeURIComponent(q.trim()) + '">' + faceImg(q.trim(), 40) + '<span class="lbl"><b>' + esc(q.trim()) +
    "</b><small>Voir sa fiche : résumé, derniers matchs, matchs de référence</small></span><span class=\"chev\">›</span></a>" : "") + "</div>" : "";
  return ev ? showsH + archH + wH + gH + tH + aH : wH + gH + tH + showsH + aH + archH;
}
document.addEventListener("input", e => {
  if (e.target.id !== "q") return;
  lastQ = e.target.value;
  const r = document.getElementById("sres"); if (r) r.innerHTML = resultsHTML(lastQ);
  try { history.replaceState(null, "", "#/recherche/" + encodeURIComponent(lastQ)); } catch (err) {}
  afterSearch();
});
// Résultats d'archives (Wikipédia), demandés 450 ms après la dernière lettre tapée
let evT = null;
export function afterSearch() {
  clearTimeout(evT);
  const q = lastQ.trim(); if (norm(q).length < 3 || PREVIEW) return;
  evT = setTimeout(async () => {
    const list = await searchEvents(q);
    const box = document.getElementById("evres"); if (!box || lastQ.trim() !== q) return;
    box.innerHTML = list.length ? '<div class="list">' + list.map(x => '<a class="item" href="#/evenement/' + encodeURIComponent(x.l + ":" + x.title) + '"><span class="lbl"><b>' + esc(x.title.replace(/\s*\((?:catch|professional wrestling|wrestling)\)$/i, "")) +
      "</b><small>" + esc(x.sn.slice(0, 110)) + (x.sn.length > 110 ? "…" : "") + '</small></span><span class="chev">›</span></a>').join("") + "</div>"
      : '<p class="note small">Aucun événement passé trouvé. Essaie avec le numéro ou l’année (ex. : WrestleMania 13, Starrcade 1997).</p>';
  }, 450);
}
// Valider = ouvrir la fiche du catcheur (sauf si la recherche correspond exactement à un show ou une promotion)
document.addEventListener("keydown", e => {
  if (e.target.id !== "q" || e.key !== "Enter" || !norm(e.target.value)) return;
  const v = e.target.value.trim(), loc = localResults(v), names = nameResults(v);
  const exact = loc.find(r => norm(r.t) === norm(v));
  if (exact) { location.hash = exact.h; return; }
  // nom d'événement (WrestleMania 13, Starrcade 1997…) : page d'archives générée depuis Wikipédia
  if (EVENT_WORDS.test(v) && !names.some(x => norm(x.n) === norm(v))) { location.hash = "#/evenement/" + encodeURIComponent(v); return; }
  const nm = names.find(x => norm(x.n) === norm(v) || (x.a || []).some(a => norm(a) === norm(v)));
  location.hash = "#/catcheur/" + encodeURIComponent(nm ? nm.n : v);
});

// ---------- fiche catcheur ----------

// Rôle actuel : face, heel ou tweener (et blessé)
function alignFact(name) {
  const a = alignOf(name); if (!a) return "";
  const A = ALIGN[a.k];
  return '<div class="walign' + (a.k ? " al-" + a.k : "") + '"><small>Rôle actuel</small><b>' + (A ? A[0] + " " + A[1] + " <span class=\"alx\">(" + A[2] + ")</span>" : "") + (a.inj ? (A ? " · " : "") + "🤕 Blessé" : "") + "</b>" +
    (a.since ? "<small class=\"alsince\">depuis le " + esc(fmt(a.since)) + "</small>" : "") + "</div>";
}
export function wrestlerView(raw, wt) {
  const name = canonical(raw), n = norm(name), w = wInfo(name);
  const up = upcomingFor(name), shows = wShows(name), held = wTitles(name);
  const arts = wNews(name, 6);
  const vids = S.matches.filter(m => norm(m.t).indexOf(n) >= 0).slice(0, 5);
  const k = (w && w.k) || (shows[0] && shows[0].k) || "";
  const ls = lastShow(name), lock = noSpoil();
  let h = '<a class="back" href="#/recherche/' + encodeURIComponent(raw) + '">' + ICON.back + " Recherche</a>";
  // fiche résumé
  const wcard = { ty: "w", t: name, s: [k, w && w.era].filter(Boolean).join(" · ") || "Fiche catcheur", h: "#/catcheur/" + encodeURIComponent(name) };
  // photo du dossier de l'admin (prioritaire) ; sinon l'image ajoutée par un membre
  const pic = photoOf(name), grp = wGroups(name);
  h += '<section class="wcard"><div class="wtop' + (pic ? " haspic" : "") + '">' + (pic ? '<div class="wpicbox"><button class="wpicbtn" data-act="zoom" data-src="' + esc(pic) + '" data-alt="' + esc(name) + '" aria-label="Agrandir la photo"><img class="wpic" src="' + esc(pic) + '" alt="' + esc(name) + '" onerror="this.closest(\'.wpicbox\').remove()"></button>' +
    (grp.corner ? '<span class="wgcorner">' + grp.corner + "</span>" : "") + "</div>" : "") + '<div class="wtt"><span class="eyebrow">FICHE CATCHEUR</span><h1>' + esc(name) + "</h1>" +
    (w && w.era ? '<small class="wera">' + esc(w.era) + "</small>" : "") + (!pic && grp.corner ? '<span class="wgcorner inline">' + grp.corner + "</span>" : "") + "</div>" + '<span class="wacts">' + starBtn(name) + '<button class="iconbtn sharebtn" data-act="share"' + shAttr(wcard) + ' aria-label="Partager">↗</button></span></div>' +
    '<div id="wchoose"></div>' + wImageBox(name, { small: !!pic }) +
    (w && w.txt ? '<p class="wtxt">' + esc(w.txt) + "</p>" : "") +
    '<div id="wiki" class="wiki">' + (PREVIEW ? (w && w.txt ? "" : '<p class="note">Le résumé Wikipédia s’affichera une fois l’app en ligne (l’aperçu bloque les connexions vers d’autres sites).</p>') : '<p class="note">Recherche de son résumé…</p>') + "</div>" +
    '<div class="wfacts"><div><small>Promotion</small><b id="wpromo">' + esc(k || "–") + "</b></div>" +
    "<div><small>Dernière apparition</small>" + (ls ? '<a href="' + esc(ls.href) + '"><b>' + esc(ls.label) + "</b></a>" : "<b>–</b>") + "</div>" + alignFact(name) + "</div>" + grp.list +
    '<div id="wtech" class="wtech">' + techHTML(localTech(w), Object.keys(localTech(w)).length ? [{ n: "TCC TV" }] : []) + "</div>";
  if (shows.length || held.length) h += '<div class="chips wrap" style="margin:10px 0 0">' + shows.filter(s => s.n).map(s => '<a class="chip" href="#/p/' + encodeURIComponent(s.k) + "/" + encodeURIComponent(s.n) + '">' + esc(s.k + " · " + s.n) + "</a>").join("") +
    held.map(t => champHidden(t) ? "" : '<a class="chip gold" href="#/titre/' + encodeURIComponent(t.id) + '">🏆 ' + esc(t.n) + "</a>").join("") + "</div>";
  h += "</section>";
  h += palmaresHTML(name);
  // 3 derniers matchs (résultat derrière le bouton spoiler)
  const last = lastMatches(name, 3);
  h += "<h2>Ses 3 derniers matchs</h2>";
  if (last.length) {
    h += '<div class="list">' + last.map(m => '<div class="item"><span class="lbl"><b>' + esc(m.t || ((m.ev || m.k) + (m.d ? " du " + fmt(m.d) : ""))) + "</b><small>" + esc([m.k, m.ev].filter(Boolean).join(" · ")) + (m.d ? " · " + fmt(m.d) : "") + "</small>" +
      (m.r ? '<span class="spoil inline"><button class="linkbtn spoilbtn" data-act="reveal">👀 Voir le résultat (spoiler)</button><span class="spoilbody">' + linkNames(m.r) + "</span></span>" : "") + "</span>" +
      (okVid(m.v) && !lock ? '<button class="btn small ghost" data-act="play" data-id="' + esc(m.v) + '" data-t="' + esc(m.vt || m.t || name) + '">▶</button>' : "") +
      (m.d && m.k && S.P[m.k] ? '<a class="chev" href="' + hlHref(m.k, m.show || (m.ev && S.P[m.k].s && S.P[m.k].s[m.ev] ? m.ev : "PLE"), m.d) + '" aria-label="Highlights">›</a>' : "") + "</div>").join("") + "</div>";
  } else h += '<p class="note">Pas encore de résultat récent dans l’app.</p>';
  // 5 matchs de référence
  const ref = (w && Array.isArray(w.ref) ? w.ref : []).slice(0, 5), kk = k && S.P[k] ? k : "WWE";
  h += "<h2>Ses 5 matchs de référence</h2>";
  if (ref.length) h += '<div class="list">' + ref.map(m => {
    // vidéo officielle connue -> on la regarde dans l'app ; sinon simple recherche YouTube du combat complet,
    // et c'est le membre qui choisit la vidéo
    const go = refButton(m);
    return '<div class="item"><span class="lbl"><b>' + linkNames(m.t) + "</b><small>" + esc(m.ev || "") + "</small></span>" + go + "</div>";
  }).join("") + "</div>";
  else h += '<p class="note">Ses matchs de référence seront ajoutés lors d’une prochaine mise à jour' + (S.user ? " (ajoute-le à tes favoris pour qu’il soit suivi en priorité)" : "") + ".</p>";
  h += '<p class="note small" style="margin-top:8px"><a class="linkbtn" style="padding:0" href="' + esc(ytSearch(kk, name + " highlights")) + '" target="_blank" rel="noopener">Ses vidéos sur la chaîne YouTube officielle ↗</a></p>';
  h += "<h2>Prochains matchs annoncés</h2>" + (up.length ? '<div class="list">' + up.map(e => '<a class="item" href="' + esc(evHref(e)) + '"' + shAttr(evCard(e)) +
    '><span class="lbl"><b>' + esc(e.t) + "</b><small>" + esc(e.k) + " · " + fmt(e.d) + (e.line ? " · " + esc(e.line) : "") + '</small></span><span class="chev">›</span></a>').join("") + "</div>"
    : '<p class="note">Rien d’annoncé dans l’app pour l’instant.</p>');
  h += "<h2>Son actu</h2>" + (arts.length ? '<div class="list">' + arts.map(a => '<a class="item" href="' + esc(a.u) + '" target="_blank" rel="noopener"' + shAttr(artCard(a)) + '><span class="lbl"><b>' + esc(a.t) +
    "</b><small>" + esc(a.s || "") + (a.tr ? " · titre traduit" : "") + '</small></span><span class="rt">' + (a.d ? fmt(a.d) : "") + "</span></a>").join("") + "</div>" : '<p class="note">Pas d’article en français dans l’app qui parle de lui ou d’elle.</p>') +
    '<p class="note" style="margin-top:8px"><a class="linkbtn" style="padding:0" href="https://news.google.com/search?q=' + encodeURIComponent('"' + name + '"') + '&hl=fr&gl=FR&ceid=FR:fr" target="_blank" rel="noopener">Plus d’actu sur Google Actualités ↗</a></p>';
  if (vids.length) h += '<h2>Ses matchs à découvrir</h2><div class="list">' + vids.map(m => '<button class="item" data-act="play" data-id="' + esc(m.id) + '" data-t="' + esc(m.t) + '"' + shAttr({ ty: "vid", t: m.t, s: [m.k, m.ev].filter(Boolean).join(" · "), id: m.id }) + '><span class="lbl"><b>' + esc(m.t) +
    "</b><small>" + esc(m.k) + (m.ev ? " · " + esc(m.ev) : "") + '</small></span><span class="chev">▶</span></button>').join("") + "</div>";
  h += commentsBox(name);
  return h;
}

// ---------- Wikipédia : résumé + homonymes ----------
const wikiCache = {};
const isPerson = sj => /catcheu|lutteu|wrestler|luchador/.test(norm(sj.description || ""));
const isCatch = sj => /catcheu|lutteu|catch professionnel|wrestl|luchador/.test(norm((sj.description || "") + " " + (sj.extract || "")));
const pick = sj => ({ title: sj.title, desc: sj.description || "", extract: sj.extract || "", qid: sj.wikibase_item || "", url: sj.content_urls && sj.content_urls.desktop && sj.content_urls.desktop.page });
async function summary(title) { return (await fetch("https://fr.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title.replace(/ /g, "_")))).json(); }
// Tous les catcheurs dont la fiche correspond au nom tapé (pour proposer le bon en cas d'homonymes)
async function candidates(name) {
  if (wikiCache[name]) return wikiCache[name];
  const api = "https://fr.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=8&srsearch=" + encodeURIComponent(name + " catch");
  const j = await (await fetch(api)).json();
  const hits = (j.query && j.query.search) || [], toks = norm(name).split(/\s+/).filter(Boolean), out = [];
  for (const hit of hits) {
    const sj = await summary(hit.title);
    if (sj.type === "disambiguation" || !isCatch(sj)) continue;
    const t = norm(sj.title.replace(/\s*\(.*\)$/, ""));
    out.push(Object.assign(pick(sj), { person: isPerson(sj), match: toks.every(x => t.indexOf(x) >= 0) }));
  }
  return (wikiCache[name] = out);
}
const wikiCard = w => '<div class="wikicard">' + (w.desc ? "<small>" + esc(w.desc) + "</small>" : "") + "<p>" + esc(w.extract) + "</p>" +
  (okHttp(w.url) ? '<a href="' + esc(w.url) + '" target="_blank" rel="noopener">Lire la suite sur Wikipédia ↗</a>' : "") + '<small class="src">Source : Wikipédia (licence CC BY-SA)</small></div>';

export async function fillWiki(name, wt) {
  if (PREVIEW) return;
  const loc = localTech(wInfo(canonical(name)));
  const box = () => document.getElementById("wiki"), local = wInfo(name);
  try {
    let w = null;
    if (wt) { const sj = await summary(wt); if (sj && sj.extract) w = pick(sj); }
    else {
      const list = await candidates(name);
      const people = list.filter(c => c.person && c.match);
      w = people[0] || list.find(c => c.match) || list[0] || null;
      // homonymes : plusieurs catcheurs portent ce nom -> on propose de choisir
      if (people.length > 1 && document.getElementById("wchoose")) {
        document.getElementById("wchoose").innerHTML = '<div class="choose"><b>Plusieurs catcheurs portent ce nom. Lequel veux-tu voir ?</b>' + people.slice(0, 6).map(c =>
          '<a class="choice" href="#/catcheur/' + encodeURIComponent(c.title.replace(/\s*\(.*\)$/, "")) + "/w/" + encodeURIComponent(c.title) + '"><b>' + esc(c.title) + "</b><small>" + esc(c.desc || c.extract.slice(0, 90)) + "</small></a>").join("") + "</div>";
      }
    }
    fillTech(canonical(name), loc, w && w.qid);
    if (!box()) return;
    if (!w) { box().innerHTML = local && local.txt ? "" : '<p class="note">Pas de fiche Wikipédia en français trouvée pour ce nom. Vérifie l’orthographe ou essaie son nom de ring complet.</p>'; return; }
    box().innerHTML = wikiCard(w);
    const pr = document.getElementById("wpromo");
    if (pr && pr.textContent === "–") { const f = promoIn(w.desc + " " + w.extract); if (f) pr.textContent = f; }
  } catch (e) {
    fillTech(canonical(name), loc, "");
    if (box()) box().innerHTML = local && local.txt ? "" : '<p class="note">Impossible de joindre Wikipédia pour le moment.</p>';
  }
}
