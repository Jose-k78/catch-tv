// TCC Player : lecteur vidéo de l'app (format vertical) + Archives par promotion et par année.
// Sources : vidéos des chaînes YouTube officielles (robot : data/feed.json « yt », highlights.json « v », matches.json),
// liens directs officiels des shows (« w ») et la plateforme officielle (Netflix s'ouvre à part : il ne se lit pas dans une app).
// Jamais de copies non officielles (VK, archive.org…).
import { S, ACT } from "../state.js";
import { esc, fmt, ICON, lsGet, lsSet } from "../util.js";
import { commentsBox } from "./comments.js";
import { linkNames } from "../wrestlers.js";
import { showLogo } from "../assets.js";
import { PREVIEW } from "../content.js";
import { linksHTML } from "../links.js";

const okId = id => /^[\w-]{11}$/.test(String(id || ""));
const keyParts = k => { const p = String(k).split("|"); return { k: p[0], show: p[1], d: p[2] }; };
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
const thumb = v => '<a class="pvid" href="#/player/v/' + v.id + '"><span class="pth" style="background-image:url(https://i.ytimg.com/vi/' + v.id + '/mqdefault.jpg)">▶</span><span class="pinfo"><b>' + esc(v.t) + "</b><small>" + esc([v.k, v.show, v.d ? fmt(v.d) : ""].filter(Boolean).join(" · ")) + "</small></span></a>";
const row = (title, list) => list.length ? "<h2>" + title + '</h2><div class="prow">' + list.slice(0, 12).map(thumb).join("") + "</div>" : "";

export function playerView(a, b) {
  const vids = allVideos();
  if (a === "v") return watchView(b, vids);
  // vidéos d'un show précis : #/player/e/K|show|date (bouton « TCC Player » des shows, appui long)
  if (a === "e") {
    const key = decodeURIComponent(b || ""), p = key.split("|"), L = vids.filter(v => v.k === p[0] && (v.show || "PLE") === (p[1] || "PLE") && v.d === p[2]);
    let h = '<a class="back" href="#/player">' + ICON.back + " TCC Player</a><h1>" + esc((p[1] === "PLE" ? "" : p[1] + " · ") + p[0]) + "</h1><small class=\"note\" style=\"margin:0 16px\">" + (p[2] ? fmt(p[2]) : "") + "</small>";
    h += L.length ? '<div class="prow pcol">' + L.map(thumb).join("") + "</div>" : '<p class="note">Pas encore de vidéo officielle de ce show dans l’app.</p>';
    h += '<div style="margin:12px 16px">' + linksHTML("ev:" + key, { title: (p[1] === "PLE" ? p[0] : p[1]) + (p[2] ? " du " + fmt(p[2]) : ""), href: location.hash, ask: true }) + "</div>";
    h += row("Autres vidéos " + esc(p[0]), vids.filter(v => v.k === p[0] && L.indexOf(v) < 0));
    return h;
  }
  if (a === "k") {
    const k = decodeURIComponent(b || ""), L = vids.filter(v => v.k === k);
    const years = {}; L.forEach(v => { const y = (v.d || "").slice(0, 4) || "Matchs"; (years[y] = years[y] || []).push(v); });
    let h = '<a class="back" href="#/player">' + ICON.back + " TCC Player</a><h1>" + esc(k) + " · Archives</h1>";
    h += Object.keys(years).sort().reverse().map(y => row(y, years[y])).join("") || '<p class="note">Pas encore de vidéo officielle pour ' + esc(k) + " dans l’app.</p>";
    return h;
  }
  const L = likes(), liked = vids.filter(v => L[v.id] === 1);
  const promos = Object.keys(S.P || {}).concat(["WWF", "WCW", "ECW"]);
  let h = '<section class="phero"><span class="eyebrow">TCC PLAYER</span><h1>Archives et vidéos</h1><p>Toutes les vidéos officielles de l’app, par promotion et par année.</p></section>';
  h += '<div class="chips wrap pk">' + promos.map(k => '<a class="chip" href="#/player/k/' + encodeURIComponent(k) + '">' + (showLogo(k, "") ? '<img src="' + esc(showLogo(k, "")) + '" alt="">' : "") + esc(k) + "</a>").join("") + "</div>";
  h += row("Les plus récentes", vids.filter(v => v.d)) + row("👍 Tes vidéos aimées", liked) + row("Matchs complets", vids.filter(v => v.full));
  Object.keys(S.P || {}).forEach(k => { h += row(esc(k), vids.filter(v => v.k === k && v.d)); });
  return h;
}
function watchView(id, vids) {
  const v = vids.find(x => x.id === id) || { id: id, t: "Vidéo", k: "" };
  if (!okId(id)) return '<p class="empty">Vidéo introuvable.</p>';
  let h = '<div class="pstage">' + (PREVIEW ? '<p class="note" style="margin:16px">La vidéo se lira ici une fois l’app en ligne.</p>' :
    '<div class="player"><iframe src="https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0" title="' + esc(v.t) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>') + "</div>";
  h += '<section class="pmeta"><h1>' + linkNames(v.t) + "</h1><small>" + esc([v.k, v.show, v.d ? fmt(v.d) : ""].filter(Boolean).join(" · ")) + " · Source : YouTube (chaîne officielle)</small>" + likeBar(id) +
    '<a class="linkbtn" href="https://www.youtube.com/watch?v=' + id + '" target="_blank" rel="noopener">Ouvrir sur YouTube ↗</a></section>';
  const same = vids.filter(x => x.id !== id && x.k === v.k && x.show === v.show && x.d === v.d), more = vids.filter(x => x.id !== id && x.k === v.k && same.indexOf(x) < 0);
  h += row("Du même show", same) + row("Autres vidéos " + esc(v.k || ""), more);
  h += commentsBox("video " + id);
  return h;
}

// recherche dans les archives (recherche globale)
export function searchVideos(q, n) {
  const words = String(q || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).filter(w => w.length > 1);
  if (!words.length) return [];
  return allVideos().filter(v => { const t = (v.t + " " + v.k + " " + (v.show || "")).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); return words.every(w => t.indexOf(w) >= 0); }).slice(0, n || 8);
}
export const playerThumb = v => thumb(v);
