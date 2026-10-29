// Messagerie : liste des conversations, « Gorilla Position » (le chat de tous les membres), messages privés ; photos et GIFs.
// Appui long sur une discussion : épingler, sourdine, non lu, archiver, supprimer, signaler, bloquer.
// Paramètres façon Messenger (ⓘ) : couleur, emoji rapide, surnoms, recherche, photos partagées, « Vu »…
import { S, B, ACT, FORM, prof, nameOf, avatar, changed } from "../state.js";
import { esc, ICON, timeLabel, dayLabel, hhmm, toast, fmtMs } from "../util.js";
import { errText } from "./account.js";
import { isBlocked, confirmBox } from "../social.js";
import { modal, okImg, okHttp, fileToDataUrl } from "../util.js";
import { GIPHY_KEY } from "../config.js";
import { cleanImageUrl } from "../modals.js";
import { cardHTML, cardLabel, revealCard, cleanCard } from "../share.js";
import { pushPing } from "../push.js";

export const ROOM_NAME = "Gorilla Position";
// texte affiché pour un message (photo / GIF sans texte)
export const msgLabel = m => m.text || (m.gif ? "GIF" : m.img ? "📷 Photo" : m.card && cleanCard(m.card) ? cardLabel(cleanCard(m.card)) : "");

let USERS = null;
const INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v6"/><path d="M12 7.6v.01"/></svg>';

// ---------- réglages des discussions ----------
export const THEMES = [["red", "Rouge TCC", "#e50914"], ["blue", "Bleu", "#0a7cff"], ["purple", "Violet", "#8a3ffc"], ["pink", "Rose", "#f0287a"], ["orange", "Orange", "#f77f00"],
  ["green", "Vert", "#13a35b"], ["teal", "Turquoise", "#0a9396"], ["gold", "Or", "#c08a00"], ["black", "Noir", "#2b2b33"]];
const EMOJIS = ["👍", "❤️", "🔥", "😂", "👏", "💪", "🏆", "🤼", "😮", "🐐", "🦍", "🎉"];
const MUTES = [[15, "Pendant 15 minutes"], [60, "Pendant 1 heure"], [480, "Pendant 8 heures"], [1440, "Pendant 24 heures"], [0, "Jusqu’à ce que je les réactive"]];
const FOREVER = 9e15;

// réglages personnels (privés) : pin, mute (jusqu'à), arch (archivée le), clr (supprimée de mon côté le), unr (marquée non lue), theme/emoji (Gorilla Position)
export const pref = id => ((S.reads && S.reads.cp) || {})[id] || {};
export const isMuted = id => (pref(id).mute || 0) > Date.now();
const convOf = id => S.convs.find(c => c.id === id) || null;
const rrOn = () => !(S.reads && S.reads.rrOff);
export function themeOf(id) { const k = id === "general" ? pref(id).theme : (convOf(id) || {}).theme; return THEMES.find(x => x[0] === k) || THEMES[0]; }
export function emojiOf(id) { const e = id === "general" ? pref(id).emoji : (convOf(id) || {}).emoji; return e || "👍"; }
// surnom choisi dans cette conversation privée, sinon le pseudo
export function nickOf(id, uid) { const c = id !== "general" && convOf(id), n = c && c.nicks && c.nicks[uid]; return n || nameOf(uid); }
function archived(c) { const p = pref(c.id); return !!p.arch && !(c.last && c.last.at > p.arch && c.last.uid !== S.user.uid); }
function cleared(c) { const p = pref(c.id); return !!p.clr && (!c.last || c.last.at <= p.clr); }
const setPref = (id, patch) => B.setChatPref(S.user.uid, id, patch).catch(err => { toast(errText(err)); throw err; });

export function roomUnread() {
  if (!S.user) return 0;
  const r = S.reads.general || 0;
  const n = S.room.filter(m => m.uid !== S.user.uid && m.at > r && !isBlocked(m.uid)).length;
  return n || (pref("general").unr ? 1 : 0);
}
function convUnread(c) { const n = (c.unread && c.unread[S.user.uid]) || 0; return n || (pref(c.id).unr ? 1 : 0); }
export function dmUnread() { return S.user ? S.convs.filter(c => !isBlocked(otherOf(c.id)) && !isMuted(c.id) && !cleared(c)).reduce((s, c) => s + convUnread(c), 0) : 0; }
// pastille de l'onglet Messages : sans les discussions en sourdine
export function chatBadge() { return S.user ? (isMuted("general") ? 0 : roomUnread()) + dmUnread() : 0; }
export function otherOf(convId) { const p = convId.split("_"); return p[0] === S.user.uid ? p[1] : p[0]; }
export function validConv(convId) { return convId === "general" || (S.user && convId.split("_").length === 2 && convId.split("_").indexOf(S.user.uid) >= 0); }

const grpAv = size => '<span class="av grpav" style="width:' + size + "px;height:" + size + "px;font-size:" + Math.round(size * .55) + 'px">🦍</span>';
const cnt = n => n > 99 ? "99+" : String(n);

