// TCCCG : la partie « cartes à collectionner » (TCG) de TCC TV, ouverte à tous les membres connectés (réglages : modo).
// Interface noir et doré (classe body.tccg). Barre du bas (cahier du 12 nov.) : Shop · Event · Match · Accueil · Call Up ·
// Roster · Échange, cachée pendant l'invocation et le combat. En haut : ressources, niveau, logo TCC TV (retour), ⚙️ Paramètres.
import { S, ACT, avatar, changed } from "../state.js";
import { esc, toast } from "../util.js";
import { callUpView } from "../tcg/callup.js";
import { rosterView } from "../tcg/roster.js";
import { eventView, matchView, prepView, combatView } from "../tcg/fight.js";
import { tccgHome, shopView, guideView } from "../tcg/home.js";
import { me, XP_LV } from "../tcg/store.js";
import { muted } from "../tcg/sfx.js";
import "../tcg/train.js";
import { modoView } from "../tcg/modo.js";
import { echangeView } from "../tcg/trade.js";
import { backupView } from "../tcg/backup.js";

const sv = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + "</svg>";
export const TICON = {
  cards: sv('<rect x="3" y="5" width="11" height="15" rx="2"/><path d="M8 3.5 18.5 5.4a2 2 0 0 1 1.6 2.3l-2 11.1"/>'),
  home: sv('<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>'),
  callup: sv('<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>'),
  roster: sv('<rect x="3" y="4" width="7" height="9" rx="1.5"/><rect x="14" y="4" width="7" height="9" rx="1.5"/><rect x="8.5" y="12" width="7" height="9" rx="1.5"/>'),
  swap: sv('<path d="M7 7h12l-3-3"/><path d="M17 17H5l3 3"/>'),
  shop: sv('<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  event: sv('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m10 14 1.5 1.5L15 12"/>'),
  match: sv('<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6M16 16l4 4M19 21l2-2"/><path d="M9.5 6.5 14 2h3v3l-4.5 4.5"/><path d="m5 14-2 2 3 3 2-2"/>'),
  gear: sv('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>')
};
// logo TCCCG : éventail de cartes dorées + nom
export const LOGO = '<svg class="tfan" viewBox="0 0 40 34" aria-hidden="true"><defs><linearGradient id="tg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7e08a"/><stop offset=".6" stop-color="#c9971f"/><stop offset="1" stop-color="#8a6412"/></linearGradient></defs>' +
  '<rect x="4" y="6" width="16" height="23" rx="3" transform="rotate(-16 12 18)" fill="#16130d" stroke="url(#tg1)" stroke-width="2"/>' +
  '<rect x="13" y="4" width="16" height="23" rx="3" transform="rotate(10 21 16)" fill="#16130d" stroke="url(#tg1)" stroke-width="2"/>' +
  '<path d="M21 10.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="url(#tg1)" transform="rotate(10 21 16)"/></svg>' +
  '<span class="tword">TCCCG</span>';
export const TNAV = [["shop", "Shop", "shop"], ["event", "Event", "event"], ["match", "Match", "match"], ["", "Accueil", "home"], ["callup", "Call Up", "callup"], ["roster", "Roster", "roster"], ["echange", "Échange", "swap"]];
// onglet de la barre du bas allumé pour chaque page du TCCCG
export const navTab = tab => tab === "combat-prep" || tab === "combat" || tab === "combats" ? "event" : tab === "guide" || tab === "parametres" || tab === "sauvegardes" || tab === "modo" ? "" : tab;
const PAGES = {
  "": ["Bienvenue dans TCCCG", "Le jeu de cartes de TCC TV : collectionne les cartes de tes catcheurs préférés, monte ton roster et échange avec les autres membres."],
  callup: ["Call Up", "Ouvre tes paquets et fais monter de nouveaux catcheurs dans ta collection."],
  roster: ["Roster", "Toutes tes cartes, rangées par promotion, rareté et catcheur."],
  echange: ["Échange", "Échange tes cartes en double avec les autres membres."],
  shop: ["Shop", "Les paquets et les cartes spéciales."]
};
export function tccgView(tab, sub, id) {
  if (!S.user) return '<section class="tccgsoon"><div class="tcards">' + TICON.cards + '</div><h1>TCCCG</h1><p>Le jeu de cartes de TCC TV : connecte-toi pour jouer, collectionner et échanger avec les autres membres.</p><a class="btn" href="#/connexion">Se connecter</a> <a class="btn ghost" href="#/">Retour à TCC TV</a></section>';
  const W = x => '<section class="tccgwrap">' + x + "</section>";
  if (tab === "sauvegardes") return W(backupView());
  if (tab === "parametres") return W(settingsView());
  // tant que la vraie partie n'est pas arrivée, on n'affiche pas une partie vide (elle pouvait être enregistrée par-dessus)
  if (!S.tcgReady) return W('<div class="tload"><div class="tspin"></div><p>Chargement de ta partie…</p><small>Si ça dure, vérifie ta connexion. Ta partie n’est jamais remplacée par une partie vide.</small><a class="linkbtn" href="#/tccg/sauvegardes">🛟 Sauvegardes</a></div>');
  if (tab === "") return W(tccgHome());
  if (tab === "callup") return W(callUpView());
  if (tab === "roster") return W(rosterView(sub, id));
  if (tab === "shop") return W(shopView());
  if (tab === "guide") return W(guideView());
  if (tab === "event" || tab === "combats") return W(eventView(sub));
  if (tab === "match") return W(matchView(sub));
  if (tab === "combat-prep") return W(prepView());
  if (tab === "combat") return W(combatView());
  if (tab === "modo") return W(modoView());
  if (tab === "echange") return W(echangeView(sub, decodeURIComponent(id || "")));
  const p = PAGES[tab] || PAGES[""];
  return '<section class="tccgpage"><span class="tbadge">🚧 EN CHANTIER</span><div class="tcards">' + TICON[(TNAV.find(x => x[0] === tab) || TNAV[0])[2]] + "</div><h1>" + esc(p[0]) + "</h1><p>" + esc(p[1]) + "</p>" +
    '<div class="tslots">' + [1, 2, 3].map(() => '<div class="tslot"><span>?</span></div>').join("") + "</div>" +
    '<p class="tnote">Cette page est un prototype : la partie TCG est en construction et seul le modérateur la voit pour l’instant.</p></section>';
}
// haut de l'écran en mode TCCCG : logo TCCCG, retour à TCC TV, ⚙️, profil ; dessous : niveau, XP et ressources
const nf = n => { n = +n || 0; return n >= 1e6 ? (Math.round(n / 1e5) / 10 + "M").replace(".", ",") : n >= 1e4 ? (Math.round(n / 100) / 10 + "k").replace(".", ",") : String(n); };
export function tccgTop() {
  let res = "";
  if (S.user && S.tcgReady) { const d = me(), xp = d.lvl < 50 ? Math.round(d.xp / XP_LV(d.lvl) * 100) : 100;
    res = '<div class="ttopres"><span class="tlv" title="Niveau ' + d.lvl + " · " + d.xp + " XP\"><b>Nv " + d.lvl + '</b><i class="txpbar"><i style="width:' + xp + '%"></i></i></span>' +
      '<span title="Argent">💵 ' + nf(d.res.money) + '</span><span title="Momentum">⚡ ' + nf(d.res.mom) + '</span><span title="Pop">⭐ ' + nf(d.res.pop) + '</span><span title="Push">📣 ' + nf(d.res.push) + '</span><span title="Gimmicks">🎟️ ' + nf(d.res.gim) + "</span></div>"; }
  return '<a class="logo tlogo" href="#/tccg" aria-label="TCCCG, accueil">' + LOGO + "</a>" +
    '<div class="hbtns"><a class="tvback" href="#/" aria-label="Revenir à TCC TV"><span class="l1">TCC</span><span class="l2">TV</span></a>' +
    '<a class="tgear" href="#/tccg/parametres" aria-label="Paramètres du TCCCG">' + TICON.gear + "</a>" +
    (S.user ? '<a class="tprof" href="#/profil" aria-label="Mon profil">' + avatar(S.profile || {}, 30) + "</a>" : "") + "</div>" + res;
}
// ---------- Paramètres du TCCCG ----------
const lsG = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsS = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
function settingsView() {
  const fxOff = lsG("ctv.tgfx") === "simple";
  return '<section class="tccghead"><h1>Paramètres</h1></section><div class="list tset">' +
    '<div class="item"><span class="lbl"><b>🔊 Sons du jeu</b><small>Cloche, coups, public, invocation</small></span><button class="btn small' + (muted() ? " ghost" : "") + '" data-act="tgset" data-k="snd">' + (muted() ? "Coupés" : "Activés") + "</button></div>" +
    '<div class="item"><span class="lbl"><b>🎬 Animations</b><small>Complètes (Phaser) ou simples (téléphone lent)</small></span><button class="btn small' + (fxOff ? " ghost" : "") + '" data-act="tgset" data-k="fx">' + (fxOff ? "Simples" : "Complètes") + "</button></div>" +
    '<a class="item" href="#/tccg/guide"><span class="lbl"><b>📖 Guide du jeu</b><small>Toutes les règles</small></span><span>›</span></a>' +
    '<a class="item" href="#/tccg/sauvegardes"><span class="lbl"><b>🛟 Sauvegardes</b><small>Copies de ta partie, restaurer</small></span><span>›</span></a>' +
    '<a class="item" href="#/profil"><span class="lbl"><b>👤 Mon profil</b></span><span>›</span></a>' +
    '<a class="item" href="#/parametres"><span class="lbl"><b>⚙️ Paramètres de TCC TV</b><small>Compte, notifications…</small></span><span>›</span></a>' +
    (S.realAdmin ? '<a class="item" href="#/tccg/modo"><span class="lbl"><b>🛠️ Modo du TCCCG</b><small>Cartes, boosters, taux, objets</small></span><span>›</span></a>' : "") +
    '<a class="item" href="#/"><span class="lbl"><b>📺 Revenir à TCC TV</b><small>Aussi : appui long sur « Accueil » en bas</small></span><span>›</span></a></div>';
}
ACT.tgset = el => {
  if (el.dataset.k === "snd") { lsS("ctv.tgsnd", muted() ? null : "off"); toast(muted() ? "🔇 Sons coupés" : "🔊 Sons activés"); }
  if (el.dataset.k === "fx") { const off = lsG("ctv.tgfx") === "simple"; lsS("ctv.tgfx", off ? null : "simple"); toast(off ? "🎬 Animations complètes" : "Animations simples"); }
  changed("tcg");
};
// appui long sur « Accueil » dans la barre du bas : retour à TCC TV
if (typeof document !== "undefined") {
  let t = 0, fired = false;
  document.addEventListener("pointerdown", e => { const a = e.target.closest && e.target.closest('body.tccg #bnav a[href="#/tccg"]'); if (!a) return; fired = false; clearTimeout(t); t = setTimeout(() => { fired = true; try { navigator.vibrate && navigator.vibrate(20); } catch (er) {} location.hash = "#/"; }, 600); });
  ["pointerup", "pointercancel", "pointerleave"].forEach(ev => document.addEventListener(ev, () => clearTimeout(t)));
  document.addEventListener("click", e => { if (fired && e.target.closest && e.target.closest("#bnav")) { e.preventDefault(); fired = false; } }, true);
  document.addEventListener("contextmenu", e => { if (e.target.closest && e.target.closest('body.tccg #bnav a[href="#/tccg"]')) e.preventDefault(); });
}
