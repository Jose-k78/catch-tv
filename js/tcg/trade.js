// TCCCG — Échange entre membres : voir les rosters des autres, proposer des échanges (cartes et/ou ressources), enchères de 24 h.
// Tout passe par la collection Firestore « tcgx » :
//  échange { ty:"trade", from, to, fromName, toName, give:{cards,res}, want:{cards,res}, st }
//    open → ok (accepté par « to ») → done (récupéré par « from ») ; open → no (refusé) / open → back (annulé) ; no → back.
//    Ce que propose « from » est mis de côté dès l'envoi (retiré de sa partie) et lui revient s'il annule ou si c'est refusé.
//  enchère { ty:"auc", from, fromName, card, start, bids:[{u,n,v}], end, st, win, winName, price, sc, wc }
//    l'argent d'une enchère est mis de côté (d.esc[id]) et rendu dès qu'on est dépassé ; le vendeur peut valider l'offre du
//    moment pendant les 24 h, sinon la plus haute enchère gagne à la fin. sc = vendeur payé / carte rendue, wc = carte récupérée.
//  défi { ty:"duel", from, to, fromName, toName, win, diff, n } (écrit à la fin d'un combat contre un membre)
import { S, B as DB, ACT, changed, prof } from "../state.js";
import { esc, toast, modal } from "../util.js";
import { RAR, defOf, statsOf, hpOf } from "./data.js";
import { me, commit, owned, addInst, RES, RICO } from "./store.js";
import { cardHTML } from "./card.js";
import { resBar } from "./roster.js";
import { loadAll } from "./fight.js";

