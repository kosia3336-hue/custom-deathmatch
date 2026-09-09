/** 운영자 닉. 접속자 명단·솔로 AI 토글·비밀방 비번 생략 등에 쓴다. */
export const CHEONHA_NICKNAME = '천하';

export function isCheonhaNickname(nickname: string | null | undefined): boolean {
  return nickname === CHEONHA_NICKNAME;
}
