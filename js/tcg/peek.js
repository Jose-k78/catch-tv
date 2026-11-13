// TCCCG — appui long sur une carte, partout dans le jeu : la carte s'affiche en grand, en entier (demande de Jose, 13 nov.).
// On la ferme en touchant l'écran (ou avec le bouton retour du téléphone). Le toucher qui suit l'appui long n'ouvre rien d'autre.
import { backLayer } from "../util.js";
import { me } from "./store.js";
import { cardHTML } from "./card.js";
import { defOf } from "./data.js";

let T = 0, stopClick = 0;
function show(el) {
  const p = String(el.dataset.pk || "").split("|"), cid = p[0], iid = p[3] || "";
  if (!cid || !defOf(cid)) return;
  const d = me(), own = iid && d && d.cards && d.cards[iid];
  const inst = own ? Object.assign({ iid: iid }, own) : { c: cid, r: p[1] || undefined, lv: +p[2] || 1 };
  const ov = document.createElement("div"); ov.className = "tpeek"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Carte en grand");
  ov.innerHTML = '<div class="tpeekc">' + cardHTML(inst, { nozoom: true }) + '</div><p class="tpeekh">Touche l’écran pour fermer</p>';
  document.body.appendChild(ov);
  const c = ov.querySelector(".tc3"), k = Math.max(0.8, Math.min((innerWidth - 32) / 210, (innerHeight - 110) / 318, 1.9));
  if (c) { ov.querySelector(".tpeekc").style.width = Math.round(c.offsetWidth * k) + "px"; ov.querySelector(".tpeekc").style.height = Math.round(318 * k) + "px"; c.style.transform = "scale(" + k + ")"; }
  let done = false;
  const rel = backLayer(() => close(true));
  const close = fromBack => { if (done) return; done = true; if (!fromBack) rel(); ov.classList.add("out"); setTimeout(() => ov.remove(), 160); };
  ov.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); close(); });
}
if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", e => {
    clearTimeout(T);
    if (!document.body.classList.contains("tccg") || e.button > 0) return;
    const c = e.target.closest && e.target.closest(".tc3[data-pk]"); if (!c || c.closest(".tpeek, .tczoom, .tsfront, .tsback")) return;
    const x0 = e.clientX, y0 = e.clientY;
    T = setTimeout(() => { T = 0; stopClick = Date.now(); off(); try { navigator.vibrate && navigator.vibrate(20); } catch (er) {} show(c); }, 450);
    const mv = ev => { if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 12) { clearTimeout(T); off(); } };
    const up = () => { clearTimeout(T); off(); };
    const off = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up); };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
  });
  // le toucher qui termine l'appui long ne doit pas ouvrir la fiche, attaquer, etc.
  document.addEventListener("click", e => { if (stopClick && Date.now() - stopClick < 900 && !(e.target.closest && e.target.closest(".tpeek"))) { e.preventDefault(); e.stopPropagation(); stopClick = 0; } }, true);
  document.addEventListener("contextmenu", e => { if (e.target.closest && e.target.closest(".tc3[data-pk]") && document.body.classList.contains("tccg")) e.preventDefault(); });
}
