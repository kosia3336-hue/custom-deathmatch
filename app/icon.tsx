import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

// Custom Deathmatch 마크 — 인디고/코랄 두 막대(1:1 결투)를 둥근 배경 위에 표현.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: 3,
          paddingBottom: 6,
          background: '#0B0B12',
          borderRadius: 7,
        }}
      >
        <div
          style={{
            width: 6,
            height: 18,
            borderRadius: 2,
            background: '#4F46E5',
          }}
        />
        <div
          style={{
            width: 6,
            height: 18,
            borderRadius: 2,
            background: '#FB7185',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
