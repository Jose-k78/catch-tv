// TCCCG — réglages du modo (data/tcg.json, enregistré avec la clé GitHub du modo) :
// cartes (rareté, rareté max, archétype, stats, finisher, gimmick, image, buff / nerf, médailles d'éveil, boosters, masquer),
// personnages créés (N : managers, jobbers, célébrités, OC), taux d'apparition, objets (créer / modifier / supprimer, effet, prix),
// boosters (créer : cartes auto ou à la main, nombre de cartes, prix en gimmicks, image), combats (PLE autorisés / retirés,
// difficulté de l'IA, attente entre deux combats), musiques (victoire, défaite) et image du dos des cartes.
import { S, ACT, FORM, changed } from "../state.js";
import { esc, toast, modal, fileToDataUrl } from "../util.js";
import { ghGetJson, ghPutJson, ghToken, ghPutBinary } from "../github.js";
import { RAR, ARCHS, STATS, FX, ITEMS0, RATE0, cfg, baseCards, cardById, items, rates, showKeyLabel } from "./data.js";
import { cardHTML } from "./card.js";
import { norm } from "../wrestlers.js";

let tab = "", q = "";
async function saveCfg(fn, msg) {
  if (!ghToken()) { if (ACT.ghkey) ACT.ghkey(); return false; }
  const cur = await ghGetJson("data/tcg.json"), d = cur.data || {};
  fn(d); d.updated = new Date().toISOString().slice(0, 10);
  await ghPutJson("data/tcg.json", d, "TCCCG (modo) : " + msg);
  S.tcgCfg = d; changed("tcg");
  return true;
}
const run = (fn, msg) => saveCfg(fn, msg).then(ok => { if (ok) toast("Enregistré ✓"); }).catch(e => { if (e && e.message !== "nokey") toast("Pas enregistré : " + e.message, { ms: 5000 }); });
// envoie une image ou un son dans le dépôt (img/tcg/ ou media/tcg/) et renvoie son chemin
async function upload(file, dir) {
  if (!ghToken()) { if (ACT.ghkey) ACT.ghkey(); throw new Error("nokey"); }
  const url = await fileToDataUrl(file), ext = (file.name.match(/\.(\w+)$/) || [, "bin"])[1].toLowerCase(), path = dir + Date.now().toString(36) + "." + ext;
  await ghPutBinary(path, url.split(",")[1], "TCCCG (modo) : fichier " + file.name);
  return path;
}
function pickFile(accept, dir, cb) { const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.onchange = async () => { const f = i.files[0]; if (!f) return; toast("Envoi…"); try { cb(await upload(f, dir)); } catch (e) { if (e && e.message !== "nokey") toast("Envoi impossible : " + e.message, { ms: 5000 }); } }; i.click(); }

