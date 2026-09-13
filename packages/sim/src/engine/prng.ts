/**
 * The one seeded generator a Run owns (ADR 0003). xorshift32 with a
 * splitmix-style seed scramble so small seeds do not correlate. Integer-only
 * arithmetic via Math.imul and unsigned shifts: bit-identical everywhere.
 */
export class Prng {
  #state: number;

  constructor(seed: number) {
    let s = (seed | 0) ^ 0x9e3779b9;
    // splitmix32 scramble
    s = Math.imul(s ^ (s >>> 16), 0x21f0aaad);
    s = Math.imul(s ^ (s >>> 15), 0x735a2d97);
    s = (s ^ (s >>> 15)) >>> 0;
    this.#state = s === 0 ? 0x1234567 : s;
  }

  /** Next unsigned 32-bit integer. */
  nextU32(): number {
    let x = this.#state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    this.#state = x;
    return x;
  }

  /** Uniform integer in [0, n). */
  nextInt(n: number): number {
    return this.nextU32() % n;
  }

  /** Uniform number in [0, 1). Division by a power of two is exact. */
  nextUnit(): number {
    return this.nextU32() / 4294967296;
  }
}
