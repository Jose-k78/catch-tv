// TCCCG — ceintures (objets « belt:<idTitre> ») et évolution par ceinture (11 nov., demande de Jose).
// Donner une ceinture que le catcheur a vraiment tenue transforme SA carte (une seule carte : même niveau, même rareté),
// avec un bonus de stats selon le prestige du titre et un pouvoir tiré au hasard. La ceinture est perdue ; pour reprendre
// une ancienne forme, il faut redonner sa ceinture. Le modo règle chaque évolution (nom, image, stats, pouvoir, retirer, ajouter).
import { S, ACT, changed } from "../state.js";
import { esc, toast, modal } from "../util.js";
import { beltOf } from "../assets.js";
import { parisDay } from "../time.js";
import { norm } from "../wrestlers.js";
import { cfg, defOf, cardById, baseId, evolutionsOf, evoDef, titleById, prestige, EVO_BONUS, EVO_NAME, POWERS, randomPower, STATS, items, itemById } from "./data.js";
import { me, commit, owned, bump } from "./store.js";
import { rays, burst, flash, fireworks, mid } from "./phaser.js";
import { cardHTML } from "./card.js";
import { SFX } from "./sfx.js";
import { saveCfg, bankPick } from "./modo.js";

export const BELT = "belt:";
export const isBelt = id => String(id || "").indexOf(BELT) === 0;
export const beltTitle = id => titleById(String(id).slice(BELT.length));
export const beltLabel = id => { const t = beltTitle(id); return t ? t.n : "Ceinture"; };
export const beltImgHTML = (tid, cls) => { const img = beltOf(tid); return img ? '<img class="' + (cls || "tbeltimg") + '" src="' + esc(img) + '" alt="" loading="lazy">' : '<span class="' + (cls || "tbeltimg") + ' e">🏆</span>'; };
// chances de gagner une ceinture en combat (avant le bonus de difficulté)
export const BELT_DROP = { low: 0.05, mid: 0.1, top: 0.18, duel: 0 };
export const BELT_PRICE = { world: 25000, sec: 12000, tag: 9000 };
export const beltPrice = t => +((cfg().beltPrice || {})[t.id]) || BELT_PRICE[prestige(t)];
// ceintures de la boutique : 4 par jour (heure de Paris), elles changent toutes les 24 h
export function dailyBelts() {
  const T = (S.titles || []).filter(t => beltOf(t.id)); if (!T.length) return [];
  let h = 0; for (const c of parisDay()) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  const out = []; for (let i = 0; out.length < Math.min(4, T.length) && i < 60; i++) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; const t = T[h % T.length]; if (out.indexOf(t) < 0) out.push(t); }
  return out;
}
// ceinture gagnée en combat : une de la promotion du show (sinon au hasard)
export function dropBelt(k) {
  const T = S.titles || [], L = T.filter(t => !k || t.k === k || (t.also || []).indexOf(k) >= 0), P = L.length ? L : T;
  return P.length ? BELT + P[Math.floor(Math.random() * P.length)].id : "";
}
export const myBelts = d => Object.keys(d.items || {}).filter(k => isBelt(k) && d.items[k] > 0 && beltTitle(k));

// ---------- onglet Objets : ceintures (qui peut la porter), médailles, objets ----------
export function beltsSection(d) {
  const B = myBelts(d), L = owned(d);
  if (!B.length) return "<h2>Ceintures</h2>" + '<p class="tnote">Gagne des ceintures en combat (Low, Mid, Top : de plus en plus de chances) ou achète celles du jour au Shop. Une ceinture fait évoluer un catcheur qui l’a vraiment tenue.</p>';
  return "<h2>Ceintures</h2>" + '<div class="tbelts">' + B.map(k => {
    const t = beltTitle(k), who = L.filter(x => evolutionsOf(x.c).some(e => e.t && e.t.id === t.id) && x.c !== baseId(x.c) + "~" + t.id);
    return '<div class="tbelt">' + beltImgHTML(t.id) + '<div><b>' + esc(t.n) + " ×" + d.items[k] + "</b><small>" + esc(t.k) + " · " + EVO_NAME[prestige(t)] + "</small>" +
      (who.length ? '<div class="tbwho">' + who.slice(0, 6).map(x => '<button class="chip" data-act="tcgevo" data-iid="' + esc(x.iid) + '">' + esc(defOf(x.c).name) + " ›</button>").join("") + "</div>" : '<small class="tnote">Aucune de tes cartes ne peut la porter pour l’instant.</small>') + "</div></div>";
  }).join("") + "</div>";
}

