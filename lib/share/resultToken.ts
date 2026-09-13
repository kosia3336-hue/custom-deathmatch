/**
 * 결과 공유 링크 토큰 — `<게임 로그 id 32자리 hex><f|s><서명 22자>` (55자).
 *
 * 공유 페이지는 로그인 없이 열리지만 게임 로그는 참가자 전용이다. 그래서 링크에
 * "어느 판을, 누구(선·후) 입장에서" 보여 줄지를 담고 서버 비밀키로 서명한다.
 * 서명이 맞지 않으면 페이지가 열리지 않으므로, 로그 id 를 바꿔 끼워 남의 판을
 * 여는 것은 불가능하다. 발급은 본인이 참가한 판의 본인 자리로만 한다
 * (마이페이지 로그 = 서버 렌더, 게임 종료 화면 = /api/share/result).
 *
 * node:crypto 를 쓰므로 서버에서만 import 한다.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export type SharePosition = 'first' | 'second';

const SIG_LEN = 22;
const HEX32 = /^[0-9a-f]{32}$/;

function toUuid(hex: string): string {
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sign(secret: string, logId: string, position: SharePosition): string {
  return createHmac('sha256', secret)
    .update(`cdm:result-share:v1:${logId}:${position}`)
    .digest('base64url')
    .slice(0, SIG_LEN);
}

export function createResultShareToken(
  logId: string,
  position: SharePosition,
  secret: string,
): string {
  const hex = logId.replaceAll('-', '').toLowerCase();
  if (!HEX32.test(hex)) throw new Error('게임 로그 id 형식이 아닙니다.');
  return `${hex}${position === 'first' ? 'f' : 's'}${sign(secret, toUuid(hex), position)}`;
}

export function verifyResultShareToken(
  token: string,
  secret: string,
): { logId: string; position: SharePosition } | null {
  if (typeof token !== 'string' || token.length !== 32 + 1 + SIG_LEN) return null;
  const hex = token.slice(0, 32);
  const marker = token[32];
  if (!HEX32.test(hex) || (marker !== 'f' && marker !== 's')) return null;

  const logId = toUuid(hex);
  const position: SharePosition = marker === 'f' ? 'first' : 'second';
  const expected = Buffer.from(sign(secret, logId, position));
  const given = Buffer.from(token.slice(33));
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { logId, position };
}

/**
 * 서명 비밀키. 따로 두지 않았으면 서비스 롤 키를 쓴다(카카오 계정 비밀번호 파생과 같은 방식).
 * 서명 문자열에 용도 접두사(cdm:result-share:v1)를 붙여 다른 파생값과 섞이지 않는다.
 */
export function getResultShareSecret(): string | null {
  return process.env.SHARE_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}
