// Activité des membres : « Karim a noté ★★★★ le Raw du 26 oct. », commentaires des fiches catcheurs,
// avec réactions (emoji) et réponses des autres membres, et notification à l'auteur
import { S, B, ACT, FORM, avatar, prof, nameOf, need, changed } from "../state.js";
import { esc, ICON, fmt, stars, timeLabel, toast, modal } from "../util.js";
import { isBlocked } from "../social.js";
import { noteTarget } from "./mrate.js";
import { errText } from "./account.js";

export const EMOJIS = ["👍", "🔥", "😂", "😮", "👏", "💯"];
// titre court de ce qui a été noté ou commenté (pour les notifications)
export function titleOf(a) {
  if (a.kind === "wcom") return String(a.name || "");
  if (a.kind === "mrate") return String(a.title || "");
  return !a.show ? String(a.title || "") : (a.title && a.title !== a.show ? a.title : a.show) + " du " + fmt(a.d);
}
const rxCounts = a => { const c = {}; Object.keys(a.rx || {}).forEach(u => { if (isBlocked(u)) return; const e = a.rx[u]; c[e] = (c[e] || 0) + 1; }); return c; };
function rxChips(a, big) {
  const c = rxCounts(a), mine = S.user && a.rx ? a.rx[S.user.uid] : "";
  const list = big ? EMOJIS : EMOJIS.filter(e => c[e]).concat(Object.keys(c).filter(e => EMOJIS.indexOf(e) < 0));
  return list.map(e => '<button class="rxc' + (mine === e ? " on" : "") + (c[e] ? "" : " zero") + '" data-act="arx" data-id="' + esc(a.id) + '" data-e="' + e + '">' + e + (c[e] ? "<b>" + c[e] + "</b>" : "") + "</button>").join("");
}
// barre sous chaque activité : réactions, réagir, répondre
function actBar(a) {
  if (!S.user) return "";
  const n = Math.max(0, a.rn || 0);
  return '<div class="actbar">' + rxChips(a, false) + '<button class="rxadd" data-act="arpick" data-id="' + esc(a.id) + '" aria-label="Réagir">☺︎＋</button>' +
    '<a class="arep" href="#/activite/' + encodeURIComponent(a.id) + '">💬 ' + (n ? n + " réponse" + (n > 1 ? "s" : "") : "Répondre") + "</a></div>";
}

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
    esc(nameOf(a.uid)) + "</b> " + w.txt + "</a>" + (a.comment ? '<q class="mycom">' + esc(a.comment) + "</q>" : "") + "<small>" + esc(timeLabel(a.at)) + "</small>" + actBar(a) + "</div></div>";
}
export function activityList(n) {
  const list = (S.activity || []).filter(a => !isBlocked(a.uid)).slice(0, n || 40);
  return list.length ? '<div class="acts">' + list.map(line).join("") + "</div>" : '<p class="note">Pas encore d’activité. Note un show avec l’œil pour lancer le mouvement !</p>';
}
export function activitySection() {
  if (!S.user) return "";
  return '<h2 class="acth">Activité des membres <a class="linkbtn" href="#/activite">Tout voir</a></h2>' + activityList(5);
}
export function activityView(id) {
  if (id) return threadView(id);
  return '<a class="back" href="#/">' + ICON.back + " Accueil</a><h1>Activité des membres</h1>" + activityList(40);
}