// ---------- l'arbre d'évolution d'une carte du joueur (façon Pokémon / Digimon) ----------
// conditions (1 à 3) : ceinture, objet, médailles, niveau, victoires ; ceinture, objet et médailles sont utilisés.
const medName = (b, c) => (c.med && c.med.n) || b.name;
export function condList(d, inst, e) {
  const b = cardById(baseId(inst.c)), c = e.cond || {}, L = [];
  if (c.belt) { const t = titleById(c.belt); L.push({ ok: (d.items[BELT + c.belt] || 0) > 0, t: "🏆 Ceinture " + (t ? t.n : c.belt) + " (" + (d.items[BELT + c.belt] || 0) + ")" }); }
  if (c.item && c.item.id) { const it = itemById(c.item.id), q = +c.item.q || 1; L.push({ ok: (d.items[c.item.id] || 0) >= q, t: (it ? it.ic + " " + it.n : c.item.id) + " ×" + q + " (" + (d.items[c.item.id] || 0) + ")" }); }
  if (c.med && +c.med.q) { const n = medName(b, c); L.push({ ok: (d.medals[n] || 0) >= +c.med.q, t: "🏅 Médailles de " + n + " ×" + c.med.q + " (" + (d.medals[n] || 0) + ")" }); }
  if (+c.lv) L.push({ ok: (inst.lv || 1) >= +c.lv, t: "⭐ Niveau " + c.lv + " (" + (inst.lv || 1) + ")" });
  if (+c.wins) L.push({ ok: (d.wins || 0) >= +c.wins, t: "⚔️ " + c.wins + " victoires (" + (d.wins || 0) + ")" });
  return L;
}
ACT.tcgevo = el => {
  const iid = el.dataset.iid; let armed = "";
  modal((box, close) => {
    box.classList.add("tbibox", "tevbox");
    const draw = () => {
      const d = me(), inst = d.cards[iid]; if (!inst) { close(); return; }
      const cur = defOf(inst.c), base = cardById(baseId(inst.c)); if (!base || !cur) { close(); return; }
      const E = evolutionsOf(base), root = { c: base.id, r: inst.r, lv: inst.lv };
      let h = '<h3>🌳 Arbre d’évolution</h3><p class="sub">' + esc(base.name) + " change de gimmick et de stats. La rareté reste " + inst.r + " ; le niveau revient à 1 (les bonus d’entraînement restent). Ceinture, objet et médailles demandés sont utilisés.</p>" +
        '<div class="tetree"><div class="tenode root' + (inst.c === base.id || (inst.c.indexOf("~") < 0) ? " on" : "") + '">' + cardHTML(root, { small: true }) + "<small>Forme de base</small></div>" +
        (E.length ? '<div class="tebranch">' + E.map(x => {
          const on = inst.c === x.id, ed = evoDef(base, x.k), C = condList(d, inst, x), ok = C.every(c => c.ok);
          return '<div class="tenode' + (on ? " on" : ok ? " ready" : "") + '"><i class="teline"></i>' + cardHTML({ c: x.id, r: inst.r, lv: 1 }, { small: true }) +
            "<b>" + (x.kind === "belt" ? beltImgHTML(x.t.id, "tebelt") + " " : "🎭 ") + esc(x.name) + "</b><small>" + (x.kind === "belt" ? EVO_NAME[ed.evoCls] + (x.year ? " · dès " + x.year : "") : "ancienne gimmick") + " · stats +" + ed.evoBonus + " %" + (ed.evoPw && POWERS[ed.evoPw] ? " · " + esc(POWERS[ed.evoPw][0]) : " · pouvoir au hasard") + "</small>" +
            '<ul class="tecond">' + C.map(c => '<li class="' + (c.ok ? "ok" : "no") + '">' + (c.ok ? "✓ " : "✗ ") + esc(c.t) + "</li>").join("") + "</ul>" +
            (on ? '<span class="tevon">✓ Forme actuelle</span>' : '<button class="btn small' + (ok ? " gold" : "") + '" data-g="' + esc(x.k) + '"' + (ok ? "" : " disabled") + ">" + (armed === x.k ? "Confirmer l’évolution" : "🌳 Évoluer") + "</button>") +
            (S.isAdmin ? '<button class="linkbtn" data-m="' + esc(x.k) + '">✏️ Régler (modo)</button>' : "") + "</div>";
        }).join("") + "</div>" : '<p class="tnote">Pas encore d’évolution pour ce catcheur.</p>') + "</div>";
      if (S.isAdmin) h += '<button class="btn wide ghost" data-madd>✏️ Évolutions de ce catcheur (modo)</button>';
      h += '<p class="tnote">Ceintures : en combat (si l’adversaire est champion en vrai) ou au Shop avec des médailles.</p><button class="btn wide ghost" data-close>Fermer</button>';
      box.innerHTML = h;
    };
    draw();
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return close();
      const d0 = me(), inst0 = d0.cards[iid]; if (!inst0) return close();
      if (e.target.closest("[data-madd]")) { close(); return evoModo(baseId(inst0.c)); }
      const m = e.target.closest("[data-m]"); if (m) { close(); return evoEdit(baseId(inst0.c), m.dataset.m); }
      const g = e.target.closest("[data-g]"); if (!g || g.disabled) return;
      const k = g.dataset.g; if (armed !== k) { armed = k; return draw(); }
      const base = cardById(baseId(inst0.c)), x = evolutionsOf(base).find(y => y.k === k); if (!x || !condList(d0, inst0, x).every(c => c.ok)) return;
      const before = Object.assign({ iid: iid }, inst0), nid = base.id + "~" + k, ed = evoDef(base, k), pw = ed.evoPw && POWERS[ed.evoPw] ? ed.evoPw : randomPower();
      let ok = false;
      commit(d => { const it = d.cards[iid]; if (!it || !condList(d, it, x).every(c => c.ok)) return; const c = x.cond || {};
        if (c.belt) d.items[BELT + c.belt]--;
        if (c.item && c.item.id) d.items[c.item.id] -= (+c.item.q || 1);
        if (c.med && +c.med.q) { const n = medName(base, c); d.medals[n] -= +c.med.q; if (d.medals[n] <= 0) delete d.medals[n]; }
        it.c = nid; it.pw = pw; it.lv = 1; it.xp = 0; bump(d, "evo"); ok = true; });
      if (!ok) return;
      close(); evoFx(before, { iid: iid, c: nid, r: before.r, lv: 1, xp: 0, pw: pw, tr: before.tr, trn: before.trn, eq: before.eq });
    });
  });
};
// animation d'évolution (Phaser) : l'ancienne carte tremble et s'illumine, rayons, flash, la nouvelle forme apparaît
function evoFx(before, after) {
  const ov = document.createElement("div"); ov.className = "tevfx";
  ov.innerHTML = '<div class="tevstage"><div class="tevcard old">' + cardHTML(before, { nozoom: true }) + '</div></div><p class="tphint">Touche pour continuer</p>';
  document.body.appendChild(ov); SFX.unlock(); SFX.bell(1);
  let stop = null; rays(innerWidth / 2, innerHeight * 0.45, true, 0).then(f => { stop = f; });
  setTimeout(() => ov.classList.add("charge"), 200);
  setTimeout(() => { ov.classList.add("flash"); flash(0xffffff, 600); SFX.finisher(); }, 1500);
  setTimeout(() => {
    const k = after.c.split("~")[1], t = k.indexOf("g-") === 0 ? null : titleById(k);
    ov.querySelector(".tevstage").innerHTML = '<div class="tevtitle">ÉVOLUTION !</div><div class="tevcard new">' + cardHTML(after, { nozoom: true }) + "</div>" +
      '<p class="tevpw">' + (t ? beltImgHTML(t.id, "tevbelt") : "") + (POWERS[after.pw] ? "<span>Nouveau pouvoir ✦ <b>" + esc(POWERS[after.pw][0]) + "</b><br><small>" + esc(POWERS[after.pw][1]) + "</small></span>" : "") + "</p>";
    const c = ov.querySelector(".tevcard.new"); if (c) { const p = mid(c); burst(p[0], p[1], 70); } fireworks(3);
    ov.classList.add("tevok"); SFX.crowd(true); setTimeout(() => SFX.crowd(false), 2500);
  }, 1900);
  ov.addEventListener("click", () => { if (!ov.classList.contains("tevok")) return; if (stop) stop(); ov.remove(); changed("tcg"); });
}

