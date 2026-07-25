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
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const KEY = process.env.STDICT_KEY;
if (!KEY) { console.error('❌ STDICT_KEY(표준국어대사전) 필요.'); process.exit(1); }

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

async function fetchPage(q, start, retry = 0) {
  try {
    const res = await fetch(url(q, start), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) {
      const code = String(json.error.error_code ?? json.error.code ?? '');
      if (code === '020' || code === '021') { console.error(`\n❌ 키 오류(${code})`); process.exit(1); }
      return { total: 0, words: [] };
    }
    const ch = json.channel;
    if (!ch) return { total: 0, words: [] };
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
  } catch (e) {
    if (retry < 3) { await sleep(600 * (retry + 1)); return fetchPage(q, start, retry + 1); }
    return { total: 0, words: [] };
  }
}

async function main() {
  const existing = existingWords();
  const prefixes = firstSyllables();
  console.log(`stdict 일반어·명사·3음절 수집 — prefix ${prefixes.length}개, prefix당 최대 ${PAGES_MAX}페이지\n`);

  const collected = new Set();
  const queue = [...prefixes];
  let done = 0;
  async function worker() {
    while (queue.length) {
      const q = queue.shift();
      if (!q) break;
      const first = await fetchPage(q, 1);
      await sleep(DELAY);
      for (const w of first.words) if (!existing.has(w)) collected.add(w);
      const totalPages = Math.min(PAGES_MAX, Math.ceil((first.total || 0) / 100));
      for (let pg = 2; pg <= totalPages; pg++) {
        const r = await fetchPage(q, (pg - 1) * 100 + 1);
        for (const w of r.words) if (!existing.has(w)) collected.add(w);
        await sleep(DELAY);
      }
      if (++done % 100 === 0) process.stdout.write(`\r  ${done}/${prefixes.length} · 수집 ${collected.size}   `);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const out = [...collected].sort((a, b) => a.localeCompare(b, 'ko'));
  writeFileSync('/tmp/3letter-stdict.txt', out.join(' '));
  console.log(`\n✅ stdict 신규 수집 ${out.length}개 → /tmp/3letter-stdict.txt (기존 ${existing.size} 제외)`);
}

main().catch((e) => { console.error('\n오류:', e); process.exit(1); });