// ---------- liste ----------
let archOpen = false;
export function chatListView() {
  const me = S.user.uid;
  let h = '<div class="chathead"><h1>Messages</h1><a class="iconbtn" href="#/chat/nouveau" aria-label="Nouveau message">' + ICON.pen + "</a></div>";
  const rows = [];
  const vis = S.room.filter(m => !isBlocked(m.uid)), lr = vis[vis.length - 1];
  rows.push({ id: "general", av: grpAv(52), name: ROOM_NAME, sub: lr ? (lr.uid === me ? "Toi : " : nameOf(lr.uid) + " : ") + msgLabel(lr) : "Le chat de tous les membres", at: lr ? lr.at : 0, un: roomUnread() });
  S.convs.forEach(c => {
    const o = c.members.find(x => x !== me) || me;
    if (isBlocked(o) || cleared(c)) return;
    rows.push({ id: c.id, c: c, av: avatar(prof(o), 52), name: nickOf(c.id, o), sub: c.last ? (c.last.uid === me ? "Toi : " : "") + c.last.text : "Nouvelle conversation", at: c.last ? c.last.at : c.updatedAt || 0, un: convUnread(c) });
  });
  rows.forEach(r => { r.pin = pref(r.id).pin || 0; r.mute = isMuted(r.id); r.arch = r.c ? archived(r.c) : false; });
  rows.sort((a, b) => (b.pin - a.pin) || (b.at - a.at));
  const item = r => '<a class="conv-item' + (r.un ? " unread" : "") + (r.mute ? " muted" : "") + '" href="#/chat/' + encodeURIComponent(r.id) + '" data-conv="' + esc(r.id) + '">' + r.av +
    '<span class="mid"><b>' + esc(r.name) + (r.pin ? '<i class="cico" title="Épinglée">📌</i>' : "") + (r.mute ? '<i class="cico" title="En sourdine">🔕</i>' : "") + "</b><small>" + esc(r.sub) + "</small></span>" +
    '<span class="end">' + esc(r.at ? timeLabel(r.at) : "") + (r.un ? '<span class="dot' + (r.mute ? " grey" : "") + '">' + cnt(r.un) + "</span>" : "") + "</span></a>";
  // la Gorilla Position toujours en haut, séparée des messages privés par un bandeau rouge
  const room = rows.filter(r => r.id === "general"), main = rows.filter(r => !r.arch && r.id !== "general"), arch = rows.filter(r => r.arch);
  h += '<div class="convs gorilla">' + room.map(item).join("") + '</div><div class="dmband">Messages privés</div>';
  h += main.length ? '<div class="convs">' + main.map(item).join("") + "</div>" : "";
  if (arch.length) h += '<button class="linkbtn archtoggle" data-act="archshow">' + (archOpen ? "▾" : "▸") + " Discussions archivées (" + arch.length + ")</button>" +
    (archOpen ? '<div class="convs archived">' + arch.map(item).join("") + "</div>" : "");
  if (!S.convs.length) h += '<p class="note" style="margin-top:12px">Pour écrire en privé à quelqu’un, appuie sur le crayon en haut ou sur « Envoyer un message » depuis son profil.</p>';
  h += '<div class="chatshort"><a class="shortbtn" href="#/pronostics">🎯 Pronostics</a><a class="shortbtn" href="#/sondages">📊 Sondages</a></div>';
  h += '<p class="note small" style="margin-top:14px">Astuce : reste appuyé sur une discussion (clic droit sur ordinateur) pour l’épingler, la mettre en sourdine, l’archiver ou la supprimer.</p>';
  return h;
}
ACT.archshow = () => { archOpen = !archOpen; changed("route"); };

// Appui long (ou clic droit) sur une discussion de la liste
let lpT = null, lpFired = false, lpXY = null;
document.addEventListener("pointerdown", e => {
  const it = e.target.closest && e.target.closest(".conv-item[data-conv]"); lpFired = false; if (!it || e.button > 0) return;
  lpXY = [e.clientX, e.clientY]; clearTimeout(lpT);
  lpT = setTimeout(() => { lpFired = true; it.classList.add("pressed"); setTimeout(() => it.classList.remove("pressed"), 250); try { if (navigator.vibrate) navigator.vibrate(12); } catch (x) {} convMenu(it.dataset.conv); }, 480);
});
["pointerup", "pointercancel"].forEach(t => document.addEventListener(t, () => clearTimeout(lpT), true));
document.addEventListener("pointermove", e => { if (lpXY && Math.hypot(e.clientX - lpXY[0], e.clientY - lpXY[1]) > 10) clearTimeout(lpT); }, { passive: true });
document.addEventListener("click", e => { if (lpFired && e.target.closest && e.target.closest(".conv-item")) { e.preventDefault(); e.stopPropagation(); lpFired = false; } }, true);
document.addEventListener("contextmenu", e => {
  const it = e.target.closest && e.target.closest(".conv-item[data-conv]"); if (!it) return;
  e.preventDefault(); clearTimeout(lpT); if (!lpFired) { lpFired = true; convMenu(it.dataset.conv); }
});

