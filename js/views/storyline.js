// Storyline du jour : histoires, rivalités, anecdotes de coulisses et faits marquants, racontés en français, une nouvelle chaque jour
import { S } from "../state.js";
import { esc, ICON, fmt, okHttp, shAttr } from "../util.js";
import { linkNames } from "../wrestlers.js";
import { okVid, ytSearch } from "./highlights.js";

const list = () => (S.storylines || []).filter(s => s && s.id && s.t && Array.isArray(s.txt));
const card = s => ({ ty: "story", t: String(s.t || ""), s: ["Storyline", s.k, s.years].filter(Boolean).join(" · "), h: "#/storyline/" + encodeURIComponent(s.id || ""), k: s.k || "" });
export function storylineTile() {
  const s = list()[0]; if (!s) return "";
  return '<a class="storytile" href="#/storyline"' + shAttr(card(s)) + '><span class="eyebrow">📖 LA STORYLINE DU JOUR</span><b>' + esc(s.t) + "</b><small>" + esc([s.type, s.k, s.years].filter(Boolean).join(" · ")) + "</small>" +
    "<p>" + esc(s.hook || s.txt[0]) + '</p><span class="discgo">Lire l’histoire ›</span></a>';
}
export function storylineView(id) {
  const all = list(), s = id ? all.find(x => x.id === id) : all[0];
  let h = '<a class="back" href="#/">' + ICON.back + " Accueil</a>";
  if (!s) return h + '<p class="empty">La storyline du jour arrive bientôt.</p>';
  const k = S.P[s.k] ? s.k : "WWE";
  h += '<section class="storyhead"><span class="eyebrow">STORYLINE' + (s === all[0] ? " DU JOUR" : "") + "</span><h1>" + esc(s.t) + "</h1><small>" + esc([s.type, s.k, s.years].filter(Boolean).join(" · ")) + "</small>" +
    '<button class="iconbtn sharebtn light" data-act="share"' + shAttr(card(s)) + ' aria-label="Partager">↗</button></section>';
  h += '<article class="story">' + s.txt.map(p => "<p>" + linkNames(p) + "</p>").join("") + "</article>";
  if (s.key) h += '<div class="storykey"><small>Le moment clé</small><p>' + linkNames(s.key) + "</p></div>";
  h += "<h2>En vidéo</h2>";
  const vids = (s.v || []).filter(v => okVid(v.id));
  h += vids.length ? '<div class="list">' + vids.map(v => '<button class="item vid" data-act="play" data-id="' + esc(v.id) + '" data-t="' + esc(v.t) + '"><span class="vplay">' + ICON.play +
    '</span><span class="lbl"><b>' + esc(v.t) + "</b><small>Chaîne officielle</small></span></button>").join("") + "</div>" : "";
  h += (s.q || []).map(q => '<p class="note" style="margin-top:8px"><a class="linkbtn" style="padding:0" href="' + esc(ytSearch(k, q)) + '" target="_blank" rel="noopener">▶ ' + esc(q) + " sur la chaîne officielle ↗</a></p>").join("");
  if (Array.isArray(s.src) && s.src.length) h += '<p class="note small" style="margin-top:14px">Sources : ' + s.src.filter(x => okHttp(x.u)).map(x => '<a href="' + esc(x.u) + '" target="_blank" rel="noopener">' + esc(x.n) + "</a>").join(" · ") +
    ". Texte écrit par Claude à partir de ces sources.</p>";
  const others = all.filter(x => x !== s);
  if (others.length) h += '<h2>Les storylines précédentes</h2><div class="list">' + others.map(x => '<a class="item" href="#/storyline/' + encodeURIComponent(x.id) + '"' + shAttr(card(x)) + '><span class="lbl"><b>' + esc(x.t) +
    "</b><small>" + esc([x.k, x.years].filter(Boolean).join(" · ")) + ((x.d || x.week) ? " · " + fmt(x.d || x.week) : "") + '</small></span><span class="chev">›</span></a>').join("") + "</div>";
  return h;
}
