import type { summarize } from "../domain/progress";
import { FIELDS } from "../domain/types";
import { formatPercent } from "./format";

type Props = {
  summary: ReturnType<typeof summarize>;
  reviewCount: number;
  onDrill: () => void;
  onExam: () => void;
  onReview: () => void;
};

export function Home({ summary, reviewCount, onDrill, onExam, onReview }: Props) {
  const lastExam = summary.lastExam;
  const total = lastExam ? FIELDS.reduce((n, f) => n + lastExam.byField[f].total, 0) : 0;
  return (
    <div className="stack">
      <h1>ITパスポート 過去問演習</h1>
      <div className="card">
        <div className="row">
          <span>回答済み <b>{summary.answered}</b> 問</span>
          <span>正答率 <b>{formatPercent(summary.accuracy)}</b></span>
          {lastExam && (
            <span>直近の模試 <b>{lastExam.score}</b> / {total}</span>
          )}
        </div>
      </div>
      <button className="btn primary" onClick={onDrill}>ドリル（1問ずつ即採点）</button>
      <button className="btn" onClick={onExam}>模試（100問・120分）</button>
      <button className="btn" onClick={onReview} disabled={reviewCount === 0}>
        復習（間違えた問題 {reviewCount} 問）
      </button>
    </div>
  );
}
