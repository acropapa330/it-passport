import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assembleQuestions } from "./lib/build.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const imagesDir = join(root, "public", "data", "images");
const outFile = join(root, "public", "data", "questions.json");

const args = process.argv.slice(2);
const allowMissingImages = args.includes("--allow-missing-images");
const only = args.filter((a) => !a.startsWith("--"));

const exams = JSON.parse(readFileSync(join(here, "exams.json"), "utf8"));
const all = [];
const warnings = [];

for (const exam of exams) {
  if (only.length && !only.includes(exam.code)) continue;
  const dir = join(here, "transcripts", exam.code);
  if (!existsSync(dir)) {
    console.log(`${exam.code}: transcripts がないのでスキップ`);
    continue;
  }
  const transcripts = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
  const answers = JSON.parse(readFileSync(join(here, "answers", `${exam.code}.json`), "utf8"));
  const { questions, warnings: w } = assembleQuestions({
    exam,
    transcripts,
    answers,
    imageExists: (id) => existsSync(join(imagesDir, `${id}.png`)),
    allowMissingImages,
  });
  all.push(...questions);
  warnings.push(...w);
  console.log(`${exam.code}: ${questions.length} questions, ${questions.filter((q) => q.image).length} with image`);
}

const ids = new Set(all.map((q) => q.id));
if (ids.size !== all.length) throw new Error("id が重複しています");

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify({ version: 1, questions: all }, null, 1) + "\n");
for (const w of warnings) console.warn(`WARN ${w}`);
console.log(`wrote ${outFile} (${all.length} questions)`);
