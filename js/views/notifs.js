// Notifications : likes et réponses sur tes commentaires, réactions et réponses sur tes notes
import { S, B, ACT, avatar, prof, nameOf } from "../state.js";
import { esc, ICON, timeLabel, toast } from "../util.js";
import { isBlocked } from "../social.js";
import { annSection, annUnread } from "./annonces.js";

export function notifUnread() { if (!S.user) return 0; const r = S.reads.notifs || 0; return S.notifs.filter(n => n.at > r && !isBlocked(n.from)).length + annUnread(); }
const yours = n => (n.cid === "wcom" ? "ton commentaire sur " : n.cid === "trophy" ? "ton trophée " : n.cid === "slammy" || n.cid === "babies" ? "" : "ta note sur ") + n.name;
export function notifText(n) {
  if (n.type === "slammy") return "t’a remis le Slammy « " + n.name + " » 🏆";
  if (n.type === "areact") return "a réagi " + (n.text || "") + " à " + yours(n);
  if (n.type === "areply") return "a répondu à " + yours(n);
  return n.type === "like" ? "a aimé ton commentaire sur " + n.name : "a répondu à ton commentaire sur " + n.name;
}
const href = n => n.type === "slammy" ? "#/trophees" : n.a ? "#/activite/" + encodeURIComponent(n.a) : "#/catcheur/" + encodeURIComponent(n.name || "");
const icon = n => n.type === "like" ? "❤️ " : n.type === "areact" || n.type === "slammy" ? "" : "💬 ";

export function notifsView() {
  const list = S.notifs.filter(n => !isBlocked(n.from)), r = S.reads.notifs || 0;
  let h = '<a class="back" href="javascript:history.back()">' + ICON.back + " Retour</a><h1>Notifications</h1>" +
    '<p class="note small" style="margin-bottom:10px"><a class="linkbtn" style="padding:0" href="#/parametres/notifs">🔔 Notifications sur le téléphone ›</a></p>' + annSection();
  if (!list.length) return h + '<p class="note">' + (annSection() ? "" : "Rien pour l’instant. ") + "Quand un membre réagira ou répondra à tes notes et commentaires, tu le verras ici.</p>";
  return h + (annSection() ? "<h2>Pour toi</h2>" : "") + '<div class="convs">' + list.map(n => '<a class="conv-item' + (n.at > r ? " unread" : "") + '" href="' + href(n) + '">' + avatar(prof(n.from), 44) +
    '<span class="mid"><b>' + icon(n) + esc(nameOf(n.from)) + " " + esc(notifText(n)) + "</b>" + (n.type === "areact" || n.type === "slammy" ? "" : "<small>« " + esc(n.text || "") + " »</small>") + "</span>" +
    '<span class="end">' + esc(timeLabel(n.at)) + "</span></a>").join("") + "</div>";
}
// Toast à l'arrivée d'une nouvelle notification
export function popNotif(n) {
  if (isBlocked(n.from)) return;
  setTimeout(() => toast(icon(n) + nameOf(n.from) + " " + notifText(n), { top: true, ms: 5000, onClick: () => { location.hash = href(n); } }), 400);
}
ACT.notifs = () => { if (S.user) location.hash = "#/notifs"; else location.hash = "#/connexion"; };
export function markNotifsSeen() { if (S.user && notifUnread()) B.markNotifsRead(S.user.uid).catch(() => {}); }
