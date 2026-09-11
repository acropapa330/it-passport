import { useState } from "react";

export function Figure({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="figure-error">画像を読み込めません</div>;
  return <img className="figure" src={src} alt="問題の図表" onError={() => setFailed(true)} />;
}
