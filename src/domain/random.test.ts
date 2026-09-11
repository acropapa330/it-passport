import { describe, expect, test } from "vitest";
import { mulberry32, shuffle } from "./random";

describe("mulberry32", () => {
  test("同じ seed なら同じ列", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  test("0 以上 1 未満", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("shuffle", () => {
  test("元配列を変更せず、要素を保つ", () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffle(src, mulberry32(1));
    expect(src).toEqual([1, 2, 3, 4, 5]);
    expect(out.slice().sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test("同じ seed なら同じ順", () => {
    const src = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffle(src, mulberry32(3))).toEqual(shuffle(src, mulberry32(3)));
  });

  test("seed が違えば順が変わる", () => {
    const src = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffle(src, mulberry32(3))).not.toEqual(shuffle(src, mulberry32(4)));
  });
});
