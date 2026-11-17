// TCCCG — les boosters en forme de sachet (choix de Jose du 15 nov., canevas « TCCCG – Boosters en sachet ») :
// finition « alu brillant » (dents de scie en haut et en bas, soudures rayées, plis aux coins, reflet qui passe, petites étoiles),
// pointillé « déchirer ici » sous la soudure du haut, couleur de l'alu selon la catégorie du booster.
// packHTML = la version HTML (Call Up, confirmation, ouverture sans Phaser) ; paintPack = la même chose dessinée sur un canvas
// pour la scène Phaser de l'invocation (summon.js).
import { esc } from "../util.js";
import { boosterImg, faSvg, FA_PATHS } from "./card.js";

// couleur de l'alu : Cadeaux vert, Shows argent, PLE or, Spéciaux bleu, Départ cuivre, Modo rouge
export const FOIL = { "Cadeau": "#6ee7a6", "Shows de la semaine": "#d6dbe4", "PLE et PPV": "#ffd23f", "Boosters spéciaux": "#8fb8ff", "Boosters de départ": "#e9a273", "Modo": "#ff8a8a" };
export const foilOf = b => FOIL[(b && b.cat) || ""] || "#8fb8ff";
// boosters des agents libres (16 nov.) : le symbole « chaîne brisée » des cartes agents libres
export const isFaPack = b => !!b && (b.id === "fa" || b.id === "mitb");
export const packTag = b => b.id === "free" ? "Gratuit" : b.id === "mitb" ? "1 SSR au choix" : "5 cartes";
const colOk = c => /^#[0-9a-f]{3,8}$|^rgba?\([\d\s.,%]+\)$/i.test(String(c || "").trim());
const cols = b => { const c = (b && b.c) || []; return [colOk(c[0]) ? c[0] : "#2a3a72", colOk(c[1]) ? c[1] : "#0b1636"]; };

// opt : { cls, title, tag ("" = sans pastille), notitle, still (sans reflet ni étoiles) }
export function packHTML(b, opt) {
  opt = opt || {};
  const img = boosterImg(b), c = cols(b);
  return '<span class="tpk' + (opt.cls ? " " + esc(opt.cls) : "") + '" style="--foil:' + foilOf(b) + ";--c0:" + c[0] + ";--c1:" + c[1] + '"><span class="tpk-b">' +
    (img ? '<img class="tpk-img" src="' + esc(img) + '" alt="" draggable="false" decoding="async">' : "") +
    (b.logo ? '<img class="tpk-logo" src="' + esc(b.logo) + '" alt="" draggable="false">' : !img && (b.id === "free" || b.id === "mitb") ? '<span class="tpk-gift">' + (b.id === "free" ? "🎁" : "💼") + "</span>" : "") +
    '<span class="tpk-f"></span><span class="tpk-w"></span><span class="tpk-g"></span>' +
    (isFaPack(b) ? '<span class="tpk-fa" title="Agent libre" role="img" aria-label="Agent libre">' + faSvg() + "<small>AGENT LIBRE</small></span>" : "") +
    (opt.still ? "" : '<span class="tpk-sh"></span><span class="tpk-sp"><i></i><i></i><i></i><i></i></span>') +
    '<span class="tpk-s t"><b>TCCCG</b></span><span class="tpk-s b"></span><span class="tpk-cut"></span>' +
    (opt.notitle ? "" : '<span class="tpk-t"><b>' + esc(opt.title || b.t || "Booster") + "</b>" + (opt.tag === "" ? "" : "<small>" + esc(opt.tag || packTag(b)) + "</small>") + "</span>") +
    "</span></span>";
}

