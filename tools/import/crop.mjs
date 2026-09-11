import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const imagesDir = join(root, "public", "data", "images");
mkdirSync(imagesDir, { recursive: true });

const exams = JSON.parse(readFileSync(join(here, "exams.json"), "utf8"));
const overrides = JSON.parse(readFileSync(join(here, "overrides.json"), "utf8"));
const only = process.argv.slice(2);

for (const o of overrides) {
  if (only.length && !only.includes(o.id)) continue;
  const code = o.id.split("-")[0];
  const exam = exams.find((e) => e.code === code);
  if (!exam) throw new Error(`${o.id}: exams.json に ${code} がありません`);
  const prefix = join(imagesDir, `tmp-${o.id}`);
  // pdftoppm は 200dpi のピクセル座標で切り出せる（pages/ の PNG と同じ座標系）
  execFileSync("pdftoppm", [
    "-r", "200", "-png",
    "-f", String(o.page), "-l", String(o.page),
    "-x", String(o.x), "-y", String(o.y), "-W", String(o.w), "-H", String(o.h),
    "-singlefile",
    join(here, "raw", exam.qsPdf), prefix,
  ]);
  renameSync(`${prefix}.png`, join(imagesDir, `${o.id}.png`));
  console.log(`${o.id}: page ${o.page} (${o.x},${o.y}) ${o.w}x${o.h}`);
}
