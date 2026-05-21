import { redirect } from 'next/navigation';

/**
 * 인디언 홀덤 (이벤트) 페이지는 기존 게임룸 인프라(/room/{id}/play)로 통합되었다.
 * 외부에서 /event 로 들어온 경우 새 경로로 리다이렉트한다.
 */
export default function EventRoomPage() {
  redirect('/room/evt-indpkr/play');
}
