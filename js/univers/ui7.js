// Mode Univers (21 nov., heure du codage) : les écrans de la WWE avec un seul show — Ma fédé › Autres shows (les GM, leurs catcheurs,
// rencontrer, échanger, faire monter un talent), apparitions depuis la fiche, la soirée du draft en direct (#/univers/draft).
import { ACT } from "../state.js";
import { esc, toast, modal } from "../util.js";
import { U, go, redraw, persist, shell, face, crest, imgShow } from "./core.js";
import { meF, roster, isMine, champIds } from "./base.js";
import { fmtM, stars, dayLabel } from "./world.js";
import { MACTS } from "./ui.js";
import { brands, others, brandGM, brandRoster, tradeAsk, tradeValue, callUpPool, callUp, meet, hosts, visit, draftTurn, draftPool, draftPick, draftStep, draftEnd } from "./brand.js";

const logo = (G, br, sz) => { const s = imgShow(G, G.me, br); return s ? '<img class="uvbrl" src="' + esc(s) + '" alt="' + esc(br) + '" style="width:' + sz + "px;height:" + sz + 'px">' : '<span class="uvbrl ini" style="width:' + sz + "px;height:" + sz + 'px">' + esc(br.slice(0, 3).toUpperCase()) + "</span>"; };
const line = (G, w, btns) => '<div class="uvline uvbrw">' + face(G, w, 38) + '<a class="uvgrow" href="#/univers/c/' + esc(w.id) + '"><b>' + esc(w.n) + "</b><small>Pop " + Math.round(w.pop) + (Object.values(G.T).some(t => champIds(t).indexOf(w.id) >= 0) ? " · champion" + (w.sx === "f" ? "ne" : "") : "") + "</small></a>" + btns + "</div>";

// catcheur d'un autre show : nom sur toute la largeur, boutons dessous
const line2 = (G, w) => '<div class="uvbrw2">' + face(G, w, 40) + '<a href="#/univers/c/' + esc(w.id) + '"><b>' + esc(w.n) + "</b><small>Pop " + Math.round(w.pop) + (Object.values(G.T).some(t => champIds(t).indexOf(w.id) >= 0) ? " · champion" + (w.sx === "f" ? "ne" : "") : "") + "</small></a>" +
  '<div class="uvbrb"><button type="button" class="uvbtn sm" data-act="uvmeet" data-w="' + esc(w.id) + '">Rencontrer</button><button type="button" class="uvbtn sm" data-act="uvtrade" data-w="' + esc(w.id) + '">Échanger</button></div></div>';
