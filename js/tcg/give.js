// TCCCG — outil du modo « Rendre des cartes et ressources » (mis de côté le 11 nov. au soir, codé le 12 nov.).
// Le modo choisit un joueur (lui-même ou un membre), des cartes (nom, forme, rareté, niveau), des ressources, des objets,
// des médailles et un niveau de joueur minimum. On AJOUTE seulement : rien n'est jamais retiré de la partie.
// Pour un membre : on relit sa partie juste avant, on ajoute, on enregistre (tcg/{uid}, permis au modo par les règles v12).
import { S, B, ACT, changed } from "../state.js";
import { esc, toast, modal } from "../util.js";
import { RAR, LVMAX, baseCards, cardById, defOf, evolutionsOf, items } from "./data.js";
import { me, commit, addInst, cleanSave } from "./store.js";
import { norm } from "../wrestlers.js";

const RES = [["money", "💵 Argent"], ["mom", "⚡ Momentum"], ["pop", "⭐ Pop"], ["push", "🚀 Push"], ["gim", "🎟️ Gimmicks"]];
const blank = () => ({ uid: "", name: "", cards: [], res: {}, items: {}, medals: {}, lvl: 0 });
let G = blank(), players = null, loadingP = false;

// liste des joueurs (moi + les membres qui ont une partie)
function loadPlayers(done) {
  if (loadingP) return; loadingP = true;
  (B.listTcg ? B.listTcg() : Promise.resolve([])).then(L => { players = (L || []).filter(p => p && p.uid); }).catch(() => { players = []; })
    .then(() => { loadingP = false; if (done) done(); });
}
const nCards = d => Object.keys((d && d.cards) || {}).length;
const sum = d => "Niveau " + (+d.lvl || 1) + " · " + nCards(d) + " carte" + (nCards(d) > 1 ? "s" : "") + " · 💵 " + (((d.res || {}).money) || 0);
// toutes les formes d'une carte : base + évolutions (ceintures, gimmicks)
const formsOf = base => { const b = cardById(base); if (!b) return []; return [{ id: b.id, n: "Forme de base" }].concat(evolutionsOf(b).map(e => ({ id: e.id, n: (e.kind === "belt" ? "🏆 " : "🎭 ") + e.name }))); };
const rarsOf = id => { const d = defOf(id); if (!d) return RAR; const a = RAR.indexOf(d.r), z = Math.max(a, RAR.indexOf(d.max || d.r)); return RAR.slice(Math.max(0, a), z + 1); };
const itemList = () => {
  const L = items().filter(x => x.id && x.id !== "gift1").map(x => ({ id: x.id, n: (x.ic || "🎁") + " " + x.n + (x.t === "equip" ? " (équipement)" : x.t === "eveil" ? " (éveil)" : " (combat)") }));
  L.push({ id: "mitb", n: "💼 Mallette Money In The Bank" });
  (S.titles || []).forEach(t => { if (t && t.id) L.push({ id: "belt:" + t.id, n: "🏆 Ceinture : " + (t.n || t.id) }); });
  return L;
};
const itemName = id => (itemList().find(x => x.id === id) || { n: id }).n;
// ce qu'on va donner, en une ligne par élément
function recap() {
  const L = [];
  G.cards.forEach(x => { const d = defOf(x.c); L.push("🃏 " + (d ? d.name : x.c) + " · " + x.r + " · niv. " + x.lv); });
  RES.forEach(r => { const v = +G.res[r[0]] || 0; if (v > 0) L.push(r[1] + " +" + v); });
  Object.keys(G.items).forEach(id => { const n = +G.items[id] || 0; if (n > 0) L.push(itemName(id) + " ×" + n); });
  Object.keys(G.medals).forEach(n => { const q = +G.medals[n] || 0; if (q > 0) L.push("🏅 Médaille de " + n + " ×" + q); });
  if (G.lvl > 1) L.push("📈 Niveau du joueur au moins " + G.lvl);
  return L;
}
// on ajoute seulement (jamais de retrait)
export function applyGive(d, g) {
  d.res = d.res || {}; d.items = d.items || {}; d.medals = d.medals || {}; d.cards = d.cards || {};
  const ids = [];
  (g.cards || []).forEach(x => { const r = RAR.indexOf(x.r) >= 0 ? x.r : (defOf(x.c) || {}).r, lv = Math.max(1, Math.min(LVMAX[r] || 50, Math.round(+x.lv || 1))); const iid = addInst(d, { c: x.c, r: r, lv: lv }); if (iid) ids.push(iid); });
  RES.forEach(r => { const v = Math.max(0, Math.round(+(g.res || {})[r[0]] || 0)); if (v) d.res[r[0]] = (+d.res[r[0]] || 0) + v; });
  Object.keys(g.items || {}).forEach(id => { const n = Math.max(0, Math.round(+g.items[id] || 0)); if (n) d.items[id] = (+d.items[id] || 0) + n; });
  Object.keys(g.medals || {}).forEach(n => { const q = Math.max(0, Math.round(+g.medals[n] || 0)); if (q) d.medals[n] = (+d.medals[n] || 0) + q; });
  const lv = Math.max(0, Math.min(50, Math.round(+g.lvl || 0))); if (lv > (+d.lvl || 1)) { d.lvl = lv; d.xp = 0; }
  return ids;
}

