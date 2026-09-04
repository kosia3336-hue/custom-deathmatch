/**
 * 서비스 간 신원 증명 토큰 (드림샵 → 커스텀 데스매치) — 검증 측.
 *
 * 드림샵의 src/lib/ssoToken.ts 와 같은 내용이다. 두 저장소가 분리되어 있어
 * 공유 패키지를 만들 수 없으므로 복사해 둔다. 한쪽을 고치면 다른 쪽도 함께
 * 고쳐야 한다 — 서명 형식이 어긋나면 연동이 통째로 멈춘다.
 *
 * 두 서비스는 Supabase 프로젝트가 달라 세션을 공유할 수 없다. 대신 드림샵이
 * "이 브라우저는 이 드림샵 계정으로 로그인해 있다" 는 사실만 짧은 수명의
 * 서명 토큰으로 증명해 준다.
 *
 * 이 토큰은 **세션이 아니다.** 커데매는 이걸로 곧장 로그인시키지 않고,
 * 연동(linking) 이나 이미 연결된 계정 확인에만 쓴다.
 *
 * 라이브러리를 새로 넣지 않고 node:crypto 로 HS256 을 직접 만든다 —
 * 필요한 건 서명 하나뿐이다.
 */

import 'server-only';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const ISS = 'dreamshop';
const AUD = 'cdm';
/** 60초. 발급 직후 곧바로 쓰이는 토큰이라 짧게 잡는다. */
const TTL_SECONDS = 60;

export interface SsoClaims {
  iss: string;
  aud: string;
  /** 드림샵 auth.users.id */
  sub: string;
  /** 카카오 회원번호 — 있으면 커데매가 자동 연결에 쓴다 */
  kakao_id?: string;
  jti: string;
  iat: number;
  exp: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function secret(): string {
  const s = process.env.SSO_SHARED_SECRET;
  if (!s || s.length < 32) {
    throw new Error('SSO_SHARED_SECRET 가 없거나 너무 짧습니다(32자 이상).');
  }
  return s;
}

export function issueSsoToken(args: { userId: string; kakaoId?: string | null }): string {
  const now = Math.floor(Date.now() / 1000);
  const claims: SsoClaims = {
    iss: ISS,
    aud: AUD,
    sub: args.userId,
    ...(args.kakaoId ? { kakao_id: args.kakaoId } : {}),
    jti: randomUUID(),
    iat: now,
    exp: now + TTL_SECONDS,
  };

  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify(claims));
  const sig = b64url(createHmac('sha256', secret()).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

/**
 * 검증. 커스텀 데스매치 쪽에서도 같은 로직을 쓰므로 함께 둔다.
 * 서명이 맞아도 exp/iss/aud 를 반드시 확인한다 — 서명만 보면
 * 다른 용도로 발급한 토큰을 그대로 받아들이게 된다.
 */
export function verifySsoToken(token: string): SsoClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;

  const expected = b64url(createHmac('sha256', secret()).update(`${header}.${payload}`).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let claims: SsoClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as SsoClaims;
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== ISS || claims.aud !== AUD) return null;
  if (typeof claims.exp !== 'number' || claims.exp < now) return null;
  if (!claims.sub || !claims.jti) return null;

  return claims;
}
