import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import type { Progress, Question, SessionConfig } from "./domain/types";
import type { AnswerMap, GradeResult } from "./domain/grading";
import { grade, isCorrect } from "./domain/grading";
import { loadQuestions } from "./domain/questions";
import { buildExam, buildReview, EXAM_TIME_LIMIT_SEC } from "./domain/quiz";
import {
  detectStorage,
  loadProgress,
  memoryStorage,
  recordAnswer,
  recordExam,
  saveProgress,
  summarize,
  type StorageLike,
} from "./domain/progress";
import type { Choice } from "./domain/types";
import { Home } from "./ui/Home";
import { Footer } from "./ui/Footer";
import { Setup } from "./ui/Setup";
import { Session } from "./ui/Session";
import { Result } from "./ui/Result";

export type Screen =
  | { name: "home" }
  | { name: "setup" }
  | { name: "session"; config: SessionConfig; startedAt: number }
  | { name: "result"; config: SessionConfig; result: GradeResult };

const QUESTIONS_URL = `${import.meta.env.BASE_URL}data/questions.json`;

export function App() {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [storage, setStorage] = useState<{ storage: StorageLike; persistent: boolean } | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "home" });

  const startSession = (config: SessionConfig) =>
    setScreen({ name: "session", config, startedAt: Date.now() });

  const startExam = () => {
    if (!questions) return;
    const list = buildExam(questions, Date.now());
    startSession({ mode: "exam", questions: list, instantFeedback: false, timeLimitSec: EXAM_TIME_LIMIT_SEC });
  };

  const startReview = () => {
    if (!questions || !progress) return;
    const list = buildReview(questions, progress, Date.now());
    if (list.length === 0) return;
    startSession({ mode: "review", questions: list, instantFeedback: true });
  };

  // 学習記録の読み込み（初回のみ）
  const loadedOnce = useRef(false);
  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    const detected = detectStorage();
    const loaded = loadProgress(detected.storage);
    if (loaded.status === "incompatible") {
      const reset = window.confirm(
        "保存されている学習記録の形式が古いため読み込めません。記録を初期化しますか？\n（キャンセルすると、このセッションの記録は保存されません）",
      );
      if (reset) saveProgress(detected.storage, loaded.progress);
      else {
        detected.storage = memoryStorage();
        detected.persistent = false;
      }
    }
    setStorage(detected);
    setProgress(loaded.progress);
  }, []);

  // 問題データの読み込み
  const reload = () => {
    setLoadError(null);
    setQuestions(null);
    loadQuestions(QUESTIONS_URL)
      .then(setQuestions)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(reload, []);

  // 連続回答で古い progress を上書きしないよう関数型更新にする
  const updateProgress = (update: (prev: Progress) => Progress) => {
    setProgress((prev) => {
      if (!prev) return prev;
      const next = update(prev);
      if (storage) {
        try {
          saveProgress(storage.storage, next);
        } catch {
          /* 保存失敗は無視（メモリ上の状態は更新する） */
        }
      }
      return next;
    });
  };
  const handleAnswer = (q: Question, choice: Choice) => {
    updateProgress((prev) => recordAnswer(prev, q.id, isCorrect(q, choice), new Date().toISOString()));
  };

  const handleFinish = (config: SessionConfig, answers: AnswerMap) => {
    const result = grade(config.questions, answers);
    if (config.mode === "exam") {
      updateProgress((prev) =>
        recordExam(prev, { finishedAt: new Date().toISOString(), score: result.score, byField: result.byField }),
      );
    }
    setScreen({ name: "result", config, result });
  };

  const summary = useMemo(() => (progress ? summarize(progress) : null), [progress]);
  const reviewCount = useMemo(
    () => (questions && progress ? buildReview(questions, progress, 0).length : 0),
    [questions, progress],
  );

  let body: ReactElement;
  if (loadError) {
    body = (
      <div className="card stack">
        <p className="error">{loadError}</p>
        <button className="btn primary" onClick={reload}>再読み込み</button>
      </div>
    );
  } else if (!questions || !progress || !summary) {
    body = <p className="muted">読み込み中…</p>;
  } else if (screen.name === "home") {
    body = (
      <Home
        summary={summary}
        reviewCount={reviewCount}
        onDrill={() => setScreen({ name: "setup" })}
        onExam={startExam}
        onReview={startReview}
      />
    );
  } else if (screen.name === "setup") {
    body = (
      <Setup
        questions={questions}
        onStart={startSession}
        onBack={() => setScreen({ name: "home" })}
      />
    );
  } else if (screen.name === "session") {
    body = (
      <Session
        key={screen.startedAt}
        config={screen.config}
        onAnswer={handleAnswer}
        onFinish={(answers) => handleFinish(screen.config, answers)}
        onQuit={() => setScreen({ name: "home" })}
      />
    );
  } else {
    body = <Result config={screen.config} result={screen.result} onHome={() => setScreen({ name: "home" })} />;
  }

  return (
    <>
      {storage && !storage.persistent && (
        <div className="banner">このブラウザでは学習記録を保存できません。閉じると記録は消えます。</div>
      )}
      <main>{body}</main>
      <Footer />
    </>
  );
}
