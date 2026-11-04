// Membres : liste avec recherche par pseudo, amis, demandes reçues ; compteur de feud avec chacun
import { S, B, changed, avatar, prof } from "../state.js";
import { esc } from "../util.js";
import { storylineTile } from "./storyline.js";
import { pollTile } from "./polls.js";
import { pickTile } from "./picks.js";
import { activitySection, activityList } from "./activity.js";
import { friendState, friendsOf, requestsIn, feudBadge, isBlocked, feudsToReturn } from "../social.js";

let loading = false;
export async function loadMembers(force) {
  if (loading || (S.users && !force)) return;
  loading = true;
  try { S.users = await B.listUsers(); } catch (e) { S.users = S.users || []; }
  loading = false; changed("users");
}
let lastQ = "";

function row(u, extra) {
  const st = friendState(u.uid);
  const sub = st === "ok" ? "Ami ✓" : st === "out" ? "Demande envoyée" : st === "in" ? "Veut être ton ami" : (u.bio || "");
  return '<div class="mem" data-name="' + esc((u.pseudo || "").toLowerCase()) + '"><a class="memlink" href="#/profil/' + encodeURIComponent(u.uid) + '">' + avatar(u, 46) +
    '<span class="mid"><b>' + esc(u.pseudo || "Membre") + "</b><small>" + esc(sub) + "</small></span></a>" + (extra || feudBadge(u.uid)) + "</div>";
}

export function membersView(tab) {
  const meId = S.user.uid, reqs = requestsIn(), toReturn = feudsToReturn();
  let h = '<div class="chathead"><h1>Membres</h1></div>' +
    '<div class="seg"><a href="#/membres" class="' + (!tab ? "on" : "") + '">Communauté</a><a href="#/membres/tous" class="' + (tab === "tous" ? "on" : "") + '">Tous</a><a href="#/membres/amis" class="' + (tab === "amis" ? "on" : "") + '">Amis</a>' +
    '<a href="#/membres/demandes" class="' + (tab === "demandes" ? "on" : "") + '">Demandes' + (reqs.length ? ' <span class="dot inl">' + reqs.length + "</span>" : "") + "</a></div>";
  // Communauté : storyline du jour, sondages, pronostics, Babies du mois, activité des membres
  if (!tab) {
    const tiles = [storylineTile(), pollTile(), pickTile()].filter(Boolean);
    h += (tiles.length ? '<div class="tiles2">' + tiles.join("") + "</div>" : "") +
      '<div class="list" style="margin-top:10px">' + [["#/sondages", "📊 Sondages", "et le tournoi Babies du mois"], ["#/pronostics", "🎯 Pronostics", "et le classement"], ["#/storyline", "📖 Storyline du jour", "et les précédentes"], ["#/tournois", "🏆 Tournois", "en cours et à venir"]]
        .map(x => '<a class="item" href="' + x[0] + '"><span class="lbl"><b>' + x[1] + "</b><small>" + x[2] + '</small></span><span class="chev">›</span></a>').join("") + "</div>" +
      '<div class="actsec">' + activitySection() + "</div>";
    return h;
  }
  if (tab === "demandes") {
    h += reqs.length ? '<div class="mems">' + reqs.map(f => {
      const o = f.members[0] === meId ? f.members[1] : f.members[0], p = prof(o) || { uid: o };
      return row(Object.assign({ uid: o }, p), '<span class="membtns"><button class="btn small" data-act="friendok" data-uid="' + esc(o) + '">Accepter</button><button class="btn small ghost" data-act="frienddel" data-uid="' + esc(o) + '">Refuser</button></span>');
    }).join("") + "</div>" : '<p class="note">Aucune demande en attente.</p>';
    if (toReturn.length) {
      h += "<h2>Feuds à renvoyer aujourd’hui</h2><div class=\"mems\">" + toReturn.map(f => {
        const o = f.members[0] === meId ? f.members[1] : f.members[0], p = prof(o) || {};
        return row(Object.assign({ uid: o }, p), '<button class="btn small" data-act="feud" data-uid="' + esc(o) + '">🔥 Continuer</button>');
      }).join("") + "</div>";
    }
    return h;
  }
  if (tab === "amis") {
    const ids = friendsOf(meId);
    return h + (ids.length ? '<div class="mems">' + ids.map(o => row(Object.assign({ uid: o }, prof(o) || {}))).join("") + "</div>"
      : '<p class="note">Pas encore d’amis. Ouvre le profil d’un membre et appuie sur « Ajouter en ami ».</p>');
  }
  h += '<div class="search"><input id="msearch" type="search" placeholder="Rechercher un pseudo" autocomplete="off" value="' + esc(lastQ) + '" aria-label="Rechercher un membre"></div>';
  if (!S.users) return h + '<p class="empty">Chargement des membres…</p>';
  const list = S.users.filter(u => u.uid !== meId && !isBlocked(u.uid));
  if (!list.length) return h + '<p class="empty">Aucun autre membre pour l’instant. Partage l’adresse de l’app à tes amis !</p>';
  // amis et feuds en cours d'abord
  const rank = u => (friendState(u.uid) === "ok" ? 0 : 1);
  list.sort((a, b) => rank(a) - rank(b) || (a.pseudoLower || "").localeCompare(b.pseudoLower || ""));
  const q = lastQ.trim().toLowerCase();
  return h + '<div class="mems" id="memlist">' + list.map(u => row(u)).join("").replace(/<div class="mem" data-name="([^"]*)"/g, (m, n) => q && n.indexOf(q) < 0 ? m + " hidden" : m) + "</div>" +
    '<p class="note small" style="margin-top:12px">' + list.length + " membre" + (list.length > 1 ? "s" : "") + " · 🔥 = jours de feud d’affilée avec toi</p>";
}
document.addEventListener("input", e => {
  if (e.target.id !== "msearch") return;
  lastQ = e.target.value; const q = lastQ.trim().toLowerCase();
  document.querySelectorAll("#memlist .mem").forEach(el => { el.hidden = !!q && el.dataset.name.indexOf(q) < 0; });
});
