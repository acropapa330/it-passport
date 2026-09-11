import { useEffect, useRef, useState } from "react";
import type { Choice, Question, SessionConfig } from "../domain/types";
import { CHOICE_LABEL } from "../domain/types";
import type { AnswerMap } from "../domain/grading";
import { isCorrect } from "../domain/grading";
import { formatSource, formatTime } from "./format";
import { Figure } from "./Figure";

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
  const deadlineRef = useRef<number | null>(
    config.timeLimitSec != null ? Date.now() + config.timeLimitSec * 1000 : null,
  );
  const answersRef = useRef<AnswerMap>({});
  const finishedRef = useRef(false);
  const qRef = useRef<Question>(config.questions[index]);
  const selectedRef = useRef<Choice | null>(null);

  const q = config.questions[index];
  const isLast = index === total - 1;
  qRef.current = q;

  const commit = (choice: Choice) => {
    answersRef.current = { ...answersRef.current, [qRef.current.id]: choice };
    onAnswer(qRef.current, choice);
  };

  const commitPending = () => {
    if (!config.instantFeedback && selectedRef.current !== null && !(qRef.current.id in answersRef.current)) {
      commit(selectedRef.current);
    }
  };

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    commitPending();
    onFinish(answersRef.current);
  };

  // タイマー（模試のみ）：開始時刻からの実時間で残りを計算する
  useEffect(() => {
    if (deadlineRef.current === null) return;
    const tick = () => {
      const deadline = deadlineRef.current;
      if (deadline === null) return;
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(next);
      if (next <= 0) finish();
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (choice: Choice) => {
    if (revealed) return;
    setSelected(choice);
    selectedRef.current = choice;
    if (config.instantFeedback) {
      setRevealed(true);
      commit(choice);
    }
  };

  const next = () => {
    commitPending();
    if (isLast) {
      finish();
      return;
    }
    setIndex(index + 1);
    setSelected(null);
    selectedRef.current = null;
    setRevealed(false);
  };

  const quit = () => {
    if (window.confirm("演習を中断してホームに戻りますか？（回答済みの記録は残ります）")) onQuit();
  };

  if (total === 0) {
    return (
      <div className="stack">
        <p className="muted">出題できる問題がありません。</p>
        <button className="btn" onClick={onQuit}>ホームへ</button>
      </div>
    );
  }

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
        {q.image && <Figure src={`${import.meta.env.BASE_URL}data/${q.image}`} />}
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
