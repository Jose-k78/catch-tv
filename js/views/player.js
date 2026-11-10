// TCC Play : lecteur vidéo de l'app (format vertical, style Prime Video) + Archives par promotion, show et date.
// Sources : vidéos des chaînes YouTube officielles (robot : data/feed.json « yt », highlights.json « v », matches.json),
// lecteurs vidéo ajoutés par le modérateur (data/links.json, lus dans l'app, un lien « par défaut » qui se lance tout seul),
// et la plateforme officielle (Netflix s'ouvre à part : il ne se lit pas dans une app).
import { searchEvents } from "./event.js";
import { S, ACT, FORM } from "../state.js";
import { esc, fmt, ICON, lsGet, lsSet, shAttr, modal, toast } from "../util.js";
import { commentsBox } from "./comments.js";
import { linkNames } from "../wrestlers.js";
import { showLogo } from "../assets.js";
import { PREVIEW } from "../content.js";
import { linksOf, linksHTML, playerHTML, defaultLink, TPLAY, saveLinks } from "../links.js";
import { allPle, epis, watchLinks, PARENT } from "./catalog.js";

const okId = id => /^[\w-]{11}$/.test(String(id || ""));
const keyParts = k => { const p = String(k).split("|"); return { k: p[0], show: p[1], d: p[2] }; };
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
// toutes les vidéos connues : { id, t, k, show, d, src }
export function allVideos() {
  const out = [], seen = {};
  const add = (v, meta) => { if (!v || !okId(v.id) || seen[v.id]) return; seen[v.id] = 1; out.push(Object.assign({ id: v.id, t: v.t || "" }, meta)); };
  Object.keys((S.feed && S.feed.yt) || {}).forEach(k => (S.feed.yt[k] || []).forEach(v => add(v, keyParts(k))));
  Object.keys(S.highlights || {}).forEach(k => ((S.highlights[k] || {}).v || []).forEach(v => add(v, keyParts(k))));
  (S.matches || []).forEach(m => add(m, { k: m.k, show: m.ev || "Match à découvrir", d: "", full: true }));
  return out.sort((a, b) => String(b.d || "").localeCompare(String(a.d || "")));
}
const LIKE = "ctv.plike";
const likes = () => { try { return JSON.parse(lsGet(LIKE) || "{}"); } catch (e) { return {}; } };
ACT.plike = el => { const L = likes(), id = el.dataset.id, v = +el.dataset.v; L[id] = L[id] === v ? 0 : v; lsSet(LIKE, JSON.stringify(L)); const p = el.closest(".plikes"); if (p) p.outerHTML = likeBar(id); };
const likeBar = id => { const v = likes()[id] || 0; return '<div class="plikes"><button class="chip' + (v === 1 ? " on" : "") + '" data-act="plike" data-id="' + id + '" data-v="1">👍 J’aime</button><button class="chip' + (v === -1 ? " on" : "") + '" data-act="plike" data-id="' + id + '" data-v="-1">👎</button></div>'; };
const thumb = v => '<a class="pvid" href="#/player/v/' + v.id + '"' + shAttr({ ty: "vid", t: v.t, s: [v.k, v.show].filter(Boolean).join(" · "), id: v.id }) + '><span class="pth" style="background-image:url(https://i.ytimg.com/vi/' + v.id + '/mqdefault.jpg)">▶</span><span class="pinfo"><b>' + esc(v.t) + "</b><small>" + esc([v.k, v.show, v.d ? fmt(v.d) : ""].filter(Boolean).join(" · ")) + "</small></span></a>";
const row = (title, list) => list.length ? "<h2>" + title + '</h2><div class="prow">' + list.slice(0, 14).map(thumb).join("") + "</div>" : "";
const evKeyOf = (k, show, d) => k + "|" + (show || "PLE") + "|" + d;
const evHrefP = (k, show, d) => "#/player/e/" + encodeURIComponent(evKeyOf(k, show, d));
// carte d'un show à une date (appui long : choisir la source, ajouter un lecteur pour le modo)
const evTile = (k, show, d, t) => '<a class="pev" href="' + evHrefP(k, show, d) + '"' + shAttr({ ty: "ev", t: t || show || k, s: k + (show && show !== "PLE" ? " · " + show : "") + " · " + fmt(d), h: "#/ev/" + [k, show || "PLE", d].map(encodeURIComponent).join("/"), k: k }) + ">" +
  (showLogo(k, show && show !== "PLE" ? show : "") ? '<img src="' + esc(showLogo(k, show && show !== "PLE" ? show : "")) + '" alt="" loading="lazy">' : "") +
  "<b>" + esc(t || show || k) + "</b><small>" + fmt(d) + " " + d.slice(0, 4) + "</small>" + (defaultLink("ev:" + evKeyOf(k, show, d)) || linksOf("ev:" + evKeyOf(k, show, d)).length ? '<i class="pok">▶</i>' : "") + "</a>";

