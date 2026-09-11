import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAnswerText } from "./lib/answers.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const exams = JSON.parse(readFileSync(join(here, "exams.json"), "utf8"));
const only = process.argv.slice(2);
mkdirSync(join(here, "answers"), { recursive: true });

for (const exam of exams) {
  if (only.length && !only.includes(exam.code)) continue;
  const text = execFileSync("pdftotext", ["-layout", join(here, "raw", exam.ansPdf), "-"], { encoding: "utf8" });
  const answers = parseAnswerText(text);
  const n = Object.keys(answers).length;
  if (n !== 100) throw new Error(`${exam.code}: 解答が ${n} 問しか読めませんでした`);
  writeFileSync(join(here, "answers", `${exam.code}.json`), JSON.stringify(answers, null, 2) + "\n");
  console.log(`${exam.code}: 100 answers`);
}
