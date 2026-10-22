// School-night bedtime, worked back from the wake-up alarm.
// Paediatric guidance (American Academy of Sleep Medicine, endorsed by the AAP): 10–13 hours per
// 24 h at ages 3–5, 9–12 hours at ages 6–12. We aim inside the range, not at its edge.
export function plan({age, wake}) {
  const young = age <= 5;
  const hours = young ? 11 : 10;
  const [h, m] = String(wake || '07:00').split(':').map(Number);
  const wakeMin = h * 60 + m;
  const day = 24 * 60;
  const lightsOut = (wakeMin - hours * 60 + day) % day;
  const start = (lightsOut - 20 + day) % day; // the routine takes about 20 minutes
  return {hours, range: young ? '10–13' : '9–12', lightsOut: clock(lightsOut), start: clock(start), wake: clock(wakeMin)};
}

export const clock = mins => `${((Math.floor(mins / 60) + 11) % 12) + 1}:${String(mins % 60).padStart(2, '0')}`;

/** Hours and minutes from "dark" to the next wake-up, e.g. "10 h 36 min". */
export function sleepWindow(darkAtMs, wake) {
  const d = new Date(darkAtMs);
  const [h, m] = String(wake || '07:00').split(':').map(Number);
  const w = new Date(d);
  w.setHours(h, m, 0, 0);
  if (w <= d) w.setDate(w.getDate() + 1);
  const mins = Math.round((w - d) / 60000);
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`;
}