const DAY = 864e5;
const myId = () => (S.user && S.user.uid) || "";
const myName = () => String((S.profile && S.profile.pseudo) || "Joueur").slice(0, 30);
const X = () => S.tcgx || [];
const nameOf = (uid, fb) => { const o = (S.tcgAll || []).find(x => x.uid === uid), p = prof(uid); return (o && o.name) || (p && p.pseudo) || fb || "Joueur"; };
const resTxt = r => RES.filter(k => r && +r[k] > 0).map(k => RICO[k] + " " + r[k]).join(" · ");
const cardsOf = o => Object.keys((o && o.cards) || {}).map(iid => Object.assign({ iid: iid }, o.cards[iid])).filter(x => defOf(x.c));
const sortCards = L => L.sort((a, b) => RAR.indexOf(b.r) - RAR.indexOf(a.r) || b.lv - a.lv);
const strip = x => Object.assign({ c: x.c, r: x.r, lv: x.lv || 1, xp: x.xp || 0 }, x.pw ? { pw: String(x.pw).slice(0, 12) } : {});
const top = a => (a.bids || []).reduce((m, b) => (!m || b.v > m.v ? b : m), null);
const left = ms => { const m = Math.max(0, Math.ceil(ms / 6e4)); return m >= 60 ? Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0") : m + " min"; };
// état d'une enchère : en cours, ou terminée avec (ou sans) gagnant
export function aucState(a) {
  if (a.st === "back") return { done: true, win: null };
  if (a.st === "sold") return { done: true, win: a.win, price: a.price };
  const t = top(a);
  if (Date.now() >= (a.end || 0)) return t ? { done: true, win: t.u, price: t.v } : { done: true, win: null };
  return { done: false, top: t };
}
export const pendingCount = () => X().filter(t => t.ty === "trade" && t.to === myId() && t.st === "open").length;

// ---------- règlement automatique (à chaque mise à jour) : récupérer, rembourser, payer ----------
const busy = new Set(), inflight = new Set();
const once = (key, fn) => { if (busy.has(key)) return; busy.add(key); Promise.resolve().then(fn).catch(() => {}).then(() => setTimeout(() => busy.delete(key), 4000)); };
export function settle() {
  if (!S.user || !S.tcg || !S.tcgReady || !DB.txTcgx) return;
  const u = myId(), d = me();
  X().forEach(t => {
    if (t.ty === "trade" && t.from === u) {
      if (t.st === "ok") once("ok" + t.id, () => DB.txTcgx(t.id, c => c.st === "ok" ? { st: "done" } : null).then(() => { commit(x => { (t.want.cards || []).forEach(cd => addInst(x, cd)); RES.forEach(k => { x.res[k] += +(t.want.res || {})[k] || 0; }); }); toast("🤝 Échange accepté par " + (t.toName || "un membre") + " : tes cartes sont arrivées !"); }));
      if (t.st === "no") once("no" + t.id, () => DB.txTcgx(t.id, c => c.st === "no" ? { st: "back" } : null).then(() => { giveBack(t); toast("Échange refusé par " + (t.toName || "un membre") + " : tout t’est rendu"); }));
    }
    if (t.ty === "auc") {
      const s = aucState(t);
      if (t.from === u && s.done && !t.sc) once("sc" + t.id, () => DB.txTcgx(t.id, c => c.sc ? null : { sc: true, st: c.st === "open" ? "done" : c.st }).then(() => {
        commit(x => { if (s.win) x.res.money += +s.price || 0; else addInst(x, t.card); });
        toast(s.win ? "🔨 Enchère vendue " + s.price + " 💵 à " + nameOf(s.win) : "Enchère terminée sans offre : ta carte t’est rendue");
      }));
      const esc0 = (d.esc || {})[t.id];
      if (esc0 && s.done && s.win === u && !t.wc) once("wc" + t.id, () => DB.txTcgx(t.id, c => c.wc ? null : { wc: true }).then(() => {
        commit(x => { if (!(x.esc || {})[t.id]) return; const back = x.esc[t.id] - (+s.price || 0); if (back > 0) x.res.money += back; delete x.esc[t.id]; addInst(x, t.card); });
        toast("🔨 Enchère gagnée : " + ((defOf(t.card.c) || {}).name || "carte") + " !");
      }));
      else if (esc0 && !inflight.has(t.id) && ((s.done && s.win !== u) || (!s.done && s.top && s.top.u !== u))) commit(x => { if (!(x.esc || {})[t.id]) return; x.res.money += x.esc[t.id]; delete x.esc[t.id]; });
    }
  });
  // enchère disparue (supprimée) : on rend l'argent mis de côté
  Object.keys(d.esc || {}).forEach(id => { if (X().length && !X().some(t => t.id === id)) commit(x => { if (x.esc && x.esc[id]) { x.res.money += x.esc[id]; delete x.esc[id]; } }); });
}
function giveBack(t) { commit(x => { (t.give.cards || []).forEach(cd => addInst(x, cd)); RES.forEach(k => { x.res[k] += +(t.give.res || {})[k] || 0; }); }); }

// ---------- vues ----------
export function echangeView(sub, id) {
  const d = me(), n = pendingCount(), nb = X().filter(t => t.ty === "auc" && !aucState(t).done).length;
  let h = '<section class="tccghead"><h1>Échange</h1></section>' + resBar(d) +
    '<nav class="tsub">' + [["", "Membres"], ["props", "Propositions" + (n ? " (" + n + ")" : "")], ["encheres", "Enchères" + (nb ? " (" + nb + ")" : "")]].map(x => '<a class="' + ((sub || "") === x[0] || (x[0] === "" && (sub === "m" || sub === "p")) ? "on" : "") + '" href="#/tccg/echange' + (x[0] ? "/" + x[0] : "") + '">' + x[1] + "</a>").join("") + "</nav>";
  if (!S.tcgAll && !loading) { loading = true; loadAll().then(() => { loading = false; }); }
  if (sub === "m") return h + memberView(id);
  if (sub === "p") return h + propView(id);
  if (sub === "props") return h + propsView();
  if (sub === "encheres") return h + aucView();
  const L = (S.tcgAll || []).filter(o => o.uid !== myId());
  return h + '<p class="tnote">Regarde les rosters des autres membres et propose-leur un échange : des cartes, des ressources, ou les deux.</p>' +
    (!S.tcgAll ? '<p class="tnote">Chargement…</p>' : L.length ? '<div class="list">' + L.map(o => { const C = sortCards(cardsOf(o)), b = C[0];
      return '<a class="item tmem" href="#/tccg/echange/m/' + esc(o.uid) + '">' + (b && defOf(b.c).pic ? '<span class="tfface" style="background-image:url(\'' + esc(defOf(b.c).pic) + '\')"></span>' : '<span class="tfface"></span>') + '<span class="lbl"><b>' + esc(nameOf(o.uid, o.name)) + "</b><small>Niveau " + (o.lvl || 1) + " · " + C.length + " cartes" + (b ? " · meilleure : " + esc(defOf(b.c).name) + " " + b.r : "") + '</small></span><span class="chev">›</span></a>'; }).join("") + "</div>" : '<p class="tnote">Aucun autre membre n’a encore commencé TCCCG.</p>');
}
let loading = false;
function memberView(uid) {
  const o = (S.tcgAll || []).find(x => x.uid === uid);
  if (!o) return '<p class="tnote">' + (S.tcgAll ? "Membre introuvable." : "Chargement…") + "</p>";
  const C = sortCards(cardsOf(o));
  return '<a class="back" href="#/tccg/echange">‹ Membres</a><h2>Roster de ' + esc(nameOf(uid, o.name)) + ' <small class="tsmall">' + C.length + " cartes · niveau " + (o.lvl || 1) + "</small></h2>" +
    '<button class="btn wide" style="margin:4px 16px 10px;width:calc(100% - 32px)" data-act="tcgtnew" data-u="' + esc(uid) + '">🤝 Proposer un échange</button>' +
    '<div class="trgrid">' + C.map(x => cardHTML(x, { small: true })).join("") + "</div>";
}
// proposition en préparation
let P = null;
ACT.tcgtnew = el => { P = { to: el.dataset.u, give: [], want: [], gr: {}, wr: {} }; location.hash = "#/tccg/echange/p/" + el.dataset.u; };
function propView(uid) {
  const o = (S.tcgAll || []).find(x => x.uid === uid);
  if (!o) return '<p class="tnote">Chargement…</p>';
  if (!P || P.to !== uid) P = { to: uid, give: [], want: [], gr: {}, wr: {} };
  const d = me(), mine = sortCards(owned(d)), theirs = sortCards(cardsOf(o));
  const resRow = (side, r, max) => '<div class="tresin">' + RES.map(k => '<label>' + RICO[k] + '<input type="number" min="0" inputmode="numeric" data-tr="' + side + '" data-k="' + k + '" value="' + (r[k] || "") + '" placeholder="0"' + (max ? ' max="' + max.res[k] + '"' : "") + "></label>").join("") + "</div>";
  return '<a class="back" href="#/tccg/echange/m/' + esc(uid) + '">‹ Roster de ' + esc(nameOf(uid, o.name)) + "</a>" +
    '<h2>Tu veux <small class="tsmall">' + P.want.length + " carte" + (P.want.length > 1 ? "s" : "") + "</small></h2>" + resRow("w", P.wr) +
    '<div class="trgrid tpick">' + theirs.map(x => '<div class="tpk' + (P.want.indexOf(x.iid) >= 0 ? " on" : "") + '" data-act="tcgtw" data-iid="' + esc(x.iid) + '">' + cardHTML(x, { small: true }) + "</div>").join("") + "</div>" +
    '<h2>Tu donnes <small class="tsmall">' + P.give.length + " carte" + (P.give.length > 1 ? "s" : "") + "</small></h2>" + resRow("g", P.gr, d) +
    '<div class="trgrid tpick">' + mine.map(x => '<div class="tpk' + (P.give.indexOf(x.iid) >= 0 ? " on" : "") + '" data-act="tcgtg" data-iid="' + esc(x.iid) + '">' + cardHTML(x, { small: true }) + "</div>").join("") + "</div>" +
    '<p class="tnote">Ce que tu donnes est mis de côté dès l’envoi, et te revient si l’échange est refusé ou si tu l’annules.</p>' +
    '<button class="btn wide" style="margin:6px 16px 20px;width:calc(100% - 32px)" data-act="tcgtsend">📨 Envoyer la proposition</button>';
}
document.addEventListener("input", e => { const t = e.target; if (!P || !t.dataset || !t.dataset.tr) return; (t.dataset.tr === "g" ? P.gr : P.wr)[t.dataset.k] = Math.max(0, Math.floor(+t.value || 0)); });
ACT.tcgtw = el => { if (!P) return; const i = P.want.indexOf(el.dataset.iid); if (i >= 0) P.want.splice(i, 1); else P.want.push(el.dataset.iid); changed("tcg"); };
ACT.tcgtg = el => { if (!P) return; const i = P.give.indexOf(el.dataset.iid); if (i >= 0) P.give.splice(i, 1); else P.give.push(el.dataset.iid); changed("tcg"); };
ACT.tcgtsend = async () => {
  if (!P) return; const o = (S.tcgAll || []).find(x => x.uid === P.to), d = me();
  if (!o) return toast("Membre introuvable");
  const gr = {}, wr = {}; RES.forEach(k => { if (P.gr[k] > 0) gr[k] = P.gr[k]; if (P.wr[k] > 0) wr[k] = P.wr[k]; });
  if (!P.give.length && !P.want.length && !Object.keys(gr).length && !Object.keys(wr).length) return toast("Choisis au moins une carte ou une ressource");
  if (RES.some(k => (gr[k] || 0) > d.res[k])) return toast("Tu n’as pas assez de ressources");
  const give = P.give.map(iid => d.cards[iid] && strip(d.cards[iid])).filter(Boolean), want = P.want.map(iid => o.cards[iid] && Object.assign({ iid: iid }, strip(o.cards[iid]))).filter(Boolean);
  const gids = P.give.slice();
  commit(x => { gids.forEach(iid => { delete x.cards[iid]; }); x.fav = x.fav.filter(i => gids.indexOf(i) < 0); RES.forEach(k => { x.res[k] -= gr[k] || 0; }); });
  try {
    await DB.addTcgx({ ty: "trade", from: myId(), to: P.to, fromName: myName(), toName: String(nameOf(P.to, o.name)).slice(0, 30), give: { cards: give, res: gr }, want: { cards: want, res: wr }, st: "open" });
    toast("📨 Proposition envoyée à " + nameOf(P.to, o.name)); P = null; location.hash = "#/tccg/echange/props";
  } catch (e) { commit(x => { give.forEach(cd => addInst(x, cd)); RES.forEach(k => { x.res[k] += gr[k] || 0; }); }); toast("Pas envoyé : " + ((e && e.message) || "erreur"), { ms: 4000 }); }
};
const side = (cards, res) => '<div class="ttside">' + ((cards || []).length ? '<div class="trgrid">' + cards.map(cd => defOf(cd.c) ? cardHTML(cd, { small: true }) : "").join("") + "</div>" : "") + (resTxt(res) ? '<p class="tres2">' + resTxt(res) + "</p>" : "") + ((cards || []).length || resTxt(res) ? "" : '<p class="tnote">Rien</p>') + "</div>";
const ST = { open: "En attente", ok: "Accepté", done: "Terminé ✓", no: "Refusé", back: "Annulé / rendu" };
function propsView() {
  const u = myId(), L = X().filter(t => t.ty === "trade" && (t.from === u || t.to === u));
  const inc = L.filter(t => t.to === u && t.st === "open"), out = L.filter(t => t.from === u && t.st === "open"), old = L.filter(t => t.st !== "open").slice(0, 20);
  const box = (t, btns) => '<div class="ttrade"><p class="sub">' + (t.from === u ? "Toi → " + esc(t.toName || nameOf(t.to)) : esc(t.fromName || nameOf(t.from)) + " → toi") + " · " + ST[t.st] + "</p>" +
    '<div class="ttgrid"><div><h4>' + (t.from === u ? "Tu donnes" : "Tu reçois") + "</h4>" + side(t.give.cards, t.give.res) + "</div><div><h4>" + (t.from === u ? "Tu reçois" : "Tu donnes") + "</h4>" + side(t.want.cards, t.want.res) + "</div></div>" + (btns || "") + "</div>";
  return "<h2>Reçues</h2>" + (inc.length ? inc.map(t => box(t, '<div class="btns"><button class="btn small" data-act="tcgtok" data-id="' + t.id + '">✅ Accepter</button><button class="btn small ghost" data-act="tcgtno" data-id="' + t.id + '">Refuser</button></div>')).join("") : '<p class="tnote">Aucune proposition en attente.</p>') +
    "<h2>Envoyées</h2>" + (out.length ? out.map(t => box(t, '<div class="btns"><button class="btn small ghost" data-act="tcgtcancel" data-id="' + t.id + '">Annuler</button></div>')).join("") : '<p class="tnote">Aucune proposition envoyée en attente.</p>') +
    (old.length ? "<h2>Historique</h2>" + old.map(t => box(t)).join("") : "");
}
const byId = id => X().find(t => t.id === id);
ACT.tcgtok = async el => {
  const t = byId(el.dataset.id); if (!t || t.st !== "open") return;
  const d = me(), miss = (t.want.cards || []).filter(cd => !d.cards[cd.iid]);
  if (miss.length) return toast("Tu n’as plus " + miss.map(cd => (defOf(cd.c) || {}).name).join(", ") + " : refuse ou demande une autre proposition", { ms: 4500 });
  if (RES.some(k => (+(t.want.res || {})[k] || 0) > d.res[k])) return toast("Tu n’as pas assez de ressources pour cet échange");
  try { await DB.txTcgx(t.id, c => c.st === "open" ? { st: "ok" } : null); } catch (e) { return toast("Plus possible : la proposition a changé"); }
  commit(x => { const ids = (t.want.cards || []).map(cd => cd.iid); ids.forEach(iid => { delete x.cards[iid]; }); x.fav = x.fav.filter(i => ids.indexOf(i) < 0); RES.forEach(k => { x.res[k] -= +(t.want.res || {})[k] || 0; x.res[k] += +(t.give.res || {})[k] || 0; }); (t.give.cards || []).forEach(cd => addInst(x, cd)); });
  toast("🤝 Échange fait !");
};
ACT.tcgtno = el => { const t = byId(el.dataset.id); if (!t) return; DB.txTcgx(t.id, c => c.st === "open" ? { st: "no" } : null).then(() => toast("Proposition refusée")).catch(() => toast("Plus possible")); };
ACT.tcgtcancel = el => { const t = byId(el.dataset.id); if (!t) return; DB.txTcgx(t.id, c => c.st === "open" ? { st: "back" } : null).then(() => { giveBack(t); toast("Proposition annulée : tout t’est rendu"); }).catch(() => toast("Plus possible : elle a déjà eu une réponse")); };

// ---------- enchères ----------
function aucView() {
  const u = myId(), L = X().filter(t => t.ty === "auc"), live = L.filter(t => !aucState(t).done), done = L.filter(t => aucState(t).done).slice(0, 12), d = me();
  const box = t => { const s = aucState(t), tp = top(t), mine = t.from === u, def = defOf(t.card.c); if (!def) return "";
    return '<div class="tauc"><div class="taucc">' + cardHTML(t.card, { small: true }) + '</div><div class="tauci"><b>' + esc(def.name) + " " + esc(t.card.r) + "</b><small>par " + esc(mine ? "toi" : t.fromName || nameOf(t.from)) + "</small>" +
      '<p>Prix de départ : 💵 ' + t.start + "<br>" + (tp ? "Meilleure offre : <b>💵 " + tp.v + "</b> (" + esc(tp.u === u ? "toi" : tp.n || nameOf(tp.u)) + ")" : "Pas encore d’offre") + "</p>" +
      (s.done ? '<p class="sub">' + (s.win ? "Gagnée par " + esc(s.win === u ? "toi" : nameOf(s.win, (tp || {}).n)) + " · 💵 " + s.price : "Terminée sans offre") + "</p>"
        : '<p class="sub">⏳ ' + left(t.end - Date.now()) + " · " + (t.bids || []).length + " offre" + ((t.bids || []).length > 1 ? "s" : "") + "</p>" +
          (mine ? (tp ? '<button class="btn small" data-act="tcgasold" data-id="' + t.id + '">✅ Valider ' + tp.v + " 💵</button>" : '<button class="btn small ghost" data-act="tcgaback" data-id="' + t.id + '">Retirer</button>')
            : tp && tp.u === u ? '<p class="tnote">Tu es le meilleur enchérisseur</p>' : '<div class="tbid"><input type="number" inputmode="numeric" id="bid-' + t.id + '" min="' + (tp ? tp.v + 1 : t.start) + '" value="' + (tp ? tp.v + Math.max(10, Math.round(tp.v * 0.05)) : t.start) + '"><button class="btn small" data-act="tcgabid" data-id="' + t.id + '">Enchérir</button></div>')) + "</div></div>"; };
  return '<p class="tnote">Mets une carte en vente pour 24 h avec un prix de départ en argent. Les membres surenchérissent ; tu peux valider l’offre du moment quand tu veux, sinon la plus haute enchère gagne à la fin. L’argent d’une offre est mis de côté et rendu si quelqu’un enchérit plus haut. Tu as 💵 ' + d.res.money + (Object.keys(d.esc || {}).length ? " (+ " + Object.values(d.esc).reduce((a, b) => a + b, 0) + " mis de côté)" : "") + ".</p>" +
    '<button class="btn wide" style="margin:0 16px 8px;width:calc(100% - 32px)" data-act="tcganew">🔨 Mettre une carte aux enchères</button>' +
    "<h2>En cours</h2>" + (live.length ? live.map(box).join("") : '<p class="tnote">Aucune enchère en cours.</p>') + (done.length ? "<h2>Terminées</h2>" + done.map(box).join("") : "");
}
ACT.tcganew = () => {
  const L = sortCards(owned(me())); if (!L.length) return toast("Tu n’as pas encore de carte");
  let pick = "";
  modal((box, close) => {
    const draw = () => { box.innerHTML = "<h3>🔨 Nouvelle enchère</h3><p class=\"sub\">Choisis la carte, puis le prix de départ (24 h).</p>" + '<div class="trgrid tpick">' + L.map(x => '<div class="tpk' + (pick === x.iid ? " on" : "") + '" data-p="' + esc(x.iid) + '">' + cardHTML(x, { small: true }) + "</div>").join("") + "</div>" +
      '<label class="tmform" style="display:block;margin-top:8px">Prix de départ (💵)<input id="astart" type="number" min="1" value="500" inputmode="numeric"></label><button class="btn wide" data-go' + (pick ? "" : " disabled") + '>Mettre en vente</button><button class="btn wide ghost" style="margin-top:6px" data-close>Annuler</button>'; };
    draw();
    box.addEventListener("click", async e => {
      if (e.target.closest("[data-close]")) return close();
      const p = e.target.closest("[data-p]"); if (p) { const v = (box.querySelector("#astart") || {}).value; pick = p.dataset.p; draw(); box.querySelector("#astart").value = v || 500; return; }
      if (!e.target.closest("[data-go]") || !pick) return;
      const start = Math.max(1, Math.floor(+box.querySelector("#astart").value || 0)), d = me(), inst = d.cards[pick]; if (!inst) return;
      const card = strip(inst), iid = pick; close();
      commit(x => { delete x.cards[iid]; x.fav = x.fav.filter(i => i !== iid); });
      try { await DB.addTcgx({ ty: "auc", from: myId(), fromName: myName(), card: card, start: start, bids: [], end: Date.now() + DAY, st: "open" }); toast("🔨 Enchère lancée pour 24 h"); }
      catch (er) { commit(x => addInst(x, card)); toast("Pas lancée : " + ((er && er.message) || "erreur")); }
    });
  });
};
ACT.tcgabid = async el => {
  const t = byId(el.dataset.id); if (!t) return; const inp = document.getElementById("bid-" + t.id), v = Math.floor(+(inp && inp.value) || 0), tp = top(t), d = me();
  if (t.from === myId()) return;
  if (v < (tp ? tp.v + 1 : t.start)) return toast("Offre trop basse : au moins " + (tp ? tp.v + 1 : t.start) + " 💵");
  if (d.res.money < v) return toast("Pas assez d’argent");
  inflight.add(t.id); setTimeout(() => inflight.delete(t.id), 8000);
  commit(x => { x.res.money -= v; x.esc = x.esc || {}; x.esc[t.id] = (x.esc[t.id] || 0) + v; });
  try { await DB.txTcgx(t.id, c => { const m = top(c); return c.st === "open" && Date.now() < c.end && v >= (m ? m.v + 1 : c.start) ? { bids: (c.bids || []).concat([{ u: myId(), n: myName(), v: v }]).slice(-60) } : null; }); toast("🔨 Offre de " + v + " 💵 placée"); }
  catch (e) { commit(x => { x.res.money += v; if (x.esc && x.esc[t.id]) { x.esc[t.id] -= v; if (x.esc[t.id] <= 0) delete x.esc[t.id]; } }); toast("Pas placée : quelqu’un a peut-être enchéri plus haut"); }
};
ACT.tcgasold = el => { const t = byId(el.dataset.id); if (!t) return; DB.txTcgx(t.id, c => { const m = top(c); return c.st === "open" && m ? { st: "sold", win: m.u, winName: m.n || "", price: m.v } : null; }).then(() => toast("✅ Vendu !")).catch(() => toast("Plus possible")); };
ACT.tcgaback = el => { const t = byId(el.dataset.id); if (!t) return; DB.txTcgx(t.id, c => c.st === "open" && !(c.bids || []).length && !c.sc ? { st: "back", sc: true } : null).then(() => { commit(x => addInst(x, t.card)); toast("Enchère retirée : ta carte t’est rendue"); }).catch(() => toast("Plus possible : il y a déjà une offre")); };
// défis reçus (pour l'accueil)
export const duelsForMe = () => X().filter(t => t.ty === "duel" && t.to === myId() && Date.now() - t.at < 7 * DAY).slice(0, 3);