const PROMOS = () => Object.keys(S.P || {}).filter(k => !PARENT[k]).concat(Object.keys(S.P || {}).filter(k => PARENT[k]));
let pq = "";
function topBar(cur) {
  return '<section class="phero"><span class="eyebrow">' + TPLAY + '</span><h1>' + (cur && cur !== "home" ? esc(cur) : "Archives et vidéos") + "</h1>" +
    '<div class="psearch"><input id="pq" type="search" placeholder="Chercher une vidéo, un show, un catcheur…" autocomplete="off" value="' + esc(pq) + '"></div></section>' +
    '<nav class="tabs ptabs">' + [["home", "Accueil"]].concat(PROMOS().map(k => [k, k]), [["legendes", "WWF · WCW · ECW"]]).map(x =>
      '<a class="tab' + (x[0] === cur ? " on" : "") + '" href="' + (x[0] === "home" ? "#/player" : "#/player/k/" + encodeURIComponent(x[0])) + '">' + esc(x[1]) + "</a>").join("") +
    (S.isAdmin ? '<a class="tab" href="#/player/reglages">⚙️</a>' : "") + "</nav>" + '<div id="pres">' + (pq.trim() ? searchBlock(pq.trim()) : "") + "</div>";
}
// recherche : vidéos de l'app, puis sur le web (Dailymotion et archive.org, sans clé), et boutons vers YouTube, VK, OK.ru
const WEB = {}, ARCH = {};
function searchBlock(q) {
  const v = searchVideos(q, 20), enc = encodeURIComponent(q);
  return (v.length ? '<h2>Dans l’app</h2><div class="prow">' + v.map(thumb).join("") + "</div>" : '<p class="note">Rien dans l’app pour « ' + esc(q) + " ».</p>") +
    (q.length > 2 && !PREVIEW ? '<h2>Fiches des shows <small class="cnt">archives</small></h2><div id="parch">' + (ARCH[q] || '<p class="note small">Recherche des shows passés…</p>') + "</div>" : "") +
    '<h2>Sur le web</h2><div id="pweb">' + (WEB[q] || '<p class="note small">Recherche…</p>') + "</div>" +
    '<div class="chips" style="margin:6px 16px"><a class="chip" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=' + enc + '">▶ YouTube</a>' +
    '<a class="chip" target="_blank" rel="noopener" href="https://vkvideo.ru/?q=' + enc + '">VK Video</a><a class="chip" target="_blank" rel="noopener" href="https://ok.ru/video/search?st.query=' + enc + '">OK.ru</a>' +
    '<a class="chip" target="_blank" rel="noopener" href="https://www.dailymotion.com/search/' + enc + '/videos">Dailymotion</a><a class="chip" target="_blank" rel="noopener" href="https://archive.org/search?query=' + enc + '&and[]=mediatype%3A%22movies%22">archive.org</a></div>';
}
const webCard = (u, img, t, src) => '<button class="pvid" data-act="mlplay" data-u="' + esc(u) + '" data-t="' + esc(t) + '"><span class="pth" style="background-image:url(\'' + esc(img) + '\')">▶</span><span class="pinfo"><b>' + esc(t) + "</b><small>" + esc(src) + "</small></span></button>";
async function webSearch(q) {
  if (WEB[q]) return;
  const enc = encodeURIComponent(q), out = [];
  const dm = fetch("https://api.dailymotion.com/videos?search=" + enc + "&fields=id,title,thumbnail_240_url,owner.screenname&limit=12").then(r => r.json()).then(j => (j.list || []).forEach(x => out.push(webCard("https://www.dailymotion.com/video/" + x.id, x.thumbnail_240_url, x.title, "Dailymotion · " + (x["owner.screenname"] || ""))))).catch(() => {});
  const ar = fetch("https://archive.org/advancedsearch.php?q=" + encodeURIComponent("(" + q + ") AND mediatype:movies") + "&fl[]=identifier&fl[]=title&rows=12&output=json").then(r => r.json()).then(j => ((j.response || {}).docs || []).forEach(x => out.push(webCard("https://archive.org/details/" + x.identifier, "https://archive.org/services/img/" + x.identifier, x.title || x.identifier, "archive.org")))).catch(() => {});
  // fiches des anciens shows (résumé, matchs, résultats, « J'ai vu ce show », liens du modo)
  searchEvents(q).then(list => { ARCH[q] = list.length ? '<div class="list">' + list.slice(0, 6).map(x => '<a class="item" href="#/evenement/' + encodeURIComponent(x.l + ":" + x.title) + '"><span class="lbl"><b>' + esc(x.title.replace(/\s*\((?:catch|professional wrestling|wrestling)\)$/i, "")) + "</b><small>Fiche du show : résumé, matchs, résultats, liens</small></span><span class=\"chev\">›</span></a>").join("") + "</div>" : '<p class="note small">Aucun show passé trouvé à ce nom (essaie avec le numéro ou l’année).</p>'; const el = document.getElementById("parch"); if (el && pq === q) el.innerHTML = ARCH[q]; }).catch(() => {});
  await Promise.all([dm, ar]);
  WEB[q] = out.length ? '<div class="prow">' + out.join("") + "</div>" : '<p class="note small">Rien trouvé sur Dailymotion ni archive.org.</p>';
  const el = document.getElementById("pweb"); if (el && pq === q) el.innerHTML = WEB[q];
}
let pqT = null;
document.addEventListener("input", e => {
  if (e.target.id !== "pq") return; pq = e.target.value; const r = document.getElementById("pres"), q = pq.trim();
  if (r) r.innerHTML = q.length > 1 ? searchBlock(q) : "";
  clearTimeout(pqT); if (q.length > 2 && !PREVIEW) pqT = setTimeout(() => { pq = q; webSearch(q); }, 650);
});

