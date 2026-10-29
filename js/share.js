// Partage dans l'app : appui long (ou clic droit) sur un article, une fiche catcheur, un show, un PLE, un titre,
// une storyline, un sondage ou une vidéo -> « Partager » dans la Gorilla Position ou en message privé,
// avec un message facultatif. Le message porte une carte (titre, source, lien) ; une carte « spoiler » reste masquée
// dans la discussion tant qu'on n'a pas touché pour la voir.
import { S, B, ACT, prof, avatar, nameOf } from "./state.js";
import { esc, modal, toast, okHttp } from "./util.js";
import { namesIn } from "./wrestlers.js";
import { pushPing } from "./push.js";

const ICO = { art: "📰", w: "🤼", show: "📺", ev: "🎟️", title: "🏆", story: "📖", poll: "📊", vid: "▶️", hl: "🎬" };
const KIND = { art: "Article", w: "Fiche catcheur", show: "Show", ev: "Événement", title: "Titre", story: "Storyline", poll: "Sondage", vid: "Vidéo officielle", hl: "Highlights" };
const okVid = id => typeof id === "string" && /^[\w-]{11}$/.test(id);
const okIn = h => typeof h === "string" && /^#\/[^\s"<>]{0,290}$/.test(h);

// carte propre (vient d'une page ou d'un message : on ne garde que des champs sûrs)
export function cleanCard(c) {
  if (!c || typeof c !== "object" || !ICO[c.ty]) return null;
  const o = { ty: c.ty, t: String(c.t || "").slice(0, 160) };
  if (c.s) o.s = String(c.s).slice(0, 120);
  if (okIn(c.h)) o.h = c.h;
  if (okHttp(c.u) && /^https:/.test(c.u) && c.u.length <= 600) o.u = c.u;
  if (okVid(c.id)) o.id = c.id;
  if (c.k) o.k = String(c.k).slice(0, 30);
  if (c.sp) o.sp = true;
  return o.t && (o.h || o.u || o.id) ? o : null;
}
export const cardLabel = c => (c.sp ? "🙈 Spoiler" : (ICO[c.ty] || "📎") + " " + c.t);

// ---------- dans la discussion ----------
const shown = new Set(); // cartes spoiler dévoilées (jusqu'au rechargement)
export function cardHTML(c, mid) {
  c = cleanCard(c); if (!c) return "";
  const key = mid || c.t;
  if (c.sp && !shown.has(key)) return '<button class="mcard sp" data-act="cardsp" data-k="' + esc(key) + '"><span class="mcico">🙈</span><span class="mctxt"><b>Spoiler</b><small>' + esc((KIND[c.ty] || "") + (c.s ? " · " + c.s : "")) + " — touche pour voir</small></span></button>";
  const inner = '<span class="mcico">' + (ICO[c.ty] || "📎") + '</span><span class="mctxt"><small class="mck">' + esc(KIND[c.ty] || "") + "</small><b>" + esc(c.t) + "</b>" + (c.s ? "<small>" + esc(c.s) + "</small>" : "") + "</span>";
  if (c.ty === "vid" && c.id) return '<button class="mcard" data-act="play" data-id="' + esc(c.id) + '" data-t="' + esc(c.t) + '">' + inner + '<span class="mcgo">▶</span></button>';
  if (c.h) return '<a class="mcard" href="' + esc(c.h) + '">' + inner + '<span class="mcgo">›</span></a>';
  return '<a class="mcard" href="' + esc(c.u) + '" target="_blank" rel="noopener">' + inner + '<span class="mcgo">↗</span></a>';
}
export function revealCard(k) { shown.add(k); }

