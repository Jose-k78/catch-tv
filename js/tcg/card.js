// TCCCG — template d'une carte. Depuis le 16 nov. (choix de Jose) : l'image prend toute la carte, logo de la promotion (haut gauche,
// symbole « agent libre » pour un catcheur sans roster), lettres de rareté en métal (haut droite), nom géant à la verticale, cadre du bas :
// nom + (années) + gimmick, archétype, niveau, petit cercle des types, jauges PV + 5 stats, finisher ; couleur dominante = celle de l'archétype.
// Dos de carte : TCCCG (ou l'image du modo).
import { esc } from "../util.js";
import { ARCH, ARCHS, STATS, statsOf, defOf, promoLogo, hpOf, isChampLive, RNAME, titleOf, titleById, POWERS, cfg, RAR, skillOf } from "./data.js";
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

// icône d'un objet : image du modo s'il en a mis une, sinon l'émoji
export const itemIc = (it, cls) => !it ? "" : it.img ? '<img class="' + (cls || "tico") + '" src="' + esc(it.img) + '" alt="">' : '<span class="' + (cls || "tico") + ' e">' + esc(it.ic || "🎁") + "</span>";
// image de la carte (16 nov.) : au chargement, on mesure la partie visible de l'image (les bords transparents sont ignorés) pour placer
// le catcheur en grand ; une photo sans détourage (coins opaques) a un fondu en ovale. Mémorisé par image.
const FIT = new Map();
function measure(im) {
  const src = im.getAttribute("src"), nw = im.naturalWidth, nh = im.naturalHeight; if (!nw || !nh) return null;
  if (FIT.has(src)) return FIT.get(src);
  let r = { a: nw / nh, b: [0, 0, 1, 1], p: 0, u: 1 };
  try {
    const W = 64, H = Math.max(8, Math.min(200, Math.round(W * nh / nw))), cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d", { willReadFrequently: true }); x.drawImage(im, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H).data, A = (i, j) => d[(j * W + i) * 4 + 3];
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (A(i, j) > 40) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
    if (x1 >= 0) {
      const op = [[x0 + 1, y0 + 1], [x1 - 1, y0 + 1], [x0 + 1, y1 - 1], [x1 - 1, y1 - 1]].filter(q => A(Math.max(0, Math.min(W - 1, q[0])), Math.max(0, Math.min(H - 1, q[1]))) > 230).length;
      r = { a: nw / nh, b: [x0 / W, y0 / H, (x1 - x0 + 1) / W, (y1 - y0 + 1) / H], p: op >= 3 ? 1 : 0 };
    }
  } catch (e) {}
  FIT.set(src, r); return r;
}
// place l'image (en cqw = % de la largeur de la carte) : la partie visible fait ~100 de large, centrée à 54, le bas vers 100
function fitStyle(r) {
  if (!r || r.u) return "";
  const b = r.b, rb = (b[3] / b[2]) / r.a;
  const Wb = r.p ? Math.max(100, 100 / rb) : Math.min(104, 100 / rb), Hb = Wb * rb, Wi = Wb / b[2], Hi = Wi / r.a;
  const L = 54 - Wb / 2 - b[0] * Wi, T = (r.p ? 4 : Math.max(6, 100 - Hb)) - b[1] * Hi;
  return "width:" + Wi.toFixed(1) + "cqw;left:" + L.toFixed(1) + "cqw;top:" + T.toFixed(1) + "cqw";
}
if (typeof document !== "undefined") document.addEventListener("load", e => {
  const im = e.target; if (!im || !im.classList || !im.classList.contains("t4img")) return;
  const r = measure(im); if (!r) return;
  const st = fitStyle(r); if (st) im.setAttribute("style", st);
  const c = im.closest(".tc4"); if (c) c.classList.toggle("photo", !!r.p);
}, true);
// symbole « agent libre » (16 nov.) : une chaîne brisée, à la place du logo de la promotion (cartes) et sur les boosters agents libres
export const FA_PATHS = ["M10.2 14.2 7.4 17a3.3 3.3 0 0 1-4.7-4.7l2.8-2.8a3.3 3.3 0 0 1 4.5-.2", "M13.8 9.8 16.6 7a3.3 3.3 0 0 1 4.7 4.7l-2.8 2.8a3.3 3.3 0 0 1-4.5.2", "M8.6 2.6 9.2 5.4", "M2.6 8.6 5.4 9.2", "M15.4 21.4 14.8 18.6", "M21.4 15.4 18.6 14.8"];
export const faSvg = () => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + FA_PATHS.map(d => '<path d="' + d + '"/>').join("") + "</svg>";
export const faMark = cls => '<span class="' + (cls || "t4fa") + '" title="Agent libre : dans aucun roster" role="img" aria-label="Agent libre">' + faSvg() + "</span>";
// image d'une carte selon sa rareté : en UR puis en LR elle passe sur son image alternative (façon Dokkan)
export const picOf = (def, r) => (r === "LR" && def.picLR) || ((r === "UR" || r === "LR") && def.picUR) || def.pic || "";
// vraie ceinture en petit sur la carte (évolution, carte champion ou champion en titre), sinon 🏆
function beltMark(def, live) {
  if (!def.evo && !def.champ && !live) return "";
  const t = def.evo ? titleById(def.evo) : titleOf(def.rn || def.name), img = t && beltOf(t.id);
  const tip = def.evo ? "Évolution : " + (t ? t.n : "") : def.champ ? "Carte champion (boost permanent)" : "Champion en titre : +10 %";
  return img ? '<img class="tc3belt img" src="' + esc(img) + '" alt="" title="' + esc(tip) + '">' : '<span class="tc3belt" title="' + esc(tip) + '">🏆</span>';
}
// carte vedette = carte fétiche d'un joueur (14 nov.) : sa 1re favorite qui existe encore, sinon sa meilleure carte.
// Elle est en haut du Roster et sur son profil TCC TV / TCCCG.
export function starOf(d) {
  if (!d || !d.cards) return null;
  const f = (d.fav || []).find(i => d.cards[i] && defOf(d.cards[i].c));
  if (f) return Object.assign({ iid: f }, d.cards[f]);
  let best = null;
  Object.keys(d.cards).forEach(i => { const x = d.cards[i]; if (!x || !defOf(x.c)) return; if (!best || RAR.indexOf(x.r) > RAR.indexOf(best.r) || (x.r === best.r && (x.lv || 1) > (best.lv || 1))) best = Object.assign({ iid: i }, x); });
  return best;
}
// dos des cartes : l'image choisie par le modo (Modo › Musiques et assets › Dos des cartes), sinon « TCCCG »
export const backImg = () => ((cfg().assets || {}).back) || "";
export function backHTML(small, cls) {
  const im = backImg();
  return '<div class="tc3 back' + (small ? " sm" : "") + (im ? " img" : "") + (cls ? " " + cls : "") + '">' + (im ? '<img class="tc3bimg" src="' + esc(im) + '" alt="" draggable="false">' : '<div class="tc3back"><b>TCCCG</b><small>The Catch Card Collection Game</small></div>') + "</div>";
}
// image d'un booster : la sienne (modo), sinon le fond commun des boosters (Modo › Fond des boosters)
export const boosterImg = b => (b && b.img) || ((cfg().assets || {}).booster) || "";
// nom des raretés « façon catch » (16 nov.) : sous les lettres en métal
export const TIER = { N: "ROOKIE", R: "MID-CARD", SR: "UPPER CARD", SSR: "MAIN EVENT", UR: "CHAMPION", LR: "LÉGENDE" };
const rep = (n, s) => Array.from({ length: n }, () => s).join("");
// décor de chaque rareté : derrière le catcheur (bk) et devant (fr, seulement sur les grandes cartes : ça bouge)
const DECO = {
  N: { bk: '<span class="zbulb"></span>', ropes: 1, riv: 1 },
  R: { bk: '<span class="zled"></span><span class="zled2"></span>', ropes: 1, riv: 1 },
  SR: { bk: "", ropes: 1, riv: 1, gloss: 1 },
  SSR: { bk: '<span class="zbeam a"></span><span class="zbeam b"></span><span class="zflame a"></span><span class="zflame b"></span>', fr: rep(8, '<span class="zpyro"></span>'), shine: 1 },
  UR: { bk: '<span class="zholo"></span><span class="zbelt"><span class="zstrap"></span><span class="zsp a"></span><span class="zsp b"></span><span class="zcp"></span></span>', fr: rep(8, '<span class="zconf"></span>'), shine: 1 },
  LR: { bk: '<span class="zrays"></span>', fr: rep(8, '<span class="zglit"></span>'), shine: 1 }
};
const gsOf = n => Math.max(14, Math.min(34, 140 / (Math.max(3, String(n).length) * 0.62)));
const nsOf = n => { const l = String(n).length; return l > 18 ? 6.4 : l > 15 ? 7.2 : l > 12 ? 8.2 : 9.5; };
// inst : exemplaire du joueur { c, r, lv, xp } ou une définition de carte (def) ; opt : { small, act, iid, count, back, badge, nozoom, fighter, cls }
// Design du 16 nov. (choix de Jose, canevas « TCCCG – Cartes ») : l'image prend toute la carte, nom géant à la verticale derrière le catcheur,
// bande de la couleur du type à gauche, cadre du bas avec les jauges (PV + 5 stats), fondu de l'image, décor et lettres en métal selon la rareté.
export function cardHTML(inst, opt) {
  opt = opt || {};
  const def = inst.c ? defOf(inst.c) : inst; if (!def) return "";
  const r = inst.r || def.r, lv = inst.lv || 1, st = inst.c ? statsOf(inst, def) : def.st, A = ARCH[def.arch] || ARCH.Showman;
  const lg = promoLogo(def.k), fl = def.faction && groupLogo(def.faction), live = isChampLive(def);
  if (opt.back) return backHTML(opt.small);
  const pic = picOf(def, r), sm = !!opt.small, hp = hpOf(st), D = DECO[r] || DECO.N;
  // carte Soutien (14 nov.) / Legends (16 nov.) : à la place des jauges, son bonus + sa compétence (sauf sur le plateau de combat)
  const supc = def.sup && !opt.fighter, sk = supc ? skillOf(def, r) : null, leg = supc && def.leg;
  const fit = pic ? fitStyle(FIT.get(pic)) : "", ph = pic && FIT.get(pic) && FIT.get(pic).p;
  const promo = def.fa ? faMark("t4promo t4fa") : lg ? '<img class="t4promo" src="' + esc(lg) + '" alt="' + esc(def.k || "") + '">' : def.k ? '<span class="t4promo t">' + esc(def.k) + "</span>" : "";
  const side = (fl ? '<img class="t4fac" src="' + esc(fl) + '" alt="">' : "") + beltMark(def, live) + alSym(def.al);
  const tag = supc ? '<span class="t4tag' + (leg ? " leg" : "") + '">' + (leg ? "👑 LEGENDS" : "🤝 SOUTIEN") + "</span>" : "";
  let body;
  if (sm) body = tag + '<b class="t4nm" style="--ns:' + nsOf(def.name) + 'cqw">' + esc(def.name) + '</b><span class="t4lv">Nv ' + lv + "</span>";
  else {
    const sub = [def.years ? esc(def.years) : "", def.gimmick ? "<i>" + esc(def.gimmick) + "</i>" : "", inst.pw && POWERS[inst.pw] ? '<em class="tc3pw">✦ ' + esc(POWERS[inst.pw][0]) + "</em>" : ""].filter(Boolean);
    const panel = supc ? '<div class="t4sp' + (leg ? " leg" : "") + '">' +
        (leg ? '<b class="t4tb">+5 % à toute l’équipe</b><div class="t4sk"><b>👑 Retour surprise</b><span>Quand ton équipe tombe à 25 % de vie : elle entre sur le ring, soigne ' + Math.round(hp * 0.6) + " PV et joue 3 tours</span></div>" : '<b class="t4tb">+10 % aux cartes ' + esc(def.arch) + "</b>") +
        (sk ? '<div class="t4sk"><b>✦ ' + esc(sk.n) + "</b><span>" + esc(sk.t) + "</span></div>" : "") + "</div>"
      : '<div class="t4gg"><span class="t4hp"><b>' + hp + "</b><i></i>PV</span>" + STATS.map((s, i) => "<span><b>" + st[i] + '</b><i style="--v:' + Math.max(6, Math.min(100, Math.round(st[i] / 80 * 100))) + '%"></i>' + s.slice(0, 3).toUpperCase() + "</span>").join("") + "</div>";
    body = tag + '<b class="t4nm" style="--ns:' + nsOf(def.name) + 'cqw">' + esc(def.name) + "</b>" + (sub.length ? '<span class="t4sub">' + sub.join(" · ") + "</span>" : "") +
      '<span class="t4meta"><span class="t4arch">' + esc(def.arch) + '</span><span class="t4lv">Nv ' + lv + "</span>" + typeWheel(26, def.arch) + "</span>" + panel +
      (supc ? "" : '<span class="t4fin">🔥 ' + esc(def.fin.n) + " <em>· " + esc(def.fin.e) + "</em></span>");
  }
  return '<div class="tc3 tc4 r-' + r + " rz-" + r + (sm ? " sm" : "") + (sk || leg ? " sup" : "") + (leg ? " leg" : "") + (def.champ || live ? " champ" : "") + (def.evo ? " evo" : "") + (ph ? " photo" : "") + (opt.cls ? " " + esc(opt.cls) : "") + '" style="--ac:' + A.c + ";--gs:" + gsOf(def.name).toFixed(1) + 'cqw" data-pk="' + esc(def.id + "|" + r + "|" + lv + "|" + (inst.iid || opt.iid || "")) + '"' + (opt.act ? ' data-act="' + opt.act + '" data-iid="' + esc(opt.iid || "") + '" data-c="' + esc(def.id) + '"' : "") + ' title="' + esc(def.name + " · " + r + " " + (RNAME[r] || "")) + '">' +
    '<span class="t4bg"></span>' + (D.bk ? '<span class="t4zk bk">' + D.bk + "</span>" : "") +
    '<span class="t4giant" aria-hidden="true"><b>' + esc(def.name) + "</b></span>" + (D.ropes ? '<span class="t4ropes"></span>' : "") + '<span class="t4floor"></span>' +
    '<div class="t4art' + (pic ? "" : " nopic") + '"' + (pic && !sm && !opt.nozoom ? ' data-act="zoom" data-src="' + esc(pic) + '" data-alt="' + esc(def.name) + '"' : "") + ">" +
      (pic ? '<img class="t4img" src="' + esc(pic) + '" alt="" loading="lazy" decoding="async" draggable="false"' + (fit ? ' style="' + fit + '"' : "") + ">" : '<span class="t4empty">🖼️<small>Image à venir</small></span>') + "</div>" +
    (D.fr && !sm ? '<span class="t4zk fr">' + D.fr + "</span>" : "") +
    '<span class="t4strip"></span>' + promo + (side ? '<span class="t4side">' + side + "</span>" : "") +
    '<span class="t4rl"><b>' + r + "</b>" + (sm ? "" : "<small>" + TIER[r] + "</small>") + (r === "LR" && !sm ? '<i class="spk"></i>' : "") + "</span>" +
    (opt.count > 1 ? '<span class="t4cnt">×' + opt.count + "</span>" : "") + (opt.badge || "") +
    '<div class="t4fr">' + body + "</div>" +
    (D.riv ? '<span class="t4riv a"></span><span class="t4riv b"></span>' : "") + (D.gloss ? '<span class="t4gloss"></span>' : "") + (D.shine ? '<span class="t4shine"></span>' : "") +
    '<span class="t4glare" aria-hidden="true"></span><span class="t4rim"></span></div>';
}
