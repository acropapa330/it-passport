import { useMemo, useState } from "react";
import type { Field, Question, SessionConfig } from "../domain/types";
import { FIELDS, FIELD_LABEL } from "../domain/types";
import { buildDrill, filterQuestions } from "../domain/quiz";

type Props = {
  questions: Question[];
  onStart: (config: SessionConfig) => void;
  onBack: () => void;
};

const COUNTS = [10, 20, 50, 0] as const;

export function Setup({ questions, onStart, onBack }: Props) {
  const exams = useMemo(() => {
    const seen = new Map<string, string>();
    for (const q of questions) seen.set(q.examCode, q.exam);
    return [...seen.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [questions]);

  const [fields, setFields] = useState<Field[]>(FIELDS);
  const [examCodes, setExamCodes] = useState<string[]>(() => exams.map(([code]) => code));
  const [count, setCount] = useState<number>(10);
  const [order, setOrder] = useState<"random" | "number">("random");

  const available = filterQuestions(questions, fields, examCodes).length;

  const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const start = () => {
    const list = buildDrill(questions, { fields, examCodes, count, order, seed: Date.now() });
    onStart({ mode: "drill", questions: list, instantFeedback: true });
  };

  return (
    <div className="stack">
      <h1>出題設定</h1>
      <div className="card">
        <h2>分野</h2>
        <div className="row">
          {FIELDS.map((f) => (
            <label key={f} className="check">
              <input type="checkbox" checked={fields.includes(f)} onChange={() => setFields(toggle(fields, f))} />
              {FIELD_LABEL[f]}
            </label>
          ))}
        </div>
        <h2>回次</h2>
        <div className="row">
          {exams.map(([code, name]) => (
            <label key={code} className="check">
              <input type="checkbox" checked={examCodes.includes(code)} onChange={() => setExamCodes(toggle(examCodes, code))} />
              {name}
            </label>
          ))}
        </div>
        <h2>出題数・順序</h2>
        <div className="row">
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {COUNTS.map((c) => (
              <option key={c} value={c}>{c === 0 ? "全問" : `${c} 問`}</option>
            ))}
          </select>
          <select value={order} onChange={(e) => setOrder(e.target.value as "random" | "number")}>
            <option value="random">ランダム</option>
            <option value="number">番号順</option>
          </select>
        </div>
        <p className="muted">対象 {available} 問</p>
      </div>
      <button className="btn primary" onClick={start} disabled={available === 0}>開始</button>
      <button className="btn" onClick={onBack}>戻る</button>
    </div>
  );
}
