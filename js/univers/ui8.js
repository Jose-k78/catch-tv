// Mode Univers (21 nov., heure du codage) : les écrans de la vie en coulisses — décors dessinés (couloir, bureau, vestiaire, parking,
// cantine, salle de presse, même style que le ring du direct), scènes façon visual novel (#/univers/scene), téléphone (#/univers/tel),
// vestiaire (Ma fédé › Vestiaire : leaders, groupes, solitaires, tensions), négociation face à face.
import { ACT } from "../state.js";
import { esc, toast } from "../util.js";
import { U, go, redraw, persist, shell, face, imgW } from "./core.js";
import { meF } from "./base.js";
import { shortDate, dayLabel } from "./world.js";
import { sceneFor, sceneText, scenePick, telReply, telUnread, locker, influence, bondWord, enWord } from "./vn.js";

// ---------- les décors (SVG, mis en cache) ----------
const DEF = '<defs><radialGradient id="dgl" cx="50%" cy="0%" r="70%"><stop offset="0" stop-color="#ffe3a3" stop-opacity=".55"/><stop offset="1" stop-color="#ffe3a3" stop-opacity="0"/></radialGradient>' +
  '<linearGradient id="dfl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1220" stop-opacity="0"/><stop offset="1" stop-color="#0d1220" stop-opacity=".95"/></linearGradient>' +
  '<radialGradient id="dsp" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#f5b13d" stop-opacity=".5"/><stop offset="1" stop-color="#f5b13d" stop-opacity="0"/></radialGradient></defs>';
