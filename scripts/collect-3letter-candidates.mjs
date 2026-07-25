#!/usr/bin/env node
/**
 * 단어조합 — 우리말샘에서 '일반어·명사·3음절' 단어를 인기순으로 대량 수집.
 * 카테고리 필터 없이 전 범위를 훑어 흔한 3글자 명사 후보를 모은다.
 *
 * ⚠ 인기순은 완벽한 친숙도 지표가 아니므로, 출력물은 반드시 사람이 검수해
 *    친숙한 단어만 three-letter-words.ts 에 반영한다. (게임 특성상 낯선 단어는 못 맞힘)
 *
 * 사용법: OPENDICT_KEY=키 node scripts/collect-3letter-candidates.mjs
 * 출력:   /tmp/3letter-candidates.txt  (인기순 상위부터, 공백 구분)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const KEY = process.env.OPENDICT_KEY;
if (!KEY) {
  console.error('❌ OPENDICT_KEY(우리말샘) 필요.');
  process.exit(1);
}

const TOP_PER_PREFIX = Math.max(1, Number(process.env.WD_TOP ?? 3));
const CONCURRENCY = Math.max(1, Number(process.env.WD_CONCURRENCY ?? 4));
const DELAY = Math.max(0, Number(process.env.WD_DELAY ?? 80));

// 기존 단어(중복 제거용)
function existingWords() {
  const p = join(ROOT, 'shared', 'data', 'three-letter-words.ts');
  const src = readFileSync(p, 'utf8');
  return new Set([...src.matchAll(/'([가-힣]{3})'/g)].map((m) => m[1]));
}

// 첫 음절 조합 (상용 초/중/종)
const CJUNG = [0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 13, 17, 18, 20];
const CJONG = [0, 1, 4, 8, 16, 17, 19, 21, 22, 27];
const syl = (c, j, t) => String.fromCharCode(0xac00 + (c * 21 + j) * 28 + t);
function firstSyllables() {
  const out = [];
  for (let c = 0; c < 19; c++) for (const j of CJUNG) for (const t of CJONG) out.push(syl(c, j, t));
  return out;
}

const API = 'https://opendict.korean.go.kr/api/search';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function url(q) {
  const p = new URLSearchParams({
    key: KEY, q, req_type: 'json', start: '1', num: '20',
    advanced: 'y', target: '1', method: 'start',
    type1: 'word', type3: 'general', pos: '1',
    sort: 'popular', letter_s: '3', letter_e: '3',
  });
  return `${API}?${p.toString()}`;
}

async function fetchTop(q, retry = 0) {
  try {
    const res = await fetch(url(q), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) {
      const code = String(json.error.error_code ?? json.error.code ?? '');
      if (code === '020' || code === '021') { console.error(`\n❌ 키 오류(${code})`); process.exit(1); }
      return [];
    }
    const ch = json.channel;
    if (!ch) return [];
    const items = Array.isArray(ch.item) ? ch.item : ch.item ? [ch.item] : [];
    const out = [];
    for (const it of items) {
      const w = String(it.word ?? '').replace(/[\-^]/g, '').trim();
      if (/^[가-힣]{3}$/.test(w)) out.push(w);
      if (out.length >= TOP_PER_PREFIX) break;
    }
    return out;
  } catch (e) {
    if (retry < 3) { await sleep(500 * (retry + 1)); return fetchTop(q, retry + 1); }
    return [];
  }
}

async function main() {
  const existing = existingWords();
  const prefixes = firstSyllables();
  console.log(`일반어·명사·3음절 수집 — prefix ${prefixes.length}개, prefix당 상위 ${TOP_PER_PREFIX}\n`);

  const ranked = new Map(); // prefix → [단어...]
  const queue = [...prefixes];
  let done = 0;
  async function worker() {
    while (queue.length) {
      const q = queue.shift();
      if (!q) break;
      ranked.set(q, await fetchTop(q));
      await sleep(DELAY);
      if (++done % 50 === 0) process.stdout.write(`\r  ${done}/${prefixes.length}   `);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // rank0 전체 → rank1 전체 → … (각 prefix 최상위 인기어부터)
  const lists = [...ranked.values()];
  const maxRank = Math.max(0, ...lists.map((a) => a.length));
  const out = [];
  const seen = new Set(existing);
  for (let r = 0; r < maxRank; r++) {
    for (const a of lists) {
      const w = a[r];
      if (w && !seen.has(w)) { seen.add(w); out.push(w); }
    }
  }

  writeFileSync('/tmp/3letter-candidates.txt', out.join(' '));
  console.log(`\n✅ 신규 후보 ${out.length}개 → /tmp/3letter-candidates.txt (기존 ${existing.size} 제외)`);
}

main().catch((e) => { console.error('\n오류:', e); process.exit(1); });
