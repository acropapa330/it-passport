import { useState } from "react";
import type { SessionConfig } from "../domain/types";
import { CHOICE_LABEL, FIELDS, FIELD_LABEL } from "../domain/types";
import type { GradeResult } from "../domain/grading";
import { formatPercent, formatSource } from "./format";

type Props = {
  config: SessionConfig;
  result: GradeResult;
  onHome: () => void;
};

const TITLE = { drill: "ドリル結果", review: "復習結果", exam: "模試結果" } as const;

function Figure({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="figure-error">画像を読み込めません</div>;
  return <img className="figure" src={src} alt="問題の図表" onError={() => setFailed(true)} />;
}

export function Result({ config, result, onHome }: Props) {
  return (
    <div className="stack">
      <h1>{TITLE[config.mode]}</h1>
      <div className="card">
        <p style={{ fontSize: "1.6rem", margin: 0 }}>
          <b>{result.score}</b> / {result.total}
          <span className="muted">（{formatPercent(result.total ? result.score / result.total : null)}）</span>
        </p>
        <table>
          <tbody>
            {FIELDS.map((f) => (
              <tr key={f}>
                <td>{FIELD_LABEL[f]}</td>
                <td className="num">{result.byField[f].correct} / {result.byField[f].total}</td>
                <td className="num">
                  {formatPercent(result.byField[f].total ? result.byField[f].correct / result.byField[f].total : null)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>間違えた問題（{result.wrong.length}）</h2>
      {result.wrong.map((q) => (
        <details key={q.id} className="card">
          <summary>{q.exam} 問{q.number}　正解: {CHOICE_LABEL[q.answerIndex]}</summary>
          <p className="question-text">{q.text}</p>
          {q.image && <Figure src={`${import.meta.env.BASE_URL}data/${q.image}`} />}
          <ol className="stack" style={{ listStyle: "none", padding: 0 }}>
            {q.choices.map((c, i) => (
              <li key={i} className={i === q.answerIndex ? "choice correct card" : "choice card"}>
                <span className="label">{CHOICE_LABEL[i]}</span>
                <span>{c}</span>
              </li>
            ))}
          </ol>
          <p className="muted">{formatSource(q)}</p>
        </details>
      ))}

      <button className="btn primary" onClick={onHome}>ホームへ</button>
    </div>
  );
}
