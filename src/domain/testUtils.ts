import type { Field, Question } from "./types";

let seq = 0;

export function makeQuestion(overrides: Partial<Question> = {}): Question {
  seq++;
  const number = overrides.number ?? seq;
  const examCode = overrides.examCode ?? "r08";
  return {
    id: `${examCode}-${String(number).padStart(3, "0")}`,
    exam: "令和8年度",
    examCode,
    number,
    field: "strategy",
    text: `問${number}`,
    choices: ["ア", "イ", "ウ", "エ"],
    answerIndex: 0,
    ...overrides,
  };
}

export function makeQuestions(count: number, field: Field, examCode = "r08"): Question[] {
  return Array.from({ length: count }, (_, i) =>
    makeQuestion({ number: i + 1, field, examCode }),
  );
}
