import { useEffect, useRef, useState } from "react";
import type { Choice, Question, SessionConfig } from "../domain/types";
import { CHOICE_LABEL } from "../domain/types";
import type { AnswerMap } from "../domain/grading";
import { isCorrect } from "../domain/grading";
import { formatSource, formatTime } from "./format";

type Props = {
  config: SessionConfig;
  onAnswer: (q: Question, choice: Choice) => void;
  onFinish: (answers: AnswerMap) => void;
  onQuit: () => void;
};

export function Session({ config, onAnswer, onFinish, onQuit }: Props) {
  const total = config.questions.length;
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Choice | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(config.timeLimitSec ?? null);
  const [imageError, setImageError] = useState(false);
  const answersRef = useRef<AnswerMap>({});
  const finishedRef = useRef(false);

  const q = config.questions[index];
  const isLast = index === total - 1;

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish(answersRef.current);
  };

  // タイマー（模試のみ）
  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) {
      finish();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => (r ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  const commit = (choice: Choice) => {
    answersRef.current = { ...answersRef.current, [q.id]: choice };
    onAnswer(q, choice);
  };

  const select = (choice: Choice) => {
    if (revealed) return;
    setSelected(choice);
    if (config.instantFeedback) {
      setRevealed(true);
      commit(choice);
    }
  };

  const next = () => {
    if (!config.instantFeedback && selected !== null && !(q.id in answersRef.current)) commit(selected);
    if (isLast) {
      finish();
      return;
    }
    setIndex(index + 1);
    setSelected(null);
    setRevealed(false);
    setImageError(false);
  };

  const quit = () => {
    if (window.confirm("演習を中断してホームに戻りますか？（回答済みの記録は残ります）")) onQuit();
  };

  return (
    <div className="stack">
      <div className="topbar">
        <span>{index + 1} / {total}</span>
        {remaining !== null && (
          <span className={`timer${remaining < 300 ? " urgent" : ""}`}>残り {formatTime(remaining)}</span>
        )}
        <button className="btn small" onClick={quit}>中断</button>
      </div>

      <div className="card">
        <p className="question-text"><b>問{q.number}</b>　{q.text}</p>
        {q.image && !imageError && (
          <img className="figure" src={`${import.meta.env.BASE_URL}data/${q.image}`} alt="問題の図表" onError={() => setImageError(true)} />
        )}
        {q.image && imageError && <div className="figure-error">画像を読み込めません</div>}
        <p className="muted">{formatSource(q)}</p>
      </div>

      <div className="stack">
        {q.choices.map((text, i) => {
          const c = i as Choice;
          let cls = "btn choice";
          if (revealed) {
            if (c === q.answerIndex) cls += " correct";
            else if (c === selected) cls += " wrong";
          } else if (c === selected) cls += " selected";
          return (
            <button key={i} className={cls} onClick={() => select(c)} disabled={revealed}>
              <span className="label">{CHOICE_LABEL[i]}</span>
              <span>{text}</span>
            </button>
          );
        })}
      </div>

      {revealed && selected !== null && (
        <p className={`feedback ${isCorrect(q, selected) ? "ok" : "ng"}`}>
          {isCorrect(q, selected) ? "正解！" : `不正解… 正解は ${CHOICE_LABEL[q.answerIndex]}`}
        </p>
      )}

      {(revealed || !config.instantFeedback) && (
        <button className="btn primary" onClick={next}>
          {isLast ? (config.instantFeedback ? "結果を見る" : "採点する") : "次へ"}
        </button>
      )}
    </div>
  );
}
