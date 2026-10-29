// Recadrage d'une photo avant de l'enregistrer : on la déplace avec le doigt, on zoome (pincer ou curseur), puis Valider.
// ratio : 3 pour la bannière (3:1), 1 pour la photo de profil (cadre rond).
import { modal, toast } from "./util.js";

export function cropImage(file, opt) {
  opt = Object.assign({ ratio: 1, round: false, out: 400, maxLen: 350000, title: "Recadrer" }, opt || {});
  return new Promise(resolve => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); toast("Image illisible"); resolve(null); };
    img.onload = () => {
      let done = false;
      const finish = v => { if (done) return; done = true; URL.revokeObjectURL(url); resolve(v); };
      modal((box, close) => {
        box.classList.add("cropbox");
        box.innerHTML = "<h3>" + opt.title + '</h3><div class="cropstage' + (opt.round ? " round" : "") + '" style="aspect-ratio:' + opt.ratio + '/1"><img alt="" draggable="false"><span class="cropframe"></span></div>' +
          '<label class="cropzoom"><span>🔍</span><input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom"></label>' +
          '<p class="note small" style="text-align:center;margin:4px 0 10px">Déplace la photo avec le doigt, pince ou utilise le curseur pour zoomer.</p>' +
          '<button class="btn wide" data-ok>Valider</button><button class="btn wide ghost" style="margin-top:10px" data-no>Annuler</button>';
        box.parentNode.addEventListener("click", e => { if (e.target === box.parentNode) finish(null); });
        const stage = box.querySelector(".cropstage"), im = box.querySelector("img"), zr = box.querySelector("input[type=range]");
        im.src = url;
        const iw = img.naturalWidth, ih = img.naturalHeight;
        let W = 0, H = 0, s0 = 1, z = 1, x = 0, y = 0;
        const sc = () => s0 * z;
        const clamp = () => { const dw = iw * sc(), dh = ih * sc(); x = Math.min(0, Math.max(W - dw, x)); y = Math.min(0, Math.max(H - dh, y)); };
        const draw = () => { clamp(); im.style.width = iw * sc() + "px"; im.style.height = ih * sc() + "px"; im.style.transform = "translate(" + x + "px," + y + "px)"; };
        const layout = () => { W = stage.clientWidth; H = stage.clientHeight; s0 = Math.max(W / iw, H / ih); x = (W - iw * sc()) / 2; y = (H - ih * sc()) / 2; draw(); };
        // zoom autour d'un point (le centre du cadre, ou le milieu des deux doigts)
        const zoomTo = (nz, px, py) => {
          nz = Math.min(4, Math.max(1, nz)); px = px == null ? W / 2 : px; py = py == null ? H / 2 : py;
          const cx = (px - x) / sc(), cy = (py - y) / sc(); z = nz; x = px - cx * sc(); y = py - cy * sc(); zr.value = z; draw();
        };
        requestAnimationFrame(layout);
        zr.addEventListener("input", () => zoomTo(+zr.value));
        stage.addEventListener("wheel", e => { e.preventDefault(); const r = stage.getBoundingClientRect(); zoomTo(z * (e.deltaY < 0 ? 1.08 : 0.93), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
        const pts = new Map(); let start = null;
        const snap = () => { const a = Array.from(pts.values()); return a.length >= 2 ? { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), mx: (a[0].x + a[1].x) / 2, my: (a[0].y + a[1].y) / 2, z: z, x: x, y: y } : a.length ? { px: a[0].x, py: a[0].y, x: x, y: y } : null; };
        stage.addEventListener("pointerdown", e => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); start = snap(); e.preventDefault(); });
        stage.addEventListener("pointermove", e => {
          if (!pts.has(e.pointerId) || !start) return;
          pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const now = snap(); if (!now) return;
          if (start.d && now.d) {
            // pincer : le point de la photo sous les doigts reste sous les doigts
            const r = stage.getBoundingClientRect(), s1 = s0 * start.z;
            const ix = (start.mx - r.left - start.x) / s1, iy = (start.my - r.top - start.y) / s1;
            z = Math.min(4, Math.max(1, start.z * now.d / start.d)); zr.value = z;
            x = now.mx - r.left - ix * sc(); y = now.my - r.top - iy * sc(); draw();
          } else if (start.px != null) { x = start.x + (now.px - start.px); y = start.y + (now.py - start.py); draw(); }
        });
        const up = e => { pts.delete(e.pointerId); start = snap(); };
        stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
        box.addEventListener("click", ev => {
          if (ev.target.closest("[data-no]")) { close(); finish(null); return; }
          if (!ev.target.closest("[data-ok]")) return;
          const ow = opt.out, oh = Math.round(opt.out / opt.ratio), c = document.createElement("canvas");
          c.width = ow; c.height = oh;
          const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, ow, oh);
          g.drawImage(img, -x / sc(), -y / sc(), W / sc(), H / sc(), 0, 0, ow, oh);
          let q = 0.88, out = c.toDataURL("image/jpeg", q);
          while (out.length > opt.maxLen && q > 0.45) { q -= 0.08; out = c.toDataURL("image/jpeg", q); }
          close(); finish(out);
        });
      });
    };
    img.src = url;
  });
}
