#!/usr/bin/env node
/**
 * 트랜스레터 — 우리말샘 API 로 카테고리별 단어 대량 수집 (cat 태그 + 인기순).
 *
 * 표준국어대사전 API 는 cat(분야) 필터가 무시되고 인기순 정렬도 없어 카테고리 수집이
 * 불가능하다. 우리말샘 API 는 cat 이 실제로 작동하고 sort=popular(많이 찾은 순)를
 * 지원해, 분야별 단어를 인기순으로 대량 수집할 수 있다.
 *
 * ⚠ 트랜스레터는 '낯선 단어 = 못 맞히는 게임'이다. 인기순은 완벽한 친숙도 지표가
 *    아니므로(사람들은 모르는 단어를 오히려 더 검색), 수집 후 낯선 단어가 많으면
 *    WD_TOP_PER_PREFIX 를 낮추거나 사람이 한 번 훑는 것을 권장.
 *
 * 필터: 명사 · 단어 · 일반어(방언/북한어/옛말 제외) · 2~4음절 · cat 분야 · 인기순
 *
 * 사용법:
 *   OPENDICT_KEY=우리말샘키 node scripts/build-transletter-words.mjs
 *   (키 발급: https://opendict.korean.go.kr/service/openApiInfo → 오픈 API 사용 신청)
 *
 * 옵션(환경변수):
 *   WD_CAP_PER_CATEGORY 카테고리당 최대 단어 수 (기본 100). 인기 최상위부터 채운다
 *   WD_TOP_PER_PREFIX 음절 prefix 당 인기순 상위 N개 채택 (기본 20). 낮출수록 흔한 것만
 *   WD_MIN_LEN/MAX_LEN 음절 수 범위 (기본 2~4)
 *   WD_CONCURRENCY    동시 요청 수 (기본 4)
 *   WD_DELAY          요청 간 최소 간격 ms (기본 90)
 *
 * 특징:
 *   - 체크포인트로 중단/재개 (.transletter-checkpoint.json)
 * 출력: shared/data/transletter-words.generated.ts (검수 후 topic-words.ts 에 반영)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const DATA_DIR = join(ROOT, 'shared', 'data');
const CKPT = join(ROOT, '.transletter-checkpoint.json');

const KEY = process.env.OPENDICT_KEY;
if (!KEY) {
  console.error('❌ OPENDICT_KEY(우리말샘) 필요.');
  console.error('   https://opendict.korean.go.kr/service/openApiInfo → 오픈 API 사용 신청 후:');
  console.error('   OPENDICT_KEY=your_key node scripts/build-transletter-words.mjs');
  process.exit(1);
}

const CAP_PER_CATEGORY = Math.max(10, Number(process.env.WD_CAP_PER_CATEGORY ?? 100));
const TOP_PER_PREFIX = Math.max(1, Number(process.env.WD_TOP_PER_PREFIX ?? 3));
const MIN_LEN = Math.max(2, Number(process.env.WD_MIN_LEN ?? 2));
const MAX_LEN = Math.min(5, Number(process.env.WD_MAX_LEN ?? 4));
const CONCURRENCY = Math.max(1, Number(process.env.WD_CONCURRENCY ?? 4));
const DELAY = Math.max(0, Number(process.env.WD_DELAY ?? 90));

/** 우리 게임 카테고리 → 우리말샘 cat 코드 */
const CATEGORY_CAT = {
  동물: [16],
  식물: [35],
  음식: [36], // 식품
  음악: [44],
  미술: [21],
  운동: [62], // 체육
};
/** cat 태그가 없어 API 수집 불가 → 큐레이션 유지 */
const CURATED_ONLY = ['사물', '신체', '자연·장소'];

/* ── 첫 음절 (상용) ──────────────────────────────────────────── */
const CJUNG = [0, 1, 2, 4, 5, 6, 8, 12, 13, 17, 18, 20];
const CJONG = [0, 1, 4, 8, 16, 17, 19, 21];
const syl = (c, j, t) => String.fromCharCode(0xac00 + (c * 21 + j) * 28 + t);
const firstSyllables = () => {
  const out = [];
  for (let c = 0; c < 19; c++) for (const j of CJUNG) for (const t of CJONG) out.push(syl(c, j, t));
  return out;
};

const API = 'https://opendict.korean.go.kr/api/search';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function url(q, cat, len) {
  const p = new URLSearchParams({
    key: KEY, q, req_type: 'json', start: '1', num: '100',
    advanced: 'y', target: '1', method: 'start',
    type1: 'word', type3: 'general', pos: '1',
    cat: String(cat), sort: 'popular',
    letter_s: String(len), letter_e: String(len),
  });
  return `${API}?${p.toString()}`;
}

async function fetchTop(q, cat, len, retry = 0) {
  try {
    const res = await fetch(url(q, cat, len), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) {
      const code = String(json.error.error_code ?? json.error.code ?? '');
      if (code === '020' || code === '021') { console.error(`\n❌ 키 오류(${code}): ${json.error.message}`); process.exit(1); }
      return [];
    }
    const ch = json.channel;
    if (!ch) return [];
    const items = Array.isArray(ch.item) ? ch.item : ch.item ? [ch.item] : [];
    const out = [];
    for (const it of items) {
      const w = String(it.word ?? '').replace(/[\-^]/g, '').trim();
      if (new RegExp(`^[가-힣]{${len}}$`).test(w)) out.push(w);
      if (out.length >= TOP_PER_PREFIX) break;
    }
    return out;
  } catch (e) {
    if (retry < 3) { await sleep(500 * (retry + 1)); return fetchTop(q, cat, len, retry + 1); }
    return [];
  }
}

