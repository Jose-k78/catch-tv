// TCCCG — ceintures (objets « belt:<idTitre> ») et évolution par ceinture (11 nov., demande de Jose).
// Donner une ceinture que le catcheur a vraiment tenue transforme SA carte (une seule carte : même niveau, même rareté),
// avec un bonus de stats selon le prestige du titre et un pouvoir tiré au hasard. La ceinture est perdue ; pour reprendre
// une ancienne forme, il faut redonner sa ceinture. Le modo règle chaque évolution (nom, image, stats, pouvoir, retirer, ajouter).
import { S, ACT, changed } from "../state.js";
import { esc, toast, modal } from "../util.js";
import { beltOf } from "../assets.js";
import { parisDay } from "../time.js";
import { norm } from "../wrestlers.js";
import { cfg, defOf, cardById, baseId, evolutionsOf, evoDef, titleById, prestige, EVO_BONUS, EVO_NAME, POWERS, randomPower, STATS } from "./data.js";
import { me, commit, owned } from "./store.js";
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
    const t = beltTitle(k), who = L.filter(x => evolutionsOf(x.c).some(e => e.t.id === t.id) && x.c !== baseId(x.c) + "~" + t.id);
    return '<div class="tbelt">' + beltImgHTML(t.id) + '<div><b>' + esc(t.n) + " ×" + d.items[k] + "</b><small>" + esc(t.k) + " · " + EVO_NAME[prestige(t)] + "</small>" +
      (who.length ? '<div class="tbwho">' + who.slice(0, 6).map(x => '<button class="chip" data-act="tcgevo" data-iid="' + esc(x.iid) + '">' + esc(defOf(x.c).name) + " ›</button>").join("") + "</div>" : '<small class="tnote">Aucune de tes cartes ne peut la porter pour l’instant.</small>') + "</div></div>";
  }).join("") + "</div>";
}

// ---------- l'arbre d'évolution d'une carte du joueur ----------
ACT.tcgevo = el => {
  const iid = el.dataset.iid; let armed = "";
  modal((box, close) => {
    box.classList.add("tbibox", "tevbox");
    const draw = () => {
      const d = me(), inst = d.cards[iid]; if (!inst) { close(); return; }
      const cur = defOf(inst.c), base = cardById(baseId(inst.c)); if (!base || !cur) { close(); return; }
      const E = evolutionsOf(base);
      let h = "<h3>🏆 Évolution par ceinture</h3><p class=\"sub\">Donne à " + esc(base.name) + " une ceinture déjà tenue en vrai : sa carte se transforme (même niveau, même rareté) et reçoit un pouvoir au hasard. La ceinture est perdue ; pour reprendre une ancienne forme, il faut redonner sa ceinture.</p>" +
        '<div class="tevtree"><div class="tevnode">' + cardHTML(Object.assign({ iid: iid }, inst), { small: true }) + "<small>" + (cur.evo ? "Forme actuelle" : "Forme de base") + "</small></div>" + (E.length ? '<div class="tevarrow">⬇</div>' : "") + "</div>";
      h += '<div class="tevlist">' + E.map(x => {
        const have = d.items[BELT + x.t.id] || 0, on = inst.c === x.id, ed = evoDef(base, x.t.id);
        return '<div class="tevrow' + (on ? " on" : "") + '">' + beltImgHTML(x.t.id) + '<div class="tevinfo"><b>' + esc(x.t.n) + "</b><small>" + esc(x.t.k) + (x.year ? " · tenu dès " + x.year : "") + "</small><small>" + EVO_NAME[ed.evoCls] + " · stats +" + ed.evoBonus + " %" + (ed.evoPw && POWERS[ed.evoPw] ? " · pouvoir : " + esc(POWERS[ed.evoPw][0]) : " · pouvoir au hasard") + "</small><small>Tes ceintures : ×" + have + "</small>" +
          (on ? '<span class="tevon">✓ Forme actuelle</span>' : '<button class="btn small" data-g="' + esc(x.t.id) + '"' + (have ? "" : " disabled") + ">" + (armed === x.t.id ? "Confirmer : donner la ceinture" : "🏆 Donner la ceinture") + "</button>") +
          (S.isAdmin ? '<button class="linkbtn" data-m="' + esc(x.t.id) + '">✏️ Régler (modo)</button>' : "") + "</div>" +
          '<div class="tevprev">' + cardHTML({ c: x.id, r: inst.r, lv: inst.lv }, { small: true }) + "</div></div>";
      }).join("") + "</div>";
      if (!E.length) h += '<p class="tnote">Ce catcheur n’a encore tenu aucune des ceintures de l’app.</p>';
      if (S.isAdmin) h += '<button class="btn wide ghost" data-madd>✏️ Évolutions de ce catcheur (modo)</button>';
      h += '<p class="tnote">Les ceintures se gagnent en combat ou s’achètent dans la boutique du jour (Shop).</p><button class="btn wide ghost" data-close>Fermer</button>';
      box.innerHTML = h;
    };
    draw();
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return close();
      const d0 = me(), inst0 = d0.cards[iid]; if (!inst0) return close();
      if (e.target.closest("[data-madd]")) { close(); return evoModo(baseId(inst0.c)); }
      const m = e.target.closest("[data-m]"); if (m) { close(); return evoEdit(baseId(inst0.c), m.dataset.m); }
      const g = e.target.closest("[data-g]"); if (!g || g.disabled) return;
      const tid = g.dataset.g; if (armed !== tid) { armed = tid; return draw(); }
      if (!(d0.items[BELT + tid] > 0)) return;
      const before = Object.assign({ iid: iid }, inst0), bid = baseId(inst0.c), nid = bid + "~" + tid, ed = evoDef(cardById(bid), tid), pw = ed.evoPw && POWERS[ed.evoPw] ? ed.evoPw : randomPower();
      commit(d => { const it = d.cards[iid]; if (!it || !(d.items[BELT + tid] > 0)) return; d.items[BELT + tid]--; it.c = nid; it.pw = pw; });
      close(); evoFx(before, { iid: iid, c: nid, r: before.r, lv: before.lv, xp: before.xp, pw: pw });
    });
  });
};
// animation : l'ancienne carte s'illumine, flash, la nouvelle forme apparaît avec son pouvoir
function evoFx(before, after) {
  const ov = document.createElement("div"); ov.className = "tevfx";
  ov.innerHTML = '<div class="tevstage"><div class="tevcard old">' + cardHTML(before, { nozoom: true }) + '</div></div><p class="tphint">Touche pour continuer</p>';
  document.body.appendChild(ov); SFX.unlock(); SFX.bell(1);
  setTimeout(() => ov.classList.add("charge"), 200);
  setTimeout(() => { ov.classList.add("flash"); SFX.finisher(); }, 1500);
  setTimeout(() => {
    const t = titleById(after.c.split("~")[1]);
    ov.querySelector(".tevstage").innerHTML = '<div class="tevtitle">ÉVOLUTION !</div><div class="tevcard new">' + cardHTML(after, { nozoom: true }) + "</div>" +
      '<p class="tevpw">' + (t ? beltImgHTML(t.id, "tevbelt") : "") + (POWERS[after.pw] ? "<span>Nouveau pouvoir ✦ <b>" + esc(POWERS[after.pw][0]) + "</b><br><small>" + esc(POWERS[after.pw][1]) + "</small></span>" : "") + "</p>";
    ov.classList.add("tevok"); SFX.crowd(true); setTimeout(() => SFX.crowd(false), 2500);
  }, 1900);
  ov.addEventListener("click", () => { if (!ov.classList.contains("tevok")) return; ov.remove(); changed("tcg"); });
}

