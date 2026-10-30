// Fiche d'un tag team / d'une faction (#/groupe/id) : logo (dossier de l'admin, sinon ajouté par un membre, sinon le nom écrit),
// membres actuels, anciens membres, années, matchs de référence. Données : data/groups.json (tenu à jour chaque soir).
// Sur la fiche d'un catcheur : le logo de ses groupes actuels dans un coin de sa photo, et la liste de ses groupes.
import { S } from "../state.js";
import { esc, ICON } from "../util.js";
import { linkNames } from "../wrestlers.js";
import { okVid } from "./highlights.js";
import { photoOf, face } from "../photos.js";
import { groupById, groupId, groupLogo, groupsOf, groupChip, groupHref, artVersions } from "../assets.js";
import { wImageBox, gslug } from "./wimage.js";

// bouton d'un match de référence : vidéo officielle connue -> on la regarde dans l'app ;
// sinon simple recherche YouTube du combat complet (« noms + événement + full match »), et c'est le membre qui choisit
export function refButton(m) {
  const q = String(m.t || "").replace(/^[^:]{1,80} : (?=.* (?:contre|vs) )/, "").replace(/ — .*$/, "").replace(/ contre /g, " vs ").replace(/ et /g, " & ") + (m.ev ? " " + m.ev : "") + " full match";
  return okVid(m.v) ? '<button class="btn small" data-act="play" data-id="' + esc(m.v) + '" data-t="' + esc(m.t) + '">▶ Voir</button>'
    : '<a class="btn small ghost" href="https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '" target="_blank" rel="noopener">🔎 Chercher le match</a>';
}
const wl = n => "#/catcheur/" + encodeURIComponent(n);
function people(list) {
  return '<div class="list">' + list.map(n => '<a class="item" href="' + wl(n) + '">' + (photoOf(n) ? '<img class="wface0" src="' + esc(photoOf(n)) + '" alt="" loading="lazy" style="width:40px;height:40px" onerror="this.remove()">' : '<span class="wnone">?</span>') +
    '<span class="lbl"><b>' + esc(n) + '</b></span><span class="chev">›</span></a>').join("") + "</div>";
}

export function groupView(raw) {
  const id = groupById(raw) ? raw : groupId(decodeURIComponent(String(raw)).replace(/-/g, " "));
  const g = groupById(id);
  if (!g) return '<a class="back" href="#/recherche">' + ICON.back + ' Recherche</a><p class="empty">Groupe introuvable.</p>';
  const logo = groupLogo(id);
  let h = '<a class="back" href="#/recherche/' + encodeURIComponent(g.n) + '">' + ICON.back + " Recherche</a>";
  h += '<section class="wcard gcard">' + (logo ? '<button class="glogo" data-act="zoom" data-src="' + esc(logo) + '" data-alt="' + esc(g.n) + '" aria-label="Agrandir le logo"><img src="' + esc(logo) + '" alt="' + esc(g.n) + '"></button>' : "") +
    '<div class="wtt"><span class="eyebrow">' + (g.m && g.m.length === 2 ? "TAG TEAM" : "FACTION / TAG TEAM") + "</span><h1>" + esc(g.n) + "</h1></div>" +
    (logo ? "" : wImageBox(g.n, { slug: gslug(id), label: "logo" })) +
    '<div class="wfacts"><div><small>Promotion</small><b>' + esc(g.k || "–") + "</b></div><div><small>" + (g.on ? "En activité" : "Années") + "</small><b>" + esc(g.y || "–") + "</b></div></div>";
  // les deux visages face à face pour un duo, sinon la rangée des membres
  const faces = (g.m || []).map(n => face(n, 56)).filter(Boolean);
  if (faces.length) h += '<div class="wfaces gfaces">' + faces.slice(0, 8).join("") + "</div>";
  h += "</section>";
  h += "<h2>" + (g.on ? "Membres actuels" : "Membres") + "</h2>" + ((g.m || []).length ? people(g.m) : '<p class="note">Les membres seront ajoutés lors d’une prochaine mise à jour.</p>');
  if ((g.ex || []).length) h += "<h2>Anciens membres</h2>" + people(g.ex);
  const ref = (Array.isArray(g.ref) ? g.ref : []).slice(0, 5);
  h += "<h2>Matchs de référence</h2>" + (ref.length ? '<div class="list">' + ref.map(m => '<div class="item"><span class="lbl"><b>' + linkNames(m.t) + "</b><small>" + esc(m.ev || "") + "</small></span>" + refButton(m) + "</div>").join("") + "</div>"
    : '<p class="note">Ses matchs de référence seront ajoutés lors d’une prochaine mise à jour.</p>');
  const old = artVersions("groups", g.lg);
  if (old.length) h += '<h2>Anciens logos</h2><div class="glogos">' + old.map(s => '<button data-act="zoom" data-src="' + esc(s) + '" data-alt="' + esc(g.n) + '"><img src="' + esc(s) + '" alt="" loading="lazy"></button>').join("") + "</div>";
  h += '<p class="note small" style="margin-top:12px">' + "Membres et matchs de référence tenus à jour chaque soir." + "</p>";
  return h;
}

// Fiche catcheur : logos des groupes actuels (dans un coin de la photo) et liste de ses groupes
export function wGroups(name) {
  const gs = groupsOf(name);
  const corner = gs.cur.slice(0, 2).map(id => groupChip(id, 30)).join("");
  const all = gs.cur.concat(gs.past);
  const list = all.length ? '<div class="wgroups"><small>' + (gs.cur.length ? "Ses groupes" : "Ses anciens groupes") + '</small><div class="chips wrap">' +
    all.map(id => { const g = groupById(id), src = groupLogo(id); return '<a class="chip gpill' + (gs.cur.indexOf(id) >= 0 ? " cur" : "") + '" href="' + groupHref(id) + '">' + (src ? '<img src="' + esc(src) + '" alt="" loading="lazy">' : "") + esc(g.n) + (gs.cur.indexOf(id) < 0 ? ' <span class="muted">(ancien)</span>' : "") + "</a>"; }).join("") +
    "</div></div>" : "";
  return { corner: corner, list: list };
}
