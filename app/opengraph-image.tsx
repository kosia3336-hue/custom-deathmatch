import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = '커스텀 데스매치 — 1:1 보드/카드 게임 플랫폼';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// satori(Edge)는 시스템 한글 폰트가 없어 한글이 비어 렌더링된다.
// Google Fonts 에서 이미지에 사용된 글자만 서브셋으로 받아 폰트로 넘긴다.
const OG_TEXT =
  'Custom Deathmatch 커스텀 데스매치 브라우저에서 바로 즐기는 1:1 보드·카드 게임 · 카카오 로그인 칭호 게임 로그 랭킹';

async function loadKoreanFont(weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (
      await fetch(cssUrl, {
        // IE11 UA 를 보내면 woff2 대신 satori 가 읽을 수 있는 truetype 을 반환한다.
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; AS; rv:11.0) like Gecko',
        },
      })
    ).text();
    const match = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/);
    if (!match) return null;
    return await (await fetch(match[1])).arrayBuffer();
  } catch {
    return null;
  }
}

type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 500 | 800;
  style: 'normal';
};

export default async function OgImage() {
  const [regular, bold] = await Promise.all([
    loadKoreanFont(500, OG_TEXT),
    loadKoreanFont(800, OG_TEXT),
  ]);

  const fonts: OgFont[] = [];
  if (regular) fonts.push({ name: 'Noto Sans KR', data: regular, weight: 500, style: 'normal' });
  if (bold) fonts.push({ name: 'Noto Sans KR', data: bold, weight: 800, style: 'normal' });

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, #4F46E5 0%, #6366F1 45%, #FB7185 100%)',
          color: '#FFFFFF',
          padding: 80,
          fontFamily: '"Noto Sans KR", sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            opacity: 0.9,
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              background: '#FBBF24',
              boxShadow: '0 0 24px rgba(251,191,36,0.7)',
            }}
          />
          Custom Deathmatch
        </div>

        <div
          style={{
            marginTop: 32,
            fontSize: 128,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.04em',
            textShadow: '0 4px 32px rgba(0,0,0,0.25)',
          }}
        >
          커스텀 데스매치
        </div>

        <div
          style={{
            marginTop: 28,
            fontSize: 40,
            fontWeight: 500,
            opacity: 0.95,
            letterSpacing: '-0.01em',
          }}
        >
          브라우저에서 바로 즐기는 1:1 보드·카드 게임
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 56,
            left: 80,
            right: 80,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 22,
            fontWeight: 500,
            opacity: 0.75,
          }}
        >
          <div style={{ display: 'flex', gap: 24 }}>
            <span>· 카카오 로그인</span>
            <span>· 칭호</span>
            <span>· 게임 로그</span>
            <span>· 랭킹</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
