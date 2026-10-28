// Favoris ⭐ : catcheurs suivis (profil), page des favoris, colonne de droite sur ordinateur, favoris des amis
import { S, B, ACT, prof, avatar } from "../state.js";
import { esc, ICON, fmt, toast } from "../util.js";
import { errText } from "./account.js";
import { canonical, wShows, upcomingFor, lastMatches, wNews } from "../wrestlers.js";
import { friendsOf } from "../social.js";
import { spoilBlock, okVid } from "./highlights.js";

export function favsOf(p) { return (p && Array.isArray(p.favs) ? p.favs : []).filter(x => typeof x === "string" && x.trim()).slice(0, 30); }
export function myFavs() { return S.user ? favsOf(S.profile) : []; }
export function isFav(name) { const c = canonical(name).toLowerCase(); return myFavs().some(f => f.toLowerCase() === c); }

export function starBtn(name) {
  const on = isFav(name);
  return '<button class="starbtn' + (on ? " on" : "") + '" data-act="fav" data-name="' + esc(canonical(name)) + '" aria-pressed="' + on + '" aria-label="' + (on ? "Retirer des favoris" : "Ajouter aux favoris") + '">' +
    (on ? ICON.starF : ICON.starO) + "<span>" + (on ? "Favori" : "Suivre") + "</span></button>";
}
ACT.fav = async el => {
  if (!S.user) { toast("Connecte-toi pour suivre tes catcheurs favoris"); location.hash = "#/connexion"; return; }
  const name = el.dataset.name, cur = myFavs(), on = cur.some(f => f.toLowerCase() === name.toLowerCase());
  if (!on && cur.length >= 30) { toast("30 favoris maximum"); return; }
  const next = on ? cur.filter(f => f.toLowerCase() !== name.toLowerCase()) : cur.concat([name]);
  try {
    await B.saveProfile(S.user.uid, { favs: next });
    toast(on ? name + " retiré de tes favoris" : "⭐ " + name + " ajouté à tes favoris");
    if (!on) B.addFollowed(name).catch(() => {});
  } catch (e) { toast(errText(e)); }
};

const wlink = n => "#/catcheur/" + encodeURIComponent(n);
const showHref = s => "#/p/" + encodeURIComponent(s.k) + (s.n ? "/" + encodeURIComponent(s.n) : "");

// Carte verticale d'un favori : shows, match récent (spoiler), prochain combat, 2-3 news
export function favCard(name, compact) {
  const shows = wShows(name), last = lastMatches(name, 1)[0], next = upcomingFor(name)[0], news = wNews(name, compact ? 2 : 3);
  let h = '<article class="favcard"><a class="favname" href="' + wlink(name) + '">' + ICON.starF + "<b>" + esc(name) + '</b><span class="chev">›</span></a>';
  if (shows.length) h += '<div class="chips">' + shows.map(s => '<a class="chip" href="' + showHref(s) + '">' + esc(s.n ? s.n : s.k) + "</a>").join("") + "</div>";
  h += '<div class="favrow"><small>Prochain combat</small>' + (next ? '<a href="#/p/' + encodeURIComponent(next.k) + (next.show ? "/" + encodeURIComponent(next.show) : "") + '"><b>' + esc(next.t) + "</b> · " + fmt(next.d) +
    (next.line ? "<br><span>" + esc(next.line) + "</span>" : "") + "</a>" : "<span>Rien d’annoncé pour l’instant</span>") + "</div>";
  h += '<div class="favrow"><small>Match récent</small>' + (last ? "<b>" + esc(last.t || ((last.ev || last.k) + " · " + fmt(last.d))) + "</b>" + (last.t && last.d ? " · " + fmt(last.d) : "") +
    (last.r ? spoilBlock("Voir le résultat (spoiler)", "<p>" + esc(last.r) + "</p>") : "") +
    (okVid(last.v) ? '<button class="btn small ghost" data-act="play" data-id="' + esc(last.v) + '" data-t="' + esc(last.vt || last.t || name) + '">▶ Vidéo</button>' : "") : "<span>Pas encore de résultat dans l’app</span>") + "</div>";
  if (news.length) h += '<div class="favrow"><small>Actu</small><ul class="favnews">' + news.map(a => '<li><a href="' + esc(a.u) + '" target="_blank" rel="noopener">' + esc(a.t) + "</a>" +
    '<span class="src">' + esc(a.s || "") + (a.tr ? " · titre traduit" : "") + (a.d ? " · " + fmt(a.d) : "") + "</span></li>").join("") + "</ul></div>";
  return h + "</article>";
}

export function favsView() {
  const mine = myFavs();
  let h = '<a class="back" href="#/">' + ICON.back + " Accueil</a><h1>⭐ Mes favoris</h1>";
  h += mine.length ? '<div class="favs2">' + mine.map(n => favCard(n)).join("") + "</div>"
    : '<p class="note">Ouvre la page d’un catcheur ou d’une catcheuse (barre de recherche) et appuie sur l’étoile pour le suivre ici.</p>' +
      '<div class="btns" style="margin-top:12px"><a class="btn" href="#/recherche">Rechercher un catcheur</a></div>';
  const fr = friendsOf(S.user.uid).map(uid => ({ uid: uid, p: prof(uid) })).filter(x => x.p && favsOf(x.p).length);
  if (fr.length) {
    h += "<h2>Les favoris de mes amis</h2><div class=\"list\">" + fr.map(x => '<div class="item"><a class="lbl favfriend" href="#/profil/' + encodeURIComponent(x.uid) + '">' + avatar(x.p, 32) +
      "<b>" + esc(x.p.pseudo || "Membre") + '</b></a><span class="chips">' + favsOf(x.p).slice(0, 8).map(n => '<a class="chip" href="' + wlink(n) + '">' + esc(n) + "</a>").join("") + "</span></div>").join("") + "</div>";
  }
  return h;
}

// Colonne de droite de l'accueil (visible seulement sur grand écran)
export function favAside() {
  if (!S.user) return '<aside class="side"><h2>⭐ Favoris</h2><p class="note">Connecte-toi et suis tes catcheurs favoris pour voir ici leurs shows, leurs matchs et leur actu.</p></aside>';
  const mine = myFavs();
  return '<aside class="side"><h2>⭐ Mes favoris</h2>' + (mine.length ? mine.slice(0, 6).map(n => favCard(n, true)).join("") +
    (mine.length > 6 ? '<a class="linkbtn" href="#/favoris">Tous mes favoris ›</a>' : "") : '<p class="note">Appuie sur l’étoile d’un catcheur pour le suivre ici.</p>') + "</aside>";
}

// Puces des favoris (profils)
export function favChips(p) {
  const f = favsOf(p);
  return f.length ? '<div class="chips wrap">' + f.map(n => '<a class="chip star" href="' + wlink(n) + '">⭐ ' + esc(n) + "</a>").join("") + "</div>" : "";
}
