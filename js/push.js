// Notifications sur le téléphone, même app fermée : Firebase Cloud Messaging + service worker (sw.js, sans cache).
//  - instantanées (messages privés, feuds, annonces) : l'app prévient le service Cloudflare, qui vérifie et envoie ;
//  - toutes les 30 minutes (infos, favoris, rappel des feuds) : le robot GitHub.
// Chaque membre choisit ce qu'il reçoit (document push/{uid}). Sur iPhone, il faut d'abord ajouter l'app à l'écran d'accueil.
import { S, B, ACT, changed } from "./state.js";
import { esc, toast, lsGet, lsSet, modal } from "./util.js";
import { VAPID_KEY } from "./config.js";
import { PREVIEW } from "./content.js";

export const pushSupported = () => typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isMobile = () => isIOS() || /android/i.test(navigator.userAgent) || !!(window.matchMedia && matchMedia("(pointer:coarse)").matches);
export const standalone = () => !!(window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
export const keyOf = t => { let h = 5381; t = String(t); for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return "k" + (h >>> 0).toString(36); };
const devName = () => { const u = navigator.userAgent; return /iphone/i.test(u) ? "iPhone" : /ipad/i.test(u) ? "iPad" : /android/i.test(u) ? "Android" : /mac/i.test(u) ? "Mac" : /windows/i.test(u) ? "PC" : "Navigateur"; };

// réglages publics de l'installation : data/push.json { vapid (clé push web, publique), url (service Cloudflare) }
let cfg = null, cfgP = null;
export function loadPushCfg(force) {
  if (cfgP && !force) return cfgP;
  cfgP = (PREVIEW ? Promise.resolve({}) : fetch("data/push.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : {}).catch(() => ({})))
    .then(j => { cfg = j && typeof j === "object" ? j : {}; changed("push"); return cfg; });
  return cfgP;
}
export const pushCfg = () => cfg || {};
export const vapid = () => { const v = pushCfg().vapid || VAPID_KEY || ""; return /^[\w-]{60,120}$/.test(v) ? v : ""; };
export const pushReady = () => !!vapid() && !S.demo && !PREVIEW;
export async function pushUrl() { const c = await loadPushCfg(); return /^https:\/\/[^\s"<>]+$/.test(c.url || "") ? c.url.replace(/\/$/, "") : ""; }

// l'app prévient le service Cloudflare (message privé, feud, annonce, test) ; il vérifie tout dans Firebase avant d'envoyer
export async function pushPing(body) {
  try {
    if (PREVIEW || S.demo || !S.user || !B || !B.idToken) return null;
    const u = await pushUrl(); if (!u) return { error: "noservice" };
    const r = await fetch(u + "/notify", { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify(Object.assign({ idToken: await B.idToken() }, body)), keepalive: true });
    return await r.json().catch(() => null);
  } catch (e) { return null; }
}

// ---------- ce téléphone ----------
export const myToken = () => lsGet("ctv.ptok") || "";
export function pushOnHere() { const t = myToken(); return !!t && !!S.push && !!S.push.tok && !!S.push.tok[keyOf(t)] && typeof Notification !== "undefined" && Notification.permission === "granted"; }
async function swReg() { const reg = await navigator.serviceWorker.register("sw.js"); await navigator.serviceWorker.ready; return reg; }
const DEF_ON = { dm: true, info: true, fav: true, feud: true, ann: true, prev: true };
async function saveToken(tok) {
  const old = myToken(), patch = { tok: {}, at: Date.now() };
  patch.tok[keyOf(tok)] = { t: tok, at: Date.now(), ua: devName() };
  if (!S.push || !S.push.on) patch.on = DEF_ON;
  if (!S.push || S.push.quiet == null) patch.quiet = true;
  await B.savePush(S.user.uid, patch);
  if (old && old !== tok) B.removePushKey(S.user.uid, keyOf(old)).catch(() => {});
  lsSet("ctv.ptok", tok);
}
export async function enablePush() {
  if (!S.user) { location.hash = "#/connexion"; return; }
  if (!pushReady()) { toast("Les notifications ne sont pas encore installées (réglage du modérateur)", { ms: 4500 }); return; }
  if (isIOS() && !standalone()) { installHelp(); return; }
  if (!pushSupported()) { toast("Ce navigateur ne permet pas les notifications", { ms: 4000 }); return; }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { toast("Notifications refusées. Tu peux les réactiver dans les réglages du téléphone.", { ms: 5000 }); changed("push"); return; }
    const tok = await B.pushToken(vapid(), await swReg());
    if (!tok) throw new Error("jeton");
    await saveToken(tok);
    toast("🔔 Notifications activées sur ce téléphone");
  } catch (e) { console.error(e); toast("Activation impossible (" + ((e && (e.code || e.message)) || "erreur") + ")", { ms: 6000 }); }
}
export async function disablePush() {
  if (!S.user) return;
  const t = myToken();
  try { if (t) await B.removePushKey(S.user.uid, keyOf(t)); } catch (e) {}
  try { await B.dropPushToken(); } catch (e) {}
  lsSet("ctv.ptok", null); toast("Notifications désactivées sur ce téléphone"); changed("push");
}
// au démarrage (notifications déjà permises) : le jeton est rafraîchi s'il a changé
let synced = false;
export async function syncPush() {
  if (synced || !pushReady() || !pushSupported() || !S.user || !S.push || Notification.permission !== "granted" || !myToken()) return;
  synced = true;
  try { const tok = await B.pushToken(vapid(), await swReg()); if (tok && (tok !== myToken() || !(S.push.tok && S.push.tok[keyOf(tok)]))) await saveToken(tok); } catch (e) {}
}
export function resetPushSync() { synced = false; }
// appui sur une notification alors que l'app est ouverte : le service worker indique la page à ouvrir
if (typeof navigator !== "undefined" && navigator.serviceWorker) navigator.serviceWorker.addEventListener("message", e => { if (e.data && typeof e.data.go === "string" && e.data.go.indexOf("#/") === 0) location.hash = e.data.go; });

// ---------- installer l'app (écran d'accueil) ----------
let deferred = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; });
  window.addEventListener("appinstalled", () => { deferred = null; lsSet("ctv.instx", String(Date.now() + 365 * 864e5)); });
}
export function installHelp() {
  modal((box, close) => {
    box.innerHTML = "<h3>📲 Installer TCC TV</h3>" + (isIOS()
      ? '<ol class="steps"><li>Ouvre ce site dans <b>Safari</b></li><li>Appuie sur le bouton <b>Partager</b> (le carré avec la flèche ⬆️)</li><li>Choisis <b>« Sur l’écran d’accueil »</b>, puis <b>Ajouter</b></li><li>Ouvre TCC TV depuis la nouvelle icône, puis active les notifications dans Paramètres › Notifications</li></ol><p class="note small">Sur iPhone, les notifications ne marchent qu’avec l’app installée (iOS 16.4 ou plus récent).</p>'
      : '<ol class="steps"><li>Ouvre le menu du navigateur <b>⋮</b> (en haut à droite dans Chrome)</li><li>Choisis <b>« Installer l’application »</b> ou <b>« Ajouter à l’écran d’accueil »</b></li><li>Ouvre TCC TV depuis la nouvelle icône</li></ol>') +
      '<button class="btn wide" data-no>J’ai compris</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-no]")) close(); });
  });
}
// bandeau de l'accueil : « Installe l'app » sur un téléphone, puis « Active les notifications » une fois installée
export function installBar() {
  if (PREVIEW) return "";
  const later = k => (+lsGet(k) || 0) > Date.now();
  if (isMobile() && !standalone() && !later("ctv.instx"))
    return '<div class="instbar"><span class="ibico">📲</span><span class="ibtxt"><b>Installe TCC TV sur ton écran d’accueil</b><small>Plein écran, une icône comme une vraie appli' + (isIOS() ? ", et les notifications sur iPhone" : "") + "</small></span>" +
      '<button class="btn small" data-act="install">Installer</button><button class="ibx" data-act="instx" aria-label="Plus tard">×</button></div>';
  if (pushReady() && S.user && pushSupported() && !pushOnHere() && Notification.permission === "default" && !(isIOS() && !standalone()) && !later("ctv.notx"))
    return '<div class="instbar"><span class="ibico">🔔</span><span class="ibtxt"><b>Active les notifications</b><small>Messages privés, infos, matchs de tes favoris, feuds…</small></span>' +
      '<button class="btn small" data-act="penable">Activer</button><button class="ibx" data-act="notx" aria-label="Plus tard">×</button></div>';
  return "";
}
ACT.install = async () => { if (deferred) { const d = deferred; deferred = null; d.prompt(); try { await d.userChoice; } catch (e) {} changed("route"); return; } installHelp(); };
ACT.instx = () => { lsSet("ctv.instx", String(Date.now() + 14 * 864e5)); changed("route"); };
ACT.notx = () => { lsSet("ctv.notx", String(Date.now() + 14 * 864e5)); changed("route"); };

// ---------- Paramètres › Notifications ----------
const TYPES = [["dm", "💬 Messages privés", "Tout de suite, quand on t’écrit"], ["info", "📰 Infos et alertes", "Nouveaux articles, défenses de titre (sous spoiler), PLE du jour, pronostics, sondages, storyline"],
  ["fav", "⭐ Matchs de mes favoris", "Quand ils sont annoncés sur une carte, puis le jour du match"], ["feud", "🔥 Feuds", "Quand on te lance une feud, et le rappel de 21 h avant qu’elle s’éteigne"], ["ann", "📣 Annonces du modérateur", "Les nouvelles importantes de l’app"]];
const tgl = on => '<span class="tgl' + (on ? " on" : "") + '" aria-hidden="true"></span>';
export function notifSettingsView() {
  const P = S.push || {}, on = Object.assign({}, DEF_ON, P.on || {}), here = pushOnHere();
  let h = '<h1>Notifications</h1><p class="note" style="margin-bottom:12px">Sur ton téléphone, même quand l’app est fermée.</p>';
  const box = (ico, title, txt, btns) => '<div class="lockbox pushbox"><span class="lockico">' + ico + "</span><b>" + title + "</b><p>" + txt + "</p>" + (btns ? '<div class="btns">' + btns + "</div>" : "") + "</div>";
  if (!pushReady()) h += box("⏳", "Bientôt disponibles", "Le modérateur termine l’installation des notifications. Tu peux déjà choisir ce que tu veux recevoir ci-dessous.");
  else if (isIOS() && !standalone()) h += box("📲", "Installe d’abord l’app", "Sur iPhone, les notifications marchent seulement avec TCC TV ajoutée à l’écran d’accueil (iOS 16.4 ou plus récent).", '<button class="btn" data-act="install">Comment faire ?</button>');
  else if (!pushSupported()) h += box("🚫", "Pas disponibles sur ce navigateur", "Essaie avec Chrome sur Android, ou avec l’app installée sur iPhone.");
  else if (Notification.permission === "denied") h += box("🔕", "Notifications bloquées", "Tu les as refusées pour ce site. Réactive-les dans les réglages du téléphone (ou du navigateur) pour TCC TV, puis reviens ici.");
  else if (here) h += box("✅", "Activées sur ce téléphone", "Tu peux choisir ci-dessous ce que tu reçois.", '<button class="btn ghost" data-act="ptest">Envoyer une notification de test</button><button class="btn ghost" data-act="pdisable">Désactiver ici</button>');
  else h += box("🔔", "Pas encore activées sur ce téléphone", "Un appui, puis accepte la demande du téléphone.", '<button class="btn" data-act="penable">Activer les notifications</button>');
  h += '<h2>Ce que je reçois</h2><div class="list">' + TYPES.map(t => '<button class="item" data-act="ptype" data-k="' + t[0] + '"><span class="lbl"><b>' + t[1] + "</b><small>" + t[2] + "</small></span>" + tgl(on[t[0]] !== false) + "</button>").join("") + "</div>";
  const pr = Array.isArray(P.promos) ? P.promos : [];
  h += '<h2>Promotions pour les infos</h2><div class="chips wrap" style="margin:0 16px">' + Object.keys(S.P).map(k => '<button class="chip' + (pr.indexOf(k) >= 0 ? " on" : "") + '" data-act="ppromo" data-k="' + esc(k) + '">' + (pr.indexOf(k) >= 0 ? "✓ " : "") + esc(k) + "</button>").join("") + "</div>" +
    '<p class="note small" style="margin-top:6px">' + (pr.length ? "Seulement : " + esc(pr.join(", ")) + "." : "Aucune choisie : les infos de toutes les promotions.") + "</p>";
  h += '<h2>Confort</h2><div class="list">' +
    '<button class="item" data-act="pquiet"><span class="lbl"><b>🌙 Heures calmes (23 h – 8 h)</b><small>Les infos et les favoris attendent 8 h. Les messages, les feuds et les annonces passent quand même.</small></span>' + tgl(P.quiet !== false) + "</button>" +
    '<button class="item" data-act="ptype" data-k="prev"><span class="lbl"><b>👁 Aperçu des messages privés</b><small>Le début du message s’affiche dans la notification</small></span>' + tgl(on.prev !== false) + "</button></div>";
  const devs = Object.keys(P.tok || {}).map(k => (P.tok[k] || {}).ua || "Téléphone");
  if (devs.length) h += '<p class="note small" style="margin-top:10px">Appareils inscrits : ' + esc(devs.join(" · ")) + "</p>";
  return h;
}
async function savePref(patch, msg) {
  if (!S.user) return;
  try { await B.savePush(S.user.uid, patch); if (msg) toast(msg); }
  catch (e) { toast(e && e.code === "permission-denied" ? "Refusé par Firebase : le modérateur doit publier les règles v8" : "Enregistrement impossible"); }
}
ACT.penable = () => enablePush();
ACT.pdisable = () => disablePush();
ACT.ptype = el => { const k = el.dataset.k, cur = Object.assign({}, DEF_ON, (S.push && S.push.on) || {}), o = {}; o[k] = cur[k] === false; savePref({ on: o }); };
ACT.pquiet = () => savePref({ quiet: !(S.push && S.push.quiet === false) ? false : true });
ACT.ppromo = el => { const k = el.dataset.k, cur = (S.push && Array.isArray(S.push.promos)) ? S.push.promos.slice() : [], i = cur.indexOf(k); if (i >= 0) cur.splice(i, 1); else cur.push(k); savePref({ promos: cur.slice(0, 20) }); };
ACT.ptest = async () => {
  toast("Envoi…");
  const r = await pushPing({ type: "test" });
  if (r && r.sent) toast("Notification envoyée ✓ Elle arrive dans quelques secondes");
  else if (r && r.error === "noservice") toast("Le service des notifications n’est pas encore installé (étape 3 du guide)", { ms: 5000 });
  else toast("Pas envoyée" + (r && r.error ? " (" + r.error + ")" : "") + ". Vérifie l’installation.", { ms: 5000 });
};
