// TCCCG — template d'une carte (cahier des charges) : « TCCCG » en haut au centre, logo de la promotion (haut gauche),
// rareté (haut droite), grande image, nom + (années) + version / gimmick, badge archétype, logo de faction, symbole face / heel,
// 5 stats, zone Finisher, petit cercle des types ; couleur dominante = celle de l'archétype. Dos de carte : TCCCG.
import { esc } from "../util.js";
import { ARCH, ARCHS, STATS, statsOf, defOf, promoLogo, hpOf, isChampLive, RNAME, titleOf, titleById, POWERS } from "./data.js";
import { groupLogo, beltOf } from "../assets.js";

// cercle des types : les 5 couleurs dans l'ordre du cycle, flèches de qui bat qui
export const typeWheel = (size, cur) => {
  const R = size / 2 - 5, c = size / 2;
  const pts = ARCHS.map((a, i) => { const ang = -Math.PI / 2 + i * 2 * Math.PI / 5; return [c + R * Math.cos(ang), c + R * Math.sin(ang), a]; });
  return '<svg class="twheel" viewBox="0 0 ' + size + " " + size + '" width="' + size + '" height="' + size + '" aria-hidden="true">' +
    pts.map((p, i) => { const q = pts[(i + 1) % 5]; return '<line x1="' + p[0] + '" y1="' + p[1] + '" x2="' + (p[0] + (q[0] - p[0]) * 0.78) + '" y2="' + (p[1] + (q[1] - p[1]) * 0.78) + '" stroke="#fff" stroke-opacity=".55" stroke-width="1"/>'; }).join("") +
    pts.map(p => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (p[2] === cur ? 4.2 : 3) + '" fill="' + ARCH[p[2]].c + '"' + (p[2] === cur ? ' stroke="#fff" stroke-width="1.2"' : "") + "/>").join("") + "</svg>";
};
const alSym = al => al === "heel" ? '<span class="tal heel" title="Heel">😈</span>' : al === "face" ? '<span class="tal face" title="Face">😇</span>' : al === "tweener" ? '<span class="tal" title="Tweener">⚖️</span>' : "";

// format de l'image : la carte s'adapte (portrait 9:16 → carte haute ; paysage → carte large). Mémorisé par image.
const AR = new Map();
const arOf = src => AR.get(src) || 0;
const arStyle = a => a && Math.abs(a - 1) > 0.1 ? Math.max(0.5625, Math.min(1.78, a)) : 0;
if (typeof document !== "undefined") document.addEventListener("load", e => {
  const im = e.target; if (!im || !im.classList || !im.classList.contains("tc3img") || !im.naturalWidth) return;
  const src = im.getAttribute("src"), a = im.naturalWidth / im.naturalHeight; if (AR.get(src) === a) return; AR.set(src, a);
  const c = im.closest(".tc3"), v = arStyle(a); if (!c) return;
  c.classList.toggle("ar", !!v); if (v) c.style.setProperty("--ar", v.toFixed(3)); else c.style.removeProperty("--ar");
}, true);
// image d'une carte selon sa rareté : en UR puis en LR elle passe sur son image alternative (façon Dokkan)
export const picOf = (def, r) => (r === "LR" && def.picLR) || ((r === "UR" || r === "LR") && def.picUR) || def.pic || "";
// vraie ceinture en petit sur la carte (évolution, carte champion ou champion en titre), sinon 🏆
function beltMark(def, live) {
  if (!def.evo && !def.champ && !live) return "";
  const t = def.evo ? titleById(def.evo) : titleOf(def.rn || def.name), img = t && beltOf(t.id);
  const tip = def.evo ? "Évolution : " + (t ? t.n : "") : def.champ ? "Carte champion (boost permanent)" : "Champion en titre : +10 %";
  return img ? '<img class="tc3belt img" src="' + esc(img) + '" alt="" title="' + esc(tip) + '">' : '<span class="tc3belt" title="' + esc(tip) + '">🏆</span>';
}
// inst : exemplaire du joueur { c, r, lv, xp } ou une définition de carte (def) ; opt : { small, act, iid, count, back }
export function cardHTML(inst, opt) {
  opt = opt || {};
  const def = inst.c ? defOf(inst.c) : inst; if (!def) return "";
  const r = inst.r || def.r, lv = inst.lv || 1, st = inst.c ? statsOf(inst, def) : def.st, A = ARCH[def.arch] || ARCH.Showman;
  const lg = promoLogo(def.k), fl = def.faction && groupLogo(def.faction), live = isChampLive(def);
  if (opt.back) return '<div class="tc3 back' + (opt.small ? " sm" : "") + '"><div class="tc3back"><b>TCCCG</b><small>The Catch Card Collection Game</small></div></div>';
  const pic = picOf(def, r);
  const ar = pic ? arStyle(arOf(pic)) : 0;
  return '<div class="tc3 r-' + r + (opt.small ? " sm" : "") + (def.champ || live ? " champ" : "") + (def.evo ? " evo" : "") + (ar ? " ar" : "") + (opt.cls ? " " + esc(opt.cls) : "") + '" style="--ac:' + A.c + (ar ? ";--ar:" + ar.toFixed(3) : "") + '"' + (opt.act ? ' data-act="' + opt.act + '" data-iid="' + esc(opt.iid || "") + '" data-c="' + esc(def.id) + '"' : "") + ">" +
    '<div class="tc3foil"></div>' +
    '<div class="tc3top">' + (lg ? '<img class="tc3promo" src="' + esc(lg) + '" alt="">' : '<span class="tc3promo t">' + esc(def.k || "") + "</span>") + '<span class="tc3brand">TCCCG</span><span class="tc3r" title="' + esc(RNAME[r] || r) + '">' + r + "</span></div>" +
    '<div class="tc3pic' + (pic ? "" : " nopic") + '"' + (pic && !opt.small && !opt.nozoom ? ' data-act="zoom" data-src="' + esc(pic) + '" data-alt="' + esc(def.name) + '"' : "") + ">" +
      (pic ? '<img class="tc3img" src="' + esc(pic) + '" alt="" loading="lazy" decoding="async">' : '<span class="tc3empty">🖼️<small>Image à venir</small></span>') +
      '<span class="tc3arch">' + esc(def.arch) + "</span>" + (fl ? '<img class="tc3fac" src="' + esc(fl) + '" alt="">' : "") + alSym(def.al) +
      beltMark(def, live) +
      (opt.count > 1 ? '<span class="tc3count">×' + opt.count + "</span>" : "") + (opt.badge || "") + '<span class="tc3lv">Nv ' + lv + "</span></div>" +
    '<div class="tc3name"><b>' + esc(def.name) + "</b>" + (def.years ? " <small>(" + esc(def.years) + ")</small>" : "") + (def.gimmick ? '<i>' + esc(def.gimmick) + "</i>" : "") + (inst.pw && POWERS[inst.pw] && !opt.small ? '<em class="tc3pw">✦ ' + esc(POWERS[inst.pw][0]) + "</em>" : "") + "</div>" +
    '<div class="tc3stats">' + STATS.map((s, i) => '<span><small>' + s.slice(0, 3).toUpperCase() + "</small><b>" + st[i] + "</b></span>").join("") + "</div>" +
    '<div class="tc3fin"><span>🔥 ' + esc(def.fin.n) + "</span><small>" + esc(def.fin.e) + " · PV " + hpOf(st) + "</small>" + typeWheel(opt.small ? 18 : 26, def.arch) + "</div></div>";
}
