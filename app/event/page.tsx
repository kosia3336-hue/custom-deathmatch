// import { redirect } from 'next/navigation'; // 이벤트 재개 시 주석 해제

/**
 * 이벤트 기간 종료 — 준비중 페이지.
 * 이벤트 재개 시: 이 컴포넌트를 주석 처리하고 아래 redirect 를 복구할 것.
 *
 * 원본:
 * export default function EventRoomPage() {
 *   redirect('/room/evt-indpkr/play');
 * }
 */
export default function EventRoomPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-lg font-semibold text-cdm-fg">현재 진행중인 이벤트가 없습니다.</p>
    </main>
  );
}
