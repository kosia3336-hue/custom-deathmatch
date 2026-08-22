#!/usr/bin/env python3
"""
단어조합 — 표준국어대사전 '전체 내려받기' xls 덤프에서 3음절 명사를 추출한다.

왜 API 가 아니라 덤프인가:
  stdict Open API 는 쿼리당 num<=100 이 상한이고 start>1(페이지네이션)이 동작하지 않는다.
  ('가' 는 942건인데 100건만 받을 수 있음) 그래서 API 로는 전수 수집이 불가능하다.

준비:
  1) https://stdict.korean.go.kr → 사전 내려받기 → 전체 내려받기(xls) 다운로드·압축해제
  2) pip install xlrd   (레거시 .xls 파서. xlrd 2.x 는 .xls 전용)

사용법:
  python3 scripts/extract-stdict-dump.py <덤프폴더> [출력파일]
  기본 출력: /tmp/stdict-full-3letter.txt (공백 구분)

추출 조건: 구성단위=단어 · 품사에 '명사' 포함 · 범주에 '일반어' 포함 · 정확히 3음절 한글
  ⚠ 범주는 뜻이 여러 개면 「1」일반어「2」일반어… 형태다. 정확일치로 비교하면
    흔한 단어일수록 뜻이 많아 통째로 누락되므로 반드시 '포함' 검사를 써야 한다.
"""
import glob
import os
import re
import sys

import xlrd
import xlrd.book

# 덤프에는 깨진 UTF-16 바이트가 섞여 있어 기본 디코더로는 열다가 죽는다.
xlrd.book.unicode = lambda b, enc: b.decode(enc, "replace")

C_WORD, C_UNIT, C_POS, C_CAT = 0, 1, 11, 18
CLEAN = re.compile(r"[-^\s·]")          # 형태소 경계 하이픈·기호 제거
THREE = re.compile(r"^[가-힣]{3}$")


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    src = os.path.expanduser(sys.argv[1])
    dst = sys.argv[2] if len(sys.argv) > 2 else "/tmp/stdict-full-3letter.txt"

    files = sorted(glob.glob(os.path.join(src, "*.xls")))
    if not files:
        print(f"❌ .xls 파일이 없습니다: {src}")
        return 1

    words: set[str] = set()
    rows = 0
    for f in files:
        wb = xlrd.open_workbook(f, on_demand=True)
        sh = wb.sheet_by_index(0)
        for r in range(1, sh.nrows):
            rows += 1
            if str(sh.cell_value(r, C_UNIT)).strip() != "단어":
                continue
            if "명사" not in str(sh.cell_value(r, C_POS)):
                continue
            if "일반어" not in str(sh.cell_value(r, C_CAT)):
                continue
            w = re.sub(r"\(.*?\)|\d", "", CLEAN.sub("", str(sh.cell_value(r, C_WORD))))
            if THREE.match(w):
                words.add(w)
        wb.release_resources()
        print(f"  {os.path.basename(f)} — 누적 {len(words):,}", flush=True)

    out = sorted(words)
    with open(dst, "w") as fp:
        fp.write(" ".join(out))
    print(f"\n✅ 전체행 {rows:,} → 고유 3음절 명사 {len(out):,}개 → {dst}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
