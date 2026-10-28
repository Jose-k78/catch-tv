// Point d'entrée : chargement, navigation, abonnements temps réel, en-tête, notifications
import { firebaseConfig, ADMIN_UID } from "./config.js";
import { S, setBackend, B, ACT, FORM, onChange, changed, prof, avatar, need, nameOf } from "./state.js";
import { loadContent } from "./content.js";
import { ICON, toast } from "./util.js";
import { homeView, promoView, showView, tabsView, creditsView } from "./views/catalog.js";
import { matchesView } from "./views/matches.js";
import { titlesView, titleView } from "./views/titles.js";
import { searchView, wrestlerView, fillWiki } from "./views/search.js";
import { authView, settingsView, profileView, editProfileView, applyTheme } from "./views/account.js";
import { chatListView, newChatView, convView, renderMsgs, setupComposer, loadUsers, roomUnread, dmUnread, validConv } from "./views/chat.js";
import "./modals.js";
import * as demoBackend from "./backend/demo.js";
import { membersView, loadMembers } from "./views/members.js";
import { favsView } from "./views/favs.js";
import { hlView } from "./views/highlights.js";
import { liveNow } from "./views/catalog.js";
import { onFriends, onFeuds, resetSocial, socialBadge } from "./social.js";
import { parisDay, parisHour } from "./time.js";

let route = { name: "home" }, routeSubs = [], userSubs = [], dirty = false, searchFocused = false;
const NEEDS_USER = { settings: 1, editprofile: 1, chat: 1, newchat: 1, conv: 1, profile: 1, members: 1, favs: 1 };
const FORM_VIEWS = { auth: 1, settings: 1, editprofile: 1 };
const REL = {
  home: ["content", "images", "history", "auth", "tick", "profile", "spoil"], promo: ["content", "images", "history", "auth", "tick", "spoil"],
  profile: ["profile", "profiles", "history", "otherHistory", "auth", "friends", "feuds", "blocks", "memberFriends", "tick"], chat: ["room", "convs", "reads", "profiles", "auth", "blocks"],
  newchat: ["users", "auth"], settings: ["auth", "route", "reports", "blocks", "profiles"], editprofile: ["profile", "auth"], auth: ["auth"],
  matches: ["route"], credits: ["images"], wrestler: ["profile", "spoil", "history"], search: [], titles: ["history", "spoil"], title: ["history", "spoil"],
  members: ["users", "friends", "feuds", "blocks", "profiles", "auth", "tick"], favs: ["profile", "profiles", "friends", "auth"], hl: ["history", "spoil"],
};

