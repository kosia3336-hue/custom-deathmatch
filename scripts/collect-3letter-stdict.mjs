#!/usr/bin/env node
/**
 * 단어조합 — 표준국어대사전(stdict)에서 '일반어·명사·3음절' 표준어를 수집.
 *
 * 우리말샘과 달리 표준국어대사전은 표준어만 실려 있어 지명·인명·신조어·방언이
 * 거의 없다(품질 높음). 다만 인기순 정렬이 없어 사전 순서로 수집되므로,
 * 흔한 단어와 난해한 한자어가 섞인다(친숙도 무관 수집).
 *
 * 필터: 명사(pos=1) · 3음절 · sense.type = 일반어 (방언/북한어/옛말 제외)
 *
 * 사용법: STDICT_KEY=키 node scripts/collect-3letter-stdict.mjs
 * 출력:   /tmp/3letter-stdict.txt (공백 구분)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const KEY = process.env.STDICT_KEY;
if (!KEY) { console.error('❌ STDICT_KEY(표준국어대사전) 필요.'); process.exit(1); }

const CKPT_PATH = '/tmp/.stdict-3letter-checkpoint.json';

const PAGES_MAX = Math.max(1, Number(process.env.WD_PAGES ?? 12)); // prefix당 최대 페이지(×100)
const CONCURRENCY = Math.max(1, Number(process.env.WD_CONCURRENCY ?? 5));
const DELAY = Math.max(0, Number(process.env.WD_DELAY ?? 60));

function existingWords() {
  const p = join(ROOT, 'shared', 'data', 'three-letter-words.ts');
  const src = readFileSync(p, 'utf8');
  return new Set([...src.matchAll(/'([가-힣]{3})'/g)].map((m) => m[1]));
}

// 첫 음절: 전 초성 × 전 중성 × (받침 없음 + 상용 받침)
const JONG = [0, 1, 2, 4, 7, 8, 16, 17, 19, 21, 22, 24, 25, 26, 27];
const syl = (c, j, t) => String.fromCharCode(0xac00 + (c * 21 + j) * 28 + t);
function firstSyllables() {
  const out = [];
  for (let c = 0; c < 19; c++) for (let j = 0; j < 21; j++) for (const t of JONG) out.push(syl(c, j, t));
  return out;
}

const API = 'https://stdict.korean.go.kr/api/search.do';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function url(q, start) {
  const p = new URLSearchParams({
    key: KEY, q, req_type: 'json', advanced: 'y', method: 'start',
    pos: '1', letter_s: '3', letter_e: '3', num: '100', start: String(start),
  });
  return `${API}?${p.toString()}`;
}

function senseTypes(sense) {
  const arr = Array.isArray(sense) ? sense : sense ? [sense] : [];
  return arr.map((s) => String(s?.type ?? ''));
}

/** 재시도를 다 써도 채널이 비어 있으면(=쿼터 소진 등 지속 실패) 이 값을 던져 전체를 중단시킨다. */
class QuotaExhaustedError extends Error {}

const MAX_RETRY = Number(process.env.WD_MAX_RETRY ?? 5);

async function fetchPage(q, start, retry = 0) {
  let res;
  try {
    res = await fetch(url(q, start), { signal: AbortSignal.timeout(15000) });
  } catch (e) {
    if (retry < MAX_RETRY) { await sleep(800 * (retry + 1)); return fetchPage(q, start, retry + 1); }
    throw new QuotaExhaustedError(`네트워크 실패 지속: ${(e && e.message) || e}`);
  }
  if (!res.ok) {
    if (retry < MAX_RETRY) { await sleep(800 * (retry + 1)); return fetchPage(q, start, retry + 1); }
    throw new QuotaExhaustedError(`HTTP ${res.status} 지속`);
  }
  const text = await res.text();
  // ⚠ 쿼터 소진 시 stdict 는 HTTP 200 + 빈 바디(또는 '{}')를 준다 — 에러 필드도 없어
  //   "정상, 결과 0건"과 구분이 안 된다. 그래서 이 경우는 '0건'으로 넘기지 않고 반드시
  //   재시도하고, 그래도 계속 비면 전체 수집을 중단(QuotaExhaustedError)한다.
  //   (예전엔 여기서 { total: 0, words: [] } 를 반환해 각 prefix의 2페이지 이후가
  //   전부 조용히 누락됐다 — '가리비' 같은 흔한 단어가 빠진 원인.)
  if (!text || text.trim() === '' || text.trim() === '{}') {
    if (retry < MAX_RETRY) { await sleep(1500 * (retry + 1)); return fetchPage(q, start, retry + 1); }
    throw new QuotaExhaustedError('빈 응답(쿼터 소진 추정) 지속');
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    if (retry < MAX_RETRY) { await sleep(800 * (retry + 1)); return fetchPage(q, start, retry + 1); }
    throw new QuotaExhaustedError('JSON 파싱 실패 지속');
  }
  if (json.error) {
    const code = String(json.error.error_code ?? json.error.code ?? '');
    if (code === '020' || code === '021') { console.error(`\n❌ 키 오류(${code})`); process.exit(1); }
    return { total: 0, words: [] };
  }
  const ch = json.channel;
  if (!ch) {
    if (retry < MAX_RETRY) { await sleep(1200 * (retry + 1)); return fetchPage(q, start, retry + 1); }
    throw new QuotaExhaustedError('channel 없는 응답 지속');
  }
  const total = Number(ch.total ?? 0);
  let items = ch.item;
  items = Array.isArray(items) ? items : items ? [items] : [];
  const words = [];
  for (const it of items) {
    const types = senseTypes(it.sense);
    if (!types.includes('일반어')) continue; // 일반어만
    const w = String(it.word ?? '').replace(/[-^\s]/g, '').trim();
    if (/^[가-힣]{3}$/.test(w)) words.push(w);
  }
  return { total, words };
}

