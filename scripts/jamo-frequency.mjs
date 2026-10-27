#!/usr/bin/env node
/**
 * 자리(초성·중성·종성)별 자모 사용 빈도 — 트랜스레터 '어려움' 가중치의 근거.
 *
 *   node scripts/jamo-frequency.mjs
 *
 * 두 말뭉치를 센다.
 *   1) 저장소 문서·화면 문구 (git 에 올라간 .md/.ts/.tsx 의 한글) — 일상 서술문
 *   2) 출제 단어 shared/data/topic-words.ts — 실제로 나오는 명사
 * 두 결과를 자리별로 평균 내어 shared/types/transletter.ts 의 CHO_FREQ·JUNG_FREQ·JONG_FREQ 와
 * 비교한다. 차이가 1.5%p 를 넘는 자모가 있으면 표를 새 값으로 바꾸라고 알린다.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const CHO = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const JUNG = [...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
const JONG = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];

/** 자리별 개수 [초성 19, 중성 21, 종성 28(0 = 받침 없음은 세지 않음)] */
function count(text) {
  const c = [CHO.map(() => 0), JUNG.map(() => 0), JONG.map(() => 0)];
  for (const ch of text.match(/[가-힣]/g) ?? []) {
    const n = ch.charCodeAt(0) - 0xac00;
    c[0][Math.floor(n / 588)]++;
    c[1][Math.floor((n % 588) / 28)]++;
    if (n % 28) c[2][n % 28]++;
  }
  return c.map((arr) => {
    const total = arr.reduce((a, b) => a + b, 0);
    return { total, pct: arr.map((v) => (total ? (v / total) * 100 : 0)) };
  });
}

const files = execFileSync('git', ['ls-files', '*.md', '*.ts', '*.tsx'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && existsSync(f));
const repoText = files.map((f) => readFileSync(f, 'utf8')).join('\n');
const words = [
  ...readFileSync('shared/data/topic-words.ts', 'utf8').matchAll(/'([가-힣]{2,5})'/g),
].map((m) => m[1]);

const corpora = [
  { name: `저장소 문서·화면 문구 (${files.length}개 파일)`, freq: count(repoText) },
  { name: `출제 단어 ${words.length}개`, freq: count(words.join('')) },
];
const POS = [
  { label: '초성', jamo: CHO, table: 'CHO_FREQ' },
  { label: '중성', jamo: JUNG, table: 'JUNG_FREQ' },
  { label: '종성', jamo: JONG, table: 'JONG_FREQ' },
];

for (const c of corpora) {
  console.log(`\n== ${c.name}`);
  POS.forEach((p, k) => {
    const ranked = p.jamo
      .map((j, i) => [j, c.freq[k].pct[i]])
      .filter(([j, v]) => j && v > 0)
      .sort((a, b) => b[1] - a[1]);
    console.log(
      `  ${p.label}(${c.freq[k].total}자): ${ranked.map(([j, v]) => `${j}${v.toFixed(1)}`).join(' ')}`,
    );
  });
}

const source = readFileSync('shared/types/transletter.ts', 'utf8');
let drift = false;
console.log('\n== 두 말뭉치 평균 vs 코드의 가중치 표 (%)');
POS.forEach((p, k) => {
  const avg = p.jamo.map((j, i) =>
    j ? (corpora[0].freq[k].pct[i] + corpora[1].freq[k].pct[i]) / 2 : 0,
  );
  const m = source.match(new RegExp(`const ${p.table} = \\[([^\\]]*)\\]`));
  const table = m
    ? m[1]
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((v) => !Number.isNaN(v))
    : [];
  const off = p.jamo
    .map((j, i) => [j, avg[i], table[i]])
    .filter(([j, a, t]) => j && (t === undefined || Math.abs(a - t) > 1.5));
  if (off.length) drift = true;
  console.log(`  ${p.table}: [${avg.map((v) => v.toFixed(1)).join(', ')}]`);
  console.log(
    off.length
      ? `    ⚠ 1.5%p 넘게 다름: ${off.map(([j, a, t]) => `${j} 표 ${t} → 실측 ${a.toFixed(1)}`).join(', ')}`
      : '    표와 일치 (차이 1.5%p 이내)',
  );
});
if (drift)
  console.log('\n표를 위 평균값으로 바꾸고 server 테스트(game.transletter-hard)를 다시 돌린다.');