// ---------- modo : évolutions d'un catcheur ----------
export function evoModo(bid) {
  const b = cardById(bid); if (!b || !S.isAdmin) return;
  modal((box, close) => {
    box.classList.add("tbibox");
    const draw = () => {
      const C = cfg(), ov = C.evo || {}, E = evolutionsOf(b), off = Object.keys(ov).filter(k => k.indexOf(bid + "|") === 0 && ov[k].off).map(k => k.split("|")[1]);
      box.innerHTML = "<h3>Évolutions de " + esc(b.name) + '</h3><p class="sub">Automatique : les ceintures qu’il a tenues (historique des titres). Tu peux régler, retirer ou ajouter des évolutions.</p>' +
        '<div class="list">' + E.map(x => '<div class="item">' + beltImgHTML(x.t.id) + '<span class="lbl"><b>' + esc(x.t.n) + "</b><small>" + esc(x.t.k) + (x.year ? " · " + x.year : " · ajoutée par toi") + '</small></span><button class="btn small ghost" data-e="' + esc(x.t.id) + '">✏️</button></div>').join("") + "</div>" +
        (off.length ? "<h4>Retirées</h4>" + '<div class="tfilt">' + off.map(id => { const t = titleById(id); return t ? '<button class="chip" data-on="' + esc(id) + '">↩ ' + esc(t.n) + "</button>" : ""; }).join("") + "</div>" : "") +
        '<h4>＋ Ajouter une évolution</h4><select id="evadd" style="width:100%"><option value="">Choisir une ceinture…</option>' + (S.titles || []).filter(t => !E.some(x => x.t.id === t.id)).map(t => '<option value="' + esc(t.id) + '">' + esc(t.k + " · " + t.n) + "</option>").join("") + "</select>" +
        '<button class="btn wide" style="margin-top:8px" data-add>Ajouter</button><button class="btn wide ghost" style="margin-top:6px" data-close>Fermer</button>';
    };
    const save = (fn, msg) => saveCfg(fn, msg).then(ok => { if (ok) { toast("Enregistré ✓"); draw(); } }).catch(er => toast("Pas enregistré : " + ((er && er.message) || "")));
    draw();
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return close();
      const ed = e.target.closest("[data-e]"); if (ed) { close(); return evoEdit(bid, ed.dataset.e); }
      const on = e.target.closest("[data-on]"); if (on) return save(d => { d.evo = d.evo || {}; const k = bid + "|" + on.dataset.on; if (d.evo[k]) delete d.evo[k].off; }, "évolution rétablie : " + b.name);
      if (e.target.closest("[data-add]")) { const id = box.querySelector("#evadd").value; if (!id) return; return save(d => { d.evoAdd = d.evoAdd || {}; const L = d.evoAdd[bid] = d.evoAdd[bid] || []; if (L.indexOf(id) < 0) L.push(id); d.evo = d.evo || {}; const k = bid + "|" + id; if (d.evo[k]) delete d.evo[k].off; }, "évolution ajoutée : " + b.name); }
    });
  });
}
ACT.tcgmevo = el => evoModo(String(el.dataset.c || "").split(/[@#~]/)[0]);
// modo : régler une évolution (nom, années, gimmick, image, bonus, stats, pouvoir) ou la retirer
export function evoEdit(bid, tid) {
  const b = cardById(bid), t = titleById(tid); if (!b || !t || !S.isAdmin) return;
  const key = bid + "|" + tid, ov = Object.assign({}, (cfg().evo || {})[key] || {}), ed = evoDef(b, tid);
  modal((box, close) => {
    box.classList.add("tbibox");
    box.innerHTML = '<div class="tczoom">' + cardHTML({ c: ed.id, r: b.max, lv: 1 }) + "</div><h3>" + esc(t.n) + '</h3><form class="tmform" data-ef>' +
      '<label>Nom sur la carte<input name="nm" maxlength="40" value="' + esc(ov.name || "") + '" placeholder="' + esc(b.name) + '"></label>' +
      '<label>Années / date<input name="yr" maxlength="24" value="' + esc(ov.years || "") + '" placeholder="' + esc(ed.years || "") + '"></label>' +
      '<label>Gimmick / version<input name="gm" maxlength="60" value="' + esc(ov.gimmick || "") + '" placeholder="' + esc(ed.gimmick) + '"></label>' +
      '<label>Bonus de stats (%) — vide = selon le prestige (' + EVO_BONUS[prestige(t)] + ' %)<input name="bo" type="number" min="-50" max="200" value="' + esc(ov.bonus != null ? ov.bonus : "") + '"></label>' +
      '<div class="tmstats">' + STATS.map((s, i) => '<label>' + s.slice(0, 3) + '<input name="s' + i + '" type="number" min="1" max="999" value="' + esc(Array.isArray(ov.st) ? ov.st[i] : "") + '" placeholder="' + ed.st[i] + '"></label>').join("") + '</div><p class="tnote">Stats vides = calculées toutes seules.</p>' +
      '<label>Pouvoir<select name="pw"><option value="">Au hasard (à chaque évolution)</option>' + Object.keys(POWERS).map(k => '<option value="' + k + '"' + (ov.pw === k ? " selected" : "") + ">" + esc(POWERS[k][0] + " — " + POWERS[k][1]) + "</option>").join("") + "</select></label>" +
      '<div class="btns"><button type="button" class="btn small ghost" data-img>🖼️ Image de l’évolution</button>' + (ov.img ? '<button type="button" class="btn small ghost" data-noimg>Retirer l’image</button>' : "") + "</div>" +
      '<button class="btn wide">Enregistrer</button><button type="button" class="btn wide ghost danger" data-off>Retirer cette évolution</button><button type="button" class="btn wide ghost" data-close>Fermer</button></form>';
    const save = (fn, msg) => saveCfg(d => { d.evo = d.evo || {}; const o = d.evo[key] = d.evo[key] || {}; fn(o); if (!Object.keys(o).length) delete d.evo[key]; }, msg).then(ok => { if (ok) toast("Enregistré ✓"); }).catch(er => toast("Pas enregistré : " + ((er && er.message) || "")));
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return close();
      if (e.target.closest("[data-off]")) { close(); return save(o => { o.off = true; }, "évolution retirée : " + b.name + " / " + t.n); }
      if (e.target.closest("[data-noimg]")) { close(); return save(o => { delete o.img; }, "image d’évolution retirée"); }
      if (e.target.closest("[data-img]")) { close(); return bankPick(b, "Image de " + b.name + " · " + t.n, v => save(o => { if (v === null || v === "-") delete o.img; else o.img = v; }, "image d’évolution : " + b.name), false); }
    });
    box.addEventListener("submit", e => {
      e.preventDefault(); const f = e.target, st = STATS.map((s, i) => +f["s" + i].value || 0);
      close();
      save(o => {
        const set = (k, v) => { if (v === "" || v == null) delete o[k]; else o[k] = v; };
        set("name", f.nm.value.trim()); set("years", f.yr.value.trim()); set("gimmick", f.gm.value.trim()); set("bonus", f.bo.value === "" ? "" : +f.bo.value); set("pw", f.pw.value);
        if (st.every(v => v > 0)) o.st = st; else delete o.st;
      }, "évolution réglée : " + b.name + " / " + t.n);
    });
  });
}
// recherche rapide pour l'objet d'une ceinture dans les récompenses
export const itemText = id => isBelt(id) ? "🏆 " + beltLabel(id) : "";
export const beltOwnersFilter = q => (S.titles || []).filter(t => !q || norm(t.n).indexOf(norm(q)) >= 0);
