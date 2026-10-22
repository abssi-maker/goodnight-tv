// The morning coach: one small, proven next step for the parent, from the real log.
// Faded bedtime (start near when the child actually falls asleep, then move earlier 10–15 minutes
// at a time) and positive routines are recommended treatments for bedtime problems (AASM practice
// parameters, Morgenthaler et al. 2006). A rule decides; the model only rewords.
const mins = ms => Math.round(ms / 60000);

/**
 * nights: [{date, startedAt, darkAt, steps: {teeth: seconds, ...}, plan: {lightsOutMinutes}}]
 * Returns {kind, text} or null.
 */
export function coachTip(nights, {childName = 'your child'} = {}) {
  const recent = nights.filter(n => n.startedAt && n.darkAt).slice(-3);
  if (!recent.length) return null;
  const last = recent[recent.length - 1];

  // 1. Lights out drifting after the plan → faded bedtime, start earlier
  const late = recent
    .map(n => {
      if (n.plan?.lightsOutMinutes == null) return null;
      const d = new Date(n.darkAt);
      let diff = d.getHours() * 60 + d.getMinutes() - n.plan.lightsOutMinutes;
      if (diff < -720) diff += 1440;
      return diff;
    })
    .filter(x => x != null);
  if (late.length >= 2) {
    const avg = Math.round(late.reduce((a, b) => a + b, 0) / late.length);
    if (avg > 15) {
      return {kind: 'start-earlier', text: `Lights out has been about ${avg} minutes after the plan. Start Goodnight TV 10 minutes earlier tonight, and keep the steps the same.`};
    }
  }

  // 2. One step taking long → make it easier before Bramble arrives
  const stepAvg = {};
  for (const n of recent) for (const [k, s] of Object.entries(n.steps || {})) (stepAvg[k] ||= []).push(s);
  const slow = Object.entries(stepAvg)
    .map(([k, a]) => [k, a.reduce((x, y) => x + y, 0) / a.length / 60])
    .filter(([k, m]) => m > 6 && k !== 'story')
    .sort((a, b) => b[1] - a[1])[0];
  if (slow) {
    const fix = {pajamas: 'lay the pajamas out before Bramble arrives', teeth: 'put the toothbrush ready with paste on it', potty: 'go to the bathroom together for this one'}[slow[0]] || 'make that step easier before bedtime starts';
    return {kind: 'slow-step', text: `${cap(slow[0])} took about ${Math.round(slow[1])} minutes. Tonight, ${fix}.`};
  }

  // 3. On track → say so, with the real number
  const total = mins(last.darkAt - last.startedAt);
  return {kind: 'on-track', text: `Last night took ${total} minutes from Bramble's hello to dark. Same time, same steps tonight: the routine works best when it doesn't change.`};
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
