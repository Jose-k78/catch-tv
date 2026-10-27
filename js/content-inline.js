// Variante utilisée seulement pour l'aperçu tout-en-un (données intégrées)
import cal from "../data/calendar.json";
import news from "../news.json";
import recaps from "../data/recaps.json";
import matches from "../data/matches.json";
export const PREVIEW = true;
export async function loadContent() { return { P: cal.promotions || {}, news: news, recaps: recaps.items || {}, matches: matches.items || [] }; }
