/**
 * 결과 공유 카드 이미지(1200×630) — 카톡·디스코드 등 링크 미리보기에 뜬다.
 *
 * next/og(satori)는 woff2 를 읽지 못하고 기본 글꼴에 한글이 없다. 그래서 그릴 글자만
 * Google Fonts(Noto Sans KR, OFL)에서 서브셋 TTF 로 받아 쓴다(보통 수십 KB).
 * 글꼴을 못 받거나 결과를 찾지 못하면 사이트 공통 OG 이미지로 대신한다 — 미리보기가
 * 깨진 채로 캐시되는 것보다 낫다.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { formatShareDateTime } from '../resultShare';
import {
  formatShareOpponents,
  formatSharePlayTime,
  type ResultShareView,
} from './resultShareView';

export const RESULT_CARD_SIZE = { width: 1200, height: 630 };

const TONE: Record<ResultShareView['result'], string> = {
  win: '#FFD166',
  lose: '#A9AED6',
  draw: '#7DD3FC',
  resign: '#A9AED6',
};

const fontCache = new Map<string, ArrayBuffer>();

async function loadKoreanFont(text: string, weight: 500 | 800): Promise<ArrayBuffer> {
  const glyphs = Array.from(new Set(text)).sort().join('');
  const key = `${weight}:${glyphs}`;
  const hit = fontCache.get(key);
  if (hit) return hit;

  const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(glyphs)}`;
  const css = await (await fetch(cssUrl, { signal: AbortSignal.timeout(4000) })).text();
  const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
  if (!src) throw new Error('글꼴 주소를 찾지 못했습니다.');
  const res = await fetch(src, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`글꼴 응답 ${res.status}`);
  const data = await res.arrayBuffer();

  if (fontCache.size >= 200) fontCache.clear();
  fontCache.set(key, data);
  return data;
}

let iconDataUrl: string | null | undefined;

async function loadIcon(): Promise<string | null> {
  if (iconDataUrl !== undefined) return iconDataUrl;
  try {
    const buf = await readFile(path.join(process.cwd(), 'app', 'icon.png'));
    iconDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    iconDataUrl = null;
  }
  return iconDataUrl;
}

async function siteImageResponse(): Promise<Response> {
  try {
    const buf = await readFile(path.join(process.cwd(), 'app', 'opengraph-image.png'));
    return new Response(new Uint8Array(buf), {
      headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=300' },
    });
  } catch {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#14142B',
            color: '#FFFFFF',
            fontSize: 72,
          }}
        >
          Custom Deathmatch
        </div>
      ),
      RESULT_CARD_SIZE,
    );
  }
}

const clip = (name: string, max = 12) => (name.length > max ? `${name.slice(0, max)}…` : name);

export async function renderResultCardImage(view: ResultShareView | null): Promise<Response> {
  if (!view) return siteImageResponse();

  const vsLine = view.opponents.length
    ? `${clip(view.sharerNickname)}  vs  ${formatShareOpponents(view.opponents.map((n) => clip(n)))}`
    : clip(view.sharerNickname);
  const meta = [
    formatShareDateTime(view.playedAt),
    `플레이 ${formatSharePlayTime(view.playTimeMs)}`,
    `${view.totalTurns}턴`,
  ]
    .filter(Boolean)
    .join('  ·  ');
  const allText = `${view.gameName}${view.resultLabel}${vsLine}${meta}랭크전CUSTOM DEATHMATCH…`;

  let fonts;
  try {
    const [heavy, regular] = await Promise.all([
      loadKoreanFont(allText, 800),
      loadKoreanFont(allText, 500),
    ]);
    fonts = [
      { name: 'CDM', data: heavy, weight: 800 as const, style: 'normal' as const },
      { name: 'CDM', data: regular, weight: 500 as const, style: 'normal' as const },
    ];
  } catch (err) {
    console.warn('[share] 카드 글꼴을 받지 못해 공통 이미지로 대신합니다:', (err as Error).message);
    return siteImageResponse();
  }
  const icon = await loadIcon();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 80px',
          background: 'linear-gradient(135deg, #14142B 0%, #1E1E3F 55%, #3A2A6B 100%)',
          color: '#FFFFFF',
          fontFamily: 'CDM',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {icon && (
              // eslint-disable-next-line @next/next/no-img-element -- satori 는 <img> 만 그린다
              <img src={icon} width={52} height={52} alt="" style={{ borderRadius: 12 }} />
            )}
            <div
              style={{
                marginLeft: icon ? 18 : 0,
                fontSize: 26,
                fontWeight: 500,
                letterSpacing: 6,
                color: '#A5A8E8',
              }}
            >
              CUSTOM DEATHMATCH
            </div>
          </div>
          {view.isRanked && (
            <div
              style={{
                display: 'flex',
                padding: '8px 24px',
                borderRadius: 999,
                border: '2px solid #FFD166',
                color: '#FFD166',
                fontSize: 26,
                fontWeight: 500,
              }}
            >
              랭크전
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 40, fontWeight: 500, color: '#C9CBF5' }}>{view.gameName}</div>
          <div
            style={{
              fontSize: 150,
              fontWeight: 800,
              lineHeight: 1.05,
              marginTop: 6,
              color: TONE[view.result],
            }}
          >
            {view.resultLabel}
          </div>
          <div style={{ fontSize: 54, fontWeight: 800, marginTop: 14 }}>{vsLine}</div>
        </div>

        <div style={{ fontSize: 32, fontWeight: 500, color: '#A5A8E8' }}>{meta}</div>
      </div>
    ),
    { ...RESULT_CARD_SIZE, fonts, headers: { 'cache-control': 'public, max-age=3600' } },
  );
}
