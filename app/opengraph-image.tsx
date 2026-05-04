import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = '커스텀 데스매치 — 1:1 보드/카드 게임 플랫폼';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
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
          fontFamily:
            'system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif',
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
    { ...size },
  );
}
