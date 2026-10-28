// Messagerie : liste des conversations, « Gorilla Position » (le chat de tous les membres), messages privés ; photos et GIFs
import { S, B, ACT, FORM, prof, nameOf, avatar, changed } from "../state.js";
import { esc, ICON, timeLabel, dayLabel, hhmm, toast } from "../util.js";
import { errText } from "./account.js";
import { isBlocked } from "../social.js";
import { modal, okImg, okHttp, fileToDataUrl } from "../util.js";
import { GIPHY_KEY } from "../config.js";
import { cleanImageUrl } from "../modals.js";

export const ROOM_NAME = "Gorilla Position";
// texte affiché pour un message (photo / GIF sans texte)
export const msgLabel = m => m.text || (m.gif ? "GIF" : m.img ? "📷 Photo" : "");

let USERS = null;

export function roomUnread() {
  if (!S.user) return 0;
  const r = S.reads.general || 0;
  return S.room.filter(m => m.uid !== S.user.uid && m.at > r && !isBlocked(m.uid)).length;
}
export function dmUnread() { return S.user ? S.convs.filter(c => !isBlocked(otherOf(c.id))).reduce((s, c) => s + ((c.unread && c.unread[S.user.uid]) || 0), 0) : 0; }
export function otherOf(convId) { const p = convId.split("_"); return p[0] === S.user.uid ? p[1] : p[0]; }
export function validConv(convId) { return convId === "general" || (S.user && convId.split("_").length === 2 && convId.split("_").indexOf(S.user.uid) >= 0); }

const grpAv = size => '<span class="av grpav" style="width:' + size + "px;height:" + size + "px;font-size:" + Math.round(size * .55) + 'px">🦍</span>';
const cnt = n => n > 99 ? "99+" : String(n);

export function chatListView() {
  const me = S.user.uid;
  let h = '<div class="chathead"><h1>Messages</h1><a class="iconbtn" href="#/chat/nouveau" aria-label="Nouveau message">' + ICON.pen + "</a></div><div class=\"convs\">";
  const item = (href, av, name, sub, time, un) => '<a class="conv-item' + (un ? " unread" : "") + '" href="' + href + '">' + av +
    '<span class="mid"><b>' + esc(name) + "</b><small>" + esc(sub) + '</small></span><span class="end">' + esc(time) + (un ? '<span class="dot">' + cnt(un) + "</span>" : "") + "</span></a>";
  const vis = S.room.filter(m => !isBlocked(m.uid)), lr = vis[vis.length - 1];
  h += item("#/chat/general", grpAv(52), ROOM_NAME, lr ? (lr.uid === me ? "Toi : " : nameOf(lr.uid) + " : ") + msgLabel(lr) : "Le chat de tous les membres", lr ? timeLabel(lr.at) : "", roomUnread());
  S.convs.forEach(c => {
    const o = c.members.find(x => x !== me) || me;
    if (isBlocked(o)) return;
    h += item("#/chat/" + encodeURIComponent(c.id), avatar(prof(o), 52), nameOf(o), c.last ? (c.last.uid === me ? "Toi : " : "") + c.last.text : "Nouvelle conversation",
      c.last ? timeLabel(c.last.at) : "", (c.unread && c.unread[me]) || 0);
  });
  h += "</div>";
  if (!S.convs.length) h += '<p class="note" style="margin-top:12px">Pour écrire en privé à quelqu’un, appuie sur le crayon en haut ou sur « Envoyer un message » depuis son profil.</p>';
  return h;
}

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
});

export function convView(convId) {
  const room = convId === "general";
  let who;
  if (room) who = grpAv(36) + '<span style="text-align:left"><b>' + ROOM_NAME + "</b><small>Le chat de tous les membres</small></span>";
  else { const o = otherOf(convId); who = avatar(prof(o), 36) + '<span style="text-align:left;min-width:0"><b>' + esc(nameOf(o)) + "</b><small>Voir le profil</small></span>"; }
  const blocked = !room && isBlocked(otherOf(convId));
  return '<div class="convhead"><a class="back" href="#/chat" aria-label="Retour">' + ICON.back + "</a>" +
    (room ? '<div class="who">' + who + "</div>" : '<button class="who" data-act="profile" data-uid="' + esc(otherOf(convId)) + '">' + who + "</button>") + "</div>" +
    '<div class="msgs" id="msgs"></div>' +
    (blocked ? '<div class="composer blockedbar">Tu as bloqué ce membre. <button class="linkbtn" data-act="block" data-uid="' + esc(otherOf(convId)) + '">Débloquer</button></div>' :
    '<form class="composer" data-form="send" data-conv="' + esc(convId) + '"><button type="button" class="attbtn" data-act="attach" data-conv="' + esc(convId) + '" aria-label="Envoyer une photo ou un GIF">' + ICON.img + "</button>" +
    '<textarea id="msgin" rows="1" maxlength="1000" placeholder="Écris un message…" aria-label="Message"></textarea>' +
    '<button class="sendbtn" id="sendbtn" disabled aria-label="Envoyer">' + ICON.send + "</button></form>");
}

