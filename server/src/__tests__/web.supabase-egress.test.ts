/**
 * Supabase 전송량 줄이기(2026-10-24 무료 한도 초과) — 로그인 확인 기억, 룰 이미지 주소.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getVerifiedUser } from '../../../lib/auth/verifiedUser';
import { ruleImageSrc } from '../../../lib/ruleImageSrc';

function fakeAuth(token: string | null, claims: Record<string, unknown> | null) {
  const getClaims = vi.fn(async () =>
    claims ? { data: { claims }, error: null } : { data: null, error: new Error('bad') },
  );
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: token ? { access_token: token } : null } })),
    getClaims,
  };
  return { supabase: { auth } as never, getClaims };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('로그인 확인 기억', () => {
  it('같은 토큰은 1분 동안 다시 묻지 않는다', async () => {
    vi.useFakeTimers();
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const { supabase, getClaims } = fakeAuth('tok-a', { sub: 'u1', exp, app_metadata: { dummy: true } });
    expect(await getVerifiedUser(supabase)).toEqual({ id: 'u1', app_metadata: { dummy: true } });
    expect(await getVerifiedUser(supabase)).toEqual({ id: 'u1', app_metadata: { dummy: true } });
    expect(getClaims).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(61_000);
    await getVerifiedUser(supabase);
    expect(getClaims).toHaveBeenCalledTimes(2);
  });

  it('토큰 만료 시각을 넘겨 기억하지 않는다', async () => {
    vi.useFakeTimers();
    const exp = Math.floor(Date.now() / 1000) + 10;
    const { supabase, getClaims } = fakeAuth('tok-b', { sub: 'u2', exp });
    await getVerifiedUser(supabase);
    vi.advanceTimersByTime(11_000);
    await getVerifiedUser(supabase);
    expect(getClaims).toHaveBeenCalledTimes(2);
  });

  it('세션이 없거나 확인에 실패하면 로그인 안 함', async () => {
    expect(await getVerifiedUser(fakeAuth(null, { sub: 'x' }).supabase)).toBeNull();
    expect(await getVerifiedUser(fakeAuth('tok-c', null).supabase)).toBeNull();
  });
});

describe('룰 이미지 주소', () => {
  it('Supabase rule-images 주소만 우리 서버를 거치게 바꾼다', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co');
    const url = 'https://proj.supabase.co/storage/v1/object/public/rule-images/2026-10-01/a.png';
    expect(ruleImageSrc(url)).toBe(`/api/rule-image?src=${encodeURIComponent(url)}`);
    expect(ruleImageSrc('/rules/local.png')).toBe('/rules/local.png');
    expect(ruleImageSrc('https://proj.supabase.co/storage/v1/object/public/other/a.png')).toContain('/other/');
    expect(ruleImageSrc(undefined)).toBeUndefined();
  });
});
