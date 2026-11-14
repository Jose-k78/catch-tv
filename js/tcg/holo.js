// TCCCG — cartes holo (choix de Jose du 14 nov. : cadres en métal + holo qui bouge). Sur une grande carte, le doigt (ou la souris)
// fait pencher la carte et l'holo de l'image suit le doigt ; sans toucher, l'holo bouge tout seul (CSS). Les petites cartes ne penchent pas.
// « Animations simples » (ctv.tgfx) ou « moins d'animations » du téléphone : rien ne bouge (classe html.tgsimple, voir style.css).
const simple = () => { try { return localStorage.getItem("ctv.tgfx") === "simple" || matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
export function syncSimple() { if (typeof document !== "undefined") document.documentElement.classList.toggle("tgsimple", simple()); }

let cur = null;
function reset() {
  if (!cur) return;
  const c = cur, t = c._tt || c; cur = null;
  c.classList.remove("tilt"); c.style.removeProperty("--hx"); c.style.removeProperty("--hy");
  t.style.transform = t._t0 || ""; t._t0 = undefined; c._tt = undefined;
}
function move(e) {
  const c = e.target && e.target.closest && e.target.closest(".tc3:not(.sm):not(.back)");
  if (!c) { if (cur) reset(); return; }
  if (simple()) return;
  if (cur && cur !== c) reset();
  const r = c.getBoundingClientRect(); if (!r.width || !r.height) return;
  const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
  if (cur !== c) {
    // dans l'aperçu en grand (appui long), la carte a déjà un zoom : on fait pencher son cadre
    const t = c.closest(".tpeekc") || c;
    cur = c; c._tt = t; t._t0 = t.style.transform || ""; c.classList.add("tilt");
  }
  c.style.setProperty("--hx", Math.round(x * 100) + "%"); c.style.setProperty("--hy", Math.round(y * 100) + "%");
  const t = c._tt;
  t.style.transform = (t._t0 ? t._t0 + " " : "") + "perspective(800px) rotateY(" + ((x - 0.5) * 22).toFixed(1) + "deg) rotateX(" + ((0.5 - y) * 16).toFixed(1) + "deg)";
}
if (typeof document !== "undefined") {
  syncSimple();
  document.addEventListener("pointermove", move, { passive: true });
  document.addEventListener("pointerdown", move, { passive: true });
  const end = e => { if (e.pointerType !== "mouse") reset(); };
  document.addEventListener("pointerup", end, { passive: true });
  document.addEventListener("pointercancel", () => reset(), { passive: true });
  document.addEventListener("pointerleave", () => reset(), { passive: true });
  addEventListener("hashchange", () => reset());
}
