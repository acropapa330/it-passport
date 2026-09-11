import type { Field, Progress, Question } from "./types";
import { FIELDS } from "./types";
import { mulberry32, shuffle } from "./random";

export type DrillOptions = {
  fields: Field[];
  examCodes: string[];
  count: number; // 0 なら全問
  order: "random" | "number";
  seed: number;
};

export const EXAM_QUOTA: Record<Field, number> = {
  strategy: 35,
  management: 20,
  technology: 45,
};
export const EXAM_SIZE = 100;
export const EXAM_TIME_LIMIT_SEC = 7200;

export function filterQuestions(all: Question[], fields: Field[], examCodes: string[]): Question[] {
  return all.filter((q) => fields.includes(q.field) && examCodes.includes(q.examCode));
}

export function buildDrill(all: Question[], opts: DrillOptions): Question[] {
  const pool = filterQuestions(all, opts.fields, opts.examCodes);
  const ordered =
    opts.order === "random"
      ? shuffle(pool, mulberry32(opts.seed))
      : pool.slice().sort(byExamAndNumber);
  return opts.count > 0 ? ordered.slice(0, opts.count) : ordered;
}

export function buildReview(all: Question[], progress: Progress, seed: number): Question[] {
  const wrong = all.filter((q) => progress.attempts[q.id]?.lastCorrect === false);
  return shuffle(wrong, mulberry32(seed));
}

export function buildExam(all: Question[], seed: number): Question[] {
  const rand = mulberry32(seed);
  const picked: Question[] = [];
  const pickedIds = new Set<string>();
  for (const field of FIELDS) {
    const pool = shuffle(all.filter((q) => q.field === field), rand).slice(0, EXAM_QUOTA[field]);
    for (const q of pool) {
      picked.push(q);
      pickedIds.add(q.id);
    }
  }
  const deficit = EXAM_SIZE - picked.length;
  if (deficit > 0) {
    const rest = shuffle(all.filter((q) => !pickedIds.has(q.id)), rand).slice(0, deficit);
    picked.push(...rest);
  }
  // Array.prototype.sort は安定なので、分野内はシャッフル順が保たれる
  return picked.slice().sort((a, b) => FIELDS.indexOf(a.field) - FIELDS.indexOf(b.field));
}

function byExamAndNumber(a: Question, b: Question): number {
  return a.examCode.localeCompare(b.examCode) || a.number - b.number;
}