export function playerView(a, b, c) {
  const vids = allVideos();
  if (a === "v") return watchView(b, vids);
  if (a === "e") return eventView(decodeURIComponent(b || ""), vids);
  if (a === "reglages") return settingsView();
  if (a === "k") return promoView(decodeURIComponent(b || ""), c ? decodeURIComponent(c) : "", vids);
  const L = likes(), liked = vids.filter(v => L[v.id] === 1);
  let h = topBar("home");
  // derniers shows (dates) toutes promotions
  const recent = recentShows(14);
  if (recent.length) h += '<h2>Les derniers shows</h2><div class="prow">' + recent.map(x => evTile(x.k, x.show, x.d, x.t)).join("") + "</div>";
  // la sélection du modo (liens collés dans ⚙️ Réglages), puis un tirage au hasard parmi tous ses liens
  const mix = linksOf("play:mix");
  if (mix.length) h += "<h2>⭐ La sélection du modo</h2>" + '<div class="prow">' + mix.map(x => '<button class="pvid" data-act="mlplay" data-u="' + esc(x.u) + '" data-t="' + esc(x.t || "Vidéo") + '"><span class="pth modo">▶<small>' + esc((x.u.match(/\/\/(?:www\.)?([^/.]+)/) || [])[1] || "") + '</small></span><span class="pinfo"><b>' + esc(x.t || "Vidéo") + "</b><small>Ajoutée par le modo</small></span></button>").join("") + "</div>";
  h += modoRow();
  h += row("Les plus récentes", vids.filter(v => v.d)) + row("👍 Tes vidéos aimées", liked) + row("Matchs complets", vids.filter(v => v.full));
  PROMOS().forEach(k => { h += row('<a href="#/player/k/' + encodeURIComponent(k) + '">' + esc(k) + " ›</a>", vids.filter(v => v.k === k && v.d)); });
  return h;
}
// liens du modo tirés au hasard (un nouveau tirage à chaque ouverture de l'app)
const SEED = Math.random();
function modoRow() {
  const L = [];
  Object.keys(S.links || {}).filter(key => key.indexOf("chan:") !== 0 && key.indexOf("redir:") !== 0 && key !== "play:mix").forEach(key => linksOf(key).forEach(x => L.push({ key: key, x: x })));
  if (!L.length) return "";
  const r = (i => () => { i = (i * 9301 + 49297) % 233280; return i / 233280; })(Math.floor(SEED * 233280));
  for (let i = L.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [L[i], L[j]] = [L[j], L[i]]; }
  const label = (key, x) => { if (key.indexOf("ev:") === 0) { const p = keyParts(key.slice(3)); return { t: x.t || (p.show === "PLE" ? ((allPle().find(e => e.k === p.k && e.d === p.d) || {}).t || p.k) : p.show), s: p.k + (p.d ? " · " + fmt(p.d) : "") }; }
    const m = key.match(/^(m|ref|ent|entm|tn|story):(.*)$/); return { t: x.t || (m ? m[2].split("|")[0] : key), s: ({ m: "Match", ref: "Match de référence", ent: "Entrance", entm: "Entrance", tn: "Tournoi", story: "Storyline" })[m && m[1]] || "Lien" }; };
  return "<h2>🎲 Au hasard dans " + TPLAY + '</h2><div class="prow">' + L.slice(0, 12).map(o => { const lb = label(o.key, o.x), plat = o.x.p || (o.x.u.match(/\/\/(?:www\.)?([^/.]+)/) || [])[1] || "";
    const inner = '<span class="pth modo">▶<small>' + esc(plat) + '</small></span><span class="pinfo"><b>' + esc(lb.t) + "</b><small>" + esc(lb.s) + "</small></span>";
    return o.key.indexOf("ev:") === 0 ? '<a class="pvid" href="#/player/e/' + encodeURIComponent(o.key.slice(3)) + '">' + inner + "</a>" : '<button class="pvid" data-act="mlplay" data-u="' + esc(o.x.u) + '" data-t="' + esc(lb.t) + '">' + inner + "</button>"; }).join("") + "</div>";
}
// shows passés (épisodes et PLE) d'une promotion, du plus récent au plus ancien
function pastOf(k, show) {
  const out = [], td = new Date().toISOString().slice(0, 10), pr = S.P[k]; if (!pr) return out;
  if (!show || show === "PLE") allPle().filter(e => e.k === k && e.d && e.d <= td).forEach(e => out.push({ k: k, show: "PLE", d: e.d, t: e.t }));
  if (pr.s) Object.keys(pr.s).filter(n => !show || n === show).forEach(n => epis(k, n, 104, 0).filter(e => e.d <= td).forEach(e => out.push({ k: k, show: n, d: e.d, t: e.t })));
  // dates connues par les vidéos et les liens du modo
  Object.keys(S.highlights || {}).forEach(key => { const p = keyParts(key); if (p.k === k && (!show || p.show === show) && p.d && !out.some(x => x.show === p.show && x.d === p.d)) out.push({ k: k, show: p.show, d: p.d, t: p.show === "PLE" ? k : p.show }); });
  return out.sort((x, y) => y.d.localeCompare(x.d));
}
function recentShows(n) { let a = []; PROMOS().forEach(k => { a = a.concat(pastOf(k).slice(0, 4)); }); return a.sort((x, y) => y.d.localeCompare(x.d)).slice(0, n); }

