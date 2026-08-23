import 'server-only';

/** 길드 가입/탈퇴/추방 등으로 소속이 바뀐 회원의 접속 중인 소켓에 즉시 반영 */
export async function notifyGuildMembershipChanged(memberId: string): Promise<void> {
  const socketServerUrl =
    process.env.SOCKET_SERVER_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_SOCKET_URL ??
    'http://localhost:4001';
  const internalSecret = process.env.INTERNAL_SECRET ?? 'dev-internal-secret';
  try {
    await fetch(`${socketServerUrl}/internal/notify-guild-membership-changed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: internalSecret, memberId }),
    });
  } catch {
    // 소켓 서버 다운 등 — 다음 재연결 시 자연 반영
  }
}

export async function notifyGuildMembers(memberIds: string[]): Promise<void> {
  for (const id of memberIds) {
    await notifyGuildMembershipChanged(id);
  }
}
