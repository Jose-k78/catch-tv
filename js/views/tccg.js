// TCCG : la future partie « cartes à collectionner » (TCG) de TCC TV. Prototype en chantier, réservé au modérateur pour l'instant.
// Interface noir et doré (classe body.tccg), logo TCCG, barre du bas : Accueil, Call Up, Roster, Échange, Shop.
// En haut : le profil (comme TCC TV) et le logo TCC TV pour revenir à l'app de base.
import { S, avatar } from "../state.js";
import { esc } from "../util.js";

const sv = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + "</svg>";
export const TICON = {
  cards: sv('<rect x="3" y="5" width="11" height="15" rx="2"/><path d="M8 3.5 18.5 5.4a2 2 0 0 1 1.6 2.3l-2 11.1"/>'),
  home: sv('<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>'),
  callup: sv('<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>'),
  roster: sv('<rect x="3" y="4" width="7" height="9" rx="1.5"/><rect x="14" y="4" width="7" height="9" rx="1.5"/><rect x="8.5" y="12" width="7" height="9" rx="1.5"/>'),
  swap: sv('<path d="M7 7h12l-3-3"/><path d="M17 17H5l3 3"/>'),
  shop: sv('<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>')
};
export const TNAV = [["", "Accueil", "home"], ["callup", "Call Up", "callup"], ["roster", "Roster", "roster"], ["echange", "Échange", "swap"], ["shop", "Shop", "shop"]];
const PAGES = {
  "": ["Bienvenue dans TCCG", "Le jeu de cartes de TCC TV : collectionne les cartes de tes catcheurs préférés, monte ton roster et échange avec les autres membres."],
  callup: ["Call Up", "Ouvre tes paquets et fais monter de nouveaux catcheurs dans ta collection."],
  roster: ["Roster", "Toutes tes cartes, rangées par promotion, rareté et catcheur."],
  echange: ["Échange", "Échange tes cartes en double avec les autres membres."],
  shop: ["Shop", "Les paquets et les cartes spéciales."]
};
export function tccgView(tab) {
  if (!S.isAdmin) return '<section class="tccgsoon"><div class="tcards">' + TICON.cards + '</div><h1>TCCG</h1><p>Le jeu de cartes de TCC TV arrive bientôt. Reste connecté !</p><a class="btn" href="#/">Retour à TCC TV</a></section>';
  const p = PAGES[tab] || PAGES[""];
  return '<section class="tccgpage"><span class="tbadge">🚧 EN CHANTIER</span><div class="tcards">' + TICON[(TNAV.find(x => x[0] === tab) || TNAV[0])[2]] + "</div><h1>" + esc(p[0]) + "</h1><p>" + esc(p[1]) + "</p>" +
    '<div class="tslots">' + [1, 2, 3].map(() => '<div class="tslot"><span>?</span></div>').join("") + "</div>" +
    '<p class="tnote">Cette page est un prototype : la partie TCG est en construction et seul le modérateur la voit pour l’instant.</p></section>';
}
// haut de l'écran en mode TCCG : logo TCCG, retour à TCC TV, profil
export function tccgTop() {
  return '<a class="logo tlogo" href="#/tccg" aria-label="TCCG, accueil"><span class="l1">TCC</span><span class="l2">G</span></a>' +
    '<div class="hbtns"><a class="tvback" href="#/" aria-label="Revenir à TCC TV"><span class="l1">TCC</span><span class="l2">TV</span></a>' +
    (S.user ? '<a class="tprof" href="#/profil" aria-label="Mon profil">' + avatar(S.profile || {}, 30) + "</a>" : "") + "</div>";
}