function promoView(k, show, vids) {
  if (k === "legendes") return legendsView(vids);
  let h = topBar(PARENT[k] ? k : k);
  const pr = S.P[k];
  if (!pr) { // WWF, WCW, ECW…
    const L = vids.filter(v => v.k === k);
    return h + (L.length ? '<div class="prow pcol">' + L.map(thumb).join("") + "</div>" : '<p class="note">Pas encore de vidéo officielle pour ' + esc(k) + " dans l’app.</p>") + datePicker(k, "");
  }
  const shows = ["PLE"].concat(Object.keys(pr.s || {}));
  h += '<nav class="tabs sub">' + ['<a class="tab' + (!show ? " on" : "") + '" href="#/player/k/' + encodeURIComponent(k) + '">Tout</a>'].concat(shows.map(n =>
    '<a class="tab' + (show === n ? " on" : "") + '" href="#/player/k/' + encodeURIComponent(k) + "/" + encodeURIComponent(n) + '">' + esc(n) + "</a>")).join("") + "</nav>";
  // la vraie chaîne YouTube du show (ou de la promotion), choisie par le modo
  const ch = chanOf(k, show);
  if (ch || S.isAdmin) h += '<div class="pchan">' + (ch ? '<a class="btn small" href="' + esc(ch) + '" target="_blank" rel="noopener">▶ Chaîne YouTube officielle' + (show ? " · " + esc(show) : "") + " ↗</a>" : "") + (S.isAdmin ? '<button class="linkbtn" data-act="pchan" data-k="' + esc(k) + '" data-s="' + esc(show || "") + '">✏️ ' + (ch ? "Changer" : "Définir") + " la chaîne YouTube</button>" : "") + "</div>";
  h += datePicker(k, show);
  // dates par année puis par mois
  const past = pastOf(k, show), years = {};
  past.forEach(x => { const y = x.d.slice(0, 4); (years[y] = years[y] || []).push(x); });
  Object.keys(years).sort().reverse().forEach(y => {
    const months = {}; years[y].forEach(x => { const m = +x.d.slice(5, 7); (months[m] = months[m] || []).push(x); });
    h += "<h2>" + y + "</h2>" + Object.keys(months).sort((a, b) => b - a).map(m => '<p class="evsub">' + MOIS[m - 1] + '</p><div class="prow">' + months[m].map(x => evTile(x.k, x.show, x.d, x.t)).join("") + "</div>").join("");
  });
  const L = vids.filter(v => v.k === k && (!show || v.show === show));
  h += row("Vidéos officielles", L);
  return h;
}
// choisir une date : le show s'ouvre avec la meilleure source disponible
function datePicker(k, show) {
  const pr = S.P[k], shows = pr ? ["PLE"].concat(Object.keys(pr.s || {})) : [];
  return '<form class="pdate" data-form="pdate"><b>📅 Choisir une date</b>' + (shows.length && !show ? '<select name="s">' + shows.map(n => "<option>" + esc(n) + "</option>").join("") + "</select>" : '<input type="hidden" name="s" value="' + esc(show || "PLE") + '">') +
    '<input type="hidden" name="k" value="' + esc(k) + '"><input type="date" name="d" required max="' + new Date().toISOString().slice(0, 10) + '"><button class="btn small">Voir</button></form>';
}
FORM.pdate = f => { const d = f.d.value; if (!d) return; location.hash = evHrefP(f.k.value, f.s.value, d); };

