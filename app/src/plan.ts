// School-night bedtime, worked back from the wake-up alarm (same rule as the hub's plan.js).
// Paediatric guidance (AASM, endorsed by the AAP): 10–13 h at ages 3–5, 9–12 h at ages 6–12.
export type Plan = {hours: number; range: string; lightsOut: string; start: string; wake: string; startMinutes: number};

const clock = (m: number) => `${((Math.floor(m / 60) + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')}`;

export function planFor(age: number, wake: string): Plan {
  const young = age <= 5;
  const hours = young ? 11 : 10;
  const [h, m] = wake.split(':').map(Number);
  const day = 24 * 60;
  const wakeMin = h * 60 + m;
  const lightsOut = (wakeMin - hours * 60 + day) % day;
  const start = (lightsOut - 20 + day) % day;
  return {hours, range: young ? '10–13' : '9–12', lightsOut: clock(lightsOut), start: clock(start), wake: clock(wakeMin), startMinutes: start};
}

/** "Bedtime in 12 min", "It's bedtime", or "Bedtime at 7:40". */
export function bedtimeLabel(plan: Plan, now = new Date()): string {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let diff = plan.startMinutes - nowMin;
  if (diff < -12 * 60) {
    diff += 24 * 60;
  }
  if (diff <= 0 && diff > -120) {
    return "It's bedtime";
  }
  if (diff > 0 && diff <= 60) {
    return `Bedtime in ${diff} min`;
  }
  return `Bedtime at ${plan.start}`;
}
