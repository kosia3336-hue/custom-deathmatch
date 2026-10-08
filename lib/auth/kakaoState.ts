/**
 * 카카오 OAuth state — 로그인 CSRF 방지.
 *
 * state 에 이동 경로만 담으면 공격자가 자기 카카오 code 로 만든 콜백 링크를
 * 남에게 열게 해, 피해자를 공격자 계정으로 로그인시킬 수 있다. 시작할 때 만든
 * 무작위 값을 이 브라우저의 쿠키에 두고, 콜백에서 state 와 같은지 확인한다.
 * 이동 경로(next)도 쿠키에 함께 둔다 — state 는 카카오를 거쳐 돌아오는 값이라
 * 경로를 거기 싣지 않는다.
 *
 * 앱(Capacitor)은 카카오 로그인을 같은 웹뷰에서 열어 쿠키를 그대로 공유한다.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';

export const KAKAO_STATE_COOKIE = 'cdm_kakao_state';
/** 카카오 동의 화면에서 머무를 수 있는 시간 */
export const KAKAO_STATE_MAX_AGE = 10 * 60;
/** 쿠키는 시작·콜백 경로에서만 보낸다 */
export const KAKAO_STATE_COOKIE_PATH = '/auth/kakao';

export function createKakaoState(next: string): { nonce: string; cookieValue: string } {
  const nonce = randomBytes(24).toString('base64url');
  return { nonce, cookieValue: `${nonce}.${Buffer.from(next).toString('base64url')}` };
}

/** 쿠키와 돌아온 state 가 맞으면 저장해 둔 next 를, 아니면 null */
export function verifyKakaoState(
  cookieValue: string | undefined,
  state: string | null,
): { next: string } | null {
  if (!cookieValue || !state) return null;
  const dot = cookieValue.indexOf('.');
  if (dot <= 0) return null;
  const a = Buffer.from(cookieValue.slice(0, dot));
  const b = Buffer.from(state);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return { next: Buffer.from(cookieValue.slice(dot + 1), 'base64url').toString() };
  } catch {
    return null;
  }
}