function convMenu(id) {
  if (!S.user || !validConv(id)) return;
  const room = id === "general", c = convOf(id), o = room ? "" : otherOf(id), p = pref(id);
  const un = room ? roomUnread() : c ? convUnread(c) : 0;
  const it = (a, label, cls) => '<button class="item' + (cls ? " " + cls : "") + '" data-a="' + a + '">' + label + "</button>";
  modal((box, close) => {
    box.innerHTML = '<div class="sheethead">' + (room ? grpAv(40) : avatar(prof(o), 40)) + "<b>" + esc(room ? ROOM_NAME : nickOf(id, o)) + '</b></div><div class="sheet">' +
      it("pin", p.pin ? "📌 Désépingler" : "📌 Épingler en haut") +
      it("mute", isMuted(id) ? "🔔 Réactiver les notifications" : "🔕 Mettre en sourdine") +
      it("unread", un ? "✉️ Marquer comme lu" : "✉️ Marquer comme non lu") +
      (!room ? it("arch", c && archived(c) ? "🗂 Désarchiver" : "🗂 Archiver") : "") +
      it("info", "⚙️ Paramètres de la discussion") +
      (!room ? it("profile", "👤 Voir le profil") + it("del", "🗑 Supprimer la discussion", "danger") + it("report", "🚩 Signaler") + it("block", "⛔ Bloquer " + esc(nameOf(o))) : "") +
      '</div><button class="btn wide ghost" style="margin-top:12px" data-no>Fermer</button>';
    box.addEventListener("click", e => {
      if (e.target.closest("[data-no]")) return close();
      const a = e.target.closest("[data-a]"); if (!a) return;
      close(); convAction(id, a.dataset.a);
    });
  });
}
async function convAction(id, a) {
  const me = S.user.uid, room = id === "general", c = convOf(id), o = room ? "" : otherOf(id), p = pref(id);
  try {
    if (a === "pin") { await setPref(id, { pin: p.pin ? 0 : Date.now() }); toast(p.pin ? "Discussion désépinglée" : "Discussion épinglée en haut"); }
    else if (a === "mute") { if (isMuted(id)) { await setPref(id, { mute: 0 }); toast("Notifications réactivées"); } else muteMenu(id); }
    else if (a === "unread") {
      const un = room ? roomUnread() : c ? convUnread(c) : 0;
      if (un) { await setPref(id, { unr: false }); if (room) B.markRoomRead(me).catch(() => {}); else B.markDMRead(id, me, false).catch(() => {}); toast("Marquée comme lue"); }
      else { await setPref(id, { unr: true }); toast("Marquée comme non lue"); }
    }
    else if (a === "arch") { const on = c && archived(c); await setPref(id, { arch: on ? 0 : Date.now() }); toast(on ? "Discussion désarchivée" : "Discussion archivée : elle revient dès qu’un nouveau message arrive"); }
    else if (a === "info") location.hash = "#/chat/" + encodeURIComponent(id) + "/infos";
    else if (a === "profile") location.hash = "#/profil/" + encodeURIComponent(o);
    else if (a === "del") confirmBox("Supprimer la discussion ?", "Elle disparaît de ta liste et ses messages sont effacés de ton côté. " + nameOf(o) + " garde sa copie. Si un nouveau message arrive, la discussion réapparaît.", "Supprimer", async () => {
      try { await setPref(id, { clr: Date.now(), unr: false, arch: 0, pin: 0 }); B.markDMRead(id, me, false).catch(() => {}); toast("Discussion supprimée"); if (location.hash.indexOf("#/chat/") === 0) location.hash = "#/chat"; } catch (e) {}
    }, true);
    else if (a === "report") ACT.report({ dataset: { uid: o, conv: id } });
    else if (a === "block") ACT.block({ dataset: { uid: o } });
    else if (a === "search") { searchOpen = !searchOpen; const s = document.getElementById("csearch"); if (s) { s.hidden = !searchOpen; if (searchOpen) { const q = document.getElementById("cq"); if (q) q.focus(); fillSearch(id); } } }
    else if (a === "theme") themePicker(id);
    else if (a === "emoji") emojiPicker(id);
    else if (a === "nicks") nickEditor(id);
  } catch (e) {}
}
function muteLeft(id) {
  const u = pref(id).mute || 0; if (u <= Date.now()) return "";
  if (u >= FOREVER / 2) return "Jusqu’à ce que tu les réactives";
  return "Jusqu’à " + (new Date(u).toDateString() === new Date().toDateString() ? hhmm(u) : fmtMs(u) + " " + hhmm(u));
}
function muteMenu(id) {
  modal((box, close) => {
    box.innerHTML = '<h3>Mettre en sourdine</h3><p class="sub">Plus d’alerte ni de pastille pour cette discussion. Les messages continuent d’arriver.</p><div class="sheet">' +
      MUTES.map(m => '<button class="item" data-m="' + m[0] + '">' + m[1] + "</button>").join("") + '</div><button class="btn wide ghost" style="margin-top:12px" data-no>Annuler</button>';
    box.addEventListener("click", async e => {
      if (e.target.closest("[data-no]")) return close();
      const b = e.target.closest("[data-m]"); if (!b) return;
      const m = +b.dataset.m; close();
      try { await setPref(id, { mute: m ? Date.now() + m * 60000 : FOREVER }); toast("🔕 Discussion en sourdine" + (m ? " (" + b.textContent.toLowerCase() + ")" : "")); } catch (x) {}
    });
  });
}
function themePicker(id) {
  const cur = themeOf(id)[0];
  modal((box, close) => {
    box.innerHTML = "<h3>Couleur de la discussion</h3><p class=\"sub\">" + (id === "general" ? "Seulement pour toi dans la Gorilla Position." : "Change la couleur pour vous deux.") + '</p><div class="swatches">' +
      THEMES.map(t => '<button type="button" class="sw' + (t[0] === cur ? " on" : "") + '" data-th="' + t[0] + '" style="background:' + t[2] + '" aria-label="' + esc(t[1]) + '"><span>' + esc(t[1]) + "</span></button>").join("") +
      '</div><button class="btn wide ghost" style="margin-top:12px" data-no>Fermer</button>';
    box.addEventListener("click", async e => {
      if (e.target.closest("[data-no]")) return close();
      const b = e.target.closest("[data-th]"); if (!b) return;
      close();
      try { if (id === "general") await setPref(id, { theme: b.dataset.th }); else await B.setConvStyle(id, { theme: b.dataset.th }); toast("Couleur changée"); } catch (x) { toast(errText(x)); }
    });
  });
}
function emojiPicker(id) {
  const cur = emojiOf(id);
  modal((box, close) => {
    box.innerHTML = '<h3>Emoji rapide</h3><p class="sub">Il remplace le bouton d’envoi quand ton message est vide : un appui et il part.</p><div class="emojis">' +
      EMOJIS.map(x => '<button type="button" class="emo' + (x === cur ? " on" : "") + '" data-e="' + esc(x) + '">' + esc(x) + "</button>").join("") + "</div>" +
      '<label class="fld">Ou colle ton emoji<input id="emoin" maxlength="8" placeholder="🙌" autocomplete="off"></label><button class="btn wide" data-ok>Utiliser cet emoji</button>' +
      '<button class="btn wide ghost" style="margin-top:10px" data-no>Fermer</button>';
    const save = async v => {
      v = String(v || "").trim().slice(0, 8); if (!v || /[a-z0-9<>"]/i.test(v)) { toast("Choisis un emoji"); return; }
      close();
      try { if (id === "general") await setPref(id, { emoji: v }); else await B.setConvStyle(id, { emoji: v }); toast("Emoji rapide : " + v); } catch (x) { toast(errText(x)); }
    };
    box.addEventListener("click", e => {
      if (e.target.closest("[data-no]")) return close();
      const b = e.target.closest("[data-e]"); if (b) return save(b.dataset.e);
      if (e.target.closest("[data-ok]")) save(box.querySelector("#emoin").value);
    });
  });
}
function nickEditor(id) {
  const c = convOf(id); if (!c) return;
  const me = S.user.uid, o = otherOf(id), nk = c.nicks || {};
  modal((box, close) => {
    box.innerHTML = '<h3>Surnoms</h3><p class="sub">Visibles par vous deux, seulement dans cette discussion. Laisse vide pour garder le pseudo.</p>' +
      '<label class="fld">' + esc(nameOf(o)) + '<input id="nk_o" maxlength="30" value="' + esc(nk[o] || "") + '" placeholder="' + esc(nameOf(o)) + '"></label>' +
      '<label class="fld">Toi (' + esc(nameOf(me)) + ')<input id="nk_me" maxlength="30" value="' + esc(nk[me] || "") + '" placeholder="' + esc(nameOf(me)) + '"></label>' +
      '<button class="btn wide" data-ok>Enregistrer</button><button class="btn wide ghost" style="margin-top:10px" data-no>Annuler</button>';
    box.addEventListener("click", async e => {
      if (e.target.closest("[data-no]")) return close();
      if (!e.target.closest("[data-ok]")) return;
      const n = {}; n[o] = box.querySelector("#nk_o").value.trim(); n[me] = box.querySelector("#nk_me").value.trim();
      close();
      try { await B.setConvStyle(id, { nicks: n }); toast("Surnoms enregistrés"); } catch (x) { toast(errText(x)); }
    });
  });
}

// ---------- nouveau message ----------
export function newChatView() {
  let h = '<a class="back" href="#/chat">' + ICON.back + " Messages</a><h1>Nouveau message</h1>" +
    '<div class="search"><input id="usersearch" type="search" placeholder="Rechercher un membre" autocomplete="off"></div>';
  if (!USERS) return h + '<p class="empty">Chargement des membres…</p>';
  const list = USERS.filter(u => u.uid !== S.user.uid);
  if (!list.length) return h + '<p class="empty">Aucun autre membre pour l’instant. Partage l’adresse de l’app à tes amis !</p>';
  return h + '<div class="convs">' + list.map(u => '<button class="conv-item" data-act="dm" data-uid="' + esc(u.uid) + '" data-name="' + esc((u.pseudo || "").toLowerCase()) + '">' +
    avatar(u, 44) + '<span class="mid"><b>' + esc(u.pseudo || "Membre") + "</b><small>" + esc(u.bio || "") + "</small></span></button>").join("") + "</div>";
}
export async function loadUsers() { try { USERS = await B.listUsers(); } catch (e) { USERS = []; } changed("users"); }
document.addEventListener("input", e => {
  if (e.target.id === "usersearch") {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll("[data-name]").forEach(el => { el.hidden = q && el.dataset.name.indexOf(q) < 0; });
  }
  if (e.target.id === "cq") { lastCQ = e.target.value; fillSearch(e.target.dataset.conv); }
});

// ---------- conversation ----------
export function convView(convId) {
  const room = convId === "general", mu = isMuted(convId);
  let who;
  if (room) who = grpAv(36) + '<span style="text-align:left"><b>' + ROOM_NAME + "</b><small>" + (mu ? "🔕 En sourdine" : "Le chat de tous les membres") + "</small></span>";
  else { const o = otherOf(convId); who = avatar(prof(o), 36) + '<span style="text-align:left;min-width:0"><b>' + esc(nickOf(convId, o)) + "</b><small>" + (mu ? "🔕 En sourdine · " : "") + "Voir le profil</small></span>"; }
  const blocked = !room && isBlocked(otherOf(convId));
  return '<div class="convhead"><a class="back" href="#/chat" aria-label="Retour">' + ICON.back + "</a>" +
    (room ? '<div class="who">' + who + "</div>" : '<button class="who" data-act="profile" data-uid="' + esc(otherOf(convId)) + '">' + who + "</button>") +
    '<a class="iconbtn infobtn" href="#/chat/' + encodeURIComponent(convId) + '/infos" aria-label="Paramètres de la discussion">' + INFO + "</a></div>" +
    '<div class="msgs" id="msgs"></div>' +
    (blocked ? '<div class="composer blockedbar">Tu as bloqué ce membre. <button class="linkbtn" data-act="block" data-uid="' + esc(otherOf(convId)) + '">Débloquer</button></div>' :
    '<form class="composer" data-form="send" data-conv="' + esc(convId) + '"><button type="button" class="attbtn" data-act="attach" data-conv="' + esc(convId) + '" aria-label="Envoyer une photo ou un GIF">' + ICON.img + "</button>" +
    '<textarea id="msgin" rows="1" maxlength="1000" placeholder="Écris un message…" aria-label="Message"></textarea>' +
    '<button class="sendbtn qemoji" id="sendbtn" type="button" data-act="qemoji" data-conv="' + esc(convId) + '" aria-label="Envoyer ' + esc(emojiOf(convId)) + '"><span class="qe">' + esc(emojiOf(convId)) + "</span></button></form>");
}

// couleur de la discussion (bulles et bouton d'envoi)
export function applyTheme(convId) {
  const t = convId ? themeOf(convId) : THEMES[0];
  document.body.classList.toggle("chattheme", t[0] !== "red");
  if (t[0] !== "red") document.body.style.setProperty("--chat", t[2]); else document.body.style.removeProperty("--chat");
}

let jumpTo = null, flashId = "", flashUntil = 0;
const media = m => (m.img && okImg(m.img)) ? m.img : (m.gif && okHttp(m.gif)) ? m.gif : "";
function msgsOf(convId) {
  const room = convId === "general", clr = room ? 0 : pref(convId).clr || 0;
  return (room ? S.room : (S.convMsgs[convId] || [])).filter(m => !isBlocked(m.uid) && m.at > clr);
}
export function renderMsgs(convId, force) {
  const box = document.getElementById("msgs"); if (!box) return;
  applyTheme(convId);
  const room = convId === "general", list = msgsOf(convId), me = S.user.uid;
  const nearBottom = force || (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160);
  // « Vu » : sous mon dernier message lu par l'autre (si les confirmations de lecture sont activées)
  let seenId = "";
  if (!room && rrOn()) {
    const c = convOf(convId), o = otherOf(convId), seen = c && c.seen && c.seen[o];
    const mine = list.filter(m => m.uid === me), lm = mine[mine.length - 1];
    if (seen && lm && seen >= lm.at) seenId = lm.id;
  }
  let h = "", lastDay = "";
  if (!list.length) h = '<p class="empty">' + (room ? "C’est calme à la Gorilla Position… Lance la discussion !" : "Pas encore de message. Dis bonjour !") + "</p>";
  list.forEach((m, i) => {
    const prev = list[i - 1], next = list[i + 1], day = new Date(m.at).toDateString();
    if (day !== lastDay) { h += '<div class="daysep">' + dayLabel(m.at) + "</div>"; lastDay = day; }
    const same = (a, b) => a && b && a.uid === b.uid && new Date(a.at).toDateString() === new Date(b.at).toDateString() && Math.abs(b.at - a.at) < 300000;
    const sp = same(prev, m), sn = same(m, next), mine = m.uid === me;
    const cls = (mine ? "me " : "") + (!sp ? "first " : "") + (!sn ? "last " : "") + (sp && sn ? "mid" : "");
    h += '<div class="mrow ' + cls + (m.id === flashId && Date.now() < flashUntil ? " flash" : "") + '" id="m-' + esc(m.id) + '">';
    if (!mine) h += '<div class="avslot">' + (!sn ? '<button class="avbtn" data-act="profile" data-uid="' + esc(m.uid) + '" aria-label="Profil">' + avatar(prof(m.uid), 28) + "</button>" : "") + "</div>";
    const big = !media(m) && /^\p{Extended_Pictographic}[\p{Extended_Pictographic}‍️\s]{0,6}$/u.test(m.text || "");
    // carte partagée (article, fiche, PLE…) : au-dessus du message ; sans message, un petit bouton « ⋯ » pour les options
    const card = m.card ? cardHTML(m.card, m.id) : "", bubOn = !!(media(m) || m.text), mdata = ' data-id="' + esc(m.id) + '" data-uid="' + esc(m.uid) + '" data-conv="' + esc(convId) + '"';
    h += '<div class="mcol">' + (room && !mine && !sp ? '<div class="sender">' + esc(nickOf(convId, m.uid)) + "</div>" : "") +
      (card ? '<div class="mcardw">' + card + (!bubOn ? '<button class="mcmenu" data-act="msgmenu"' + mdata + ' aria-label="Options du message">⋯</button>' : "") + "</div>" : "") +
      (bubOn || !card ? '<button class="bub' + (media(m) ? " media" : "") + (big ? " bigemo" : "") + '" data-act="msgmenu"' + mdata + ">" +
      (media(m) ? '<img class="mimg" src="' + esc(media(m)) + '" alt="' + (m.gif ? "GIF" : "Photo") + '" loading="lazy">' : "") + (m.text ? '<span class="mtxt">' + esc(m.text) + "</span>" : "") + "</button>" : "") +
      (!sn || m.id === seenId ? '<div class="mtime">' + hhmm(m.at) + (m.id === seenId ? ' · <span class="vu">Vu</span>' : "") + "</div>" : "") + "</div></div>";
  });
  box.innerHTML = h;
  const target = jumpTo && document.getElementById("m-" + jumpTo);
  if (target) {
    // message trouvé par la recherche : on le centre et il clignote (même si la liste est redessinée entre-temps)
    flashId = jumpTo; flashUntil = Date.now() + 2200; jumpTo = null;
    target.scrollIntoView({ block: "center" }); target.classList.add("flash");
    setTimeout(() => { const t = document.getElementById("m-" + flashId); if (t) t.classList.remove("flash"); }, 2250);
  }
  else if (flashId && Date.now() < flashUntil) { const t = document.getElementById("m-" + flashId); if (t) t.scrollIntoView({ block: "center" }); }
  else if (nearBottom) window.scrollTo(0, document.documentElement.scrollHeight);
}

export function setupComposer() {
  const ta = document.getElementById("msgin"), btn = document.getElementById("sendbtn");
  if (!ta) return;
  const conv = ta.form.dataset.conv;
  const grow = () => {
    ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    const empty = !ta.value.trim();
    if (empty && !btn.classList.contains("qemoji")) {
      btn.type = "button"; btn.dataset.act = "qemoji"; btn.dataset.conv = conv; btn.classList.add("qemoji");
      btn.innerHTML = '<span class="qe">' + esc(emojiOf(conv)) + "</span>"; btn.setAttribute("aria-label", "Envoyer " + emojiOf(conv));
    } else if (!empty && btn.classList.contains("qemoji")) {
      btn.type = "submit"; delete btn.dataset.act; btn.classList.remove("qemoji"); btn.innerHTML = ICON.send; btn.setAttribute("aria-label", "Envoyer");
    }
  };
  ta.addEventListener("input", grow);
  ta.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); if (ta.value.trim()) ta.form.requestSubmit(); }
  });
}
// emoji rapide changé pendant que la conversation est ouverte
export function refreshQuickEmoji(convId) {
  const btn = document.getElementById("sendbtn");
  if (btn && btn.classList.contains("qemoji")) btn.innerHTML = '<span class="qe">' + esc(emojiOf(convId)) + "</span>";
}

