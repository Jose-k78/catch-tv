// Storyline du jour : histoires, rivalités, anecdotes de coulisses et faits marquants, racontés en français, une nouvelle chaque jour
import { S, B, ACT, changed } from "../state.js";
import { esc, ICON, fmt, okHttp, shAttr, docId, stars, toast } from "../util.js";
import { editNote } from "../modals.js";
import { linksOf, linksHTML, playerHTML, defaultLink, TPLAY } from "../links.js";
import { linkNames } from "../wrestlers.js";
import { okVid, ytSearch } from "./highlights.js";

export const storyNoteId = id => "s_" + docId(id).slice(0, 200);
export const storyFavId = id => "f_" + docId(id).slice(0, 200);
export const isStoryNote = h => !!h && typeof h.id === "string" && h.id.indexOf("s_") === 0;
export const isStoryFav = h => !!h && typeof h.id === "string" && h.id.indexOf("f_") === 0;
// minuteur : la storyline change chaque matin avec la mise à jour de 7 h 44 (heure de Paris)
function nextChange() {
  const now = new Date(), p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now).split(":").map(Number);
  let mins = 7 * 60 + 44 - (p[0] * 60 + p[1]); if (mins <= 0) mins += 24 * 60;
  return mins;
}
const leftTxt = () => { const m = nextChange(); return "⏱️ Il reste " + (m >= 60 ? Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0") : m + " min") + " avant la prochaine storyline"; };
let tickT = null;
function startTick() { clearInterval(tickT); tickT = setInterval(() => { const el = document.getElementById("storyleft"); if (!el) { clearInterval(tickT); return; } el.textContent = leftTxt(); }, 30000); }
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
  if (s === all[0]) { h += '<p class="storyleft" id="storyleft">' + leftTxt() + "</p>"; setTimeout(startTick, 0); }
  h += '<article class="story">' + s.txt.map(p => "<p>" + linkNames(p) + "</p>").join("") + "</article>";
  // ma note et storyline préférée
  if (S.user) {
    const mine = S.history[storyNoteId(s.id)], fav = !!S.history[storyFavId(s.id)];
    h += '<div class="storynote">' + (mine ? "<span>Ta note : " + (mine.rating ? stars(mine.rating) : "") + (mine.comment ? ' <q class="mycom">' + esc(mine.comment) + "</q>" : "") + "</span>" : "") +
      '<button class="btn small" data-act="storynote" data-id="' + esc(s.id) + '">' + (mine ? "✏️ Modifier ma note" : "⭐ Noter cette storyline") + "</button>" +
      '<button class="btn small ghost" data-act="storyfav" data-id="' + esc(s.id) + '">' + (fav ? "💛 Storyline préférée" : "🤍 Ajouter à mes préférées") + "</button></div>";
  }
  if (s.key) h += '<div class="storykey"><small>Le moment clé</small><p>' + linkNames(s.key) + "</p></div>";
  h += "<h2>En vidéo</h2>";
  const vids = (s.v || []).filter(v => okVid(v.id));
  h += vids.length ? '<div class="list">' + vids.map(v => '<button class="item vid" data-act="play" data-id="' + esc(v.id) + '" data-t="' + esc(v.t) + '"><span class="vplay">' + ICON.play +
    '</span><span class="lbl"><b>' + esc(v.t) + "</b><small>Chaîne officielle</small></span></button>").join("") + "</div>" : "";
  h += (s.q || []).map(q => '<p class="note" style="margin-top:8px"><a class="linkbtn" style="padding:0" href="' + esc(ytSearch(k, q)) + '" target="_blank" rel="noopener">▶ ' + esc(q) + " sur la chaîne officielle ↗</a></p>").join("");
  // lecteur intégré du modo (TCC Play)
  const dl = defaultLink("story:" + s.id) || linksOf("story:" + s.id)[0];
  if (dl || S.isAdmin) h += "<h2>" + TPLAY + "</h2>" + (dl ? playerHTML(dl.u, s.t) : "") + '<div style="margin:0 16px">' + linksHTML("story:" + s.id, { title: s.t }) + "</div>";
  if (Array.isArray(s.src) && s.src.length) h += '<p class="note small" style="margin-top:14px">Sources : ' + s.src.filter(x => okHttp(x.u)).map(x => '<a href="' + esc(x.u) + '" target="_blank" rel="noopener">' + esc(x.n) + "</a>").join(" · ") +
    ". Texte écrit par Claude à partir de ces sources.</p>";
  const others = all.filter(x => x !== s);
  if (others.length) h += '<h2>Les storylines précédentes</h2><div class="list">' + others.map(x => '<a class="item" href="#/storyline/' + encodeURIComponent(x.id) + '"' + shAttr(card(x)) + '><span class="lbl"><b>' + esc(x.t) +
    "</b><small>" + esc([x.k, x.years].filter(Boolean).join(" · ")) + ((x.d || x.week) ? " · " + fmt(x.d || x.week) : "") + '</small></span><span class="chev">›</span></a>').join("") + "</div>";
  return h;
}

const findStory = id => list().find(x => x.id === id);
ACT.storynote = el => { const s = findStory(el.dataset.id); if (s) editNote({ id: storyNoteId(s.id), title: "📖 " + s.t, k: S.P[s.k] ? s.k : "", show: "Storyline", d: s.d || "" }, () => changed("history")); };
export async function toggleStoryFav(id) {
  const s = findStory(id); if (!s || !S.user) { if (!S.user) location.hash = "#/connexion"; return; }
  const fid = storyFavId(id);
  try {
    if (S.history[fid]) { await B.unsetSeen(S.user.uid, fid); delete S.history[fid]; toast("Retirée de tes storylines préférées"); }
    else { await B.setSeen(S.user.uid, fid, { title: String(s.t).slice(0, 150), k: S.P[s.k] ? s.k : "", show: "StorylineFav", d: s.d || "", rating: 0, comment: "" }); toast("Ajoutée à tes storylines préférées 💛"); }
    changed("history");
  } catch (e) { toast("Impossible pour l’instant"); }
}
ACT.storyfav = el => toggleStoryFav(el.dataset.id);
// Paramètres › Mes storylines préférées
export function storyFavView() {
  const all = list();
  return '<h1>Mes storylines préférées</h1><p class="note small">Elles s’affichent sur ton profil : « Ses storylines préférées ».</p>' +
    (all.length ? '<div class="list">' + all.map(x => '<button class="item" data-act="storyfav" data-id="' + esc(x.id) + '"><span class="lbl"><b>' + esc(x.t) + "</b><small>" + esc([x.k, x.years].filter(Boolean).join(" · ")) + '</small></span><span class="chev">' + (S.history[storyFavId(x.id)] ? "💛" : "🤍") + "</span></button>").join("") + "</div>" : '<p class="note">Pas encore de storyline.</p>');
}
// profil : storylines préférées d'un membre (d'après son historique)
export function storyFavsHTML(hist) {
  const favs = hist.filter(isStoryFav); if (!favs.length) return "";
  return "<h2>📖 Ses storylines préférées</h2><div class=\"list\">" + favs.map(f => { const id = f.id.slice(2), s = list().find(x => docId(x.id).slice(0, 200) === id);
    return '<a class="item" href="#/storyline/' + encodeURIComponent(s ? s.id : "") + '"><span class="lbl"><b>' + esc(f.title) + "</b><small>" + esc(f.k || "Storyline") + '</small></span><span class="chev">›</span></a>'; }).join("") + "</div>";
}