// ---------- la version canvas (scène Phaser) ----------
const rgb = h => { const m = String(h || "").match(/^#?([0-9a-f]{6})$/i); const n = m ? parseInt(m[1], 16) : 0x8fb8ff; return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => "rgb(" + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",") + ")";
export const foilNum = b => { const c = rgb(foilOf(b)); return (c[0] << 16) | (c[1] << 8) | c[2]; };
// la déchirure entre la bande du haut et le corps (petits zigzags irréguliers, les mêmes pour les deux morceaux)
export function tearJag(w, h) { const y = h * 0.14, P = []; for (let x = 0; x <= w + 0.1; x += 6) P.push([Math.min(x, w), y + (P.length % 2 ? 1.6 : -1.6) + (Math.random() - 0.5) * 1.6]); return P; }
// contour du sachet (dents de scie en haut et en bas)
function outline(x, w, h) {
  const n = Math.max(6, Math.round(w / 10)), z = w / n, d = Math.min(5, z / 2);
  x.beginPath(); x.moveTo(0, d);
  for (let i = 0; i < n; i++) { x.lineTo(i * z + z / 2, 0); x.lineTo((i + 1) * z, d); }
  x.lineTo(w, h - d);
  for (let i = n; i > 0; i--) { x.lineTo(i * z - z / 2, h); x.lineTo((i - 1) * z, h - d); }
  x.closePath();
}
// dessine un morceau du sachet : part = "body" (sous la déchirure), "strip" (bande du haut) ou "all" ; src = image du booster (même origine)
export function paintPack(b, w, h, part, jag, src) {
  const k = Math.min(2, (typeof devicePixelRatio === "number" && devicePixelRatio) || 1), cv = document.createElement("canvas");
  cv.width = Math.round(w * k); cv.height = Math.round(h * k);
  const x = cv.getContext("2d"); x.scale(k, k);
  const F = rgb(foilOf(b)), c = cols(b), sh = h * 0.1;
  x.save(); outline(x, w, h); x.clip();
  if (part !== "all") {
    x.beginPath();
    if (part === "strip") { x.moveTo(-2, -2); x.lineTo(w + 2, -2); for (let i = jag.length - 1; i >= 0; i--) x.lineTo(jag[i][0], jag[i][1]); }
    else { jag.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.lineTo(w + 2, h + 2); x.lineTo(-2, h + 2); }
    x.closePath(); x.clip();
  }
  // fond (couleurs du booster) puis l'image qui remplit tout le sachet
  let g = x.createLinearGradient(0, 0, w * 0.6, h); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]); x.fillStyle = g; x.fillRect(0, 0, w, h);
  if (src && src.width) { const s = Math.max(w / src.width, h / src.height); x.drawImage(src, (w - src.width * s) / 2, (h - src.height * s) / 2, src.width * s, src.height * s); }
  // coussin : côtés pincés, haut et bas plus sombres, centre bombé
  g = x.createLinearGradient(0, 0, w, 0);
  [[0, "rgba(0,0,0,.55)"], [0.06, "rgba(0,0,0,0)"], [0.09, "rgba(255,255,255,.3)"], [0.14, "rgba(255,255,255,0)"], [0.86, "rgba(255,255,255,0)"], [0.91, "rgba(255,255,255,.22)"], [0.94, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,.6)"]].forEach(s => g.addColorStop(s[0], s[1]));
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  g = x.createLinearGradient(0, 0, 0, h); [[0, "rgba(0,0,0,.3)"], [0.17, "rgba(0,0,0,0)"], [0.83, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,.38)"]].forEach(s => g.addColorStop(s[0], s[1]));
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, h * 0.62); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.32)");
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  // plis en éventail aux 4 coins, près des soudures
  x.lineWidth = 1;
  [[0, sh, 0, 1.4], [w, sh, Math.PI / 2 + 0.17, Math.PI - 0.05], [0, h - sh, -1.4, 0], [w, h - sh, Math.PI + 0.05, Math.PI * 1.5 - 0.17]].forEach(q => {
    for (let i = 0; i < 7; i++) { const a = q[2] + (q[3] - q[2]) * (i + 0.5) / 7, L = w * (0.18 + ((i * 37) % 10) / 40);
      x.strokeStyle = "rgba(255,255,255,.3)"; x.beginPath(); x.moveTo(q[0], q[1]); x.lineTo(q[0] + Math.cos(a) * L, q[1] + Math.sin(a) * L); x.stroke();
      x.strokeStyle = "rgba(0,0,0,.25)"; x.beginPath(); x.moveTo(q[0], q[1] + 1.5); x.lineTo(q[0] + Math.cos(a + 0.04) * L, q[1] + 1.5 + Math.sin(a + 0.04) * L); x.stroke(); }
  });
  // grands reflets en biais
  x.save(); x.globalCompositeOperation = "screen"; x.translate(w / 2, h / 2); x.rotate(-0.47);
  [[-w * 0.36, w * 0.13, 0.42], [w * 0.2, w * 0.1, 0.26]].forEach(r => { const gg = x.createLinearGradient(r[0], 0, r[0] + r[1], 0); gg.addColorStop(0, "rgba(255,255,255,0)"); gg.addColorStop(0.5, "rgba(255,255,255," + r[2] + ")"); gg.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = gg; x.fillRect(r[0], -h, r[1], h * 2); });
  x.restore();
  g = x.createRadialGradient(w * 0.32, h * 0.28, 0, w * 0.32, h * 0.28, w * 0.55); g.addColorStop(0, "rgba(255,255,255,.2)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, w, h);
  // soudures rayées
  [[0, true], [h - sh, false]].forEach(s => {
    const y = s[0]; g = x.createLinearGradient(0, y, 0, y + sh); g.addColorStop(0, mix(F, [255, 255, 255], 0.45)); g.addColorStop(0.45, mix(F, F, 0)); g.addColorStop(1, mix(F, [0, 0, 0], 0.45));
    x.fillStyle = g; x.fillRect(0, y, w, sh);
    for (let px = 0; px < w; px += 4) { x.fillStyle = "rgba(255,255,255,.5)"; x.fillRect(px, y, 1, sh); x.fillStyle = "rgba(0,0,0,.12)"; x.fillRect(px + 1, y, 1, sh); }
    g = x.createLinearGradient(0, 0, w, 0);
    [[0.08, 0], [0.12, 0.75], [0.16, 0], [0.44, 0], [0.49, 0.6], [0.54, 0], [0.78, 0], [0.83, 0.7], [0.87, 0]].forEach(q => g.addColorStop(q[0], "rgba(255,255,255," + q[1] + ")"));
    x.fillStyle = g; x.fillRect(0, y, w, sh);
    x.fillStyle = "rgba(0,0,0,.35)"; x.fillRect(0, s[1] ? y + sh - 2 : y, w, 2);
  });
  // « TCCCG » sur la soudure du haut (lettres espacées)
  const fs = Math.max(9, w * 0.075), word = "TCCCG", sp = fs * 0.22;
  x.font = "400 " + fs + "px Anton, Impact, sans-serif"; x.textBaseline = "middle"; x.fillStyle = mix(F, [6, 16, 46], 0.75);
  const ws = word.split("").map(l => x.measureText(l).width), tot = ws.reduce((a, v) => a + v, 0) + sp * (word.length - 1);
  let tx = (w - tot) / 2; word.split("").forEach((l, i) => { x.fillText(l, tx, sh * 0.56); tx += ws[i] + sp; });
  // symbole « agent libre » (16 nov.) : pastille verte, chaîne brisée dorée
  if (isFaPack(b) && part !== "strip" && typeof Path2D === "function") {
    const r0 = w * 0.11, cx = w * 0.18, cy = h * 0.24;
    x.save(); x.shadowColor = "rgba(0,0,0,.5)"; x.shadowBlur = 6; x.fillStyle = "#0d4a2a"; x.beginPath(); x.arc(cx, cy, r0, 0, Math.PI * 2); x.fill(); x.shadowBlur = 0;
    x.lineWidth = 2; x.strokeStyle = "#ffd23f"; x.stroke();
    x.translate(cx - r0 * 0.62, cy - r0 * 0.62); x.scale(r0 * 1.24 / 24, r0 * 1.24 / 24); x.lineWidth = 2.4; x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = "#ffd23f";
    FA_PATHS.forEach(d => x.stroke(new Path2D(d))); x.restore();
  }
  // pointillés « déchirer ici »
  x.setLineDash([5, 4]); x.strokeStyle = "rgba(255,255,255,.65)"; x.lineWidth = 2; x.beginPath(); x.moveTo(w * 0.07, h * 0.125); x.lineTo(w * 0.93, h * 0.125); x.stroke(); x.setLineDash([]);
  x.restore();
  return cv;
}
// la lueur autour du sachet (couleur de l'alu), sans le sachet lui-même
export function paintGlow(b, w, h, m) {
  const cv = document.createElement("canvas"); cv.width = Math.round(w + 2 * m); cv.height = Math.round(h + 2 * m);
  const x = cv.getContext("2d"), F = rgb(foilOf(b));
  x.translate(m, m); x.shadowColor = "rgba(" + F.join(",") + ",.75)"; x.shadowBlur = m * 0.9; x.fillStyle = "rgb(" + F.join(",") + ")";
  outline(x, w, h); x.fill(); x.shadowBlur = 0; x.globalCompositeOperation = "destination-out"; outline(x, w, h); x.fill();
  return cv;
}