async function sendText(convId, text, extra) {
  if (convId === "general") await B.sendRoom(S.user.uid, text, extra);
  else { await B.sendDM(convId, S.user.uid, otherOf(convId), text, extra); pushPing({ type: "dm", conv: convId }); }
}
// carte spoiler touchée : on la dévoile
ACT.cardsp = el => { revealCard(el.dataset.k); const f = document.querySelector("form.composer[data-conv]"); const id = f ? f.dataset.conv : (location.hash.split("/")[2] || "general"); renderMsgs(decodeURIComponent(id)); };
FORM.send = async f => {
  const ta = document.getElementById("msgin"), text = ta.value.trim().slice(0, 1000), convId = f.dataset.conv;
  if (!text || !S.user) return;
  ta.value = ""; ta.style.height = "auto"; ta.dispatchEvent(new Event("input"));
  try { await sendText(convId, text); renderMsgs(convId, true); } catch (e) { ta.value = text; ta.dispatchEvent(new Event("input")); toast(errText(e)); }
  ta.focus();
};
ACT.qemoji = async el => {
  const convId = el.dataset.conv; if (!S.user || !convId) return;
  el.classList.add("pop"); setTimeout(() => el.classList.remove("pop"), 300);
  try { await sendText(convId, emojiOf(convId)); renderMsgs(convId, true); } catch (e) { toast(errText(e)); }
};

