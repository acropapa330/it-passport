import { describe, expect, test } from "vitest";
import { assembleQuestions } from "./build.mjs";

const exam = {
  code: "r08",
  name: "令和8年度",
  fieldRanges: { strategy: [1, 1], management: [2, 2], technology: [3, 3] },
};

function tq(number, extra = {}) {
  return { number, text: `本文${number}`, choices: ["a", "b", "c", "d"], hasFigure: false, ...extra };
}

describe("assembleQuestions", () => {
  test("transcript と answers を突き合わせて Question を作る", () => {
    const { questions, warnings } = assembleQuestions({
      exam,
      transcripts: [{ page: 3, questions: [tq(1), tq(2)] }, { page: 4, questions: [tq(3, { hasFigure: true })] }],
      answers: { 1: 0, 2: 3, 3: 1 },
      imageExists: (id) => id === "r08-003",
      expectedCount: 3,
    });
    expect(warnings).toEqual([]);
    expect(questions).toHaveLength(3);
    expect(questions[0]).toEqual({
      id: "r08-001",
      exam: "令和8年度",
      examCode: "r08",
      number: 1,
      field: "strategy",
      text: "本文1",
      choices: ["a", "b", "c", "d"],
      answerIndex: 0,
    });
    expect(questions[1].field).toBe("management");
    expect(questions[2]).toMatchObject({ field: "technology", image: "images/r08-003.png" });
  });

  test("欠番があれば例外", () => {
    expect(() =>
      assembleQuestions({ exam, transcripts: [{ page: 3, questions: [tq(1), tq(3)] }], answers: { 1: 0, 2: 0, 3: 0 }, imageExists: () => true, expectedCount: 3 }),
    ).toThrow("問2");
  });

  test("重複があれば例外", () => {
    expect(() =>
      assembleQuestions({ exam, transcripts: [{ page: 3, questions: [tq(1), tq(1), tq(2), tq(3)] }], answers: { 1: 0, 2: 0, 3: 0 }, imageExists: () => true, expectedCount: 3 }),
    ).toThrow("重複");
  });

  test("選択肢が 4 つでなければ例外", () => {
    expect(() =>
      assembleQuestions({ exam, transcripts: [{ page: 3, questions: [tq(1, { choices: ["a", "b"] }), tq(2), tq(3)] }], answers: { 1: 0, 2: 0, 3: 0 }, imageExists: () => true, expectedCount: 3 }),
    ).toThrow("選択肢");
  });

  test("正解がなければ例外", () => {
    expect(() =>
      assembleQuestions({ exam, transcripts: [{ page: 3, questions: [tq(1), tq(2), tq(3)] }], answers: { 1: 0, 2: 0 }, imageExists: () => true, expectedCount: 3 }),
    ).toThrow("正解");
  });

  test("図表問題に画像がなければ例外。allowMissingImages なら警告", () => {
    const args = { exam, transcripts: [{ page: 3, questions: [tq(1, { hasFigure: true }), tq(2), tq(3)] }], answers: { 1: 0, 2: 0, 3: 0 }, imageExists: () => false, expectedCount: 3 };
    expect(() => assembleQuestions(args)).toThrow("画像");
    const { questions, warnings } = assembleQuestions({ ...args, allowMissingImages: true });
    expect(warnings).toHaveLength(1);
    expect(questions[0].image).toBeUndefined();
  });

  test("分野範囲に含まれない問番号は例外", () => {
    expect(() =>
      assembleQuestions({ exam: { ...exam, fieldRanges: { strategy: [1, 2], management: [3, 3], technology: [4, 4] } }, transcripts: [{ page: 3, questions: [tq(1), tq(2), tq(3), tq(4), tq(5)] }], answers: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, imageExists: () => true, expectedCount: 5 }),
    ).toThrow("分野");
  });
});
