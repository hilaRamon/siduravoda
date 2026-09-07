export const DEFAULT_START = "07:00";
export const DEFAULT_END = "11:45";

export function isCustomHours(report) {
  return (
    report?.start_time !== DEFAULT_START || report?.end_time !== DEFAULT_END
  );
}

export function calcDuration(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return null;
  const diff = eh * 60 + em - (sh * 60 + sm);
  if (diff <= 0) return null;
  return Math.round((diff / 60) * 100) / 100;
}