export function modoView() {
  if (!S.isAdmin) return '<p class="tnote">Réservé au modérateur (active le bouton ✏️).</p>';
  const tabs = [["", "Cartes"], ["persos", "Persos créés"], ["taux", "Taux"], ["objets", "Objets"], ["boosters", "Boosters"], ["combats", "Combats"], ["sons", "Musiques et assets"]];
  let h = '<section class="tccghead"><h1>⚙️ Modo TCCCG</h1></section><nav class="tsub">' + tabs.map(x => '<button class="' + (tab === x[0] ? "on" : "") + '" data-act="tcgmt" data-t="' + x[0] + '">' + x[1] + "</button>").join("") + "</nav>";
  const C = cfg();
  if (tab === "") {
    const L = baseCards().filter(c => !q || norm(c.name).indexOf(norm(q)) >= 0).slice(0, 60);
    h += '<div class="search" style="margin:0 16px"><input id="tmq" type="search" placeholder="Chercher une carte" value="' + esc(q) + '"></div><p class="tnote">' + baseCards().length + " cartes · touche une carte pour la modifier</p>" +
      '<div class="trgrid">' + L.map(c => cardHTML(c, { small: true, act: "tcgmedit", iid: "" })).join("") + "</div>";
  }
  if (tab === "persos") {
    const P = C.custom || [];
    h += '<p class="tnote">Managers, jobbers, célébrités, personnages créés : cartes N que tu ajoutes au jeu.</p><button class="btn small" style="margin:0 16px" data-act="tcgmperso">＋ Créer un personnage</button>' +
      '<div class="trgrid">' + P.map(c => cardById(c.id) ? cardHTML(cardById(c.id), { small: true, act: "tcgmedit" }) : "").join("") + "</div>";
  }
  if (tab === "taux") {
    const R = rates();
    h += '<p class="tnote">Taux d’apparition dans les boosters (en %). La dernière carte d’un booster normal est toujours R ou mieux.</p><form class="tmform" data-form="tcgrates">' + RAR.map(r => '<label>' + r + ' <input name="' + r + '" type="number" step="0.1" min="0" value="' + R[r] + '"></label>').join("") + '<button class="btn">Enregistrer</button><button type="button" class="btn ghost" data-act="tcgmratesreset">Valeurs de départ</button></form>';
  }
  if (tab === "objets") {
    h += '<button class="btn small" style="margin:0 16px" data-act="tcgmitem" data-id="">＋ Créer un objet</button><div class="list" style="margin-top:8px">' + items().map(x => '<button class="item" data-act="tcgmitem" data-id="' + x.id + '"><span class="lbl"><b>' + esc((x.ic || "🎁") + " " + x.n) + "</b><small>" + (x.t === "combat" ? "Combat · " + esc(x.fx || "") + " " + (x.v || "") : "Éveil · rang " + esc(x.g || "")) + " · " + esc(x.d || "") + (x.drop != null ? " · drop " + x.drop + " %" : "") + '</small></span><span class="chev">›</span></button>').join("") + "</div>";
  }
  if (tab === "boosters") {
    const L = C.boosters || [];
    h += '<p class="tnote">Les boosters des shows, des promotions et le booster gratuit sont automatiques. Ici, tes boosters spéciaux.</p><button class="btn small" style="margin:0 16px" data-act="tcgmboost" data-id="">＋ Créer un booster</button><div class="list" style="margin-top:8px">' +
      L.filter(b => !b.del).map(b => '<button class="item" data-act="tcgmboost" data-id="' + esc(b.id) + '"><span class="lbl"><b>' + esc(b.t) + "</b><small>" + (b.n || 3) + " cartes · " + (b.gim || 5) + " gimmicks · " + (b.cards && b.cards.length ? b.cards.length + " cartes choisies" : "auto" + (b.k ? " (" + esc(b.k) + ")" : "")) + (b.on === false ? " · caché" : "") + '</small></span><span class="chev">›</span></button>').join("") + "</div>";
  }
  if (tab === "combats") {
    const F = C.fight || {}, allow = F.allow || [], deny = F.deny || [];
    const ples = Object.keys(S.highlights || {}).filter(k => k.split("|")[1] === "PLE" && (S.highlights[k].res || []).length).sort((a, b) => b.split("|")[2].localeCompare(a.split("|")[2])).slice(0, 40);
    h += '<form class="tmform" data-form="tcgfightcfg"><label>Difficulté de l’IA (×) <input name="ai" type="number" step="0.1" min="0.3" max="2" value="' + (F.ai || 1) + '"></label><label>Attente entre deux combats (min) <input name="cool" type="number" min="1" value="' + (F.cool || 60) + '"></label><button class="btn">Enregistrer</button></form>' +
      '<p class="tnote">PLE / PPV passés : ✅ = toujours disponible en combat (même après 7 jours), ⛔ = retiré.</p><div class="list">' + ples.map(k => '<div class="item"><span class="lbl"><b>' + esc(showKeyLabel(k)) + "</b><small>" + esc(k.split("|")[0]) + '</small></span><span class="repbtns"><button class="chip' + (allow.indexOf(k) >= 0 ? " on" : "") + '" data-act="tcgmple" data-k="' + esc(k) + '" data-m="allow">✅</button><button class="chip' + (deny.indexOf(k) >= 0 ? " on" : "") + '" data-act="tcgmple" data-k="' + esc(k) + '" data-m="deny">⛔</button></span></div>').join("") + "</div>";
  }
  if (tab === "sons") {
    const bg = C.bgm || {}, as = C.assets || {};
    h += '<div class="list">' + [["win", "🎵 Musique de victoire"], ["lose", "🎵 Musique de défaite"], ["fight", "🎵 Musique des combats"], ["bell", "🔔 Cloche du ring"], ["hit", "👊 Bruit des coups"], ["finisher", "🔥 Son du finisher"], ["taunt", "😤 Provocation / pop du public"], ["crowd", "📣 Ambiance du public (en boucle)"]].map(x => '<div class="item"><span class="lbl"><b>' + x[1] + "</b><small>" + esc(bg[x[0]] || "Par défaut (son fabriqué par l’app)") + "</small>" + (bg[x[0]] ? '<audio controls preload="none" src="' + esc(bg[x[0]]) + '"></audio>' : "") + '</span><span class="repbtns"><button class="btn small" data-act="tcgmsnd" data-k="' + x[0] + '">Choisir un MP3</button>' + (bg[x[0]] ? '<button class="btn small ghost" data-act="tcgmsnd" data-k="' + x[0] + '" data-del="1">Retirer</button>' : "") + "</span></div>").join("") +
      '<div class="item"><span class="lbl"><b>🏟️ Fond des combats</b><small>' + esc(as.fightbg || "Par défaut : noir") + '</small></span><span class="repbtns"><button class="btn small" data-act="tcgmasset" data-k="fightbg">Choisir une image</button></span></div>' +
      '<div class="item"><span class="lbl"><b>🂠 Dos des cartes</b><small>' + esc(as.back || "Par défaut : TCCCG") + '</small></span><span class="repbtns"><button class="btn small" data-act="tcgmasset" data-k="back">Choisir une image</button></span></div>' +
      '<div class="item"><span class="lbl"><b>🎴 Fond des boosters</b><small>' + esc(as.booster || "Par défaut : couleurs de la promotion") + '</small></span><span class="repbtns"><button class="btn small" data-act="tcgmasset" data-k="booster">Choisir une image</button></span></div></div>';
  }
  return h;
}
ACT.tcgmt = el => { tab = el.dataset.t || ""; changed("tcg"); };
document.addEventListener("input", e => { if (e.target.id === "tmq") { q = e.target.value; const g = document.querySelector(".trgrid"); if (g) g.innerHTML = baseCards().filter(c => !q || norm(c.name).indexOf(norm(q)) >= 0).slice(0, 60).map(c => cardHTML(c, { small: true, act: "tcgmedit" })).join(""); } });