ACT.tcggive = el => {
  if (!S.realAdmin) return;
  G = blank();
  if (el && el.dataset && el.dataset.uid) { G.uid = el.dataset.uid; G.name = el.dataset.name || ""; }
  open();
};
function open() {
  modal((box, close) => {
    let armed = false, found = [];
    const draw = () => {
      const P = players || [], mine = S.user && S.user.uid;
      const who = G.uid ? (G.uid === mine ? "Moi (" + sum(me()) + ")" : (G.name || "Membre")) : "";
      box.innerHTML = '<div class="tgv">' + "<h3>🎁 Rendre des cartes et ressources</h3><p class=\"sub\">On ajoute seulement : rien n’est retiré de la partie du joueur.</p>" +
        '<label>Joueur<select data-g="uid"><option value="">— choisir —</option><option value="' + esc(mine || "") + '"' + (G.uid === mine ? " selected" : "") + ">Moi</option>" +
        P.filter(p => p.uid !== mine).map(p => '<option value="' + esc(p.uid) + '"' + (G.uid === p.uid ? " selected" : "") + ">" + esc((p.name || "Membre") + " · " + sum(p)) + "</option>").join("") + "</select></label>" +
        (players === null ? '<p class="tnote">Chargement des membres…</p>' : "") + (who ? '<p class="tnote">Pour : <b>' + esc(who) + "</b></p>" : "") +
        "<h4>🃏 Cartes</h4>" +
        '<div class="search"><input data-g="q" type="search" placeholder="Chercher un catcheur" autocomplete="off"></div><div class="tgvfound"></div>' +
        '<div class="tgvcards">' + (G.cards.length ? G.cards.map((x, i) => {
          const d = defOf(x.c), base = String(x.c).split("~")[0], F = formsOf(base), R = rarsOf(x.c);
          return '<div class="tgvrow"><b>' + esc(d ? d.name : x.c) + '</b><button type="button" class="linkbtn" data-rm="' + i + '">✕</button>' +
            (F.length > 1 ? '<select data-cf="' + i + '">' + F.map(f => '<option value="' + esc(f.id) + '"' + (f.id === x.c ? " selected" : "") + ">" + esc(f.n) + "</option>").join("") + "</select>" : "") +
            '<span class="tgvsm"><select data-cr="' + i + '">' + R.map(r => "<option" + (r === x.r ? " selected" : "") + ">" + r + "</option>").join("") + "</select>" +
            'Niv.<input data-cl="' + i + '" type="number" min="1" max="' + (LVMAX[x.r] || 50) + '" value="' + esc(x.lv) + '"></span></div>';
        }).join("") : '<p class="tnote">Aucune carte choisie.</p>') + "</div>" +
        "<h4>💰 Ressources (en plus)</h4><div class=\"tgvres\">" + RES.map(r => '<label>' + r[1] + '<input data-gr="' + r[0] + '" type="number" min="0" value="' + esc(G.res[r[0]] || "") + '" placeholder="0"></label>').join("") + "</div>" +
        "<h4>🎒 Objets</h4>" + Object.keys(G.items).map(id => '<div class="tgvrow"><b>' + esc(itemName(id)) + '</b><input data-gi="' + esc(id) + '" type="number" min="0" value="' + esc(G.items[id]) + '"><button type="button" class="linkbtn" data-rmi="' + esc(id) + '">✕</button></div>').join("") +
        '<label>Ajouter un objet<select data-g="item"><option value="">— choisir —</option>' + itemList().filter(x => !(x.id in G.items)).map(x => '<option value="' + esc(x.id) + '">' + esc(x.n) + "</option>").join("") + "</select></label>" +
        "<h4>🏅 Médailles</h4>" + Object.keys(G.medals).map(n => '<div class="tgvrow"><b>🏅 ' + esc(n) + '</b><input data-gm="' + esc(n) + '" type="number" min="0" value="' + esc(G.medals[n]) + '"><button type="button" class="linkbtn" data-rmm="' + esc(n) + '">✕</button></div>').join("") +
        '<div class="tgvadd"><input data-g="mname" list="tgvnames" placeholder="Nom du catcheur"><datalist id="tgvnames">' + baseCards().slice(0, 600).map(c => '<option value="' + esc(c.name) + '">').join("") + '</datalist><button type="button" class="btn small ghost" data-addm>＋</button></div>' +
        '<h4>📈 Niveau du joueur</h4><label>Au moins (1 à 50, vide = pas de changement)<input data-g="lvl" type="number" min="1" max="50" value="' + esc(G.lvl || "") + '"></label>' +
        '<button type="button" class="btn wide' + (armed ? " gold" : "") + '" data-give' + (G.uid && recap().length ? "" : " disabled") + ">" + (armed ? "Confirmer : donner à " + esc(G.uid === mine ? "moi" : G.name || "ce membre") : "🎁 Donner") + "</button>" +
        (armed ? '<div class="tgvrecap">' + recap().map(t => "<small>" + esc(t) + "</small>").join("") + "</div>" : "") +
        '<button type="button" class="btn wide ghost" style="margin-top:8px" data-close>Fermer</button></div>';
    };
    const showFound = () => {
      const el = box.querySelector(".tgvfound"); if (!el) return;
      el.innerHTML = found.map(c => '<button type="button" class="chip" data-addc="' + esc(c.id) + '">＋ ' + esc(c.name) + " · " + esc(c.r) + "</button>").join("");
    };
    draw();
    if (players === null) loadPlayers(() => { if (box.isConnected) draw(); });
    box.addEventListener("input", e => {
      const t = e.target, ds = t.dataset;
      if (ds.g === "q") { const q = norm(t.value || ""); found = q.length < 2 ? [] : baseCards().filter(c => norm(c.name).indexOf(q) >= 0).slice(0, 8); return showFound(); }
      if (ds.gr) { G.res[ds.gr] = Math.max(0, +t.value || 0); return; }
      if (ds.gi) { G.items[ds.gi] = Math.max(0, +t.value || 0); return; }
      if (ds.gm) { G.medals[ds.gm] = Math.max(0, +t.value || 0); return; }
      if (ds.cl != null) { const x = G.cards[+ds.cl]; if (x) x.lv = Math.max(1, Math.min(LVMAX[x.r] || 50, +t.value || 1)); return; }
      if (ds.g === "lvl") { G.lvl = Math.max(0, Math.min(50, +t.value || 0)); return; }
    });
    box.addEventListener("change", e => {
      const t = e.target, ds = t.dataset;
      if (ds.g === "uid") { G.uid = t.value; const p = (players || []).find(x => x.uid === t.value); G.name = p ? p.name || "Membre" : ""; armed = false; return draw(); }
      if (ds.g === "item" && t.value) { G.items[t.value] = 1; return draw(); }
      if (ds.cf != null) { const x = G.cards[+ds.cf]; if (x) { x.c = t.value; const R = rarsOf(x.c); if (R.indexOf(x.r) < 0) x.r = R[0]; } return draw(); }
      if (ds.cr != null) { const x = G.cards[+ds.cr]; if (x) { x.r = t.value; x.lv = Math.min(x.lv, LVMAX[x.r] || 50); } return draw(); }
      if (ds.gr || ds.gi || ds.gm || ds.g === "lvl" || ds.cl != null) { if (armed) { armed = false; return draw(); } const b = box.querySelector("[data-give]"); if (b) b.disabled = !(G.uid && recap().length); }
    });
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return close();
      const a = e.target.closest("[data-addc]"); if (a) { const c = cardById(a.dataset.addc); if (c) G.cards.push({ c: c.id, r: c.r, lv: 1 }); armed = false; found = []; return draw(); }
      const rm = e.target.closest("[data-rm]"); if (rm) { G.cards.splice(+rm.dataset.rm, 1); armed = false; return draw(); }
      const ri = e.target.closest("[data-rmi]"); if (ri) { delete G.items[ri.dataset.rmi]; armed = false; return draw(); }
      const rmm = e.target.closest("[data-rmm]"); if (rmm) { delete G.medals[rmm.dataset.rmm]; armed = false; return draw(); }
      if (e.target.closest("[data-addm]")) { const inp = box.querySelector('[data-g="mname"]'), n = (inp.value || "").trim(); if (!n) return; const c = baseCards().find(x => norm(x.name) === norm(n)); const key = c ? c.name : n.slice(0, 60); G.medals[key] = (G.medals[key] || 0) + 1; armed = false; return draw(); }
      if (!e.target.closest("[data-give]")) return;
      if (!G.uid || !recap().length) return;
      if (!armed) { armed = true; return draw(); }
      const g = JSON.parse(JSON.stringify(G)), label = recap().length;
      close();
      give(g).then(n => toast("🎁 Donné ✓ (" + label + " élément" + (label > 1 ? "s" : "") + (n ? ", " + n + " carte" + (n > 1 ? "s" : "") : "") + ")"))
        .catch(er => toast("Pas donné : " + ((er && er.message) || "erreur") + (g.uid === (S.user && S.user.uid) ? "" : " (règles Firebase v12 collées ?)"), { ms: 6000 }));
    });
  });
}
// enregistrer : ma partie par commit, celle d'un membre relue juste avant
async function give(g) {
  if (!S.realAdmin) throw new Error("réservé au modo");
  if (S.user && g.uid === S.user.uid) { let n = 0; commit(d => { n = applyGive(d, g).length; }); changed("tcg"); return n; }
  const L = await B.listTcg(), cur = (L || []).find(p => p.uid === g.uid); if (!cur) throw new Error("partie du membre introuvable");
  const x = cleanSave(cur), n = applyGive(x, g).length;
  await B.saveTcg(g.uid, x);
  players = null; return n;
}
export const giveButton = (uid, name) => '<button class="btn small ghost" data-act="tcggive"' + (uid ? ' data-uid="' + esc(uid) + '" data-name="' + esc(name || "") + '"' : "") + ">🎁 Rendre</button>";
