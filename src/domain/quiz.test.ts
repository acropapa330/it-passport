import { describe, expect, test } from "vitest";
import { buildDrill, buildExam, buildReview, filterQuestions, EXAM_QUOTA } from "./quiz";
import { makeQuestion, makeQuestions } from "./testUtils";
import type { Progress } from "./types";

describe("filterQuestions", () => {
  test("分野と回次で絞る", () => {
    const all = [
      makeQuestion({ number: 1, field: "strategy", examCode: "r08" }),
      makeQuestion({ number: 2, field: "management", examCode: "r08" }),
      makeQuestion({ number: 3, field: "strategy", examCode: "r07" }),
    ];
    const out = filterQuestions(all, ["strategy"], ["r08"]);
    expect(out.map((q) => q.id)).toEqual(["r08-001"]);
  });
});

describe("buildDrill", () => {
  const all = [
    ...makeQuestions(10, "strategy", "r08"),
    ...makeQuestions(10, "technology", "r07"),
  ];

  test("number 順は回次・問番号順", () => {
    const out = buildDrill(all, {
      fields: ["strategy", "technology"],
      examCodes: ["r07", "r08"],
      count: 0,
      order: "number",
      seed: 1,
    });
    expect(out.map((q) => q.id).slice(0, 3)).toEqual(["r07-001", "r07-002", "r07-003"]);
    expect(out).toHaveLength(20);
  });

  test("count で切り詰める", () => {
    const out = buildDrill(all, {
      fields: ["strategy"],
      examCodes: ["r08"],
      count: 3,
      order: "number",
      seed: 1,
    });
    expect(out).toHaveLength(3);
  });

  test("random は seed で再現できる", () => {
    const opts = { fields: ["strategy" as const], examCodes: ["r08"], count: 0, order: "random" as const, seed: 9 };
    expect(buildDrill(all, opts)).toEqual(buildDrill(all, opts));
    expect(buildDrill(all, opts).map((q) => q.id)).not.toEqual(
      buildDrill(all, { ...opts, order: "number" }).map((q) => q.id),
    );
  });
});

describe("buildReview", () => {
  test("直近が不正解の問題だけ", () => {
    const all = makeQuestions(4, "strategy");
    const progress: Progress = {
      version: 1,
      attempts: {
        "r08-001": { correct: 0, wrong: 1, lastAnsweredAt: "", lastCorrect: false },
        "r08-002": { correct: 1, wrong: 1, lastAnsweredAt: "", lastCorrect: true },
        "r08-003": { correct: 0, wrong: 2, lastAnsweredAt: "", lastCorrect: false },
      },
      examResults: [],
    };
    const ids = buildReview(all, progress, 1).map((q) => q.id).sort();
    expect(ids).toEqual(["r08-001", "r08-003"]);
  });
});

describe("buildExam", () => {
  test("分野比率どおり 100 問、分野順に並ぶ", () => {
    const all = [
      ...makeQuestions(50, "strategy", "r08"),
      ...makeQuestions(50, "management", "r07"),
      ...makeQuestions(60, "technology", "r06"),
    ];
    const out = buildExam(all, 1);
    expect(out).toHaveLength(100);
    const count = (f: string) => out.filter((q) => q.field === f).length;
    expect(count("strategy")).toBe(EXAM_QUOTA.strategy);
    expect(count("management")).toBe(EXAM_QUOTA.management);
    expect(count("technology")).toBe(EXAM_QUOTA.technology);
    const fields = out.map((q) => q.field);
    expect(fields.indexOf("management")).toBeGreaterThan(fields.lastIndexOf("strategy"));
    expect(fields.indexOf("technology")).toBeGreaterThan(fields.lastIndexOf("management"));
    expect(new Set(out.map((q) => q.id)).size).toBe(100);
  });

  test("在庫不足の分野は他分野で補充する", () => {
    const all = [
      ...makeQuestions(10, "strategy", "r08"),
      ...makeQuestions(100, "management", "r07"),
      ...makeQuestions(100, "technology", "r06"),
    ];
    const out = buildExam(all, 1);
    expect(out).toHaveLength(100);
    expect(out.filter((q) => q.field === "strategy")).toHaveLength(10);
  });

  test("全体が 100 問未満ならあるだけ", () => {
    const out = buildExam(makeQuestions(30, "technology"), 1);
    expect(out).toHaveLength(30);
  });

  test("seed で再現できる", () => {
    const all = makeQuestions(120, "technology");
    expect(buildExam(all, 5)).toEqual(buildExam(all, 5));
  });
});