ACT.uvbrall = el => { U.f.brAll = U.f.brAll || {}; U.f.brAll[el.dataset.b] = 1; redraw(); };
// ---------- Ma fédé › Autres shows ----------
U.brandBody = G => {
  if (!G.solo) return '<p class="uvempty">Tu diriges toute la fédération.</p>';
  const cu = callUpPool(G).sort((a, b) => b.pop - a.pop).slice(0, 12), V = (G.visits || []).filter(v => !v.done && v.day >= G.day);
  return (U.draftTile ? U.draftTile(G) : "") +
    '<p class="uvsm">Tu diriges <b>' + esc(G.solo) + "</b>. Chaque autre show a son GM. Tu peux échanger avec eux à tout moment (un essai par semaine et par show), croiser leurs catcheurs dans les couloirs et faire monter des talents.</p>" +
    others(G).map(br => { const R = brandRoster(G, br).sort((a, b) => b.pop - a.pop), B = (G.brands || {})[br];
      return '<details class="uvbrand"' + (br === others(G)[0] ? " open" : "") + "><summary>" + logo(G, br, 44) + '<span class="uvgrow"><b>' + esc(br) + "</b><small>GM : " + esc(brandGM(G, br)) + " · " + R.length + " catcheurs" + (B && B.last ? " · dernier show " + stars(B.last.r) + " · " + fmtM(B.last.aud) : "") + "</small></span></summary>" +
        (U.f.brAll && U.f.brAll[br] ? R : R.slice(0, 12)).map(w => line2(G, w)).join("") + (R.length > 12 && !(U.f.brAll && U.f.brAll[br]) ? '<button type="button" class="uvbtn ghost" data-act="uvbrall" data-b="' + esc(br) + '">Voir les ' + (R.length - 12) + " autres</button>" : "") + "</details>"; }).join("") +
    (cu.length ? '<h3 class="uvh3">Faire monter un talent</h3><p class="uvsm">Deux montées par mois au plus. Les champions restent dans leur show.</p>' + cu.map(w => line(G, w, '<small class="uvmut">' + esc(w.br) + '</small><button type="button" class="uvbtn sm pri" data-act="uvcallup" data-w="' + esc(w.id) + '">Faire monter</button>')).join("") : "") +
    (V.length ? '<h3 class="uvh3">Apparitions prévues</h3>' + V.map(v => line(G, G.W[v.w], '<small class="uvmut">' + esc(v.n) + " · " + esc(dayLabel(v.day)) + "</small>")).join("") : "");
};
ACT.uvcallup = el => { const G = U.G, r = callUp(G, el.dataset.w); if (r) toast(r, { ms: 3500 }); persist(); redraw(); };
// rencontrer : une petite scène dans les couloirs
ACT.uvmeet = el => {
  const G = U.G, w = G.W[el.dataset.w], r = meet(G, el.dataset.w); if (!r) return; persist();
  modal((box, close) => { box.classList.add("uvmodal", "uvmeetm"); box.innerHTML = '<div class="uvscene" data-bg="couloir">' + face(G, w, 96) + "</div><small class=\"uvmut\">Dans les couloirs de la WWE</small><p class=\"uvquote " + esc(r.mood) + "\">" + esc(r.txt) + '</p><button type="button" class="uvbtn pri" data-x="1">Continuer</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-x]")) { close(); redraw(); } }); });
};
// échanger : je choisis qui je donne (2 au plus) contre ce catcheur
ACT.uvtrade = el => {
  const G = U.G, w = G.W[el.dataset.w]; if (!w) return; const mine = roster(G).sort((a, b) => b.pop - a.pop), sel = new Set();
  modal((box, close) => {
    box.classList.add("uvmodal", "uvtradem");
    const paint = () => { box.innerHTML = "<h3>Échange avec " + esc(w.br) + "</h3><p class=\"uvmut\">" + esc(brandGM(G, w.br)) + " écoute ton offre.</p>" +
      '<div class="uvtrade"><div><small>Tu veux</small>' + face(G, w, 64) + "<b>" + esc(w.n) + "</b></div><i>⇄</i><div><small>Tu donnes</small>" + (sel.size ? Array.from(sel).map(i => face(G, G.W[i], 40)).join("") : '<span class="uvmut">Choisis 1 ou 2 catcheurs</span>') + "</div></div>" +
      '<div class="uvtradel">' + mine.map(x => '<button type="button" class="uvpkr' + (sel.has(x.id) ? " on" : "") + '" data-w="' + esc(x.id) + '">' + face(G, x, 34) + '<span class="uvgrow"><b>' + esc(x.n) + "</b><small>Pop " + Math.round(x.pop) + "</small></span>" + (sel.has(x.id) ? "✓" : "") + "</button>").join("") + "</div>" +
      '<button type="button" class="uvbtn pri" data-go="1"' + (sel.size ? "" : " disabled") + '>Proposer l’échange</button><button type="button" class="uvbtn ghost" data-x="1">Annuler</button>'; };
    paint();
    box.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.x) return close();
      if (b.dataset.w) { const i = b.dataset.w; if (sel.has(i)) sel.delete(i); else if (sel.size < 2) sel.add(i); paint(); return; }
      if (b.dataset.go) { const r = tradeAsk(G, Array.from(sel), [w.id]); persist(); box.innerHTML = '<h3>' + (r.ok ? "Échange accepté !" : "Échange refusé") + '</h3><p class="uvquote">' + esc(r.txt) + '</p><button type="button" class="uvbtn pri" data-x="1">OK</button>'; if (r.ok) setTimeout(redraw, 50); }
    });
  });
};
// apparition : envoyer un de mes catcheurs dans un autre show ou une autre fédération
ACT.uvvisit = el => {
  const G = U.G, w = G.W[el.dataset.w]; if (!w) return; const H = hosts(G);
  modal((box, close) => {
    box.classList.add("uvmodal", "uvpick");
    box.innerHTML = "<h3>Où " + esc(w.n) + " fait-" + (w.sx === "f" ? "elle" : "il") + " une apparition ?</h3><p class=\"uvmut\">Une soirée chez les autres : sa popularité monte, et une autre fédération te paie et t’apprécie un peu plus.</p>" +
      H.map(h => '<button type="button" class="uvpkr" data-h="' + esc(h.id) + '">' + (h.fed ? crest(G, h.id, 36) : logo(G, h.n, 36)) + '<span class="uvgrow"><b>' + esc(h.n) + "</b><small>" + (h.fed ? "Autre fédération" : "Un autre show de " + esc(meF(G).n)) + "</small></span></button>").join("") + '<button type="button" class="uvbtn ghost" data-x="1">Annuler</button>';
    box.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.x) return close(); if (b.dataset.h) { const r = visit(G, w.id, b.dataset.h); close(); if (r) toast(r, { ms: 3500 }); persist(); redraw(); } });
  });
};
// boutons en haut d'une fiche
U.ficheX = (G, w) => {
  if (!w || w.ret) return "";
  if (G.solo && w.fed === G.me && w.br && w.br !== G.solo) return '<div class="uvrow2 uvfx"><button type="button" class="uvbtn sm" data-act="uvmeet" data-w="' + esc(w.id) + '">Le rencontrer</button><button type="button" class="uvbtn sm pri" data-act="uvtrade" data-w="' + esc(w.id) + '">Proposer un échange</button>' + (callUpPool(G).indexOf(w) >= 0 ? '<button type="button" class="uvbtn sm" data-act="uvcallup" data-w="' + esc(w.id) + '">Faire monter</button>' : "") + "</div>";
  if (isMine(G, w)) return '<div class="uvrow2 uvfx"><button type="button" class="uvbtn sm" data-act="uvvisit" data-w="' + esc(w.id) + '">Faire une apparition…</button></div>';
  return "";
};

