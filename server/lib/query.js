function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  if (typeof a === 'string' || typeof b === 'string') {
    return String(a).localeCompare(String(b), 'he');
  }

  return a > b ? 1 : a < b ? -1 : 0;
}

export function normalizeData(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );
}

export function buildMongoFilter(filter = {}) {
  return Object.fromEntries(
    Object.entries(filter).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

export function buildSort(sort) {
  if (!sort) return { created_date: -1 };
  const field = sort.startsWith('-') ? sort.slice(1) : sort;
  const direction = sort.startsWith('-') ? -1 : 1;
  return { [field]: direction };
}

export function sortInMemory(items, sort) {
  if (!sort) return items;
  const field = sort.startsWith('-') ? sort.slice(1) : sort;
  const direction = sort.startsWith('-') ? -1 : 1;

  return [...items].sort((left, right) => compareValues(left[field], right[field]) * direction);
}
