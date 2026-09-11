import type { Choice, Field, FieldStat, Question } from "./types";

export type AnswerMap = Record<string, Choice | null>;

export type GradeResult = {
  score: number;
  total: number;
  byField: Record<Field, FieldStat>;
  wrong: Question[];
};

export function emptyFieldStats(): Record<Field, FieldStat> {
  return {
    strategy: { total: 0, correct: 0 },
    management: { total: 0, correct: 0 },
    technology: { total: 0, correct: 0 },
  };
}

export function isCorrect(q: Question, selected: Choice | null): boolean {
  return selected !== null && selected === q.answerIndex;
}

export function grade(questions: Question[], answers: AnswerMap): GradeResult {
  const byField = emptyFieldStats();
  const wrong: Question[] = [];
  let score = 0;
  for (const q of questions) {
    byField[q.field].total++;
    if (isCorrect(q, answers[q.id] ?? null)) {
      byField[q.field].correct++;
      score++;
    } else {
      wrong.push(q);
    }
  }
  return { score, total: questions.length, byField, wrong };
}