// ---------- navigation ----------
function parse() {
  const parts = (location.hash || "").replace(/^#\/?/, "").split("/").filter(Boolean).map(s => { try { return decodeURIComponent(s); } catch (e) { return s; } });
  switch (parts[0]) {
    case undefined: return { name: "home" };
    case "p": return S.P[parts[1]] ? { name: "promo", k: parts[1], n: parts[2] || "" } : { name: "home" };
    case "connexion": case "inscription": case "oubli": return { name: "auth", mode: parts[0] };
    case "parametres": return { name: "settings", sub: parts[1] || "" };
    case "profil": return { name: "profile", uid: parts[1] || "" };
    case "profil-modifier": return { name: "editprofile" };
    case "chat": return parts[1] === "nouveau" ? { name: "newchat" } : parts[1] ? { name: "conv", id: parts[1] } : { name: "chat" };
    case "recherche": return { name: "search", q: parts.slice(1).join("/") };
    case "catcheur": return parts[1] ? { name: "wrestler", q: parts.slice(1).join("/").slice(0, 60) } : { name: "search", q: "" };
    case "matchs": return { name: "matches" };
    case "titres": return S.P[parts[1]] ? { name: "titles", k: parts[1], n: parts[2] || "" } : { name: "home" };
    case "titre": return { name: "title", id: parts[1] || "" };
    case "credits": return { name: "credits" };
    case "membres": return { name: "members", tab: parts[1] || "" };
    case "favoris": return { name: "favs" };
    case "hl": return S.P[parts[1]] ? { name: "hl", k: parts[1], show: parts[2] || "PLE", d: parts[3] || "" } : { name: "home" };
    default: return { name: "home" };
  }
}

function onRoute() {
  routeSubs.forEach(u => u()); routeSubs = []; dirty = false;
  const prevName = route.name;
  route = parse();
  if (route.name !== "search" || prevName !== "search") searchFocused = false;
  if (NEEDS_USER[route.name] && !S.user) {
    if (S.authReady) { if (route.name === "chat" || route.name === "conv") toast("Connecte-toi pour discuter"); location.replace("#/connexion"); return; }
  }
  if (route.name === "auth" && S.user) { location.replace("#/profil"); return; }
  if (route.name === "profile" && S.user) {
    if (!route.uid) route.uid = S.user.uid;
    if (route.uid !== S.user.uid) {
      need(route.uid);
      const id = route.uid;
      routeSubs.push(B.watchHistory(id, list => { S.otherHistory[id] = list; changed("otherHistory"); }));
      routeSubs.push(B.watchFriends(id, list => { S.memberFriends[id] = list; list.forEach(f => f.members.forEach(need)); changed("memberFriends"); }));
    }
  }
  if (route.name === "conv" && S.user) {
    if (!validConv(route.id)) { location.replace("#/chat"); return; }
    if (route.id !== "general") {
      const id = route.id;
      routeSubs.push(B.watchMessages(id, list => { S.convMsgs[id] = list; list.forEach(m => need(m.uid)); changed("msgs"); }));
    }
  }
  if (route.name === "newchat" && S.user) loadUsers();
  if (route.name === "members" && S.user) loadMembers(true);
  render();
  if (route.name !== "conv") window.scrollTo(0, 0);
}

// ---------- affichage ----------
function render() {
  const app = document.getElementById("app"), tabs = document.getElementById("tabs");
  document.body.classList.toggle("inconv", route.name === "conv");
  tabs.innerHTML = (route.name === "home" || route.name === "promo") ? tabsView(route) : "";
  document.body.classList.toggle("wide", route.name === "home");
  let h = "";
  const waiting = NEEDS_USER[route.name] && !S.user;
  if (waiting) h = '<p class="empty">Chargement…</p>';
  else switch (route.name) {
    case "home": h = homeView(); break;
    case "promo": h = route.n ? showView(route.k, route.n) : promoView(route.k); break;
    case "auth": h = authView(route.mode); break;
    case "settings": h = settingsView(route.sub); break;
    case "profile": h = profileView(route.uid); break;
    case "editprofile": h = editProfileView(); break;
    case "chat": h = chatListView(); break;
    case "newchat": h = newChatView(); break;
    case "conv": h = convView(route.id); break;
    case "search": h = searchView(route.q); break;
    case "wrestler": h = wrestlerView(route.q); break;
    case "matches": h = matchesView(); break;
    case "titles": h = titlesView(route.k, route.n); break;
    case "title": h = titleView(route.id); break;
    case "credits": h = creditsView(); break;
    case "members": h = membersView(route.tab); break;
    case "favs": h = favsView(); break;
    case "hl": h = hlView(route.k, route.show, route.d); break;
  }
  app.innerHTML = h;
  if (route.name === "conv" && !waiting) { renderMsgs(route.id, true); setupComposer(); markRead(); }
  if (route.name === "wrestler") fillWiki(route.q);
  if (route.name === "search" && !searchFocused) { searchFocused = true; const q = document.getElementById("q"); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
  const foot = document.getElementById("foot");
  foot.innerHTML = (S.demo ? '<div class="demo">' + (S.fbError ? "<b>Connexion à Firebase impossible</b> (vérifie js/config.js). " : "") +
    "Mode démo : les comptes, messages et notes sont enregistrés seulement dans ce navigateur. Pour que tout le monde puisse s’inscrire et discuter, suis le guide d’installation Firebase.</div>" : "") +
    "<footer>Calendrier, articles et résumés mis à jour automatiquement. Dates susceptibles de changer. <a href=\"#/credits\">Crédits photos</a></footer>";
  updateHeader();
}

// Barre de navigation du bas : Accueil · Recherche · Membres · Messages · Profil
const NAV = [["home", "#/", "Accueil", "home"], ["search", "#/recherche", "Recherche", "search"], ["members", "#/membres", "Membres", "globe"], ["chat", "#/chat", "Messages", "chat"], ["me", "#/profil", "Profil", "user"]];
function navOn(id) {
  const r = route.name;
  if (id === "home") return r === "home" || r === "promo" || r === "titles" || r === "title" || r === "matches" || r === "hl";
  if (id === "search") return r === "search" || r === "wrestler";
  if (id === "members") return r === "members" || (r === "profile" && S.user && route.uid && route.uid !== S.user.uid);
  if (id === "chat") return r === "chat" || r === "conv" || r === "newchat";
  if (id === "me") return (r === "profile" && (!S.user || !route.uid || route.uid === S.user.uid)) || r === "settings" || r === "editprofile" || r === "auth";
  return false;
}
const cnt = n => n > 99 ? "99+" : String(n);
function updateHeader() {
  const n = S.user ? roomUnread() + dmUnread() : 0, soc = socialBadge();
  const nav = document.getElementById("bnav");
  if (nav) nav.innerHTML = NAV.map(x => {
    const badge = x[0] === "chat" ? n : x[0] === "members" ? soc : 0;
    const href = x[0] === "me" && !S.user ? "#/connexion" : x[1];
    const ico = x[0] === "me" && S.user ? avatar(S.profile || {}, 26) : ICON[x[3]];
    return '<a class="bn' + (navOn(x[0]) ? " on" : "") + '" href="' + href + '"' + (navOn(x[0]) ? ' aria-current="page"' : "") + '><span class="bni">' + ico + (badge ? '<span class="badge">' + cnt(badge) + "</span>" : "") + "</span><small>" + x[2] + "</small></a>";
  }).join("");
  const fav = document.getElementById("favbtn");
  if (fav) fav.classList.toggle("on", route.name === "favs");
  document.title = (n + soc ? "(" + (n + soc) + ") " : "") + "Catch TV";
}

onChange(what => {
  updateHeader();
  if (route.name === "conv") {
    if (["room", "msgs", "profiles", "convs", "reads"].indexOf(what) >= 0) { renderMsgs(route.id); markRead(); }
    if (what === "profiles" || what === "auth") { const hd = document.querySelector(".convhead"); if (hd && S.user) { const tmp = document.createElement("div"); tmp.innerHTML = convView(route.id); hd.replaceWith(tmp.firstChild); } }
    return;
  }
  if (what === "route") return render();
  if (FORM_VIEWS[route.name] && dirty) return;
  if ((REL[route.name] || []).indexOf(what) >= 0) render();
});
document.addEventListener("input", e => { if (e.target.closest("#app form")) dirty = true; });

// ---------- lu / non lu ----------
const marking = {};
function markRead() {
  if (!S.user || route.name !== "conv" || document.hidden) return;
  if (route.id === "general") {
    const last = S.room[S.room.length - 1];
    if (last && last.at > (S.reads.general || 0) && !marking.general) { marking.general = 1; B.markRoomRead(S.user.uid).catch(() => {}).finally(() => { marking.general = 0; }); }
  } else {
    const c = S.convs.find(x => x.id === route.id);
    if (c && c.unread && c.unread[S.user.uid] > 0 && !marking[c.id]) { marking[c.id] = 1; B.markDMRead(c.id, S.user.uid).catch(() => {}).finally(() => { marking[c.id] = 0; }); }
  }
}
document.addEventListener("visibilitychange", markRead);

popup.tries = {};
function popup(m, convId) {
  if (route.name === "conv" && route.id === convId && !document.hidden) return;
  if (!S.profiles[m.uid] && (popup.tries[m.at] = (popup.tries[m.at] || 0) + 1) < 6) { setTimeout(() => popup(m, convId), 300); return; }
  const n = roomUnread() + dmUnread();
  toast("💬 " + (convId === "general" ? "Salon · " : "") + nameOf(m.uid) + " : " + m.text.slice(0, 90) + (n ? "\n" + n + " message" + (n > 1 ? "s" : "") + " à lire" : ""),
    { top: true, ms: 5000, onClick: () => { location.hash = "#/chat/" + encodeURIComponent(convId); } });
}

// ---------- compte connecté ----------
function onUser(u) {
  userSubs.forEach(f => f()); userSubs = [];
  S.user = u; S.authReady = true; S.profile = null; S.history = {}; S.room = []; S.convs = []; S.reads = {}; S.convMsgs = {};
  S.friends = []; S.feuds = []; S.blocks = []; S.reports = []; S.users = null; S.memberFriends = {}; resetSocial();
  S.isAdmin = !!u && (S.demo ? u.uid === B.demoAdmin() : (!!ADMIN_UID && u.uid === ADMIN_UID));
  if (u) {
    const me = u.uid;
    userSubs.push(B.watchUser(me, p => { S.profile = p; changed("profile"); }));
    userSubs.push(B.watchHistory(me, list => { const m = {}; list.forEach(x => { m[x.id] = x; }); S.history = m; changed("history"); }));
    let readsInit = false;
    userSubs.push(B.watchReads(me, r => { S.reads = r || {}; if (!readsInit && !S.reads.general) B.markRoomRead(me).catch(() => {}); readsInit = true; changed("reads"); }));
    let roomInit = false, roomMax = 0;
    userSubs.push(B.watchRoom(list => {
      S.room = list; list.forEach(m => need(m.uid));
      if (roomInit) list.filter(m => m.at > roomMax && m.uid !== me && S.blocks.indexOf(m.uid) < 0).slice(-1).forEach(m => popup(m, "general"));
      roomInit = true; list.forEach(m => { if (m.at > roomMax) roomMax = m.at; });
      changed("room");
    }));
    let convInit = false; const lastAt = {};
    userSubs.push(B.watchConvs(me, list => {
      S.convs = list;
      list.forEach(c => {
        c.members.forEach(need);
        if (convInit && c.last && c.last.uid !== me && c.last.at > (lastAt[c.id] || 0) && S.blocks.indexOf(c.last.uid) < 0) popup(c.last, c.id);
        if (c.last) lastAt[c.id] = Math.max(lastAt[c.id] || 0, c.last.at);
      });
      convInit = true; changed("convs");
    }));
    userSubs.push(B.watchBlocks(me, list => { S.blocks = list || []; changed("blocks"); }));
    userSubs.push(B.watchFriends(me, onFriends));
    userSubs.push(B.watchFeuds(me, onFeuds));
    if (S.isAdmin) userSubs.push(B.watchReports(list => { S.reports = list || []; list.forEach(r => { need(r.by); need(r.target); }); changed("reports"); }));
  }
  changed("auth");
  onRoute();
}

// ---------- évènements globaux ----------
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const f = ACT[el.dataset.act]; if (!f) return;
  e.preventDefault(); e.stopPropagation(); f(el, e);
});
document.addEventListener("submit", e => {
  const f = e.target.closest("form[data-form]");
  if (f && FORM[f.dataset.form]) { e.preventDefault(); FORM[f.dataset.form](f); }
});
ACT.favs = () => { if (S.user) location.hash = "#/favoris"; else { toast("Connecte-toi pour suivre tes catcheurs favoris"); location.hash = "#/connexion"; } };