// ---------- lettres des autres GM ----------
MACTS.trade = m => [["Accepter l’échange", "tradeyes"], ["Refuser", "tradeno"]];
MACTS.callup = m => [["Le laisser monter", "cuyes"], ["Le garder", "cuno"]];
MACTS.draft = m => [["Aller au draft", "go", "#/univers/draft"], ["Plus tard", "ok"]];
U.mact = Object.assign(U.mact || {}, {
  tradeyes: (G, m) => { const give = (m.get || []).map(i => G.W[i]), get = (m.give || []).map(i => G.W[i]); if (give.some(w => !isMine(G, w)) || get.some(w => !w || w.fed !== G.me || w.br !== m.br)) return "L’échange n’est plus possible.";
    give.forEach(w => { w.br = m.br; }); get.forEach(w => { w.br = G.solo; w.mor = Math.min(100, w.mor + 5); }); return "Échange fait : " + get.map(w => w.n).join(", ") + " arrive à " + G.solo + "."; },
  tradeno: (G, m) => "Tu refuses. " + (m.from || "Le GM") + " ira voir ailleurs.",
  cuyes: (G, m) => { const w = G.W[m.w]; if (!w || !isMine(G, w)) return "Trop tard."; w.br = m.br; w.mor = Math.min(100, w.mor + 10); return w.n + " monte à " + m.br + ". Le vestiaire salue ton geste."; },
  cuno: (G, m) => { const w = G.W[m.w]; if (w) w.mor = Math.max(0, w.mor - 8); return (w ? w.n : "Le catcheur") + " reste à " + G.solo + "… et le prend mal."; }
});

// ---------- la soirée du draft ----------
U.draftTile = G => { const D = G.draft; if (!D || D.st === "done" || !G.solo) return "";
  return '<a class="uvdtile uvdrt" href="#/univers/draft"><span class="uvdmini"><span class="uvdmc">' + logo(G, G.solo, 46) + '</span></span><span class="uvgrow"><small>' + (D.st === "live" ? "Le draft est en cours" : "Avant le " + esc(dayLabel(D.until))) + "</small><b>La soirée du draft</b><span>" + esc(D.order.join(" · ")) + "</span></span><em>Y aller</em></a>"; };
