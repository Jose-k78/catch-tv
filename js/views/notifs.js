// Notifications : likes et réponses sur tes commentaires
import { S, B, ACT, avatar, prof, nameOf } from "../state.js";
import { esc, ICON, timeLabel, toast } from "../util.js";
import { isBlocked } from "../social.js";

export function notifUnread() { if (!S.user) return 0; const r = S.reads.notifs || 0; return S.notifs.filter(n => n.at > r && !isBlocked(n.from)).length; }
export function notifText(n) {
  return n.type === "like" ? "a aimé ton commentaire sur " + n.name : "a répondu à ton commentaire sur " + n.name;
}
const href = n => "#/catcheur/" + encodeURIComponent(n.name || "");

export function notifsView() {
  const list = S.notifs.filter(n => !isBlocked(n.from)), r = S.reads.notifs || 0;
  let h = '<a class="back" href="javascript:history.back()">' + ICON.back + " Retour</a><h1>Notifications</h1>";
  if (!list.length) return h + '<p class="note">Rien pour l’instant. Quand un membre aimera ou répondra à tes commentaires, tu le verras ici.</p>';
  return h + '<div class="convs">' + list.map(n => '<a class="conv-item' + (n.at > r ? " unread" : "") + '" href="' + href(n) + '">' + avatar(prof(n.from), 44) +
    '<span class="mid"><b>' + (n.type === "like" ? "❤️ " : "💬 ") + esc(nameOf(n.from)) + " " + esc(notifText(n)) + "</b><small>« " + esc(n.text || "") + " »</small></span>" +
    '<span class="end">' + esc(timeLabel(n.at)) + "</span></a>").join("") + "</div>";
}
// Toast à l'arrivée d'une nouvelle notification
export function popNotif(n) {
  if (isBlocked(n.from)) return;
  setTimeout(() => toast((n.type === "like" ? "❤️ " : "💬 ") + nameOf(n.from) + " " + notifText(n), { top: true, ms: 5000, onClick: () => { location.hash = href(n); } }), 400);
}
ACT.notifs = () => { if (S.user) location.hash = "#/notifs"; else location.hash = "#/connexion"; };
export function markNotifsSeen() { if (S.user && notifUnread()) B.markNotifsRead(S.user.uid).catch(() => {}); }
