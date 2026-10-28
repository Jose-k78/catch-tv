// Activité des membres : « Karim a noté ★★★★ le Raw du 26 oct. », commentaires des fiches catcheurs
import { S, avatar, prof, nameOf } from "../state.js";
import { esc, ICON, fmt, stars, timeLabel } from "../util.js";
import { isBlocked } from "../social.js";

function what(a) {
  if (a.kind === "wcom") return { txt: "a commenté <b>" + esc(a.name) + "</b>", href: "#/catcheur/" + encodeURIComponent(a.name) };
  const isPle = !a.show, label = isPle ? esc(a.title) + " (" + esc(a.k) + ")" : "le " + esc(a.title && a.title !== a.show ? a.title : a.show) + " du " + fmt(a.d);
  const href = "#/p/" + encodeURIComponent(a.k) + (isPle ? "" : "/" + encodeURIComponent(a.show));
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