function loadCkpt() {
  if (!existsSync(CKPT)) return { words: {}, doneCats: [] };
  try { return JSON.parse(readFileSync(CKPT, 'utf8')); } catch { return { words: {}, doneCats: [] }; }
}
const saveCkpt = (c) => writeFileSync(CKPT, JSON.stringify(c));

function existingCurated() {
  const p = join(DATA_DIR, 'topic-words.ts');
  if (!existsSync(p)) return {};
  const src = readFileSync(p, 'utf8');
  const map = {};
  const re = /name:\s*'([^']+)',\s*words:\s*\[([\s\S]*?)\]/g;
  let m;
  while ((m = re.exec(src))) map[m[1]] = [...m[2].matchAll(/'([가-힣]+)'/g)].map((x) => x[1]);
  return map;
}

async function collectCategory(name, cats, ckpt) {
  // 각 prefix 에서 인기순 상위 TOP_PER_PREFIX 개를 '순위 리스트'로 받아,
  // rank0(각 음절 최고 인기어) → rank1 → … 순으로 병합해 CAP 까지만 채운다.
  const prefixes = firstSyllables();
  const jobs = [];
  for (const q of prefixes) for (const cat of cats) for (let len = MIN_LEN; len <= MAX_LEN; len++) jobs.push({ q, cat, len });

  const ranked = new Map(); // key: prefix|cat|len → 인기순 단어 배열
  const cacheKey = (j) => `${name}:${j.q}:${j.cat}:${j.len}`;
  // 체크포인트에 저장된 결과 복원
  ckpt.ranked ??= {};

  let processed = 0;
  const queue = [...jobs];
  async function worker() {
    while (queue.length) {
      const j = queue.shift();
      if (!j) break;
      const ck = cacheKey(j);
      let arr = ckpt.ranked[ck];
      if (!arr) {
        arr = await fetchTop(j.q, j.cat, j.len); // 인기순 상위 배열
        ckpt.ranked[ck] = arr;
        await sleep(DELAY);
      }
      ranked.set(ck, arr);
      if (++processed % 80 === 0) { saveCkpt(ckpt); process.stdout.write(`\r    [${name}] ${processed}/${jobs.length}   `); }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  saveCkpt(ckpt);

  // 티어 병합: rank0 전체 → rank1 전체 → … , CAP 까지
  const out = [];
  const seen = new Set();
  const lists = [...ranked.values()];
  const maxRank = Math.max(0, ...lists.map((a) => a.length));
  for (let r = 0; r < maxRank && out.length < CAP_PER_CATEGORY; r++) {
    for (const a of lists) {
      const w = a[r];
      if (w && !seen.has(w)) { seen.add(w); out.push(w); if (out.length >= CAP_PER_CATEGORY) break; }
    }
  }
  return out;
}

async function main() {
  console.log(`트랜스레터 수집 — 우리말샘 cat + 인기순, 카테고리당 ${CAP_PER_CATEGORY}개 (인기 최상위부터)\n`);
  const curated = existingCurated();
  const ckpt = loadCkpt();
  const result = {};

  for (const [name, cats] of Object.entries(CATEGORY_CAT)) {
    console.log(`[${name}] 수집 중…`);
    const collected = await collectCategory(name, cats, ckpt);
    // 수집분(인기 상위 CAP개) + 기존 큐레이션 병합
    const set = new Set([...collected, ...(curated[name] ?? [])]);
    result[name] = [...set].sort();
    console.log(`\r  [${name}] 완료 — ${result[name].length}단어 (수집 ${collected.length}, cap ${CAP_PER_CATEGORY})   `);
  }
  for (const name of CURATED_ONLY) if (curated[name]) result[name] = [...new Set(curated[name])].sort();

  const block = Object.entries(result)
    .map(([name, words]) => {
      const lines = [];
      for (let i = 0; i < words.length; i += 10) lines.push('      ' + words.slice(i, i + 10).map((w) => `'${w}'`).join(', ') + ',');
      return `  {\n    name: '${name}',\n    words: [\n${lines.join('\n')}\n    ],\n  },`;
    })
    .join('\n');

  writeFileSync(
    join(DATA_DIR, 'transletter-words.generated.ts'),
    `/**
 * 트랜스레터 — 카테고리별 단어 (자동 생성: 큐레이션 + 우리말샘 cat·인기순 수집).
 * ⚠ scripts/build-transletter-words.mjs 가 생성. 검수 후 topic-words.ts 에 반영하세요.
 *   낯선 단어가 섞일 수 있습니다(인기순은 완벽한 친숙도 지표 아님).
 * 생성: ${new Date().toISOString()}
 */
import type { TopicWords } from './topic-words';

export const TRANSLETTER_CATEGORIES_GENERATED: TopicWords[] = [
${block}
];
`,
    'utf8',
  );

  const total = Object.values(result).reduce((a, w) => a + w.length, 0);
  console.log(`\n✅ 완료 — 총 ${total}단어 → shared/data/transletter-words.generated.ts`);
  console.log('   내용 확인 후 topic-words.ts 로 반영하면 게임에 적용됩니다.');
}

main().catch((e) => { console.error('\n오류:', e); process.exit(1); });