const BGS = {
  couloir: () => '<rect width="400" height="240" fill="#0d1220"/><polygon points="0,0 400,0 246,86 154,86" fill="#141b2b"/><polygon points="0,240 400,240 246,138 154,138" fill="#1a2131"/>' +
    '<polygon points="0,0 154,86 154,138 0,240" fill="#222b3f"/><polygon points="400,0 246,86 246,138 400,240" fill="#1d2537"/>' +
    '<rect x="154" y="86" width="92" height="52" fill="#2a2312"/><rect x="186" y="96" width="28" height="42" fill="#f5b13d" opacity=".85"/><rect x="183" y="90" width="34" height="5" fill="#e8423f"/>' +
    [[150, 250, 6, 16], [168, 232, 30, 37], [180, 220, 52, 57], [188, 212, 68, 71]].map(l => '<polygon points="' + l[0] + "," + l[2] + " " + l[1] + "," + l[2] + " " + (l[1] - 6) + "," + l[3] + " " + (l[0] + 6) + "," + l[3] + '" fill="#ffe3a3" opacity=".85"/>').join("") +
    '<polygon points="22,58 64,78 64,190 22,212" fill="#2e3a55"/><polygon points="92,92 116,102 116,160 92,172" fill="#2e3a55"/><circle cx="58" cy="136" r="2.5" fill="#f5b13d"/>' +
    '<polygon points="300,96 352,74 352,132 300,140" fill="#3a2c48"/><polygon points="306,100 346,83 346,126 306,133" fill="#e8423f" opacity=".55"/><polygon points="268,112 288,104 288,138 268,141" fill="#244266"/>' +
    '<polyline points="0,226 154,134" stroke="#f5b13d" stroke-width="1" opacity=".25"/><polyline points="400,226 246,134" stroke="#f5b13d" stroke-width="1" opacity=".25"/>' +
    '<ellipse cx="200" cy="200" rx="120" ry="22" fill="url(#dsp)" opacity=".5"/>',
  bureau: () => '<rect width="400" height="240" fill="#1a2133"/><rect y="168" width="400" height="72" fill="#121827"/>' +
    '<rect x="34" y="26" width="150" height="104" rx="4" fill="#0b1020" stroke="#2f3a55" stroke-width="5"/>' +
    [[40, 74, 22, 56], [64, 60, 18, 70], [84, 84, 26, 46], [112, 52, 20, 78], [134, 70, 24, 60], [160, 90, 20, 40]].map(b => '<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '" fill="#1b2438"/>' +
      Array.from({ length: 4 }, (x, i) => '<rect x="' + (b[0] + 4 + (i % 2) * 9) + '" y="' + (b[1] + 6 + Math.floor(i / 2) * 12) + '" width="4" height="5" fill="#f5b13d" opacity="' + (i % 3 ? ".8" : ".35") + '"/>').join("")).join("") +
    '<line x1="109" y1="26" x2="109" y2="130" stroke="#2f3a55" stroke-width="4"/><circle cx="160" cy="44" r="9" fill="#ffe3a3" opacity=".8"/>' +
    '<rect x="270" y="40" width="96" height="62" rx="4" fill="#232c42" stroke="#5b4a26" stroke-width="3"/><ellipse cx="318" cy="71" rx="34" ry="13" fill="#3b2d14"/><ellipse cx="318" cy="71" rx="16" ry="15" fill="#f5b13d"/><circle cx="318" cy="71" r="7" fill="#e8423f"/>' +
    '<rect x="214" y="46" width="34" height="46" fill="#2c3650"/><rect x="218" y="50" width="26" height="30" fill="#e8423f" opacity=".5"/>' +
    '<polygon points="0,190 400,190 400,240 0,240" fill="#3a2a1c"/><rect y="186" width="400" height="6" fill="#5a4128"/>' +
    '<polygon points="330,186 352,150 362,150 346,186" fill="#2b2b2b"/><polygon points="344,150 372,150 380,166 336,166" fill="#f5b13d" opacity=".9"/><ellipse cx="358" cy="190" rx="60" ry="10" fill="url(#dsp)"/>' +
    '<rect x="40" y="176" width="70" height="10" rx="2" fill="#e9e1cf" opacity=".85"/><rect x="60" y="172" width="40" height="6" rx="2" fill="#cfc4ad" opacity=".85"/>',
  vestiaire: () => '<rect width="400" height="240" fill="#151c2b"/><rect width="400" height="10" fill="#0d1220"/><rect x="120" y="10" width="160" height="5" fill="#ffe3a3" opacity=".8"/><rect y="10" width="400" height="150" fill="url(#dgl)"/>' +
    Array.from({ length: 10 }, (x, i) => { const X = 4 + i * 40; return '<rect x="' + X + '" y="34" width="36" height="128" fill="' + (i % 2 ? "#24304a" : "#273450") + '"/><rect x="' + (X + 2) + '" y="36" width="32" height="124" fill="none" stroke="#33415f"/>' +
      [44, 50, 56].map(y => '<rect x="' + (X + 10) + '" y="' + y + '" width="16" height="2" fill="#141b2b"/>').join("") + '<rect x="' + (X + 28) + '" y="96" width="3" height="12" fill="#8a93a8"/><text x="' + (X + 18) + '" y="80" fill="#5f6b86" font-size="9" text-anchor="middle" font-family="sans-serif">' + (i + 1) + "</text>"; }).join("") +
    '<polygon points="120,34 156,34 156,162 120,162" fill="#e8423f" opacity=".18"/><rect x="128" y="104" width="22" height="40" rx="3" fill="#eef1f6" opacity=".7"/>' +
    '<rect y="162" width="400" height="78" fill="#1c2233"/>' + Array.from({ length: 9 }, (x, i) => '<line x1="' + (i * 50) + '" y1="162" x2="' + (i * 50 - 40) + '" y2="240" stroke="#262e42"/>').join("") +
    '<rect x="40" y="186" width="320" height="12" rx="3" fill="#6b4e2e"/><rect x="40" y="186" width="320" height="3" fill="#8a6a42"/><rect x="60" y="198" width="8" height="30" fill="#3a2a1c"/><rect x="332" y="198" width="8" height="30" fill="#3a2a1c"/>' +
    '<rect x="250" y="174" width="44" height="14" rx="5" fill="#2e5fa8"/><rect x="250" y="174" width="44" height="4" rx="2" fill="#6fb3ff" opacity=".6"/>',
  parking: () => '<rect width="400" height="240" fill="#0a0e18"/><rect y="0" width="400" height="120" fill="#121a2c"/><rect x="40" y="18" width="320" height="88" fill="#1a2238"/>' +
    '<rect x="150" y="30" width="100" height="22" rx="3" fill="#2a2312"/><text x="200" y="46" text-anchor="middle" fill="#f5b13d" font-size="13" font-family="Impact,sans-serif" letter-spacing="2">ARENA</text>' +
    Array.from({ length: 12 }, (x, i) => '<rect x="' + (52 + i * 26) + '" y="66" width="14" height="10" fill="#f5b13d" opacity="' + (i % 3 ? ".55" : ".2") + '"/>').join("") +
    '<rect y="118" width="400" height="122" fill="#161c2a"/>' + [0, 1, 2, 3, 4, 5].map(i => '<line x1="' + (10 + i * 80) + '" y1="240" x2="' + (90 + i * 50) + '" y2="130" stroke="#eef1f6" stroke-width="2" opacity=".35"/>').join("") +
    '<rect x="18" y="60" width="16" height="180" fill="#2a3246"/><rect x="366" y="60" width="16" height="180" fill="#262d40"/><circle cx="26" cy="58" r="30" fill="url(#dsp)"/><circle cx="374" cy="58" r="30" fill="url(#dsp)"/><rect x="18" y="52" width="16" height="8" fill="#ffe3a3"/><rect x="366" y="52" width="16" height="8" fill="#ffe3a3"/>' +
    '<path d="M44 196 q6-26 34-30 l30-14 q30-10 64 0 l26 14 q24 4 28 30 z" fill="#0c111d"/><circle cx="84" cy="200" r="14" fill="#06080e"/><circle cx="186" cy="200" r="14" fill="#06080e"/><rect x="214" y="180" width="12" height="6" fill="#e8423f"/><path d="M112 156 l26-10 q20-6 40 0 l18 10 z" fill="#24304a"/>',
  cantine: () => '<rect width="400" height="240" fill="#231d17"/><rect y="0" width="400" height="160" fill="#2b241c"/>' +
    [100, 200, 300].map(x => '<line x1="' + x + '" y1="0" x2="' + x + '" y2="30" stroke="#5a4a36"/><polygon points="' + (x - 18) + ",30 " + (x + 18) + ",30 " + (x + 10) + ",20 " + (x - 10) + ',20" fill="#3a3024"/><ellipse cx="' + x + '" cy="70" rx="70" ry="50" fill="url(#dsp)" opacity=".7"/>').join("") +
    '<rect x="30" y="44" width="110" height="70" rx="4" fill="#15120e" stroke="#5a4a36" stroke-width="3"/>' + [56, 68, 80, 92].map((y, i) => '<rect x="42" y="' + y + '" width="' + [70, 56, 84, 50][i] + '" height="4" fill="#eef1f6" opacity=".55"/>').join("") + '<text x="85" y="52" fill="#f5b13d" font-size="9" text-anchor="middle" font-family="sans-serif">MENU</text>' +
    '<rect x="300" y="60" width="54" height="76" rx="4" fill="#3d3d44"/><rect x="310" y="70" width="34" height="18" fill="#15120e"/><circle cx="327" cy="104" r="5" fill="#f5b13d"/><rect x="318" y="118" width="18" height="16" fill="#eef1f6" opacity=".8"/>' +
    '<rect y="160" width="400" height="80" fill="#1c1712"/><polygon points="0,176 400,176 400,212 0,212" fill="#6b5038"/><rect y="174" width="400" height="4" fill="#8a6a42"/>' +
    [60, 150, 250, 340].map(x => '<ellipse cx="' + x + '" cy="190" rx="26" ry="7" fill="#c9c1b0" opacity=".8"/><circle cx="' + (x + 30) + '" cy="186" r="6" fill="#eef1f6" opacity=".8"/>').join(""),
  gym: () => '<rect width="400" height="240" fill="#141a28"/><rect y="0" width="400" height="12" fill="#0d1220"/>' + [80, 200, 320].map(x => '<rect x="' + (x - 40) + '" y="12" width="80" height="4" fill="#ffe3a3" opacity=".8"/>').join("") + '<rect y="12" width="400" height="140" fill="url(#dgl)"/>' +
    '<rect x="20" y="40" width="70" height="40" fill="#1f2840"/><text x="55" y="64" text-anchor="middle" fill="#f5b13d" font-size="10" font-family="Impact,sans-serif" letter-spacing="1">TRAINING</text>' +
    '<polygon points="70,200 330,200 300,140 100,140" fill="#d9dde6"/><polygon points="70,200 330,200 330,212 70,212" fill="#2e5fa8"/>' + [146, 156, 166].map((y, i) => '<line x1="' + (100 - i * 10) + '" y1="' + (y - 20) + '" x2="' + (300 + i * 10) + '" y2="' + (y - 20) + '" stroke="' + ["#e8423f", "#eef1f6", "#2e5fa8"][i] + '" stroke-width="2"/>').join("") +
    '<rect x="96" y="112" width="6" height="90" fill="#8a93a8"/><rect x="298" y="112" width="6" height="90" fill="#8a93a8"/>' +
    '<rect x="340" y="150" width="50" height="6" fill="#5f6b86"/><circle cx="344" cy="153" r="11" fill="#2b2b2b"/><circle cx="386" cy="153" r="11" fill="#2b2b2b"/><rect x="10" y="160" width="40" height="40" rx="6" fill="#e8423f" opacity=".7"/>',
  presse: () => '<rect width="400" height="240" fill="#121827"/>' +
    Array.from({ length: 48 }, (x, i) => { const c = i % 8, r = Math.floor(i / 8); return '<rect x="' + (12 + c * 48 + (r % 2) * 24) + '" y="' + (12 + r * 26) + '" width="20" height="14" rx="2" fill="' + ((c + r) % 2 ? "#f5b13d" : "#2e5fa8") + '" opacity=".35"/>'; }).join("") +
    '<rect y="0" width="400" height="170" fill="url(#dgl)"/><rect y="170" width="400" height="70" fill="#0d1220"/><rect x="20" y="170" width="360" height="30" fill="#232c42"/><rect x="20" y="170" width="360" height="4" fill="#f5b13d"/>' +
    [120, 200, 280].map(x => '<rect x="' + (x - 2) + '" y="150" width="4" height="22" fill="#5f6b86"/><rect x="' + (x - 6) + '" y="140" width="12" height="14" rx="5" fill="#2b2b2b"/>').join("") +
    [[40, 40], [360, 60], [70, 110]].map(p => '<g transform="translate(' + p[0] + " " + p[1] + ')"><polygon points="0,-14 4,-4 14,0 4,4 0,14 -4,4 -14,0 -4,-4" fill="#ffffff" opacity=".8"/><circle r="5" fill="#ffffff"/></g>').join("")
};
const CACHE = {};
export const decor = k => { k = BGS[k] ? k : "couloir"; if (!CACHE[k]) CACHE[k] = '<svg class="uvdecor" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + DEF + BGS[k]() + '<rect width="400" height="240" fill="url(#dfl)"/></svg>'; return CACHE[k]; };
const PLACE = { couloir: "Dans les couloirs", bureau: "Ton bureau", vestiaire: "Le vestiaire", parking: "Le parking", cantine: "La cantine", presse: "Salle de presse" };
const portrait = (G, w) => { const p = imgW(G, w); return p ? '<img class="uvvnp" src="' + esc(p) + '" alt="">' : '<span class="uvvnp ini">' + esc(w.n.split(/\s+/).map(x => x[0]).join("").slice(0, 2)) + "</span>"; };

// ---------- la scène (visual novel) ----------
export function sceneView() {
  const G = U.G; let sc = G.scCur;
  if (!sc && (G.scQ || []).length) { sc = G.scCur = Object.assign({ st: 0 }, G.scQ.shift()); persist(); }
  if (!sc || !G.W[sc.w]) return shell("g", "Coulisses", "", '<div class="uvvn">' + decor("couloir") + '<div class="uvvnbox"><p>Personne dans les couloirs pour l’instant.</p><a class="uvbtn pri" href="#/univers/g">Retour</a></div></div>');
  const T = sceneText(G, sc), w = G.W[sc.w];
  const box = sc.st === 0 ? '<div class="uvvnbox" aria-live="polite"><b class="uvvnn">' + esc(w.n) + "</b>" + T.t.map((l, i) => "<p" + (i ? ' class="say"' : "") + ">" + esc(l) + "</p>").join("") +
      '<div class="uvvnch" role="group" aria-label="Ta réponse">' + T.ch.map((c, i) => '<button type="button" class="uvbtn" data-act="uvscpick" data-i="' + i + '">' + esc(c) + "</button>").join("") + "</div></div>"
    : '<div class="uvvnbox" aria-live="polite"><b class="uvvnn">' + esc(w.n) + '</b><p class="say">' + esc(T.rep[sc.i]) + '</p><button type="button" class="uvbtn pri" data-act="uvscend">Continuer</button></div>';
  return shell("g", PLACE[T.bg] || "Coulisses", "", '<div class="uvvn" data-bg="' + esc(T.bg) + '">' + decor(T.bg) + '<span class="uvvnpl">' + esc(PLACE[T.bg] || "") + "</span>" + portrait(G, w) + box + "</div>");
}
ACT.uvscpick = el => { const G = U.G, sc = G.scCur; if (!sc || sc.st) return; const r = scenePick(G, sc, +el.dataset.i); if (!r) return; sc.st = 1; sc.i = +el.dataset.i; sc.go = r.go; persist(); redraw(); };
ACT.uvscend = () => { const G = U.G, sc = G.scCur; G.scCur = null; persist(); if (sc && sc.go === "nego") return go("#/univers/nego/" + sc.w); if ((G.scQ || []).length) return redraw(); go("#/univers/g"); };
// un tour dans les coulisses (2 par jour)
ACT.uvwalk = () => { const G = U.G; G.walk = G.walk && G.walk.d === G.day ? G.walk : { d: G.day, n: 0 }; if (G.walk.n >= 2) { toast("Tu as déjà fait deux tours aujourd’hui. Reviens demain."); return; }
  const s = sceneFor(G); if (!s) { toast("Les couloirs sont vides."); return; } G.walk.n++; G.scCur = Object.assign({ st: 0 }, s); persist(); go("#/univers/scene"); };
U.sceneTile = G => { const q = (G.scQ || [])[0], w = q && G.W[q.w]; return (w ? '<a class="uvdtile uvsct" href="#/univers/scene"><span class="uvdmini"><span class="uvdmc">' + face(G, w, 46) + '</span></span><span class="uvgrow"><small>' + esc(PLACE[(sceneText(G, q) || {}).bg] || "Coulisses") + "</small><b>" + esc(w.n) + " veut te voir</b><span>Ça ne peut pas attendre longtemps.</span></span><em>Y aller</em></a>" : "") +
  '<button type="button" class="uvbtn ghost uvwalk" data-act="uvwalk">Faire un tour dans les coulisses</button>'; };

// ---------- le téléphone (SMS et DM) ----------
export function telView(id) {
  const G = U.G, L = G.tel || [];
  if (id) { const th = L.find(t => t.id === id); if (!th) return go("#/univers/tel") || "";
    if (!th.ch) th.read = true; persist(); const w = G.W[th.who];
    return shell("tel", th.n, "", '<a class="uvback" href="#/univers/tel">‹ Messages</a><div class="uvphone"><div class="uvphh">' + (w ? face(G, w, 40) : '<span class="uvav ini" style="width:40px;height:40px;background:#6fb3ff">' + esc(th.n.replace(/^(Le|La|Ton) /, "").slice(0, 2).toUpperCase()) + "</span>") + "<b>" + esc(th.n) + "</b></div>" +
      '<div class="uvchat">' + th.msgs.map(m => '<div class="uvbub ' + (m[0] === "me" ? "me" : "him") + '">' + esc(m[1]) + "<small>" + esc(shortDate(m[2])) + "</small></div>").join("") + "</div>" +
      (th.ch ? '<div class="uvphch" role="group" aria-label="Répondre">' + th.ch.map(c => '<button type="button" class="uvbtn" data-act="uvtelr" data-id="' + esc(th.id) + '" data-k="' + esc(c[1]) + '">' + esc(c[0].replace("Il/elle", w && w.sx === "f" ? "Elle" : "Il")) + "</button>").join("") + "</div>" : "") + "</div>"); }
  return shell("tel", "Messages", "", L.length ? '<div class="uvtll">' + L.map(t => { const w = G.W[t.who], m = t.msgs[t.msgs.length - 1] || ["", ""];
    return '<a class="uvtl' + (t.read ? "" : " new") + '" href="#/univers/tel/' + esc(t.id) + '">' + (w ? face(G, w, 44) : '<span class="uvav ini" style="width:44px;height:44px;background:#6fb3ff">' + esc(t.n.replace(/^(Le|La|Ton) /, "").slice(0, 2).toUpperCase()) + "</span>") + '<span class="uvgrow"><b>' + esc(t.n) + "</b><small>" + (m[0] === "me" ? "Toi : " : "") + esc(m[1]) + "</small></span><em>" + esc(shortDate(t.d || 0)) + "</em></a>"; }).join("") + "</div>" : '<p class="uvempty">Pas encore de message. Les catcheurs et ton staff t’écrivent au fil des jours.</p>');
}
ACT.uvtelr = el => { const G = U.G, th = (G.tel || []).find(t => t.id === el.dataset.id); if (!th || !th.ch) return; const c = th.ch.find(x => x[1] === el.dataset.k); const r = telReply(G, th, el.dataset.k, c ? c[0] : ""); persist(); if (r.go) return go(r.go); redraw(); };
U.telBadge = G => telUnread(G);

// ---------- Ma fédé › Vestiaire ----------
U.lockerBody = G => {
  const L = locker(G), lw = l => { const v = influence(G, l); return v >= 70 ? "Sa voix compte énormément" : v >= 55 ? "Très écouté" + (l.sx === "f" ? "e" : "") : "Écouté" + (l.sx === "f" ? "e" : ""); };
  const fc = id => '<a href="#/univers/c/' + esc(id) + '" title="' + esc((G.W[id] || {}).n || "") + '">' + face(G, G.W[id], 40) + "</a>";
  return '<div class="uvlock">' + decor("vestiaire") + "<b>Le vestiaire</b><small>Ce que tu observes, et ce qu’on te raconte.</small></div>" +
    '<h3 class="uvh3">Les leaders</h3>' + L.leaders.map(l => '<div class="uvline">' + face(G, l, 44) + '<span class="uvgrow"><b>' + esc(l.n) + "</b><small>" + lw(l) + " · " + esc(bondWord(l)) + "</small></span></div>").join("") +
    '<h3 class="uvh3">Les groupes</h3>' + (L.groups.length ? L.groups.map(g => '<div class="uvlkg"><small>' + esc(g.n || "Une bande d’amis") + '</small><div class="uvlkf">' + g.m.map(fc).join("") + "</div></div>").join("") : '<p class="uvmut">Pas de vrai groupe pour l’instant.</p>') +
    '<h3 class="uvh3">Les solitaires</h3>' + (L.alone.length ? '<div class="uvlkf">' + L.alone.slice(0, 14).map(w => fc(w.id)).join("") + "</div>" : '<p class="uvmut">Personne n’est mis à l’écart.</p>') +
    '<h3 class="uvh3">Les tensions</h3>' + (L.tens.length ? L.tens.slice(0, 8).map(p => '<div class="uvlkt">' + fc(p[0]) + '<i aria-label="contre">⚡</i>' + fc(p[1]) + "<span>" + esc(G.W[p[0]].n + " et " + G.W[p[1]].n) + "</span></div>").join("") : '<p class="uvmut">Le calme règne.</p>');
};

// ---------- négociation face à face (en-tête dessiné) ----------
U.negoScene = (G, w, N) => { const last = (N.log || []).filter(m => m[0] === "him").slice(-1)[0];
  return '<div class="uvvn uvneg">' + decor("bureau") + '<span class="uvvnpl">Ton bureau</span>' + portrait(G, w) + (w.fed !== G.me ? '<span class="uvagent" aria-hidden="true"></span>' : "") + (last ? '<p class="uvvnsay">' + esc(last[1]) + "</p>" : "") + "</div>"; };
U.enWord = enWord;
