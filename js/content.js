// Charge le calendrier, les articles, les résumés et les matchs (fichiers du dépôt, mis à jour automatiquement)
import { GH_REPO } from "./config.js";
export const PREVIEW = false; // true seulement dans l'aperçu hébergé dans Claude
// data/feed.json (robot GitHub, toutes les 30 min) : lu directement sur GitHub pour être toujours frais, sinon la copie du site
const feedGet = get => get("https://raw.githubusercontent.com/" + GH_REPO + "/main/data/feed.json", null).then(f => f || get("data/feed.json", { items: [], yt: {} }));
export async function loadContent() {
  const get = (u, fallback) => fetch(u, { cache: "no-cache" }).then(r => r.ok ? r.json() : fallback).catch(() => fallback);
  const [cal, news, recaps, matches] = await Promise.all([
    get("data/calendar.json", { promotions: {} }), get("news.json", { items: [], updated: "" }),
    get("data/recaps.json", { items: {} }), get("data/matches.json", { items: [] })]);
  const [titles, hl, wr, st] = await Promise.all([get("data/titles.json", { titles: [] }), get("data/highlights.json", { items: {} }), get("data/wrestlers.json", { items: {} }), get("data/storylines.json", { items: [] }), ]);
  const [ro, so, po, me, fe, ph] = await Promise.all([get("data/rosters.json", { items: {} }), get("data/sources.json", { items: [] }), get("data/polls.json", { items: [] }), get("data/media.json", { bg: {}, music: null }), feedGet(get), get("data/photos.json", { items: {} })]);
  const [lg, gr, pn] = await Promise.all([get("data/logos.json", {}), get("data/groups.json", { items: {} }), get("data/patchnotes.json", { items: [] })]);
  return { P: cal.promotions || {}, news: news, recaps: recaps.items || {}, matches: matches.items || [], titles: titles.titles || [], titlesUpdated: titles.updated || "",
    highlights: hl.items || {}, wrestlers: wr.items || {}, storylines: st.items || [], rosters: ro.items || {}, rostersSrc: ro.src || {}, sources: so.items || [], polls: po.items || [], media: me || { bg: {}, music: null }, feed: fe || { items: [], yt: {} }, photos: (ph && ph.items) || {}, art: lg || {}, groups: (gr && gr.items) || {}, patch: (pn && pn.items) || [],
    // dates de mise à jour de chaque fichier (page « État des mises à jour »)
    updated: { news: news.updated || "", recaps: recaps.updated || "", calendar: cal.updated || "", titles: titles.updated || "", highlights: hl.updated || "",
      wrestlers: wr.updated || "", storylines: st.updated || "", rosters: ro.updated || "", matches: matches.updated || "", polls: po.updated || "", groups: (gr && gr.updated) || "" } };
}