// ---------- fil d'une activité : réactions et réponses ----------
export const actOf = id => (S.activity || []).find(a => a.id === id) || (S.athread || {})[id] || null;
export function loadThread(id) {
  if ((S.activity || []).some(a => a.id === id)) return;
  B.getActivity(id).then(a => { S.athread = S.athread || {}; S.athread[id] = a || { id: id, gone: true }; if (a) need(a.uid); changed("activity"); }).catch(() => {});
}
function threadView(id) {
  const a = actOf(id);
  let h = '<a class="back" href="javascript:history.back()">' + ICON.back + " Retour</a>";
  if (!a) return h + '<p class="empty">Chargement…</p>';
  if (a.gone || isBlocked(a.uid)) return h + '<p class="empty">Cette note ou ce commentaire a été supprimé.</p>';
  const w = what(a), reps = ((S.areplies || {})[id] || []).filter(r => !isBlocked(r.uid));
  reps.forEach(r => need(r.uid));
  h += '<div class="thread"><div class="act big"><a class="actav" href="#/profil/' + encodeURIComponent(a.uid) + '">' + avatar(prof(a.uid), 40) + '</a><div class="actbody"><a class="acttxt" href="' + w.href + '"><b>' +
    esc(nameOf(a.uid)) + "</b> " + w.txt + "</a>" + (a.comment ? '<q class="mycom">' + esc(a.comment) + "</q>" : "") + "<small>" + esc(timeLabel(a.at)) + "</small></div></div>" +
    '<div class="rxbar">' + rxChips(a, true) + "</div>" + rxWho(a) + "</div>";
  h += "<h2>Réponses" + (reps.length ? ' <small class="cnt">' + reps.length + "</small>" : "") + "</h2>";
  h += reps.length ? '<div class="replies">' + reps.map(r => '<div class="reply"><a href="#/profil/' + encodeURIComponent(r.uid) + '">' + avatar(prof(r.uid), 30) + '</a><div class="rbody"><b>' + esc(nameOf(r.uid)) + "</b><p>" + esc(r.text) + "</p><small>" + esc(timeLabel(r.at)) +
    (S.user && (r.uid === S.user.uid || a.uid === S.user.uid || S.isAdmin) ? ' · <button class="linkbtn danger" data-act="ardel" data-id="' + esc(r.id) + '" data-a="' + esc(id) + '">Supprimer</button>' : "") + "</small></div></div>").join("") + "</div>"
    : '<p class="note">Pas encore de réponse.</p>';
  if (S.user) h += '<form class="replyform" data-form="areply" data-a="' + esc(id) + '"><input name="t" maxlength="300" autocomplete="off" placeholder="Ta réponse…" aria-label="Ta réponse" required><button class="btn small">Envoyer</button></form>';
  return h;
}
// qui a réagi (pseudos)
function rxWho(a) {
  const us = Object.keys(a.rx || {}).filter(u => !isBlocked(u)); if (!us.length) return "";
  us.forEach(need);
  return '<p class="note small rxwho">' + us.slice(0, 12).map(u => esc(a.rx[u]) + " " + esc(nameOf(u))).join(" · ") + (us.length > 12 ? " · +" + (us.length - 12) : "") + "</p>";
}

// ---------- actions ----------
async function react(id, e) {
  if (!S.user) return;
  const a = actOf(id); if (!a) return;
  const me = S.user.uid, cur = (a.rx || {})[me], next = cur === e ? "" : e;
  a.rx = Object.assign({}, a.rx || {}); if (next) a.rx[me] = next; else delete a.rx[me];
  changed("activity");
  try {
    await B.reactActivity(id, me, next);
    if (next && a.uid !== me) B.pushNotif(a.uid, "areact_" + id.slice(0, 200) + "_" + me, { type: "areact", from: me, a: id, name: titleOf(a).slice(0, 60), cid: String(a.kind || ""), text: next }).catch(() => {});
  } catch (err) { toast(errText(err)); }
}
ACT.arx = el => react(el.dataset.id, el.dataset.e);
ACT.arpick = el => {
  const id = el.dataset.id;
  modal((box, close) => {
    box.innerHTML = '<h3>Réagir</h3><div class="rxpick">' + EMOJIS.map(e => '<button data-e="' + e + '">' + e + "</button>").join("") + '</div><button class="btn wide ghost" data-close>Fermer</button>';
    box.addEventListener("click", ev => {
      if (ev.target.closest("[data-close]")) return close();
      const b = ev.target.closest("[data-e]"); if (!b) return;
      close(); react(id, b.dataset.e);
    });
  });
};
FORM.areply = async f => {
  const id = f.dataset.a, a = actOf(id), t = f.t.value.trim();
  if (!a || !t) return;
  f.t.disabled = true;
  try {
    const rid = await B.addReply(id, S.user.uid, t.slice(0, 300));
    if (a.uid !== S.user.uid) B.pushNotif(a.uid, "areply_" + rid, { type: "areply", from: S.user.uid, a: id, name: titleOf(a).slice(0, 60), cid: String(a.kind || ""), text: t.slice(0, 140) }).catch(() => {});
    a.rn = (a.rn || 0) + 1; f.reset();
  } catch (err) { toast(errText(err)); }
  f.t.disabled = false; f.t.focus();
};
ACT.ardel = async el => {
  try { await B.deleteReply(el.dataset.id, el.dataset.a); const a = actOf(el.dataset.a); if (a) a.rn = Math.max(0, (a.rn || 1) - 1); } catch (err) { toast(errText(err)); }
};
