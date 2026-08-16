'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { Card } from '@/components/cdm/Card';
import { TextInput } from '@/components/cdm/TextInput';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';

const STORAGE_KEY = 'cdm:signup:agreed';

type CheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'unavailable'; reason: string };

const NICKNAME_PATTERN = /^[A-Za-z0-9가-힣]{2,8}$/;

function localValidate(nick: string): string | null {
  if (nick.length < 2) return '2자 이상 입력해 주세요';
  if (nick.length > 8) return '8자 이내로 입력해 주세요';
  if (!NICKNAME_PATTERN.test(nick)) return '한글, 영문, 숫자만 사용할 수 있습니다';
  return null;
}

export default function ProfileForm() {
  const router = useRouter();
  const [nick, setNick] = useState('');
  const [check, setCheck] = useState<CheckState>({ kind: 'idle' });
  const [submitting, startTransition] = useTransition();

  // 입력 변화 시 idle 로
  useEffect(() => {
    setCheck({ kind: 'idle' });
  }, [nick]);

  async function runCheck() {
    const trimmed = nick.trim();
    const local = localValidate(trimmed);
    if (local) {
      setCheck({ kind: 'unavailable', reason: local });
      return;
    }
    setCheck({ kind: 'checking' });
    try {
      const supabase = getBrowserSupabase();
      const ok = await callRpc(supabase, 'check_nickname_available', { p_nick: trimmed });
      if (ok === true) {
        setCheck({ kind: 'available' });
      } else {
        setCheck({ kind: 'unavailable', reason: '사용할 수 없거나 이미 사용 중인 닉네임입니다' });
      }
    } catch (e) {
      setCheck({ kind: 'unavailable', reason: (e as Error).message });
    }
  }

  function handleSubmit() {
    const trimmed = nick.trim();
    const local = localValidate(trimmed);
    if (local) {
      toast.error(local);
      return;
    }

    startTransition(async () => {
      try {
        const supabase = getBrowserSupabase();
        const raw = (() => {
          try {
            return sessionStorage.getItem(STORAGE_KEY);
          } catch {
            return null;
          }
        })();
        const agreed = raw ? JSON.parse(raw) : [];

        try {
          await callRpc(supabase, 'complete_signup', {
            p_nickname: trimmed,
            p_agreed_versions: agreed,
          });
        } catch (rpcErr) {
          const code = (rpcErr as { code?: string }).code;
          if (code === '23505') {
            toast.error('이미 사용 중인 닉네임입니다');
            return;
          }
          throw rpcErr;
        }

        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
        toast.success(`환영합니다, ${trimmed}님!`);
        router.replace('/lobby');
        router.refresh();
      } catch (e) {
        toast.error(`가입 실패: ${(e as Error).message}`);
      }
    });
  }

  const errorMsg =
    check.kind === 'unavailable'
      ? check.reason
      : check.kind === 'idle'
        ? null
        : null;

  const successHint =
    check.kind === 'available' ? '사용 가능한 닉네임입니다' : null;

  return (
    <>
      <Card>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
          <div className="flex-1">
            <TextInput
              label="닉네임"
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              placeholder="예) 멋진플레이어"
              maxLength={16}
              autoFocus
              error={errorMsg}
              hint={successHint ?? '2~8자, 한글/영문/숫자'}
              success={check.kind === 'available'}
            />
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={runCheck}
            loading={check.kind === 'checking'}
            disabled={nick.trim().length === 0}
            className="sm:mb-[20px]"
          >
            중복확인
          </Button>
        </div>
      </Card>

      <div className="mt-2 flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => router.back()}
          disabled={submitting}
        >
          뒤로
        </Button>
        <Button onClick={handleSubmit} loading={submitting} disabled={check.kind !== 'available'}>
          가입 완료
        </Button>
      </div>
    </>
  );
}
