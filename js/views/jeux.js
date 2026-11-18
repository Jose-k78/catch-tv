// Jeux (18 nov., demande de Jose) : l'onglet « Jeux » de la barre du bas remplace « TCCCG ».
// On choisit à quoi jouer : TCCCG (jeu de cartes), Univers (GM d'une fédération, modo seulement pour l'instant), Coming soon.
import { S } from "../state.js";
import { metaAll } from "../univers/save.js";

export const GAMES_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 8h10a5 5 0 0 1 4.6 7l-.8 1.9a2.4 2.4 0 0 1-4 .6L15 15.5H9l-1.8 2a2.4 2.4 0 0 1-4-.6L2.4 15A5 5 0 0 1 7 8z"/><path d="M7.5 10.5v3M6 12h3"/><circle cx="15.5" cy="11" r=".6" fill="currentColor"/><circle cx="17.5" cy="13" r=".6" fill="currentColor"/></svg>';

export function jeuxView() {
  const uni = !!S.realAdmin, saves = uni ? metaAll().length : 0;
  const card = (cls, href, title, sub, art, extra) => (href ? '<a class="jx ' + cls + '" href="' + href + '">' : '<div class="jx ' + cls + '" aria-disabled="true">') +
    '<div class="jxart" aria-hidden="true">' + art + '</div><div class="jxtx"><h2>' + title + "</h2><p>" + sub + "</p>" + (extra || "") + "</div>" + (href ? "</a>" : "</div>");
  const fan = '<span class="jxc c1"></span><span class="jxc c2"></span><span class="jxc c3"><b>SSR</b></span>';
  const globe = '<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="44"></circle><ellipse cx="60" cy="60" rx="20" ry="44"></ellipse><path d="M16 60h88M24 38h72M24 82h72"></path><rect class="jxring" x="34" y="34" width="52" height="52" rx="3"></rect></svg>';
  return '<section class="jeux"><h1>Jeux</h1><p class="jxlead">Choisis ton jeu.</p><div class="jxgrid">' +
    card("tcg", "#/tccg", "TCCCG", "Le jeu de cartes de TCC TV : boosters, combats et échanges avec les membres.", fan, '<span class="jxgo">Jouer</span>') +
    (uni ? card("uni", "#/univers", "Univers", "Deviens GM : signe des catcheurs, écris les storylines, fais la meilleure audience de l’année.", globe, '<span class="jxgo">' + (saves ? "Continuer" : "Commencer") + "</span>")
      : card("uni off", "", "Univers", "Deviens GM de ta propre fédération.", globe, '<span class="jxsoon">Bientôt</span>')) +
    card("soon", "", "Coming soon", "Un nouveau jeu arrive.", '<span class="jxq">?</span>', "") +
    "</div></section>";
}
