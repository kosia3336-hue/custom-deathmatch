import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { ruleImageStoragePrefix } from '@/lib/ruleImageSrc';

export const dynamic = 'force-dynamic';

const CACHE_DIR = join(tmpdir(), 'cdm-rule-images');
const MAX_BYTES = 15 * 1024 * 1024;
const inflight = new Map<string, Promise<{ body: Buffer; type: string } | null>>();

/**
 * GET /api/rule-image?src=<Supabase 저장소 주소> — 룰 이미지를 우리 서버에서 내준다.
 *
 * Supabase 에서는 이미지마다 처음 한 번만 받아 디스크(임시 폴더)에 둔다. 업로드할 때마다
 * 파일 이름이 새로 생기므로(날짜/uuid) 같은 주소의 내용은 바뀌지 않는다 — 브라우저에도
 * 1년 캐시를 준다. rule-images 버킷 주소만 받는다(아무 주소나 대신 받아 주지 않게).
 */
export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get('src') ?? '';
  const prefix = ruleImageStoragePrefix();
  if (!prefix || !src.startsWith(prefix) || src.includes('..') || src.length > 500) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const key = createHash('sha1').update(src).digest('hex');
  const file = join(CACHE_DIR, key);
  let hit = await readCached(file);
  if (!hit) {
    let job = inflight.get(key);
    if (!job) {
      job = fetchAndStore(src, file).finally(() => inflight.delete(key));
      inflight.set(key, job);
    }
    hit = await job;
  }
  if (!hit) return NextResponse.json({ error: 'not found' }, { status: 404 });

  return new NextResponse(new Uint8Array(hit.body), {
    headers: {
      'Content-Type': hit.type,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

async function readCached(file: string): Promise<{ body: Buffer; type: string } | null> {
  try {
    const [body, type] = await Promise.all([readFile(file), readFile(`${file}.type`, 'utf8')]);
    return { body, type };
  } catch {
    return null;
  }
}

async function fetchAndStore(src: string, file: string): Promise<{ body: Buffer; type: string } | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? 'application/octet-stream';
    if (!type.startsWith('image/')) return null;
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length > MAX_BYTES) return null;
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(file, body);
    await writeFile(`${file}.type`, type);
    return { body, type };
  } catch {
    return null;
  }
}
