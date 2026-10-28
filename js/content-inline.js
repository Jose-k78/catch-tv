// Variante utilisée seulement pour l'aperçu tout-en-un (données intégrées)
import cal from "../data/calendar.json";
import news from "../news.json";
import recaps from "../data/recaps.json";
import matches from "../data/matches.json";
import titles from "../data/titles.json";
import hl from "../data/highlights.json";
import wr from "../data/wrestlers.json";
import st from "../data/storylines.json";
export const PREVIEW = true;
export async function loadContent() { return { P: cal.promotions || {}, news: news, recaps: recaps.items || {}, matches: matches.items || [], titles: titles.titles || [], titlesUpdated: titles.updated || "", highlights: hl.items || {}, wrestlers: wr.items || {}, storylines: st.items || [] }; }
