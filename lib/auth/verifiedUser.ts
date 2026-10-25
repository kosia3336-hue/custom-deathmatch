import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 로그인한 사람의 회원 id — 확인 결과를 access_token 단위로 1분 기억한다.
 *
 * 예전에는 미들웨어와 페이지가 화면을 열 때마다 각각 auth.getUser() 로 Supabase 인증
 * 서버에 물었다(요청 하나에 두 번, 매번 1~2KB). 하루 2만 번이 넘는 요청이 쌓여 Supabase
 * 무료 전송량을 넘기는 데 큰 몫을 했다(2026-10-24 서비스 정지).
 *
 * 이제 쿠키의 토큰을 getClaims 로 확인한다 — 비대칭 서명 키를 쓰는 프로젝트면 서버에서
 * 바로 검증되고(네트워크 없음), 대칭 키면 인증 서버에 한 번 묻는다. 어느 쪽이든 같은
 * 토큰은 1분 동안 다시 묻지 않는다. 토큰은 위조할 수 없으므로 기억해 둔 결과를 믿어도
 * 된다. 로그아웃은 쿠키를 지우므로 바로 반영되고, 토큰 만료 시각은 넘기지 않는다.
 *
 * 미들웨어(edge)와 서버 컴포넌트(node)가 함께 쓴다 — 기억 장소는 각자 따로다.
 */
const TTL_MS = 60_000;
const MAX_ENTRIES = 5_000;
/** 토큰에서 확인한 사람. app_metadata 는 서명된 토큰에 실려 오므로 믿을 수 있다(데브 전환 판단). */
export interface VerifiedUser {
  id: string;
  app_metadata: Record<string, unknown>;
}

const verified = new Map<string, { user: VerifiedUser; until: number }>();

function remember(token: string, user: VerifiedUser, until: number) {
  if (verified.size >= MAX_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of verified) if (v.until <= now) verified.delete(k);
    if (verified.size >= MAX_ENTRIES) verified.clear();
  }
  verified.set(token, { user, until });
}

export async function getVerifiedUser(supabase: { auth: SupabaseClient['auth'] }): Promise<VerifiedUser | null> {
  // 쿠키에서 세션을 읽는다. 토큰이 만료됐으면 여기서 갱신하고 새 쿠키를 심는다.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return null;

  const now = Date.now();
  const hit = verified.get(token);
  if (hit && hit.until > now) return hit.user;

  const { data, error } = await supabase.auth.getClaims(token);
  const sub = data?.claims?.sub;
  if (error || typeof sub !== 'string' || !sub) {
    verified.delete(token);
    return null;
  }
  const exp = typeof data.claims.exp === 'number' ? data.claims.exp * 1000 : now + TTL_MS;
  const appMeta = data.claims.app_metadata;
  const user: VerifiedUser = {
    id: sub,
    app_metadata: appMeta && typeof appMeta === 'object' ? (appMeta as Record<string, unknown>) : {},
  };
  remember(token, user, Math.min(now + TTL_MS, exp));
  return user;
}
