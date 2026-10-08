/**
 * 관리자 화면 → /api/admin/notify-member-sanctioned.
 * 정지가 DB 에 반영된 뒤 접속 중인 소켓을 끊게 한다. 실패해도 정지 자체는
 * 이미 됐고 다음 접속 때 막히므로 기다리거나 오류로 띄우지 않는다.
 */
export function notifySanctioned(target: { memberId: string } | { reportId: string }): void {
  void fetch('/api/admin/notify-member-sanctioned', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(target),
  }).catch(() => undefined);
}
