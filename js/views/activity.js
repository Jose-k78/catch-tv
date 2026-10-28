// Activité des membres : « Karim a noté ★★★★ le Raw du 26 oct. », commentaires des fiches catcheurs
import { S, avatar, prof, nameOf } from "../state.js";
import { esc, ICON, fmt, stars, timeLabel } from "../util.js";
import { isBlocked } from "../social.js";
import { noteTarget } from "./mrate.js";

// lien vers la page du show ou de l'événement concerné (comme dans l'historique des notes)
const hrefOf = (a, fallback) => { const t = noteTarget(Object.assign({}, a, { id: a.kind === "mrate" ? "m_" : "" })); return t && t.href ? t.href : fallback; };

function what(a) {
  if (a.kind === "wcom") return { txt: "a commenté <b>" + esc(a.name) + "</b>", href: "#/catcheur/" + encodeURIComponent(a.name) };
  if (a.kind === "mrate") {
    const where = [a.show, a.d ? fmt(a.d) : ""].filter(Boolean).join(" du ");
    return { txt: (a.rating ? "a noté " + stars(a.rating) + " le combat " : "a donné son avis sur le combat ") + "<b>" + esc(a.title) + "</b>" + (where ? " (" + esc(a.k) + " · " + esc(where) + ")" : " (" + esc(a.k) + ")"),
      href: hrefOf(a, "#/matchs") };
  }
  const isPle = !a.show, label = isPle ? esc(a.title) + " (" + esc(a.k) + ")" : "le " + esc(a.title && a.title !== a.show ? a.title : a.show) + " du " + fmt(a.d);
  const href = hrefOf(a, "#/p/" + encodeURIComponent(a.k) + (isPle ? "" : "/" + encodeURIComponent(a.show)));
  return { txt: (a.rating ? "a noté " + stars(a.rating) + " " : "a commenté ") + "<b>" + label + "</b>", href: href };
}
function line(a) {
  const w = what(a);
  return '<div class="act"><a class="actav" href="#/profil/' + encodeURIComponent(a.uid) + '">' + avatar(prof(a.uid), 32) + '</a><div class="actbody"><a class="acttxt" href="' + w.href + '"><b>' +
    esc(nameOf(a.uid)) + "</b> " + w.txt + "</a>" + (a.comment ? '<q class="mycom">' + esc(a.comment) + "</q>" : "") + "<small>" + esc(timeLabel(a.at)) + "</small></div></div>";
}
export function activityList(n) {
  const list = (S.activity || []).filter(a => !isBlocked(a.uid)).slice(0, n || 40);
  return list.length ? '<div class="acts">' + list.map(line).join("") + "</div>" : '<p class="note">Pas encore d’activité. Note un show avec l’œil pour lancer le mouvement !</p>';
}
export function activitySection() {
  if (!S.user) return "";
  return '<h2 class="acth">Activité des membres <a class="linkbtn" href="#/activite">Tout voir</a></h2>' + activityList(5);
}
export function activityView() {
  return '<a class="back" href="#/">' + ICON.back + " Accueil</a><h1>Activité des membres</h1>" + activityList(40);
}