function legendsView(vids) {
  let h = topBar("legendes");
  ["WWF", "WCW", "ECW"].forEach(k => { const L = vids.filter(v => v.k === k); h += "<h2>" + k + "</h2>" + (L.length ? '<div class="prow">' + L.map(thumb).join("") + "</div>" : '<p class="note small">Bientôt.</p>') + datePicker(k, ""); });
  return h;
}

// un show à une date : lecteur par défaut du modo (ou 1re vidéo officielle) en haut, puis toutes les sources
function eventView(key, vids) {
  const p = key.split("|"), k = p[0], show = p[1] || "PLE", d = p[2] || "", lk = "ev:" + key;
  const ple = show === "PLE" ? allPle().find(e => e.k === k && e.d === d) : null;
  const t = ple ? ple.t : show;
  const L = vids.filter(v => v.k === k && (v.show || "PLE") === show && v.d === d);
  const def = defaultLink(lk) || linksOf(lk)[0];
  let h = '<a class="back" href="#/player/k/' + encodeURIComponent(k) + (show ? "/" + encodeURIComponent(show) : "") + '">' + ICON.back + " " + esc(k) + "</a>";
  if (def) h += '<div class="pstage">' + playerHTML(def.u, t, { muted: true }) + "</div>";
  else if (L[0] && !PREVIEW) h += '<div class="pstage"><div class="player"><iframe src="https://www.youtube.com/embed/' + L[0].id + '?rel=0" title="' + esc(L[0].t) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div></div>';
  h += '<section class="pmeta"><h1>' + esc(t) + "</h1><small>" + esc(k) + (show !== "PLE" ? " · " + esc(show) : " · PLE") + (d ? " · " + fmt(d) + " " + d.slice(0, 4) : "") + "</small></section>";
  h += '<div style="margin:0 16px">' + linksHTML(lk, { title: t + (d ? " du " + fmt(d) : ""), href: location.hash, ask: true }) + "</div>";
  if (L.length) h += '<h2>Vidéos officielles</h2><div class="prow pcol">' + L.map(thumb).join("") + "</div>";
  // plateforme officielle (s'ouvre à part)
  const e = ple || (S.P[k] && S.P[k].s && S.P[k].s[show] ? epis(k, show, 104, 2).find(x => x.d === d) : null);
  const W = e ? watchLinks(e) : [];
  if (W.length) h += "<h2>Plateforme officielle</h2>" + W.map(x => '<a class="btn wide ghost evwatch" href="' + esc(x.u) + '" target="_blank" rel="noopener">' + ICON.play + " " + esc(x.n) + " ↗</a>").join("");
  h += '<p class="note small" style="margin:10px 16px"><a class="linkbtn" style="padding:0" href="#/ev/' + [k, show, d].map(encodeURIComponent).join("/") + '">Page du show : affiche, résumé, résultats ›</a></p>';
  h += row("Autres vidéos " + esc(k), vids.filter(v => v.k === k && L.indexOf(v) < 0));
  return h;
}
function watchView(id, vids) {
  const v = vids.find(x => x.id === id) || { id: id, t: "Vidéo", k: "" };
  if (!okId(id)) return '<p class="empty">Vidéo introuvable.</p>';
  let h = '<a class="back" href="javascript:history.back()">' + ICON.back + " TCC Play</a>";
  h += '<div class="pstage">' + (PREVIEW ? '<p class="note" style="margin:16px">La vidéo se lira ici une fois l’app en ligne.</p>' :
    '<div class="player"><iframe src="https://www.youtube.com/embed/' + id + '?autoplay=1&rel=0" title="' + esc(v.t) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>') + "</div>";
  h += '<section class="pmeta"><h1>' + linkNames(v.t) + "</h1><small>" + esc([v.k, v.show, v.d ? fmt(v.d) : ""].filter(Boolean).join(" · ")) + " · Source : YouTube (chaîne officielle)</small>" + likeBar(id) +
    '<a class="linkbtn" href="https://www.youtube.com/watch?v=' + id + '" target="_blank" rel="noopener">Ouvrir sur YouTube ↗</a>' +
    (v.d && v.k ? ' · <a class="linkbtn" href="' + evHrefP(v.k, v.show, v.d) + '">Tout le show ›</a>' : "") + "</section>";
  const same = vids.filter(x => x.id !== id && x.k === v.k && x.show === v.show && x.d === v.d), more = vids.filter(x => x.id !== id && x.k === v.k && same.indexOf(x) < 0);
  h += row("Du même show", same) + row("Autres vidéos " + esc(v.k || ""), more);
  h += commentsBox("video " + id);
  return h;
}
// ⚙️ réglages du modo : tous les lecteurs ajoutés, choix du lien par défaut
function settingsView() {
  let h = topBar("reglages");
  if (!S.isAdmin) return h + '<p class="note">Réservé au modérateur.</p>';
  const keys = Object.keys(S.links || {}).filter(k => k.indexOf("ev:") === 0).sort().reverse();
  h += '<h2>⭐ Vidéos à proposer dans ' + TPLAY + '</h2><p class="note small">Colle ici des liens (YouTube, Dailymotion…) : ils apparaissent sur l’accueil de TCC Play, dans « La sélection du modo ». Donne un titre à chaque lien.</p>' + '<div class="psets">' + linksHTML("play:mix", { title: "" }) + "</div>";
  h += '<h2>Chaînes YouTube des shows</h2><p class="note small">La vraie chaîne YouTube de chaque show : un bouton y mène depuis TCC Play.</p><div class="list">' + PROMOS().map(k => [""].concat(Object.keys((S.P[k] || {}).s || {})).map(sh => { const c = (linksOf("chan:" + k + "|" + sh)[0] || {}).u || "";
    return '<div class="item"><span class="lbl"><b>' + esc(k + (sh ? " · " + sh : " (toute la promotion)")) + "</b><small>" + esc(c || "pas de chaîne définie") + '</small></span><button class="btn small ghost" data-act="pchan" data-k="' + esc(k) + '" data-s="' + esc(sh) + '">✏️</button></div>'; }).join("")).join("") + "</div>";
  const rds = Object.keys(S.links || {}).filter(k => k.indexOf("redir:") === 0);
  h += '<h2>↪ Redirections</h2><p class="note small">En mode ✏️, reste appuyé sur un lien de l’app pour l’envoyer ailleurs.</p>' + (rds.length ? '<div class="list">' + rds.map(k => '<div class="item"><span class="lbl"><b>' + esc(k.slice(6)) + "</b><small>→ " + esc((((S.links || {})[k] || [])[0] || {}).u || "") + '</small></span><button class="btn small ghost" data-act="redir" data-h="' + esc(k.slice(6)) + '">✏️</button></div>').join("") + "</div>" : '<p class="note">Aucune redirection.</p>');
  h += '<h2>Lecteurs vidéo ajoutés</h2><p class="note small">Chaque lien s’ouvre dans le lecteur de l’app. ⭐ = lien par défaut, lancé directement quand on choisit le show. Pour en ajouter un : reste appuyé sur un show (ou ouvre-le) puis « Ajouter un lien ».</p>';
  h += keys.length ? keys.map(k => { const p = keyParts(k.slice(3)); return '<div class="psets"><a href="' + evHrefP(p.k, p.show, p.d) + '"><b>' + esc(p.k + " · " + (p.show || "PLE")) + "</b> <small>" + (p.d ? fmt(p.d) + " " + p.d.slice(0, 4) : "") + "</small></a>" + linksHTML(k, { title: p.show }) + "</div>"; }).join("") : '<p class="note">Aucun lien pour l’instant.</p>';
  return h;
}

const chanOf = (k, show) => (linksOf("chan:" + k + "|" + (show || ""))[0] || linksOf("chan:" + k + "|")[0] || {}).u || "";
ACT.pchan = el => {
  if (!S.isAdmin) return; const key = "chan:" + el.dataset.k + "|" + (el.dataset.s || ""), cur = (linksOf(key)[0] || {}).u || "";
  modal((box, close) => {
    box.innerHTML = "<h3>Chaîne YouTube · " + esc(el.dataset.k + (el.dataset.s ? " · " + el.dataset.s : "")) + '</h3><p class="sub">Colle l’adresse de la chaîne (ex. : https://www.youtube.com/@WWE). Vide = retirer.</p><input id="pchu" type="url" placeholder="https://www.youtube.com/@…" value="' + esc(cur) + '" style="width:100%"><button class="btn wide" style="margin-top:10px" data-ok>Enregistrer</button><button class="btn wide ghost" style="margin-top:6px" data-close>Annuler</button>';
    box.addEventListener("click", async e => {
      if (e.target.closest("[data-close]")) return close();
      if (!e.target.closest("[data-ok]")) return;
      const u = box.querySelector("#pchu").value.trim();
      if (u && !/^https:\/\/(www\.|m\.)?youtube\.com\//.test(u)) return toast("Il faut une adresse youtube.com");
      close();
      try { if (await saveLinks(items => { if (u) items[key] = [{ u: u }]; else delete items[key]; }, "Chaîne YouTube d’un show")) toast("Enregistré ✓"); } catch (er) { toast("Pas enregistré : " + ((er && er.message) || "")); }
    });
  });
};
// recherche dans les archives (recherche globale et barre de TCC Play)
export function searchVideos(q, n) {
  const words = String(q || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/).filter(w => w.length > 1);
  if (!words.length) return [];
  return allVideos().filter(v => { const t = (v.t + " " + v.k + " " + (v.show || "")).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); return words.every(w => t.indexOf(w) >= 0); }).slice(0, n || 8);
}
export const playerThumb = v => thumb(v);
