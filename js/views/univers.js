// Mode Univers (18 nov., v2) : routage des écrans #/univers/…
// #/univers = les 3 parties · #/univers/nouveau/<n> · #/univers/g (menu général) · courrier[/id] · actu · buzz
// · monde/<w|f|a|hof|mag|enc> · fed/<id> (page d'une fédération) · c/<id>/<s|c|h|r|d> (fiche) · nego/<id> (négociation)
// · fede/<onglet> · creatif/<onglet> · activite/<onglet> · ev/<id> (carte du show, résultats) · live/<id> (Gorilla position)
// · bureau/<obj|rep|ach|sem|agenda|cfg|riv> · decide (décisions en cartes, 21 nov.).
// Réservé au modo pour l'instant (S.realAdmin) : les membres voient « Bientôt ». Les parties restent sur le téléphone.
import { S } from "../state.js";
import { lsGet } from "../util.js";
import { U, redraw } from "../univers/core.js";
import { metaAll } from "../univers/save.js";
import { partiesView, homeView, courrierView, actuView, buzzView, mondeView, ficheView, openSlot } from "../univers/ui.js";
import { fedeView, creatifView, activiteView } from "../univers/ui2.js";
import { negoView } from "../univers/ui3.js";
import { bookView } from "../univers/ui4.js";
import { liveView } from "../univers/tv.js";
import { fedView, bureauView } from "../univers/ui5.js";
import { decideView } from "../univers/ui6.js";
import { newView, setupView } from "../univers/setup.js";
import { draftView } from "../univers/ui7.js";
import { sceneView, telView } from "../univers/ui8.js";
import { reunionView, indieView, carteView } from "../univers/ui9.js";
import { kfy } from "../univers/dna.js";

export const univOn = () => !!S.realAdmin;
let tried = 0;
const wait = t => '<div class="uvparties"><p class="uvmut" role="status">' + t + "</p></div>";
export function universView(a, b, c) {
  if (!S.authReady && !S.user) return wait("Chargement…");
  if (!univOn()) return '<section class="jeux"><a class="uvback" href="#/jeux">‹ Jeux</a><h1>Univers</h1><p class="jxlead">Le mode GM arrive bientôt : dirige ta fédération, signe des catcheurs, écris les storylines.</p></section>';
  if (!a) return partiesView();
  if (a === "nouveau") return newView(Math.min(3, Math.max(1, +b || 1)));
  if (!U.G) {
    if (U.loading) return wait("Chargement de ta partie…");
    const s = +(lsGet("ctv.univ.slot") || 0);
    if (s && tried !== s && metaAll().some(m => m.slot === s)) {
      tried = s; U.loading = true;
      openSlot(s).then(G => { U.loading = false; if (G) { U.G = G; U.slot = s; } redraw(); }).catch(() => { U.loading = false; redraw(); });
      return wait("Chargement de ta partie…");
    }
    return partiesView();
  }
  if (U.G.setup) return setupView();
  const out = route(a, b, c);
  return U.G.mark ? kfy(out) : out;   // mode Mark : aucun mot des coulisses à l'écran
}
function route(a, b, c) {
  switch (a) {
    case "courrier": return courrierView(b);
    case "actu": return actuView();
    case "buzz": return buzzView();
    case "monde": return mondeView(b);
    case "fed": return fedView(b);
    case "c": return ficheView(b, c);
    case "nego": return negoView(b);
    case "fede": return fedeView(b);
    case "creatif": return creatifView(b);
    case "activite": return activiteView(b);
    case "ev": return bookView(b);
    case "live": return liveView(b);
    case "bureau": return bureauView(b);
    case "decide": return decideView();
    case "draft": return draftView();
    case "scene": return sceneView();
    case "tel": return telView(b);
    case "reunion": return reunionView();
    case "indie": return indieView();
    case "carte": return carteView();
  }
  return homeView();
}
