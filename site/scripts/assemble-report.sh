#!/usr/bin/env bash
# Stitches ../REPORT.md from its written half and its generated half.
# The numbers come from qa/report-section.md, which scripts/report.mjs writes
# from the QA artefacts — so nobody has to retype a measurement.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 - "$@" <<'PY'
import re, pathlib
report = pathlib.Path('../REPORT.md')
text = report.read_text(encoding='utf-8')
# Everything from "## 7 ·" onwards is generated; keep the prose before it.
head = re.split(r'\n## 7 · ', text)[0].rstrip() + '\n\n---\n\n'
section = pathlib.Path('qa/report-section.md').read_text(encoding='utf-8').rstrip() + '\n'
dod = pathlib.Path('qa/dod.md').read_text(encoding='utf-8').rstrip() + '\n'
report.write_text(head + section + '\n' + dod, encoding='utf-8')
print('REPORT.md assembled:', len((head + section + dod).splitlines()), 'lines')
PY