const media = m => (m.img && okImg(m.img)) ? m.img : (m.gif && okHttp(m.gif)) ? m.gif : "";
export function renderMsgs(convId, force) {
  const box = document.getElementById("msgs"); if (!box) return;
  const room = convId === "general", list = (room ? S.room : (S.convMsgs[convId] || [])).filter(m => !isBlocked(m.uid)), me = S.user.uid;
  const nearBottom = force || (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160);
  let h = "", lastDay = "";
  if (!list.length) h = '<p class="empty">' + (room ? "C’est calme à la Gorilla Position… Lance la discussion !" : "Pas encore de message. Dis bonjour !") + "</p>";
  list.forEach((m, i) => {
    const prev = list[i - 1], next = list[i + 1], day = new Date(m.at).toDateString();
    if (day !== lastDay) { h += '<div class="daysep">' + dayLabel(m.at) + "</div>"; lastDay = day; }
    const same = (a, b) => a && b && a.uid === b.uid && new Date(a.at).toDateString() === new Date(b.at).toDateString() && Math.abs(b.at - a.at) < 300000;
    const sp = same(prev, m), sn = same(m, next), mine = m.uid === me;
    const cls = (mine ? "me " : "") + (!sp ? "first " : "") + (!sn ? "last " : "") + (sp && sn ? "mid" : "");
    h += '<div class="mrow ' + cls + '">';
    if (!mine) h += '<div class="avslot">' + (!sn ? '<button class="avbtn" data-act="profile" data-uid="' + esc(m.uid) + '" aria-label="Profil">' + avatar(prof(m.uid), 28) + "</button>" : "") + "</div>";
    h += '<div class="mcol">' + (room && !mine && !sp ? '<div class="sender">' + esc(nameOf(m.uid)) + "</div>" : "") + '<button class="bub' + (media(m) ? " media" : "") + '" data-act="msgmenu" data-id="' + esc(m.id) + '" data-uid="' + esc(m.uid) + '" data-conv="' + esc(convId) + '">' +
      (media(m) ? '<img class="mimg" src="' + esc(media(m)) + '" alt="' + (m.gif ? "GIF" : "Photo") + '" loading="lazy">' : "") + (m.text ? '<span class="mtxt">' + esc(m.text) + "</span>" : "") + "</button>" +
      (!sn ? '<div class="mtime">' + hhmm(m.at) + "</div>" : "") + "</div></div>";
  });
  box.innerHTML = h;
  if (nearBottom) window.scrollTo(0, document.documentElement.scrollHeight);
}

export function setupComposer() {
  const ta = document.getElementById("msgin"), btn = document.getElementById("sendbtn");
  if (!ta) return;
  const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; btn.disabled = !ta.value.trim(); };
  ta.addEventListener("input", grow);
  ta.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); ta.form.requestSubmit(); }
  });
}

FORM.send = async f => {
  const ta = document.getElementById("msgin"), text = ta.value.trim().slice(0, 1000), convId = f.dataset.conv;
  if (!text || !S.user) return;
  ta.value = ""; ta.style.height = "auto"; document.getElementById("sendbtn").disabled = true;
  try {
    if (convId === "general") await B.sendRoom(S.user.uid, text);
    else await B.sendDM(convId, S.user.uid, otherOf(convId), text);
    renderMsgs(convId, true);
  } catch (e) { ta.value = text; toast(errText(e)); }
  ta.focus();
};

ACT.dm = async el => {
  if (!S.user) { location.hash = "#/connexion"; return; }
  try { const id = await B.openDM(S.user.uid, el.dataset.uid); location.hash = "#/chat/" + encodeURIComponent(id); }
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

// ---------- Photos et GIFs ----------
async function sendMedia(convId, extra) {
  const ta = document.getElementById("msgin"), text = ta ? ta.value.trim().slice(0, 1000) : "";
  try {
    if (convId === "general") await B.sendRoom(S.user.uid, text, extra);
    else await B.sendDM(convId, S.user.uid, otherOf(convId), text, extra);
    if (ta) { ta.value = ""; ta.style.height = "auto"; const b = document.getElementById("sendbtn"); if (b) b.disabled = true; }
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
