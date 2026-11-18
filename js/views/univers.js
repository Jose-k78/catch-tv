// Mode Univers (18 nov.) : routage des écrans #/univers/…
// #/univers = les 3 parties · #/univers/nouveau/<n> · #/univers/g (menu général) · courrier[/id] · actu · buzz · monde/<w|f|a>
// · c/<id>/<s|c|h|d> (fiche) · fede/<onglet> · creatif/<onglet> · activite/<onglet> · ev/<id> (carte du show, résultats).
// Réservé au modo pour l'instant (S.realAdmin) : les membres voient « Bientôt ». Les parties restent sur le téléphone.
import { S } from "../state.js";
import { lsGet } from "../util.js";
import { U, redraw } from "../univers/core.js";
import { loadSlot, metaAll } from "../univers/save.js";
import { partiesView, newView, homeView, courrierView, actuView, buzzView, mondeView, ficheView } from "../univers/ui.js";
import { fedeView, creatifView, activiteView, bookView } from "../univers/ui2.js";

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
      loadSlot(s).then(G => { U.loading = false; if (G) { U.G = G; U.slot = s; } redraw(); }).catch(() => { U.loading = false; redraw(); });
      return wait("Chargement de ta partie…");
    }
    return partiesView();
  }
  switch (a) {
    case "courrier": return courrierView(b);
    case "actu": return actuView();
    case "buzz": return buzzView();
    case "monde": return mondeView(b);
    case "c": return ficheView(b, c);
    case "fede": return fedeView(b);
    case "creatif": return creatifView(b);
    case "activite": return activiteView(b);
    case "ev": return bookView(b);
  }
  return homeView();
}
