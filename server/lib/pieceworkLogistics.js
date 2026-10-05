export function pickCanonicalLogistics(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (Boolean(a.is_piecework) !== Boolean(b.is_piecework)) {
    return a.is_piecework ? a : b;
  }
  return (a.updated_date || "") >= (b.updated_date || "") ? a : b;
}

export function logisticsKey(date, workplaceId) {
  return `${date}|${String(workplaceId)}`;
}