// ---------- appui long / clic droit ----------
let lpT = null, lpFired = false, lpXY = null;
const target = e => { const el = e.target && e.target.closest && e.target.closest("[data-sh]"); return el && !el.closest("#msgs") ? el : null; };
document.addEventListener("pointerdown", e => {
  lpFired = false; const el = target(e); if (!el || e.button > 0) return;
  lpXY = [e.clientX, e.clientY]; clearTimeout(lpT);
  lpT = setTimeout(() => { lpFired = true; el.classList.add("pressed"); setTimeout(() => el.classList.remove("pressed"), 250); try { if (navigator.vibrate) navigator.vibrate(12); } catch (x) {} openFrom(el); }, 520);
});
["pointerup", "pointercancel", "scroll"].forEach(t => document.addEventListener(t, () => clearTimeout(lpT), true));
document.addEventListener("pointermove", e => { if (lpXY && Math.hypot(e.clientX - lpXY[0], e.clientY - lpXY[1]) > 10) clearTimeout(lpT); }, { passive: true });
// le clic qui suit un appui long n'ouvre pas le lien
document.addEventListener("click", e => { if (lpFired && target(e)) { e.preventDefault(); e.stopPropagation(); lpFired = false; } }, true);
document.addEventListener("contextmenu", e => {
  const el = target(e); if (!el) return;
  e.preventDefault(); clearTimeout(lpT); if (!lpFired) { lpFired = true; openFrom(el); setTimeout(() => { lpFired = false; }, 600); }
});
function openFrom(el) { let c = null; try { c = JSON.parse(el.dataset.sh); } catch (e) {} c = cleanCard(c); if (c) shareMenu(c); }
ACT.share = el => openFrom(el);

