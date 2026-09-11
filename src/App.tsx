import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import type { Progress, Question, SessionConfig } from "./domain/types";
import type { GradeResult } from "./domain/grading";
import { loadQuestions } from "./domain/questions";
import { buildReview } from "./domain/quiz";
import {
  detectStorage,
  loadProgress,
  memoryStorage,
  saveProgress,
  summarize,
  type StorageLike,
} from "./domain/progress";
import { Home } from "./ui/Home";
import { Footer } from "./ui/Footer";

export type Screen =
  | { name: "home" }
  | { name: "setup" }
  | { name: "session"; config: SessionConfig }
  | { name: "result"; config: SessionConfig; result: GradeResult };

const QUESTIONS_URL = `${import.meta.env.BASE_URL}data/questions.json`;

export function App() {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [storage, setStorage] = useState<{ storage: StorageLike; persistent: boolean } | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "home" });

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
      if (storage) saveProgress(storage.storage, next);
      return next;
    });
  };
  void updateProgress; // Task 12 で Session から使う。それまでの未使用警告よけ

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
        onExam={() => window.alert("模試は Task 13 で実装")}
        onReview={() => window.alert("復習は Task 13 で実装")}
      />
    );
  } else {
    body = (
      <div className="stack">
        <p>（Task 12 で実装）</p>
        <button className="btn" onClick={() => setScreen({ name: "home" })}>ホームへ</button>
      </div>
    );
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