ACT.dm = async el => {
  if (!S.user) { location.hash = "#/connexion"; return; }
  try {
    const id = await B.openDM(S.user.uid, el.dataset.uid);
    if (pref(id).clr || pref(id).arch) B.setChatPref(S.user.uid, id, { arch: 0 }).catch(() => {});
    location.hash = "#/chat/" + encodeURIComponent(id);
  }
  catch (e) { toast(errText(e)); }
};
ACT.profile = el => { location.hash = "#/profil/" + encodeURIComponent(el.dataset.uid); };

// Appui sur une bulle : copier, supprimer (son message ou admin), signaler, bloquer
ACT.msgmenu = el => {
  const d = el.dataset, mine = S.user && d.uid === S.user.uid, room = d.conv === "general";
  const list = room ? S.room : (S.convMsgs[d.conv] || []), m = list.find(x => x.id === d.id); if (!m) return;
  const canDel = mine || S.isAdmin;
  modal((box, close) => {
    box.innerHTML = (m.text ? '<p class="sub" style="margin-top:4px"><q class="mycom" style="text-align:left">' + esc(m.text.slice(0, 300)) + "</q></p>" : "") +
      (media(m) ? '<img class="mbig" src="' + esc(media(m)) + '" alt="">' : "") + '<div class="sheet">' +
      (m.text ? '<button class="item" data-a="copy">Copier le texte</button>' : "") +
      (canDel ? '<button class="item danger" data-a="del">Supprimer le message' + (!mine ? " (admin)" : "") + "</button>" : "") +
      (!mine ? '<button class="item" data-a="report">Signaler ce message</button><button class="item" data-a="block">Bloquer ' + esc(nameOf(m.uid)) + "</button>" : "") +
      '</div><button class="btn wide ghost" style="margin-top:12px" data-no>Fermer</button>';
    box.addEventListener("click", async e => {
      const a = e.target.closest("[data-a]");
      if (e.target.closest("[data-no]")) return close();
      if (!a) return;
      close();
      if (a.dataset.a === "copy") { try { await navigator.clipboard.writeText(m.text); toast("Texte copié"); } catch (err) { toast("Copie impossible"); } }
      else if (a.dataset.a === "del") {
        try {
          if (room) await B.deleteRoomMsg(m.id);
          else {
            await B.deleteDM(d.conv, m.id);
            const c = S.convs.find(x => x.id === d.conv);
            if (c && c.last && list[list.length - 1] === m) B.fixLast(d.conv, "Message supprimé").catch(() => {});
          }
          toast("Message supprimé");
        } catch (err) { toast(errText(err)); }
      }
      else if (a.dataset.a === "report") ACT.report({ dataset: { uid: m.uid, conv: d.conv, msg: m.id, text: m.text || (m.gif ? "[GIF] " + m.gif : "[photo]") } });
      else if (a.dataset.a === "block") ACT.block({ dataset: { uid: m.uid } });
    });
  });
};

