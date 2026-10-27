// Charge le calendrier, les articles, les résumés et les matchs (fichiers du dépôt, mis à jour automatiquement)
export const PREVIEW = false; // true seulement dans l'aperçu hébergé dans Claude
export async function loadContent() {
  const get = (u, fallback) => fetch(u, { cache: "no-cache" }).then(r => r.ok ? r.json() : fallback).catch(() => fallback);
  const [cal, news, recaps, matches] = await Promise.all([
    get("data/calendar.json", { promotions: {} }), get("news.json", { items: [], updated: "" }),
    get("data/recaps.json", { items: {} }), get("data/matches.json", { items: [] })]);
  const titles = await get("data/titles.json", { titles: [] });
  return { P: cal.promotions || {}, news: news, recaps: recaps.items || {}, matches: matches.items || [], titles: titles.titles || [], titlesUpdated: titles.updated || "" };
}
