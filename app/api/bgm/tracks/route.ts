import { NextResponse } from 'next/server';

/**
 * BGM 트랙 URL 목록 (고정).
 * `public/audio/bgm/` 파일 추가 시 여기에 한 줄 추가하면 됨.
 *
 * 서버리스(Vercel 등)에서는 런타임 `fs.readdir` 로 public 폴더를 읽을 수 없어
 * 빈 목록이 되므로, 코드로 나열한다 — docs/v2/21_bgm.md §21.2.2
 */
const TRACKS = [
  '/audio/bgm/track_01.mp3',
  '/audio/bgm/track_02.mp3',
  '/audio/bgm/track_03.mp3',
  '/audio/bgm/track_04.mp3',
  '/audio/bgm/track_05.mp3',
  '/audio/bgm/track_06.mp3',
  '/audio/bgm/track_07.mp3',
  '/audio/bgm/track_08.mp3',
  '/audio/bgm/track_09.mp3',
  '/audio/bgm/track_10.mp3',
  '/audio/bgm/track_11.mp3',
  '/audio/bgm/track_12.mp3',
  '/audio/bgm/track_13.mp3',
];

export async function GET() {
  return NextResponse.json({ tracks: TRACKS }, { headers: { 'cache-control': 'no-store' } });
}
