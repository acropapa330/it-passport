import { expect, test } from "vitest";
import { formatPercent, formatSource, formatTime } from "./format";
import { makeQuestion } from "../domain/testUtils";

test("formatSource", () => {
  expect(formatSource(makeQuestion({ number: 3 }))).toBe("出典：令和8年度 ITパスポート試験 公開問題 問3");
});

test("formatPercent", () => {
  expect(formatPercent(null)).toBe("—");
  expect(formatPercent(0.754)).toBe("75%");
});

test("formatTime", () => {
  expect(formatTime(7200)).toBe("120:00");
  expect(formatTime(59)).toBe("0:59");
  expect(formatTime(0)).toBe("0:00");
});
