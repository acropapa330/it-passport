#!/usr/bin/env bash
# 問題 PDF を 200dpi の PNG に分割する。usage: tools/import/render.sh [code...]
set -euo pipefail
cd "$(dirname "$0")"
codes=("$@")
if [ ${#codes[@]} -eq 0 ]; then
  codes=($(node -e 'console.log(require("./exams.json").map(e=>e.code).join(" "))'))
fi
for code in "${codes[@]}"; do
  pdf=$(node -e "console.log(require('./exams.json').find(e=>e.code==='$code').qsPdf)")
  mkdir -p "pages/$code"
  pdftoppm -r 200 -png "raw/$pdf" "pages/$code/p"
  echo "$code: $(ls pages/$code | wc -l) pages"
done