function loadCheckpoint(allPrefixes) {
  if (!existsSync(CKPT_PATH)) return { collected: new Set(), remaining: [...allPrefixes] };
  try {
    const ck = JSON.parse(readFileSync(CKPT_PATH, 'utf8'));
    console.log(`↻ 체크포인트 이어서 진행 — 이미 수집 ${ck.collected.length}개, 남은 prefix ${ck.remaining.length}개\n`);
    return { collected: new Set(ck.collected), remaining: ck.remaining };
  } catch {
    return { collected: new Set(), remaining: [...allPrefixes] };
  }
}

function saveCheckpoint(collected, remaining) {
  writeFileSync(CKPT_PATH, JSON.stringify({ collected: [...collected], remaining }));
}

async function main() {
  const existing = existingWords();
  const allPrefixes = firstSyllables();
  const { collected, remaining } = loadCheckpoint(allPrefixes);
  console.log(`stdict 일반어·명사·3음절 수집 — 남은 prefix ${remaining.length}개, prefix당 최대 ${PAGES_MAX}페이지\n`);

  const queue = [...remaining];
  const totalToProcess = queue.length;
  let done = 0;
  let quotaHit = false;

  async function worker() {
    while (queue.length) {
      if (quotaHit) return;
      const q = queue.shift();
      if (!q) break;
      try {
        const first = await fetchPage(q, 1);
        await sleep(DELAY);
        for (const w of first.words) if (!existing.has(w)) collected.add(w);
        const totalPages = Math.min(PAGES_MAX, Math.ceil((first.total || 0) / 100));
        for (let pg = 2; pg <= totalPages; pg++) {
          const r = await fetchPage(q, (pg - 1) * 100 + 1);
          for (const w of r.words) if (!existing.has(w)) collected.add(w);
          await sleep(DELAY);
        }
      } catch (e) {
        if (e instanceof QuotaExhaustedError) {
          quotaHit = true;
          queue.unshift(q); // 이 prefix는 못 끝냈으니 되돌려 다음 실행에서 재시도
          console.log(`\n\n⚠️  쿼터 소진 감지(${e.message}) — 여기서 중단하고 체크포인트 저장.`);
          return;
        }
        throw e;
      }
      if (++done % 50 === 0) {
        process.stdout.write(`\r  ${done}/${totalToProcess} · 수집 ${collected.size}   `);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (quotaHit) {
    saveCheckpoint(collected, queue);
    console.log(`중간 저장: 수집 ${collected.size}개, 남은 prefix ${queue.length}개.`);
    console.log('내일 쿼터가 초기화된 뒤 같은 명령으로 다시 실행하면 이어서 진행됩니다.');
    process.exit(0);
  }

  const out = [...collected].sort((a, b) => a.localeCompare(b, 'ko'));
  writeFileSync('/tmp/3letter-stdict.txt', out.join(' '));
  if (existsSync(CKPT_PATH)) writeFileSync(CKPT_PATH, JSON.stringify({ collected: [], remaining: [] }));
  console.log(`\n✅ stdict 신규 수집 ${out.length}개 → /tmp/3letter-stdict.txt (기존 ${existing.size} 제외)`);
}

main().catch((e) => { console.error('\n오류:', e); process.exit(1); });
