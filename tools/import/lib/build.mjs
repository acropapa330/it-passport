const FIELDS = ["strategy", "management", "technology"];

export function questionId(code, number) {
  return `${code}-${String(number).padStart(3, "0")}`;
}

function fieldOf(exam, number) {
  for (const f of FIELDS) {
    const [from, to] = exam.fieldRanges[f];
    if (number >= from && number <= to) return f;
  }
  throw new Error(`${exam.code} 問${number}: 分野範囲に含まれていません`);
}

/**
 * transcript と answers を突き合わせ、検証済みの Question 配列を返す。
 * 検証に失敗したら throw。allowMissingImages のときだけ画像欠落を warnings に落とす。
 */
export function assembleQuestions({ exam, transcripts, answers, imageExists, expectedCount = 100, allowMissingImages = false }) {
  const warnings = [];
  const byNumber = new Map();

  for (const t of transcripts) {
    for (const q of t.questions) {
      if (byNumber.has(q.number)) throw new Error(`${exam.code} 問${q.number}: 重複しています (page ${t.page})`);
      byNumber.set(q.number, { ...q, page: t.page });
    }
  }

  const questions = [];
  for (let n = 1; n <= expectedCount; n++) {
    const q = byNumber.get(n);
    if (!q) throw new Error(`${exam.code} 問${n}: transcript にありません`);
    if (!Array.isArray(q.choices) || q.choices.length !== 4 || q.choices.some((c) => typeof c !== "string" || c === "")) {
      throw new Error(`${exam.code} 問${n}: 選択肢は 4 つ必要です (page ${q.page})`);
    }
    if (typeof q.text !== "string" || q.text.trim() === "") throw new Error(`${exam.code} 問${n}: 本文が空です`);
    const answerIndex = answers[n];
    if (![0, 1, 2, 3].includes(answerIndex)) throw new Error(`${exam.code} 問${n}: 正解がありません`);

    const id = questionId(exam.code, n);
    const out = {
      id,
      exam: exam.name,
      examCode: exam.code,
      number: n,
      field: fieldOf(exam, n),
      text: q.text,
      choices: q.choices,
      answerIndex,
    };
    if (q.hasFigure) {
      if (imageExists(id)) out.image = `images/${id}.png`;
      else if (allowMissingImages) warnings.push(`${id}: 図表問題ですが画像がありません (page ${q.page})`);
      else throw new Error(`${id}: 図表問題ですが画像がありません (page ${q.page})`);
    }
    questions.push(out);
  }

  if (byNumber.size !== expectedCount) {
    const extra = [...byNumber.keys()].filter((n) => n < 1 || n > expectedCount);
    throw new Error(`${exam.code}: 範囲外の問番号があります: ${extra.join(", ")}`);
  }
  return { questions, warnings };
}