// Toutes les minutes : direct qui commence ou se termine, sablier ⏳ des feuds à 18 h, nouveau jour (minuit à Paris)
let tickSig = "";
function tick() {
  const sig = liveNow().map(e => e.k + e.show + e.d).join(",") + "|" + (parisHour() >= 18) + "|" + parisDay();
  if (sig !== tickSig) { const first = !tickSig; tickSig = sig; if (!first) changed("tick"); }
}

// ---------- démarrage ----------
async function boot() {
  applyTheme();
  document.getElementById("favbtn").innerHTML = ICON.starF;
  const c = await loadContent(); S.P = c.P; S.news = c.news; S.recaps = c.recaps || {}; S.matches = c.matches || []; S.titles = c.titles || []; S.titlesUpdated = c.titlesUpdated || "";
  S.highlights = c.highlights || {}; S.wrestlers = c.wrestlers || {};
  tick(); setInterval(tick, 60000);
  let backend = null;
  if (firebaseConfig) {
    try { backend = await import("./backend/firebase.js"); await backend.init(firebaseConfig); }
    catch (e) { console.error(e); backend = null; S.fbError = true; }
  }
  if (!backend) { backend = demoBackend; S.demo = true; await backend.init(); }
  setBackend(backend);
  B.watchImages(m => { S.images = m || {}; changed("images"); });
  window.addEventListener("hashchange", onRoute);
  onRoute();
  B.onAuth(onUser);
}
boot();
