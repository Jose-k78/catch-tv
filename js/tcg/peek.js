// TCCCG — appui long sur une carte, partout dans le jeu : la carte s'affiche en grand, en entier (demande de Jose, 13 nov.).
// On la ferme en touchant l'écran (ou avec le bouton retour du téléphone). Le toucher qui suit l'appui long n'ouvre rien d'autre.
import { backLayer } from "../util.js";
import { me } from "./store.js";
import { cardHTML, backHTML } from "./card.js";
import { defOf } from "./data.js";

let T = 0, stopClick = 0;
// vue 3D (16 nov., demande de Jose) : on fait tourner la carte au doigt et on voit tout, même la tranche et le dos ;
// toucher la carte = la retourner ; toucher à côté (ou le bouton retour) = fermer
function show(el) {
  const p = String(el.dataset.pk || "").split("|"), cid = p[0], iid = p[3] || "";
  if (!cid || !defOf(cid)) return;
  const d = me(), own = iid && d && d.cards && d.cards[iid];
  const inst = own ? Object.assign({ iid: iid }, own) : { c: cid, r: p[1] || undefined, lv: +p[2] || 1 };
  const k = Math.max(0.8, Math.min((innerWidth - 40) / 210, (innerHeight - 170) / 318, 1.9)), W = Math.round(210 * k), H = Math.round(318 * k);
  const ov = document.createElement("div"); ov.className = "tpeek"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Carte en grand");
  ov.innerHTML = '<div class="tv3d"><div class="tv3d-in" style="width:' + W + "px;height:" + H + 'px"><span class="tv3e l"></span><span class="tv3e r"></span><span class="tv3e t"></span><span class="tv3e b"></span>' +
    '<div class="tv3f">' + cardHTML(inst, { nozoom: true }) + '<span class="tv3gl"></span></div><div class="tv3b">' + backHTML(false) + "</div></div></div>" +
    '<div class="tv3ctl"><button type="button" data-v="spin">↻ Faire un tour</button><button type="button" data-v="back">Voir le dos</button><button type="button" data-v="face">De face</button><button type="button" data-v="close">✕ Fermer</button></div>' +
    '<p class="tpeekh">Glisse la carte pour la faire tourner · touche à côté pour fermer</p>';
  document.body.appendChild(ov);
  ov.querySelectorAll(".tv3f .tc3, .tv3b .tc3").forEach(c => { c.style.transform = "scale(" + k + ")"; });
  const box = ov.querySelector(".tv3d-in"), gl = ov.querySelector(".tv3gl"), fr = ov.querySelector(".tv3f .tc3");
  let rx = -6, ry = -24;
  const draw = slow => {
    box.classList.toggle("slow", !!slow);
    box.style.transform = "rotateX(" + rx.toFixed(1) + "deg) rotateY(" + ry.toFixed(1) + "deg)";
    const a = ((ry % 360) + 360) % 360 * Math.PI / 180, sx = Math.sin(a);
    gl.style.setProperty("--gx", Math.round(50 + sx * 70) + "%"); gl.style.opacity = Math.min(1, Math.abs(sx) * 1.6 + Math.abs(rx) / 60).toFixed(2);
    if (fr) { fr.style.setProperty("--hx", Math.round(50 + sx * 50) + "%"); fr.style.setProperty("--hy", Math.round(50 - rx) + "%"); }
  };
  draw(); requestAnimationFrame(() => requestAnimationFrame(() => { rx = 0; ry = 0; draw(true); }));
  let done = false, pt = null;
  const rel = backLayer(() => close(true));
  const close = fromBack => { if (done) return; done = true; stopClick = 0; if (!fromBack) rel(); document.removeEventListener("keydown", key); ov.classList.add("out"); setTimeout(() => ov.remove(), 160); };
  const key = e => { if (e.key === "Escape") close(); if (e.key === "ArrowLeft") { ry -= 30; draw(true); } if (e.key === "ArrowRight") { ry += 30; draw(true); } };
  document.addEventListener("keydown", key);
  ov.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); const b = e.target.closest("button[data-v]"); if (!b) return; const v = b.dataset.v;
    if (v === "close") return close(); if (v === "spin") ry += 360; if (v === "back") ry += 180; if (v === "face") { rx = 0; ry = Math.round(ry / 360) * 360; } draw(true); });
  ov.addEventListener("pointerdown", e => {
    if (e.target.closest(".tv3ctl")) return;
    pt = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: Date.now(), on: !!e.target.closest(".tv3d-in"), id: e.pointerId };
    try { ov.setPointerCapture(e.pointerId); } catch (er) {}
    draw(false);
  });
  ov.addEventListener("pointermove", e => {
    if (!pt || e.pointerId !== pt.id) return; const dx = e.clientX - pt.x, dy = e.clientY - pt.y; pt.x = e.clientX; pt.y = e.clientY;
    if (Math.abs(e.clientX - pt.x0) + Math.abs(e.clientY - pt.y0) < 6) return;
    ry += dx * 0.6; rx = Math.max(-55, Math.min(55, rx - dy * 0.4)); draw(false);
  });
  const up = e => {
    if (!pt || e.pointerId !== pt.id) return; const moved = Math.abs(e.clientX - pt.x0) + Math.abs(e.clientY - pt.y0), on = pt.on; pt = null;
    if (moved >= 6 || e.type === "pointercancel") return;
    if (on) { ry += 180; draw(true); } else close();
  };
  ov.addEventListener("pointerup", up); ov.addEventListener("pointercancel", up);
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