// ---------- modifier une carte ----------
ACT.tcgmedit = el => {
  const c = cardById(el.dataset.c); if (!c) return;
  const ov = Object.assign({}, (cfg().cards || {})[c.id] || {}), custom = (cfg().custom || []).find(x => x.id === c.id);
  modal((box, close) => {
    box.innerHTML = '<div class="tczoom">' + cardHTML(c) + "</div><form class=\"tmform\" data-mf>" +
      '<label>Rareté de base<select name="r">' + RAR.map(r => "<option" + (r === c.r ? " selected" : "") + ">" + r + "</option>").join("") + "</select></label>" +
      '<label>Rareté max<select name="max">' + RAR.map(r => "<option" + (r === c.max ? " selected" : "") + ">" + r + "</option>").join("") + "</select></label>" +
      '<label>Archétype<select name="arch">' + ARCHS.map(a => "<option" + (a === c.arch ? " selected" : "") + ">" + a + "</option>").join("") + "</select></label>" +
      '<label>Alignement<select name="al">' + [["", "–"], ["face", "Face"], ["heel", "Heel"], ["tweener", "Tweener"]].map(a => '<option value="' + a[0] + '"' + (a[0] === c.al ? " selected" : "") + ">" + a[1] + "</option>").join("") + "</select></label>" +
      STATS.map((s, i) => '<label>' + s + ' <input name="s' + i + '" type="number" min="1" value="' + c.st[i] + '"></label>').join("") +
      '<label>Finisher<input name="fn" maxlength="40" value="' + esc(c.fin.n) + '"></label><label>Effet<select name="fe">' + FX.map(f => "<option" + (f === c.fin.e ? " selected" : "") + ">" + f + "</option>").join("") + "</select></label>" +
      '<label>Gimmick / version<input name="gim" maxlength="40" value="' + esc(c.gimmick || "") + '"></label>' +
      '<label>Médailles pour l’éveil LR (catcheur)<input name="md" maxlength="60" value="' + esc(c.medalOf || "") + '"></label>' +
      '<label>Boosters spéciaux (identifiants, séparés par des virgules)<input name="bo" value="' + esc((c.boosters || []).join(", ")) + '"></label>' +
      '<label class="chk"><input type="checkbox" name="hide"' + (ov.hide ? " checked" : "") + "> Masquer la carte</label>" +
      '<div class="btns"><button type="button" class="btn small ghost" data-buff="-5">📉 Nerf −5 %</button><button type="button" class="btn small ghost" data-buff="5">📈 Buff +5 %</button><span class="tnote">Actuel : ' + (ov.buff || 0) + ' %</span></div>' +
      '<div class="btns"><button type="button" class="btn small ghost" data-img>🖼️ Changer l’image</button>' + (ov.img ? '<button type="button" class="btn small ghost" data-noimg>Image d’origine</button>' : "") + "</div>" +
      '<button class="btn wide">Enregistrer</button>' + (custom ? '<button type="button" class="btn wide ghost danger" data-del>Supprimer ce personnage</button>' : "") + '</form><button class="btn wide ghost" style="margin-top:8px" data-close>Fermer</button>';
    const target = d => { if (custom) { d.custom = d.custom || []; let x = d.custom.find(y => y.id === c.id); if (!x) { x = { id: c.id }; d.custom.push(x); } return x; } d.cards = d.cards || {}; d.cards[c.id] = d.cards[c.id] || {}; return d.cards[c.id]; };
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return close();
      const bf = e.target.closest("[data-buff]");
      if (bf) { close(); return run(d => { const t = target(d); t.buff = (+t.buff || 0) + +bf.dataset.buff; delete t.st; }, (+bf.dataset.buff > 0 ? "buff " : "nerf ") + c.name); }
      if (e.target.closest("[data-img]")) return pickFile("image/*", "img/tcg/", path => run(d => { target(d).img = path; }, "image de " + c.name).then(close));
      if (e.target.closest("[data-noimg]")) { close(); return run(d => { delete target(d).img; }, "image d’origine de " + c.name); }
      if (e.target.closest("[data-del]")) { close(); return run(d => { d.custom = (d.custom || []).filter(x => x.id !== c.id); }, "personnage supprimé : " + c.name); }
    });
    box.querySelector("[data-mf]").addEventListener("submit", ev => {
      ev.preventDefault(); const f = ev.target, st = [0, 1, 2, 3, 4].map(i => +f["s" + i].value || 1);
      const changedSt = st.some((v, i) => v !== c.st[i]);
      close();
      run(d => { const t = target(d); t.r = f.r.value; t.max = f.max.value; t.arch = f.arch.value; t.al = f.al.value; if (changedSt) t.st = st; t.fin = { n: f.fn.value.trim(), e: f.fe.value }; t.gimmick = f.gim.value.trim(); t.medalOf = f.md.value.trim(); const bo = f.bo.value.split(",").map(x => x.trim()).filter(Boolean); if (bo.length) t.boosters = bo; else delete t.boosters; if (f.hide.checked) t.hide = true; else delete t.hide; }, "carte " + c.name);
    });
  });
};
ACT.tcgmperso = () => {
  modal((box, close) => {
    box.innerHTML = '<h3>Nouveau personnage</h3><form class="tmform" data-pf><label>Nom<input name="n" required maxlength="40"></label><label>Rôle (manager, jobber, célébrité…)<input name="g" maxlength="30"></label>' +
      '<label>Promotion<select name="k"><option value="">–</option>' + Object.keys(S.P).map(k => "<option>" + esc(k) + "</option>").join("") + '</select></label><label>Archétype<select name="arch">' + ARCHS.map(a => "<option>" + a + "</option>").join("") + "</select></label>" +
      '<p class="tnote">L’image se choisit après, en touchant la carte.</p><button class="btn wide">Créer</button></form><button class="btn wide ghost" style="margin-top:8px" data-close>Annuler</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-close]")) close(); });
    box.querySelector("[data-pf]").addEventListener("submit", ev => { ev.preventDefault(); const f = ev.target, n = f.n.value.trim(); if (!n) return; close();
      run(d => { d.custom = d.custom || []; d.custom.push({ id: "oc-" + norm(n).replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString(36).slice(-4), name: n, gimmick: f.g.value.trim(), k: f.k.value, arch: f.arch.value, r: "N", max: "R" }); }, "nouveau personnage " + n); });
  });
};
FORM.tcgrates = f => run(d => { d.rates = {}; RAR.forEach(r => { d.rates[r] = Math.max(0, +f[r].value || 0); }); }, "taux d’apparition");
FORM.tcgfightcfg = f => run(d => { d.fight = Object.assign({}, d.fight || {}, { ai: +f.ai.value || 1, cool: Math.max(1, +f.cool.value || 60) }); }, "réglages des combats");
ACT.tcgmratesreset = () => run(d => { delete d.rates; }, "taux de départ");
ACT.tcgmple = el => run(d => { d.fight = d.fight || {}; const m = el.dataset.m, o = m === "allow" ? "deny" : "allow"; d.fight[m] = d.fight[m] || []; d.fight[o] = (d.fight[o] || []).filter(k => k !== el.dataset.k); const i = d.fight[m].indexOf(el.dataset.k); if (i >= 0) d.fight[m].splice(i, 1); else d.fight[m].push(el.dataset.k); }, "PLE en combat");
ACT.tcgmsnd = el => { const k = el.dataset.k; if (el.dataset.del) return run(d => { d.bgm = d.bgm || {}; delete d.bgm[k]; }, "musique retirée"); pickFile("audio/*", "media/tcg/", path => run(d => { d.bgm = d.bgm || {}; d.bgm[k] = path; }, "musique " + k)); };
ACT.tcgmasset = el => pickFile("image/*", "img/tcg/", path => run(d => { d.assets = d.assets || {}; d.assets[el.dataset.k] = path; }, "image " + el.dataset.k));
// ---------- objets ----------
ACT.tcgmitem = el => {
  const id = el.dataset.id, x = id ? items().find(i => i.id === id) || {} : { t: "combat", fx: "dmg", v: 20, ic: "🎁" }, isBase = ITEMS0.some(i => i.id === id);
  modal((box, close) => {
    box.innerHTML = "<h3>" + (id ? "Modifier l’objet" : "Nouvel objet") + '</h3><form class="tmform" data-if><label>Nom<input name="n" required maxlength="40" value="' + esc(x.n || "") + '"></label><label>Icône (emoji)<input name="ic" maxlength="4" value="' + esc(x.ic || "🎁") + '"></label>' +
      '<label>Type<select name="t"><option value="combat"' + (x.t === "combat" ? " selected" : "") + '>Combat (utilisable en match)</option><option value="eveil"' + (x.t === "eveil" ? " selected" : "") + ">Éveil</option></select></label>" +
      '<label>Rang (éveil)<select name="g">' + ["", "C", "R", "E", "L", "M"].map(g => "<option" + (g === (x.g || "") ? " selected" : "") + ">" + g + "</option>").join("") + "</select></label>" +
      '<label>Effet (combat)<select name="fx">' + [["dmg", "Dégâts"], ["heal", "Soin"], ["fin", "Barre de Finisher"], ["boost", "Boost (×)"], ["reveal", "Révèle les cases"]].map(o => '<option value="' + o[0] + '"' + (o[0] === x.fx ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select></label>" +
      '<label>Valeur<input name="v" type="number" step="0.1" value="' + esc(x.v != null ? x.v : 20) + '"></label><label>Prix au Shop (💵)<input name="price" type="number" min="0" value="' + esc(x.price || "") + '"></label>' +
      '<label>Chance de drop en combat (%)<input name="drop" type="number" step="0.1" min="0" value="' + esc(x.drop != null ? x.drop : "") + '"></label><label>Description<input name="d" maxlength="120" value="' + esc(x.d || "") + '"></label>' +
      '<label class="chk"><input type="checkbox" name="shop"' + (x.shop === false ? "" : " checked") + "> Vendu au Shop</label>" +
      '<button class="btn wide">Enregistrer</button>' + (id ? '<button type="button" class="btn wide ghost danger" data-del>Supprimer</button>' : "") + '</form><button class="btn wide ghost" style="margin-top:8px" data-close>Fermer</button>';
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return close();
      if (e.target.closest("[data-del]")) { close(); run(d => { if (isBase) { d.items = d.items || {}; d.items[id] = Object.assign({}, d.items[id] || {}, { del: true }); } else d.itemsNew = (d.itemsNew || []).filter(i => i.id !== id); }, "objet supprimé"); }
    });
    box.querySelector("[data-if]").addEventListener("submit", e => {
      e.preventDefault(); const f = e.target;
      const rec = { n: f.n.value.trim(), ic: f.ic.value.trim() || "🎁", t: f.t.value, g: f.g.value, fx: f.fx.value, v: +f.v.value, d: f.d.value.trim(), shop: f.shop.checked };
      if (f.price.value) rec.price = +f.price.value; if (f.drop.value !== "") rec.drop = +f.drop.value;
      close();
      run(d => { if (isBase) { d.items = d.items || {}; d.items[id] = rec; } else { d.itemsNew = d.itemsNew || []; const nid = id || "o-" + Date.now().toString(36); const i = d.itemsNew.findIndex(o => o.id === nid); const full = Object.assign({ id: nid }, rec); if (i >= 0) d.itemsNew[i] = full; else d.itemsNew.push(full); } }, "objet " + rec.n);
    });
  });
};
// ---------- boosters ----------
ACT.tcgmboost = el => {
  const id = el.dataset.id, b = id ? (cfg().boosters || []).find(x => x.id === id) || {} : { n: 3, gim: 5, on: true };
  modal((box, close) => {
    box.innerHTML = "<h3>" + (id ? "Modifier le booster" : "Nouveau booster") + '</h3><form class="tmform" data-bf><label>Nom<input name="t" required maxlength="40" value="' + esc(b.t || "") + '"></label>' +
      '<label>Nombre de cartes<input name="n" type="number" min="1" max="15" value="' + (b.n || 3) + '"></label><label>Prix (gimmicks)<input name="gim" type="number" min="0" value="' + (b.gim != null ? b.gim : 5) + '"></label>' +
      '<label>Promotion (cartes automatiques)<select name="k"><option value="">Toutes</option>' + Object.keys(S.P).map(k => "<option" + (k === b.k ? " selected" : "") + ">" + esc(k) + "</option>").join("") + "</select></label>" +
      '<label>Cartes choisies à la main (noms séparés par des virgules ; vide = automatique)<textarea name="cards" rows="3">' + esc((b.cards || []).join(", ")) + "</textarea></label>" +
      '<label>Description<input name="sub" maxlength="80" value="' + esc(b.sub || "") + '"></label><label class="chk"><input type="checkbox" name="on"' + (b.on === false ? "" : " checked") + "> Visible par les joueurs</label>" +
      '<div class="btns"><button type="button" class="btn small ghost" data-img>🖼️ Image du booster</button>' + (b.img ? '<small class="tnote">' + esc(b.img) + "</small>" : "") + "</div>" +
      '<button class="btn wide">Enregistrer</button>' + (id ? '<button type="button" class="btn wide ghost danger" data-del>Supprimer</button>' : "") + '</form><button class="btn wide ghost" style="margin-top:8px" data-close>Fermer</button>';
    let img = b.img || "";
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return close();
      if (e.target.closest("[data-img]")) return pickFile("image/*", "img/tcg/", p => { img = p; toast("Image prête, pense à enregistrer"); });
      if (e.target.closest("[data-del]")) { close(); run(d => { d.boosters = (d.boosters || []).filter(x => x.id !== id); }, "booster supprimé"); }
    });
    box.querySelector("[data-bf]").addEventListener("submit", e => {
      e.preventDefault(); const f = e.target, nid = id || "b-" + Date.now().toString(36);
      const rec = { id: nid, t: f.t.value.trim(), n: Math.min(15, Math.max(1, +f.n.value || 3)), gim: Math.max(0, +f.gim.value || 0), k: f.k.value, cards: f.cards.value.split(",").map(x => x.trim()).filter(Boolean), sub: f.sub.value.trim(), on: f.on.checked, img: img };
      close();
      run(d => { d.boosters = d.boosters || []; const i = d.boosters.findIndex(x => x.id === nid); if (i >= 0) d.boosters[i] = rec; else d.boosters.push(rec); }, "booster " + rec.t);
    });
  });
};
