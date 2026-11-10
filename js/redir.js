// Redirections du modo : en mode ✏️, un appui long (ou clic droit) sur un lien de l'app permet de l'envoyer vers une autre page
// ou un autre site. Enregistré dans data/links.json sous « redir:<lien d'origine> » = [{ u: destination }].
import { S, ACT } from "./state.js";
import { esc, modal, toast } from "./util.js";
import { saveLinks } from "./links.js";

const dest = h => { const x = ((S.links || {})["redir:" + h] || [])[0], u = x && String(x.u || ""); return u && /^(#\/|https:\/\/)/.test(u) ? u : ""; };
const hrefOf = el => { const a = el && el.closest && el.closest("a[href]"); const h = a && a.getAttribute("href"); return h && h.indexOf("#/") === 0 ? h : ""; };
// un clic sur un lien redirigé part vers la destination choisie
document.addEventListener("click", e => {
  if (e.defaultPrevented || e.button > 0) return; const h = hrefOf(e.target); if (!h) return; const to = dest(h); if (!to || to === h) return;
  e.preventDefault(); e.stopPropagation();
  if (to.indexOf("#/") === 0) location.hash = to; else window.open(to, "_blank", "noopener");
}, true);
export function redirEdit(from) {
  if (!S.isAdmin || !from) return; const cur = dest(from);
  const PAGES = [["#/", "Accueil"], ["#/player", "TCC Play"], ["#/tccg", "TCCCG"], ["#/membres", "Membres"], ["#/recherche", "Recherche"], ["#/matchs", "Matchs à découvrir"], ["#/tournois", "Tournois"], ["#/titres", "Titres"]];
  modal((box, close) => {
    box.innerHTML = "<h3>↪ Rediriger ce lien</h3><p class=\"sub\">Lien d’origine : <code>" + esc(from) + '</code></p><label>Destination (page de l’app « #/… » ou adresse https://…)<input id="rdto" value="' + esc(cur) + '" placeholder="#/player ou https://…" style="width:100%"></label>' +
      '<div class="chips" style="margin:8px 0">' + PAGES.map(p => '<button type="button" class="chip" data-p="' + p[0] + '">' + p[1] + "</button>").join("") + "</div>" +
      '<button class="btn wide" data-ok>Enregistrer</button>' + (cur ? '<button class="btn wide ghost" style="margin-top:6px" data-rm>Retirer la redirection</button>' : "") + '<button class="btn wide ghost" style="margin-top:6px" data-close>Annuler</button>';
    const save = async to => { close(); try { if (await saveLinks(items => { if (to) items["redir:" + from] = [{ u: to }]; else delete items["redir:" + from]; }, "Redirection du modérateur")) toast(to ? "Redirection enregistrée ✓" : "Redirection retirée"); } catch (er) { toast("Pas enregistré : " + ((er && er.message) || "")); } };
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return close();
      const p = e.target.closest("[data-p]"); if (p) { box.querySelector("#rdto").value = p.dataset.p; return; }
      if (e.target.closest("[data-rm]")) return save("");
      if (e.target.closest("[data-ok]")) { const to = box.querySelector("#rdto").value.trim(); if (!/^(#\/|https:\/\/)/.test(to)) return toast("La destination commence par #/ ou https://"); if (to === from) return toast("C’est déjà ce lien"); save(to); }
    });
  });
}
ACT.redir = el => redirEdit(el.dataset.h);
// appui long / clic droit du modo sur un lien sans menu de partage
let t = null, xy = null, fired = false;
const plain = e => (S.isAdmin && !(e.target.closest && e.target.closest("[data-sh],.modal")) ? hrefOf(e.target) : "");
document.addEventListener("pointerdown", e => { fired = false; const h = plain(e); if (!h || e.button > 0) return; xy = [e.clientX, e.clientY]; clearTimeout(t); t = setTimeout(() => { fired = true; redirEdit(h); }, 650); });
["pointerup", "pointercancel", "scroll"].forEach(n => document.addEventListener(n, () => clearTimeout(t), true));
document.addEventListener("pointermove", e => { if (xy && Math.hypot(e.clientX - xy[0], e.clientY - xy[1]) > 10) clearTimeout(t); }, { passive: true });
document.addEventListener("click", e => { if (fired) { e.preventDefault(); e.stopPropagation(); fired = false; } }, true);
document.addEventListener("contextmenu", e => { const h = plain(e); if (!h) return; e.preventDefault(); clearTimeout(t); redirEdit(h); });
