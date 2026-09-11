const LABELS = ["ア", "イ", "ウ", "エ"];

/** pdftotext -layout の出力から { 問番号: answerIndex } を作る */
export function parseAnswerText(text) {
  const out = {};
  const re = /問\s*(\d{1,3})\s+([アイウエ])/g;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1]);
    if (n in out) throw new Error(`問${n} が重複しています`);
    out[n] = LABELS.indexOf(m[2]);
  }
  return out;
}