// ---------- paramètres d'une discussion (ⓘ) ----------
let searchOpen = false, lastCQ = "", infoConv = "";
export function convInfoView(id) {
  const room = id === "general", c = convOf(id), me = S.user.uid;
  if (infoConv !== id) { infoConv = id; searchOpen = false; lastCQ = ""; }
  let h = '<a class="back" href="#/chat/' + encodeURIComponent(id) + '">' + ICON.back + " Discussion</a>";
  if (!room && !c) return h + '<p class="empty">Discussion introuvable.</p>';
  const o = room ? "" : otherOf(id), p = pref(id), th = themeOf(id), mu = isMuted(id), un = room ? roomUnread() : convUnread(c);
  const row = (a, ico, title, sub, cls) => '<button class="item' + (cls ? " " + cls : "") + '" data-act="cinfo" data-a="' + a + '" data-conv="' + esc(id) + '"><span class="ico">' + ico + '</span><span class="lbl"><b>' + title + "</b>" +
    (sub ? "<small>" + sub + "</small>" : "") + '</span><span class="chev">›</span></button>';
  const qa = (a, ico, label) => '<button class="qa" data-act="cinfo" data-a="' + a + '" data-conv="' + esc(id) + '"><span>' + ico + "</span><small>" + label + "</small></button>";
  const nick = room ? "" : nickOf(id, o);
  h += '<div class="prof cinfo">' + (room ? grpAv(88) : avatar(prof(o), 88)) + '<b class="name">' + esc(room ? ROOM_NAME : nick) + "</b>" +
    (room ? '<span class="since">Le chat de tous les membres</span>' : nick !== nameOf(o) ? '<span class="since">' + esc(nameOf(o)) + "</span>" : "") + "</div>";
  h += '<div class="qacts">' + (!room ? qa("profile", "👤", "Profil") : "") + qa("mute", mu ? "🔔" : "🔕", mu ? "Réactiver" : "Sourdine") + qa("search", "🔍", "Rechercher") + "</div>";
  h += '<div class="csearch" id="csearch"' + (searchOpen ? "" : " hidden") + '><div class="search"><input id="cq" data-conv="' + esc(id) + '" type="search" placeholder="Rechercher dans la discussion" autocomplete="off" value="' + esc(lastCQ) + '"></div><div id="cres"></div></div>';
  const nk = (c && c.nicks) || {};
  h += '<h2>Personnaliser</h2><div class="list">' +
    row("theme", '<span class="swatch" style="background:' + th[2] + '"></span>', "Couleur", esc(th[1])) +
    row("emoji", '<span class="qeico">' + esc(emojiOf(id)) + "</span>", "Emoji rapide", "Un appui sur le bouton d’envoi quand le message est vide") +
    (!room ? row("nicks", "✏️", "Surnoms", nk[o] || nk[me] ? esc([nk[o] ? nameOf(o) + " : " + nk[o] : "", nk[me] ? "toi : " + nk[me] : ""].filter(Boolean).join(" · ")) : "Aucun") : "") + "</div>" +
    '<p class="note small" style="margin-top:6px">' + (room ? "Dans la Gorilla Position, la couleur et l’emoji ne changent que pour toi." : "La couleur, l’emoji et les surnoms changent pour vous deux.") + "</p>";
  h += "<h2>Photos et GIFs partagés</h2>" + mediaGrid(id);
  h += '<h2>Plus d’options</h2><div class="list">' +
    row("pin", "📌", p.pin ? "Désépingler" : "Épingler en haut de la liste", "") +
    row("mute", mu ? "🔔" : "🔕", mu ? "Réactiver les notifications" : "Mettre en sourdine", mu ? esc(muteLeft(id)) : "") +
    row("unread", "✉️", un ? "Marquer comme lu" : "Marquer comme non lu", "") +
    (!room ? row("arch", "🗂", archived(c) ? "Désarchiver" : "Archiver la discussion", "Elle revient dès qu’un nouveau message arrive") : "") +
    (!room ? '<button class="item" data-act="crr"><span class="ico">👁</span><span class="lbl"><b>Confirmations de lecture « Vu »</b><small>' +
      (rrOn() ? "Activées : on voit quand tu as lu les messages privés" : "Désactivées : personne ne voit quand tu lis, et tu ne vois pas les « Vu » des autres") +
      '</small></span><span class="tgl' + (rrOn() ? " on" : "") + '" aria-hidden="true"></span></button>' : "") + "</div>";
  if (!room) h += '<h2>Confidentialité</h2><div class="list">' + row("block", "⛔", "Bloquer " + esc(nameOf(o)), "") + row("report", "🚩", "Signaler", "") + row("del", "🗑", "Supprimer la discussion", "Seulement de ton côté", "danger") + "</div>";
  return h;
}
function mediaGrid(id) {
  const list = msgsOf(id).filter(media).slice(-60).reverse();
  if (!list.length) return '<p class="note">Aucune photo ni GIF pour l’instant' + (id === "general" ? " (parmi les derniers messages)" : "") + ".</p>";
  return '<div class="mgrid">' + list.map(m => '<button class="mcell" data-act="cmedia" data-src="' + esc(media(m)) + '" data-mid="' + esc(m.id) + '" data-conv="' + esc(id) + '"><img src="' + esc(media(m)) + '" alt="" loading="lazy"></button>').join("") + "</div>";
}
// à appeler après l'affichage de la page des paramètres
export function afterConvInfo(id) { if (searchOpen) fillSearch(id); }
function fillSearch(id) {
  const res = document.getElementById("cres"); if (!res) return;
  const q = lastCQ.trim().toLowerCase();
  if (q.length < 2) { res.innerHTML = '<p class="note small">Tape au moins 2 lettres. La recherche porte sur les derniers messages chargés.</p>'; return; }
  const list = msgsOf(id).filter(m => (m.text || "").toLowerCase().indexOf(q) >= 0).reverse().slice(0, 40);
  if (!list.length) { res.innerHTML = '<p class="note small">Aucun message trouvé.</p>'; return; }
  const mark = t => { const i = t.toLowerCase().indexOf(q), s = Math.max(0, i - 40); return (s ? "…" : "") + esc(t.slice(s, i)) + "<mark>" + esc(t.slice(i, i + q.length)) + "</mark>" + esc(t.slice(i + q.length, i + q.length + 80)); };
  res.innerHTML = '<div class="list">' + list.map(m => '<button class="item" data-act="cjump" data-conv="' + esc(id) + '" data-mid="' + esc(m.id) + '"><span class="lbl"><b>' + esc(m.uid === S.user.uid ? "Toi" : nickOf(id, m.uid)) +
    "</b><small>" + mark(m.text) + '</small></span><span class="rt">' + esc(timeLabel(m.at)) + "</span></button>").join("") + "</div>";
}
ACT.cinfo = el => convAction(el.dataset.conv, el.dataset.a);
ACT.crr = async () => { try { await B.setReadReceipts(S.user.uid, !rrOn()); toast(rrOn() ? "« Vu » désactivé" : "« Vu » activé"); } catch (e) { toast(errText(e)); } };
ACT.cjump = el => { jumpTo = el.dataset.mid; location.hash = "#/chat/" + encodeURIComponent(el.dataset.conv); };
ACT.cmedia = el => {
  modal((box, close) => {
    box.innerHTML = '<img class="mbig" src="' + esc(el.dataset.src) + '" alt=""><button class="btn wide" data-go>Voir dans la discussion</button><button class="btn wide ghost" style="margin-top:10px" data-no>Fermer</button>';
    box.addEventListener("click", e => {
      if (e.target.closest("[data-no]")) close();
      else if (e.target.closest("[data-go]")) { close(); ACT.cjump(el); }
    });
  });
};

