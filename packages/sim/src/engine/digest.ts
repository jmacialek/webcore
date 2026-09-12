/**
 * Snapshot digests. FNV-1a over the JSON text of a Snapshot. JSON.stringify
 * of finite numbers is specified to be the shortest round-trip form, so the
 * text, and therefore the digest, is identical across engines.
 */
export function fnv1a(text: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function hex32(n: number): string {
  return (n >>> 0).toString(16).padStart(8, "0");
}

export function digestValue(value: unknown): string {
  return hex32(fnv1a(JSON.stringify(value)));
}

/** Folds a sequence of per-tick digests into one. */
export class RollingDigest {
  #h = 0x811c9dc5;

  add(tickDigest: string): void {
    this.#h = fnv1a(tickDigest, this.#h);
  }

  get value(): string {
    return hex32(this.#h);
  }
}
