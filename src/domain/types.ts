export type Field = "strategy" | "management" | "technology";

export const FIELDS: Field[] = ["strategy", "management", "technology"];

export const FIELD_LABEL: Record<Field, string> = {
  strategy: "ストラテジ系",
  management: "マネジメント系",
  technology: "テクノロジ系",
};

export type Choice = 0 | 1 | 2 | 3;

export const CHOICE_LABEL = ["ア", "イ", "ウ", "エ"] as const;

export type Question = {
  id: string;
  exam: string;
  examCode: string;
  number: number;
  field: Field;
  text: string;
  image?: string;
  choices: [string, string, string, string];
  answerIndex: Choice;
};

export type QuestionSet = {
  version: 1;
  questions: Question[];
};

export type Attempt = {
  correct: number;
  wrong: number;
  lastAnsweredAt: string;
  lastCorrect: boolean;
};

export type FieldStat = { total: number; correct: number };

export type ExamResult = {
  finishedAt: string;
  score: number;
  byField: Record<Field, FieldStat>;
};

export type Progress = {
  version: 1;
  attempts: Record<string, Attempt>;
  examResults: ExamResult[];
};

export type SessionMode = "drill" | "review" | "exam";

export type SessionConfig = {
  mode: SessionMode;
  questions: Question[];
  instantFeedback: boolean;
  timeLimitSec?: number;
};
