// One master seed is the only source of randomness in the world build. Everything
// derived from it is deterministic per seed string; the authored primary route never
// reads from it.
export const DEFAULT_SEED = 'rivet-run-highline-01';

export function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed) {
  let state = hashText(seed);
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Independent sub-stream so adding choices in one layer never reshuffles another. */
export function subStream(seed, label) {
  return seededRandom(`${seed}::${label}`);
}

export function pick(random, list) {
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}

export function range(random, min, max) {
  return min + random() * (max - min);
}

export function chance(random, probability) {
  return random() < probability;
}
