import { describe, expect, test } from "vitest";
import { grade, isCorrect } from "./grading";
import { makeQuestion } from "./testUtils";

describe("isCorrect", () => {
  test("一致すれば正解", () => {
    const q = makeQuestion({ answerIndex: 2 });
    expect(isCorrect(q, 2)).toBe(true);
    expect(isCorrect(q, 1)).toBe(false);
    expect(isCorrect(q, null)).toBe(false);
  });
});

describe("grade", () => {
  test("正解数・分野別・不正解一覧", () => {
    const qs = [
      makeQuestion({ number: 1, field: "strategy", answerIndex: 0 }),
      makeQuestion({ number: 2, field: "strategy", answerIndex: 1 }),
      makeQuestion({ number: 3, field: "technology", answerIndex: 3 }),
      makeQuestion({ number: 4, field: "management", answerIndex: 2 }),
    ];
    const result = grade(qs, { "r08-001": 0, "r08-002": 3, "r08-003": 3 });
    expect(result.score).toBe(2);
    expect(result.total).toBe(4);
    expect(result.byField.strategy).toEqual({ total: 2, correct: 1 });
    expect(result.byField.technology).toEqual({ total: 1, correct: 1 });
    expect(result.byField.management).toEqual({ total: 1, correct: 0 });
    expect(result.wrong.map((q) => q.id)).toEqual(["r08-002", "r08-004"]);
  });
});