// ---------- menu ----------
function preview(c) {
  return '<div class="shprev">' + '<span class="mcico">' + (ICO[c.ty] || "📎") + '</span><span class="mctxt"><small class="mck">' + esc(KIND[c.ty] || "") + "</small><b>" + esc(c.t) + "</b>" + (c.s ? "<small>" + esc(c.s) + "</small>" : "") + "</span></div>";
}
export function shareMenu(c) {
  const names = c.ty === "art" ? namesIn(c.t).slice(0, 3) : [];
  modal((box, close) => {
    box.innerHTML = preview(c) + '<div class="sheet">' +
      '<button class="item" data-a="room">🦍 Partager dans la Gorilla Position</button><button class="item" data-a="dm">✉️ Partager en message privé…</button>' +
      names.map(n => '<a class="item" href="#/catcheur/' + encodeURIComponent(n) + '" data-a="go">🤼 Voir la fiche de ' + esc(n) + "</a>").join("") +
      (c.h ? '<a class="item" href="' + esc(c.h) + '" data-a="go">Ouvrir</a>' : c.u ? '<a class="item" href="' + esc(c.u) + '" target="_blank" rel="noopener" data-a="go">Ouvrir l’article ↗</a>' : "") +
      '</div><button class="btn wide ghost" style="margin-top:12px" data-no>Fermer</button>';
    box.addEventListener("click", e => {
      if (e.target.closest("[data-no]")) return close();
      const a = e.target.closest("[data-a]"); if (!a) return;
      if (a.dataset.a === "go") { close(); return; }
      e.preventDefault(); close();
      if (!S.user) { toast("Connecte-toi pour partager"); location.hash = "#/connexion"; return; }
      if (a.dataset.a === "room") compose(c, "general");
      else pickMember(c);
    });
  });
}
// choix du destinataire : discussions récentes, puis tous les membres
let USERS = null;
function pickMember(c) {
  const me = S.user.uid, recent = S.convs.filter(x => x.last).map(x => x.members.find(u => u !== me)).filter(u => u && S.blocks.indexOf(u) < 0);
  modal((box, close) => {
    const row = uid => '<button class="conv-item" data-u="' + esc(uid) + '" data-name="' + esc((nameOf(uid) || "").toLowerCase()) + '">' + avatar(prof(uid), 40) + '<span class="mid"><b>' + esc(nameOf(uid)) + "</b></span></button>";
    const draw = () => {
      const others = (USERS || []).filter(u => u.uid !== me && recent.indexOf(u.uid) < 0 && S.blocks.indexOf(u.uid) < 0).map(u => u.uid);
      box.querySelector("#shlist").innerHTML = (recent.length ? '<p class="evsub">Discussions récentes</p><div class="convs">' + recent.slice(0, 12).map(row).join("") + "</div>" : "") +
        (USERS ? (others.length ? '<p class="evsub">Membres</p><div class="convs">' + others.map(row).join("") + "</div>" : "") : '<p class="note small">Chargement des membres…</p>');
      filter();
    };
    const filter = () => { const q = (box.querySelector("#shq").value || "").trim().toLowerCase(); box.querySelectorAll("[data-u]").forEach(b => { b.hidden = !!q && b.dataset.name.indexOf(q) < 0; }); };
    box.innerHTML = "<h3>Envoyer à…</h3>" + preview(c) + '<div class="search"><input id="shq" type="search" placeholder="Rechercher un membre" autocomplete="off"></div><div id="shlist" class="shlist"></div>' +
      '<button class="btn wide ghost" style="margin-top:12px" data-no>Annuler</button>';
    draw();
    if (!USERS) B.listUsers().then(l => { USERS = l || []; l.forEach(u => { if (!S.profiles[u.uid]) S.profiles[u.uid] = u; }); if (box.isConnected) draw(); }).catch(() => { USERS = []; if (box.isConnected) draw(); });
    box.querySelector("#shq").addEventListener("input", filter);
    box.addEventListener("click", async e => {
      if (e.target.closest("[data-no]")) return close();
      const b = e.target.closest("[data-u]"); if (!b) return;
      close();
      try { const id = await B.openDM(me, b.dataset.u); compose(c, id); } catch (x) { toast("Impossible d’ouvrir la discussion"); }
    });
  });
}
// message facultatif + case spoiler, puis envoi
function compose(c, convId) {
  const room = convId === "general", me = S.user.uid, other = room ? "" : convId.split("_").find(u => u !== me);
  modal((box, close) => {
    box.innerHTML = "<h3>" + (room ? "🦍 Gorilla Position" : "✉️ " + esc(nameOf(other))) + "</h3>" + preview(c) +
      '<label class="fld">Ton message (facultatif)<textarea id="shtxt" rows="2" maxlength="1000" placeholder="Regarde ça !"></textarea></label>' +
      '<label class="chk"><input type="checkbox" id="shsp"' + (c.sp ? " checked" : "") + "> 🙈 Masquer comme spoiler (on touche la carte pour la voir)</label>" +
      '<button class="btn wide" data-ok>Envoyer</button><button class="btn wide ghost" style="margin-top:10px" data-no>Annuler</button>';
    box.addEventListener("click", async e => {
      if (e.target.closest("[data-no]")) return close();
      const ok = e.target.closest("[data-ok]"); if (!ok || ok.disabled) return;
      ok.disabled = true;
      const text = box.querySelector("#shtxt").value.trim().slice(0, 1000), card = Object.assign({}, c);
      if (box.querySelector("#shsp").checked) card.sp = true; else delete card.sp;
      try {
        if (room) await B.sendRoom(me, text, { card: card });
        else { await B.sendDM(convId, me, other, text, { card: card }); pushPing({ type: "dm", conv: convId }); }
        close();
        toast("Partagé ✓" + (room ? " dans la Gorilla Position" : " avec " + nameOf(other)), { onClick: () => { location.hash = "#/chat/" + encodeURIComponent(convId); }, ms: 3500 });
      } catch (x) { ok.disabled = false; toast(x && x.code === "permission-denied" ? "Refusé par Firebase : l’admin doit publier les règles v8" : "Envoi impossible"); }
    });
    setTimeout(() => { const t = box.querySelector("#shtxt"); if (t) t.focus(); }, 50);
  });
}