// ---------- Photos et GIFs ----------
async function sendMedia(convId, extra) {
  const ta = document.getElementById("msgin"), text = ta ? ta.value.trim().slice(0, 1000) : "";
  try {
    await sendText(convId, text, extra);
    if (ta) { ta.value = ""; ta.style.height = "auto"; ta.dispatchEvent(new Event("input")); }
    renderMsgs(convId, true);
  } catch (e) { toast(errText(e)); }
}
const readRaw = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
async function gifSearch(q) {
  const u = "https://api.giphy.com/v1/gifs/" + (q ? "search" : "trending") + "?api_key=" + encodeURIComponent(GIPHY_KEY) + "&limit=24&rating=pg-13&lang=fr" + (q ? "&q=" + encodeURIComponent(q) : "");
  const j = await (await fetch(u)).json();
  return (j.data || []).map(g => ({ prev: g.images && g.images.fixed_height_small && g.images.fixed_height_small.url, url: g.images && (g.images.downsized || g.images.fixed_height || {}).url })).filter(g => okHttp(g.prev) && okHttp(g.url));
}
ACT.attach = el => {
  const convId = el.dataset.conv;
  modal((box, close) => {
    box.innerHTML = "<h3>Photo ou GIF</h3>" +
      (GIPHY_KEY ? '<div class="search" style="margin-top:6px"><input id="gifq" type="search" placeholder="Chercher un GIF (ex. : catch, wow, Cena…)" autocomplete="off"></div><div class="gifgrid" id="gifs"><p class="note">Chargement…</p></div><p class="note small" style="margin:0 16px 6px">GIFs proposés par GIPHY</p>' : "") +
      '<button class="btn wide" data-gal>Choisir dans ma galerie (photo ou GIF)</button>' +
      '<div class="sep">ou</div><label class="fld">Lien d’un GIF ou d’une image<input id="gifurl" type="url" inputmode="url" placeholder="https://…"></label>' +
      '<p class="err" id="atterr"></p><button class="btn wide ghost" data-url>Envoyer ce lien</button>' +
      '<button class="btn wide ghost" style="margin-top:10px" data-no>Annuler</button><input type="file" accept="image/*" hidden id="attfile">';
    const err = t => { box.querySelector("#atterr").textContent = t; };
    const fill = async q => {
      const g = box.querySelector("#gifs"); if (!g) return;
      try { const list = await gifSearch(q); g.innerHTML = list.length ? list.map(x => '<button type="button" class="gifbtn" data-gif="' + esc(x.url) + '"><img src="' + esc(x.prev) + '" alt="GIF" loading="lazy"></button>').join("") : '<p class="note">Aucun GIF trouvé.</p>'; }
      catch (e) { g.innerHTML = '<p class="note">Recherche de GIF indisponible pour le moment.</p>'; }
    };
    if (GIPHY_KEY) { fill(""); let t = null; box.querySelector("#gifq").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => fill(e.target.value.trim()), 350); }); }
    box.addEventListener("change", async e => {
      if (e.target.id !== "attfile" || !e.target.files[0]) return;
      const f = e.target.files[0];
      try {
        let img;
        if (f.type === "image/gif") {
          if (f.size > 680000) { err("Ce GIF est trop lourd (650 Ko maximum). Envoie plutôt son lien."); return; }
          img = await readRaw(f);
        } else img = await fileToDataUrl(f, 1280, 1280, false, 380000);
        close(); await sendMedia(convId, { img: img });
      } catch (x) { err("Image illisible (essaie une photo JPEG ou PNG)"); }
    });
    box.addEventListener("click", e => {
      const g = e.target.closest("[data-gif]");
      if (g) { close(); sendMedia(convId, { gif: g.dataset.gif }); return; }
      if (e.target.closest("[data-gal]")) box.querySelector("#attfile").click();
      else if (e.target.closest("[data-no]")) close();
      else if (e.target.closest("[data-url]")) {
        const u = cleanImageUrl(box.querySelector("#gifurl").value);
        if (!/^https:\/\/[^\s"<>]+$/.test(u)) { err("Colle un lien qui commence par https://"); return; }
        close(); sendMedia(convId, { gif: u.slice(0, 600) });
      }
    });
  });
};