// ---------- modo : évolutions d'un catcheur ----------
const slugK = n => "g-" + String(n || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
export function evoModo(bid) {
  const b = cardById(bid); if (!b || !S.isAdmin) return;
  modal((box, close) => {
    box.classList.add("tbibox");
    const draw = () => {
      const C = cfg(), ov = C.evo || {}, E = evolutionsOf(b), off = Object.keys(ov).filter(k => k.indexOf(bid + "|") === 0 && ov[k].off).map(k => k.split("|")[1]);
      box.innerHTML = "<h3>Évolutions de " + esc(b.name) + '</h3><p class="sub">Automatique : les ceintures qu’il a tenues et ses anciennes gimmicks (catcheurs fusionnés). Tu peux régler, retirer ou ajouter des évolutions, et choisir 1 à 3 conditions.</p>' +
        '<div class="list">' + E.map(x => '<div class="item">' + (x.kind === "belt" ? beltImgHTML(x.t.id) : '<span class="tbeltimg e">🎭</span>') + '<span class="lbl"><b>' + esc(x.name) + "</b><small>" + (x.kind === "belt" ? esc(x.t.k) + (x.year ? " · " + x.year : " · ajoutée par toi") : "gimmick") + '</small></span><button class="btn small ghost" data-e="' + esc(x.k) + '">✏️</button></div>').join("") + "</div>" +
        (off.length ? "<h4>Retirées</h4>" + '<div class="tfilt">' + off.map(id => { const t = titleById(id); return '<button class="chip" data-on="' + esc(id) + '">↩ ' + esc(t ? t.n : id.replace(/^g-/, "")) + "</button>"; }).join("") + "</div>" : "") +
        '<h4>＋ Ajouter une ceinture</h4><select id="evadd" style="width:100%"><option value="">Choisir une ceinture…</option>' + (S.titles || []).filter(t => !E.some(x => x.t && x.t.id === t.id)).map(t => '<option value="' + esc(t.id) + '">' + esc(t.k + " · " + t.n) + "</option>").join("") + "</select>" +
        '<button class="btn wide" style="margin-top:8px" data-add>Ajouter la ceinture</button>' +
        '<h4>＋ Ajouter une gimmick</h4><input id="evgim" maxlength="40" placeholder="Nom de la gimmick (ex. : The Fiend)" style="width:100%"><button class="btn wide" style="margin-top:8px" data-addg>Ajouter la gimmick</button>' +
        '<button class="btn wide ghost" style="margin-top:6px" data-close>Fermer</button>';
    };
    const save = (fn, msg) => saveCfg(fn, msg).then(ok => { if (ok) { toast("Enregistré ✓"); draw(); } }).catch(er => toast("Pas enregistré : " + ((er && er.message) || "")));
    draw();
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return close();
      const ed = e.target.closest("[data-e]"); if (ed) { close(); return evoEdit(bid, ed.dataset.e); }
      const on = e.target.closest("[data-on]"); if (on) return save(d => { d.evo = d.evo || {}; const k = bid + "|" + on.dataset.on; if (d.evo[k]) delete d.evo[k].off; }, "évolution rétablie : " + b.name);
      if (e.target.closest("[data-add]")) { const id = box.querySelector("#evadd").value; if (!id) return; return save(d => { d.evoAdd = d.evoAdd || {}; const L = d.evoAdd[bid] = d.evoAdd[bid] || []; if (L.indexOf(id) < 0) L.push(id); d.evo = d.evo || {}; const k = bid + "|" + id; if (d.evo[k]) delete d.evo[k].off; }, "évolution ajoutée : " + b.name); }
      if (e.target.closest("[data-addg]")) { const n = box.querySelector("#evgim").value.trim(); if (!n) return; const k = slugK(n); return save(d => { d.evoG = d.evoG || {}; const L = d.evoG[bid] = d.evoG[bid] || []; if (!L.find(x => x.k === k)) L.push({ k: k, name: n }); d.evo = d.evo || {}; if (d.evo[bid + "|" + k]) delete d.evo[bid + "|" + k].off; }, "gimmick ajoutée : " + b.name + " / " + n); }
    });
  });
}
ACT.tcgmevo = el => evoModo(String(el.dataset.c || "").split(/[@#~]/)[0]);
// modo : régler une évolution (nom, années, gimmick, image, bonus, stats, pouvoir, conditions) ou la retirer
export function evoEdit(bid, k) {
  const b = cardById(bid), x = b && evolutionsOf(b).find(y => y.k === k); if (!b || !x || !S.isAdmin) return;
  const key = bid + "|" + k, ov = Object.assign({}, (cfg().evo || {})[key] || {}), ed = evoDef(b, k), cd = x.cond || {}, isBeltE = x.kind === "belt";
  const eqs = items().filter(it => it.t !== "equip");
  modal((box, close) => {
    box.classList.add("tbibox");
    box.innerHTML = '<div class="tczoom">' + cardHTML({ c: ed.id, r: b.max, lv: 1 }) + "</div><h3>" + esc(x.name) + '</h3><form class="tmform" data-ef>' +
      '<label>Nom sur la carte<input name="nm" maxlength="40" value="' + esc(ov.name || "") + '" placeholder="' + esc(ed.name) + '"></label>' +
      '<label>Années / date<input name="yr" maxlength="24" value="' + esc(ov.years || "") + '" placeholder="' + esc(ed.years || "") + '"></label>' +
      '<label>Gimmick / version<input name="gm" maxlength="60" value="' + esc(ov.gimmick || "") + '" placeholder="' + esc(ed.gimmick) + '"></label>' +
      '<label>Bonus de stats (%) — vide = ' + ed.evoBonus + ' %<input name="bo" type="number" min="-50" max="200" value="' + esc(ov.bonus != null ? ov.bonus : "") + '"></label>' +
      '<div class="tmstats">' + STATS.map((st, i) => '<label>' + st.slice(0, 3) + '<input name="s' + i + '" type="number" min="1" max="999" value="' + esc(Array.isArray(ov.st) ? ov.st[i] : "") + '" placeholder="' + ed.st[i] + '"></label>').join("") + '</div><p class="tnote">Stats vides = calculées toutes seules.</p>' +
      '<label>Pouvoir<select name="pw"><option value="">Au hasard (à chaque évolution)</option>' + Object.keys(POWERS).map(p => '<option value="' + p + '"' + (ov.pw === p ? " selected" : "") + ">" + esc(POWERS[p][0] + " — " + POWERS[p][1]) + "</option>").join("") + "</select></label>" +
      "<h4>Conditions (1 à 3)</h4>" + (isBeltE ? '<p class="tnote">🏆 La ceinture ' + esc(x.t.n) + " (toujours demandée)</p>" : "") +
      '<div class="tmstats"><label>Niveau<input name="clv" type="number" min="0" max="150" value="' + esc(cd.lv || "") + '"></label><label>Victoires<input name="cwi" type="number" min="0" max="999" value="' + esc(cd.wins || "") + '"></label><label>Médailles<input name="cmq" type="number" min="0" max="50" value="' + esc((cd.med && cd.med.q) || "") + '"></label></div>' +
      '<label>Médailles de (vide = ' + esc(b.name) + ')<input name="cmn" maxlength="40" value="' + esc((cd.med && cd.med.n) || "") + '"></label>' +
      '<label>Objet<select name="cit"><option value="">Aucun</option>' + eqs.map(it => '<option value="' + esc(it.id) + '"' + (cd.item && cd.item.id === it.id ? " selected" : "") + ">" + esc(it.ic + " " + it.n) + "</option>").join("") + '</select></label><label>Nombre d’objets<input name="ciq" type="number" min="1" max="20" value="' + esc((cd.item && cd.item.q) || 1) + '"></label>' +
      '<div class="btns"><button type="button" class="btn small ghost" data-img>🖼️ Image de l’évolution</button>' + (ov.img ? '<button type="button" class="btn small ghost" data-noimg>Retirer l’image</button>' : "") + "</div>" +
      '<button class="btn wide">Enregistrer</button><button type="button" class="btn wide ghost danger" data-off>Retirer cette évolution</button><button type="button" class="btn wide ghost" data-close>Fermer</button></form>';
    const save = (fn, msg) => saveCfg(d => { d.evo = d.evo || {}; const o = d.evo[key] = d.evo[key] || {}; fn(o); if (!Object.keys(o).length) delete d.evo[key]; }, msg).then(ok => { if (ok) toast("Enregistré ✓"); }).catch(er => toast("Pas enregistré : " + ((er && er.message) || "")));
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return close();
      if (e.target.closest("[data-off]")) { close(); return save(o => { o.off = true; }, "évolution retirée : " + b.name + " / " + x.name); }
      if (e.target.closest("[data-noimg]")) { close(); return save(o => { delete o.img; }, "image d’évolution retirée"); }
      if (e.target.closest("[data-img]")) { close(); return bankPick(b, "Image de " + b.name + " · " + x.name, v => save(o => { if (v === null || v === "-") delete o.img; else o.img = v; }, "image d’évolution : " + b.name), false); }
    });
    box.addEventListener("submit", e => {
      e.preventDefault(); const f = e.target, st = STATS.map((s2, i) => +f["s" + i].value || 0);
      const cond = {}; if (+f.clv.value) cond.lv = +f.clv.value; if (+f.cwi.value) cond.wins = +f.cwi.value; if (+f.cmq.value) cond.med = Object.assign({ q: +f.cmq.value }, f.cmn.value.trim() ? { n: f.cmn.value.trim() } : {}); if (f.cit.value) cond.item = { id: f.cit.value, q: Math.max(1, +f.ciq.value || 1) };
      const n = Object.keys(cond).length + (isBeltE ? 1 : 0); if (n > 3) return toast("3 conditions au plus");
      if (!n) return toast("Mets au moins une condition");
      close();
      save(o => {
        const set = (kk, v) => { if (v === "" || v == null) delete o[kk]; else o[kk] = v; };
        set("name", f.nm.value.trim()); set("years", f.yr.value.trim()); set("gimmick", f.gm.value.trim()); set("bonus", f.bo.value === "" ? "" : +f.bo.value); set("pw", f.pw.value);
        if (st.every(v => v > 0)) o.st = st; else delete o.st;
        o.cond = cond;
      }, "évolution réglée : " + b.name + " / " + x.name);
    });
  });
}
// recherche rapide pour l'objet d'une ceinture dans les récompenses
export const itemText = id => isBelt(id) ? "🏆 " + beltLabel(id) : "";
export const beltOwnersFilter = q => (S.titles || []).filter(t => !q || norm(t.n).indexOf(norm(q)) >= 0);
