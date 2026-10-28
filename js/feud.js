// Règles des feuds (sans dépendance, utilisées par les deux backends et par l'affichage).
// Une feud par jour et par personne (jour = minuit-minuit, heure de Paris).
// Le compteur monte de 1 seulement les jours où les deux ont lancé leur feud ; un jour raté remet à 0.
import { prevDay } from "./time.js";

// Nouvel état après l'envoi de « me » le jour « day » (null si déjà envoyée aujourd'hui)
export function feudNext(f, me, other, day) {
  f = f || {};
  const days = Object.assign({}, f.days || {});
  if (days[me] === day) return null;
  days[me] = day;
  let count = f.count || 0, countDay = f.countDay || "";
  if (days[other] === day) { count = countDay === prevDay(day) ? count + 1 : 1; countDay = day; }
  else if (countDay !== day && countDay !== prevDay(day)) count = 0; // série cassée : on repart de zéro
  return { days: days, count: count, countDay: countDay, best: Math.max(f.best || 0, count) };
}
// Série affichée aujourd'hui (0 si un jour a été raté)
export function feudCount(f, day) {
  if (!f || !f.countDay) return 0;
  return (f.countDay === day || f.countDay === prevDay(day)) ? (f.count || 0) : 0;
}
