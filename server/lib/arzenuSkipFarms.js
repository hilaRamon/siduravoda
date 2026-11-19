import { SKIP_FARMS } from "./reportConstants.js";

export const ARZENU_SKIP_FARM_FIELD = "arzenu_skip_farms";

/** Seed names. The stored list is farm ids. */
export const DEFAULT_ARZENU_SKIP_FARM_NAMES = SKIP_FARMS;

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

/** Trim, and lowercase a 24-character hex id. Other text is only trimmed. */
export function canonicalFarmId(value) {
  const token = String(value ?? "").trim();
  if (!token) return "";
  return OBJECT_ID_RE.test(token) ? token.toLowerCase() : token;
}

function cleanTokens(value) {
  if (!Array.isArray(value)) return null;
  const seen = new Set();
  const tokens = [];
  for (const item of value) {
    const token = String(item ?? "").trim();
    if (!token || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

function sameList(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function idsByFarmName(farms) {
  const idsByName = new Map();
  for (const farm of farms) {
    const id = canonicalFarmId(farm?.id);
    const name = String(farm?.name ?? "").trim();
    if (!id || !name) continue;
    const list = idsByName.get(name) ?? [];
    list.push(id);
    idsByName.set(name, list);
  }
  return idsByName;
}

/**
 * Missing list → ids of farms whose name is in the seed.
 * A saved array, including [], is kept.
 * A leftover name is converted to the matching farm ids.
 * A saved id is returned in canonical form. An unknown name is dropped. A deleted farm id stays.
 *
 * @returns {{ ids: string[], changed: boolean, stored: Record<string, string[]> }}
 */
export function resolveArzenuSkipFarms(settings = null, farms = []) {
  const source = settings || {};
  const idsByName = idsByFarmName(farms);
  const saved = cleanTokens(source[ARZENU_SKIP_FARM_FIELD]);
  const tokens = saved ?? DEFAULT_ARZENU_SKIP_FARM_NAMES;
  const ids = [];
  const seen = new Set();

  for (const token of tokens) {
    const matches = OBJECT_ID_RE.test(token)
      ? [canonicalFarmId(token)]
      : (idsByName.get(token) ?? []);
    for (const id of matches) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }

  return {
    ids,
    changed: saved === null || !sameList(saved, ids),
    stored: { [ARZENU_SKIP_FARM_FIELD]: ids },
  };
}