export function draftView() {
  const G = U.G, D = G.draft;
  if (!D || !G.solo) return shell("fede", "Draft", "", '<p class="uvempty">Pas de draft en ce moment. Il a lieu chaque année fin avril.</p><a class="uvbtn" href="#/univers/fede/br">Les autres shows</a>');
  const R = Math.floor(D.k / D.order.length) + 1, turn = draftTurn(G), last = D.picks[D.picks.length - 1], me = turn === G.solo && D.st !== "done";
  const order = '<div class="uvdro">' + D.order.map(b => '<span class="' + (b === turn && D.st !== "done" ? "on" : "") + (b === G.solo ? " me" : "") + '">' + logo(G, b, 34) + "<small>" + esc(b) + "</small></span>").join("") + "</div>";
  const card = last ? '<div class="uvdrc" aria-live="polite"><small>' + esc(last.br) + " choisit…</small>" + face(G, G.W[last.w], 120) + "<b>" + esc(G.W[last.w].n) + "</b><span>venu" + (G.W[last.w].sx === "f" ? "e" : "") + " de " + esc(last.from) + (last.with ? " · avec " + esc(G.W[last.with].n) : "") + "</span></div>" : '<div class="uvdrc"><small>WWE Draft</small><b>Les GM sont prêts</b><span>' + esc(D.order[0]) + " ouvre le bal.</span></div>";
  let act = "";
  if (D.st === "done") { const inn = D.picks.filter(p => p.br === G.solo), out = D.picks.filter(p => p.from === G.solo);
    act = '<h3 class="uvh3">Arrivent à ' + esc(G.solo) + "</h3>" + (inn.length ? inn.map(p => line(G, G.W[p.w], '<small class="uvmut">de ' + esc(p.from) + "</small>")).join("") : '<p class="uvmut">Personne.</p>') +
      '<h3 class="uvh3">Partent</h3>' + (out.length ? out.map(p => line(G, G.W[p.w], '<small class="uvmut">à ' + esc(p.br) + "</small>")).join("") : '<p class="uvmut">Personne.</p>') + '<a class="uvbtn pri" href="#/univers/g">Retour au menu</a>'; }
  else if (me) { const sx = U.f.drsx || "", L = draftPool(G, G.solo).filter(w => !sx || w.sx === sx).sort((a, b) => b.pop - a.pop).slice(0, 40);
    act = '<p class="uvdrme">À toi de choisir !</p><div class="uvchips">' + [["", "Tous"], ["h", "Hommes"], ["f", "Femmes"]].map(x => '<button type="button" class="uvchip' + (sx === x[0] ? " on" : "") + '" data-act="uvdrsx" data-v="' + x[0] + '">' + x[1] + "</button>").join("") + "</div>" +
      L.map(w => line(G, w, '<small class="uvmut">' + esc(w.br) + '</small><button type="button" class="uvbtn sm pri" data-act="uvdrpick" data-w="' + esc(w.id) + '">Choisir</button>')).join("") + '<button type="button" class="uvbtn ghost" data-act="uvdrstep" data-h="auto">Laisser mon bras droit finir le draft</button>'; }
  else act = '<div class="uvrow2"><button type="button" class="uvbtn pri" data-act="uvdrstep" data-h="next">Choix suivant</button><button type="button" class="uvbtn" data-act="uvdrstep" data-h="skip">Jusqu’à mon tour</button></div><button type="button" class="uvbtn ghost" data-act="uvdrstep" data-h="auto">Laisser mon bras droit finir le draft</button>';
  const hist = D.picks.slice(-8, -1).reverse().map(p => '<div class="uvdrh">' + logo(G, p.br, 24) + face(G, G.W[p.w], 28) + "<span>" + esc(G.W[p.w].n) + "</span><small>" + esc(p.from) + " → " + esc(p.br) + "</small></div>").join("");
  return shell("fede", "La soirée du draft", "", '<div class="uvdraft"><div class="uvdrhd"><b>WWE Draft</b><small>' + (D.st === "done" ? "Terminé" : "Tour " + Math.min(R, D.n / D.order.length) + " sur " + D.n / D.order.length) + "</small></div>" + order + card + act + (hist ? '<h3 class="uvh3">Derniers choix</h3>' + hist : "") + "</div>");
}
ACT.uvdrsx = el => { U.f.drsx = el.dataset.v; redraw(); };
ACT.uvdrpick = el => { const G = U.G; if (draftTurn(G) !== G.solo) return; const p = draftPick(G, el.dataset.w); if (p) { if (G.draft.k >= G.draft.n) draftEnd(G); toast(G.W[p.w].n + " rejoint " + G.solo + " !"); } persist(); redraw(); };
ACT.uvdrstep = el => { draftStep(U.G, el.dataset.h); persist(); redraw(); };
