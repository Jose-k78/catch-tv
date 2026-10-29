// Commentaires d'une fiche catcheur : visibles par tous, likes ❤️ (avec notification à l'auteur), réponses
import { S, B, ACT, FORM, prof, nameOf, avatar } from "../state.js";
import { esc, toast, timeLabel } from "../util.js";
import { errText } from "./account.js";
import { isBlocked, confirmBox } from "../social.js";
import { norm, linkNames } from "../wrestlers.js";

export const wslug = name => norm(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "x";
let replyTo = "";           // commentaire auquel on répond
let curName = "";

export function commentsBox(name) {
  curName = name; replyTo = "";
  return '<h2 id="comh">Commentaires</h2><div id="wcom" class="wcom" data-w="' + esc(wslug(name)) + '"><p class="note">Chargement…</p></div>';
}

const heart = on => '<svg viewBox="0 0 24 24" aria-hidden="true"' + (on ? ' fill="currentColor"' : ' fill="none" stroke="currentColor" stroke-width="2"') + '><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 2.9 4.5 6.7 4.5c2.2 0 3.6 1.2 4.3 2.4h2c.7-1.2 2.1-2.4 4.3-2.4 3.8 0 5.8 4 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>';

function one(c, isReply) {
  const me = S.user && S.user.uid, liked = me && c.likes.indexOf(me) >= 0, mine = me === c.uid;
  return '<div class="com' + (isReply ? " rep" : "") + '"><a class="comav" href="#/profil/' + encodeURIComponent(c.uid) + '">' + avatar(prof(c.uid), isReply ? 28 : 36) + "</a>" +
    '<div class="combody"><div class="comhead"><a href="#/profil/' + encodeURIComponent(c.uid) + '"><b>' + esc(nameOf(c.uid)) + '</b></a><small>' + timeLabel(c.at) + "</small></div>" +
    '<p class="comtxt">' + linkNames(c.text) + '</p><div class="comacts">' +
    '<button class="like' + (liked ? " on" : "") + '" data-act="clike" data-id="' + esc(c.id) + '" aria-pressed="' + !!liked + '" aria-label="J’aime">' + heart(liked) + "<span>" + (c.likes.length || "") + "</span></button>" +
    (!isReply ? '<button class="linkbtn" data-act="creply" data-id="' + esc(c.id) + '">Répondre</button>' : "") +
    (mine || S.isAdmin ? '<button class="linkbtn" data-act="cdel" data-id="' + esc(c.id) + '">Supprimer</button>' : "") +
    (S.user && !mine ? '<button class="linkbtn" data-act="report" data-uid="' + esc(c.uid) + '" data-conv="wc:' + esc(c.w) + '" data-msg="' + esc(c.id) + '" data-text="' + esc(c.text) + '">Signaler</button>' : "") +
    "</div></div></div>";
}
function composer(parent) {
  if (!S.user) return parent ? "" : '<p class="note"><a class="linkbtn" style="padding:0" href="#/connexion">Connecte-toi</a> pour commenter.</p>';
  return '<form class="comform" data-form="wcom" data-parent="' + esc(parent || "") + '"><textarea id="' + (parent ? "comrep" : "comin") + '" rows="' + (parent ? 1 : 2) + '" maxlength="500" placeholder="' +
    (parent ? "Ta réponse…" : "Ton avis sur " + esc(curName) + "…") + '"></textarea><button class="btn small">' + (parent ? "Répondre" : "Publier") + "</button></form>";
}

// Affiche la liste dans #wcom sans toucher au reste de la page (le texte en cours de saisie est conservé)
export function renderWComments() {
  const box = document.getElementById("wcom"); if (!box) return;
  const w = box.dataset.w, all = (S.wcomments[w] || []).filter(c => !isBlocked(c.uid));
  const draft = document.getElementById("comin"), keep = draft ? draft.value : "";
  const rdraft = document.getElementById("comrep"), rkeep = rdraft ? rdraft.value : "";
  const tops = all.filter(c => !c.parent).sort((a, b) => b.at - a.at);
  const reps = p => all.filter(c => c.parent === p).sort((a, b) => a.at - b.at);
  const h = document.getElementById("comh"); if (h) h.textContent = "Commentaires" + (all.length ? " (" + all.length + ")" : "");
  box.innerHTML = composer("") + (tops.length ? tops.map(c => one(c) + '<div class="reps">' + reps(c.id).map(r => one(r, true)).join("") +
    (replyTo === c.id ? composer(c.id) : "") + "</div>").join("") : '<p class="note">Aucun commentaire pour l’instant. Lance la discussion !</p>');
  const d2 = document.getElementById("comin"); if (d2 && keep) d2.value = keep;
  const r2 = document.getElementById("comrep"); if (r2) { if (rkeep) r2.value = rkeep; }
}

FORM.wcom = async f => {
  if (!S.user) return;
  const ta = f.querySelector("textarea"), text = ta.value.trim().slice(0, 500), parent = f.dataset.parent || "";
  const w = document.getElementById("wcom").dataset.w; if (!text) return;
  const btn = f.querySelector("button"); btn.disabled = true;
  try {
    const id = await B.addWComment(S.user.uid, w, curName, text, parent);
    ta.value = ""; replyTo = "";
    B.setActivity(S.user.uid + "_c_" + id, { uid: S.user.uid, kind: "wcom", k: "", show: "", d: "", title: "", rating: 0, comment: text.slice(0, 500), w: w, name: curName.slice(0, 60) }).catch(() => {});
    if (parent) {
      const p = (S.wcomments[w] || []).find(c => c.id === parent);
      if (p && p.uid !== S.user.uid) B.pushNotif(p.uid, "reply_" + id, { type: "reply", from: S.user.uid, w: w, name: curName.slice(0, 60), cid: parent, text: text.slice(0, 140) }).catch(() => {});
    }
    renderWComments();
  } catch (e) { toast(errText(e)); }
  btn.disabled = false;
};
ACT.creply = el => { if (!S.user) { location.hash = "#/connexion"; return; } replyTo = replyTo === el.dataset.id ? "" : el.dataset.id; renderWComments(); const r = document.getElementById("comrep"); if (r) r.focus(); };
ACT.clike = async el => {
  if (!S.user) { toast("Connecte-toi pour liker"); location.hash = "#/connexion"; return; }
  const w = document.getElementById("wcom").dataset.w, c = (S.wcomments[w] || []).find(x => x.id === el.dataset.id); if (!c) return;
  const on = c.likes.indexOf(S.user.uid) < 0;
  try {
    await B.likeWComment(c.id, S.user.uid, on);
    if (on && c.uid !== S.user.uid) B.pushNotif(c.uid, "like_" + c.id + "_" + S.user.uid, { type: "like", from: S.user.uid, w: w, name: (c.name || curName).slice(0, 60), cid: c.id, text: c.text.slice(0, 140) }).catch(() => {});
  } catch (e) { toast(errText(e)); }
};
ACT.cdel = el => {
  const w = document.getElementById("wcom").dataset.w, c = (S.wcomments[w] || []).find(x => x.id === el.dataset.id); if (!c) return;
  confirmBox("Supprimer ce commentaire ?", "", "Supprimer", async () => {
    try {
      await B.deleteWComment(c.id); B.removeActivity(c.uid + "_c_" + c.id).catch(() => {});
      (S.wcomments[w] || []).filter(r => r.parent === c.id).forEach(r => { B.deleteWComment(r.id).catch(() => {}); });
      toast("Commentaire supprimé");
    } catch (e) { toast(errText(e)); }
  }, true);
};
