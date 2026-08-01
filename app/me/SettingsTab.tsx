'use client';

import { useState, useSyncExternalStore, useTransition } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/cdm/Card';
import { Button } from '@/components/cdm/Button';
import { TextInput } from '@/components/cdm/TextInput';
import { Modal } from '@/components/cdm/Modal';
import { Slider } from '@/components/cdm/Slider';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';
import { useRouter } from 'next/navigation';
import { useBgm } from '@/components/providers/BgmProvider';
import { isSfxMuted, setSfxMuted, subscribeSfxMuted } from '@/lib/sfxSettings';
import { useInventoryStore } from '@/stores/inventory';

export default function SettingsTab() {
  const router = useRouter();
  const [openWithdraw, setOpenWithdraw] = useState(false);
  const [openNick, setOpenNick] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <SoundCard />

      <Card>
        <h2 className="text-sm font-semibold text-cdm-fg-muted">계정</h2>
        <div className="mt-3 flex flex-col gap-2">
          <Button variant="secondary" onClick={() => setOpenNick(true)}>
            닉네임 변경 (30일에 1회)
          </Button>
          <a href="/auth/signout">
            <Button variant="secondary" fullWidth>
              로그아웃
            </Button>
          </a>
          <Button variant="danger" onClick={() => setOpenWithdraw(true)}>
            회원 탈퇴
          </Button>
        </div>
      </Card>

      <NicknameModal open={openNick} onClose={() => setOpenNick(false)} onDone={() => router.refresh()} />
      <WithdrawModal open={openWithdraw} onClose={() => setOpenWithdraw(false)} />
    </div>
  );
}

function SoundCard() {
  const { hasTracks, muted, volume, setMuted, setVolume } = useBgm();
  const volumePct = Math.round(volume * 100);
  // SSR에선 localStorage 접근 불가 → 서버 스냅샷은 항상 '켜짐'
  const sfxOn = !useSyncExternalStore(subscribeSfxMuted, isSfxMuted, () => false);

  return (
    <Card>
      <h2 className="text-sm font-semibold text-cdm-fg-muted">소리</h2>
      <div className="mt-3 flex flex-col gap-4">
        {hasTracks && (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-cdm-fg">배경음악 (BGM)</div>
                <div className="text-xs text-cdm-fg-muted">
                  사이트에서 흘러나오는 배경음악을 켜고 끕니다
                </div>
              </div>
              <ToggleSwitch
                checked={!muted}
                onChange={(on) => setMuted(!on)}
                ariaLabel="배경음악"
              />
            </div>

            <div>
              <Slider
                value={volumePct}
                min={0}
                max={100}
                step={1}
                disabled={muted}
                ariaLabel="배경음악 음량"
                leftAdornment={<VolumeMinIcon />}
                rightAdornment={<VolumeMaxIcon />}
                valueLabel={`${volumePct}%`}
                onChange={(pct) => setVolume(pct / 100)}
              />
            </div>
          </>
        )}

        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-cdm-fg">효과음 (SFX)</div>
            <div className="text-xs text-cdm-fg-muted">
              게임·스킨 효과음을 켜고 끕니다 (배경음악과 별개)
            </div>
          </div>
          <ToggleSwitch
            checked={sfxOn}
            onChange={(on) => setSfxMuted(!on)}
            ariaLabel="효과음"
          />
        </div>
      </div>
    </Card>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
        checked ? 'bg-cdm-primary' : 'bg-cdm-bg-elev-2'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function VolumeMinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  );
}

function VolumeMaxIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function NicknameModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [nick, setNick] = useState('');
  const [useTicket, setUseTicket] = useState(false);
  const [submitting, startTransition] = useTransition();
  const ticketCount = useInventoryStore((s) => s.items?.nickname_change ?? 0);
  const setOne = useInventoryStore((s) => s.setOne);

  function handleSubmit() {
    startTransition(async () => {
      try {
        const res = await fetch('/api/me/nickname/change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newNick: nick.trim(), useTicket }),
        });
        const json = (await res.json()) as
          | {
              ok: true;
              newNickname: string;
              usedTicket: boolean;
              ticketCountAfter: number;
            }
          | { error: string; code: string };

        if (!res.ok || !('ok' in json)) {
          const e = json as { error: string; code: string };
          if (e.code === 'cooldown') {
            toast.error(
              ticketCount > 0
                ? '쿨다운이 남아있습니다. "변경권 사용"을 체크하면 우회할 수 있습니다.'
                : '닉네임은 30일에 한 번만 변경할 수 있습니다.',
            );
            return;
          }
          if (e.code === 'no_ticket') {
            toast.error('닉네임 변경권이 없습니다.');
            return;
          }
          if (e.code === 'invalid_nickname') {
            toast.error('사용할 수 없는 닉네임입니다.');
            return;
          }
          toast.error(e.error ?? '변경에 실패했습니다.');
          return;
        }

        if (json.usedTicket) {
          setOne('nickname_change', json.ticketCountAfter);
          toast.success(
            `닉네임이 변경됐습니다. (변경권 사용, 잔여 ${json.ticketCountAfter}개)`,
          );
        } else {
          toast.success('닉네임이 변경됐습니다.');
        }
        onClose();
        onDone();
      } catch (e) {
        toast.error(`변경 실패: ${(e as Error).message}`);
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="닉네임 변경"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={!nick.trim()}>
            변경
          </Button>
        </>
      }
    >
      <TextInput
        label="새 닉네임"
        value={nick}
        onChange={(e) => setNick(e.target.value)}
        placeholder="2~8자 한글/영문/숫자"
        maxLength={16}
        autoFocus
      />
      <label
        className={`mt-3 flex items-start gap-2 text-sm ${
          ticketCount > 0 ? 'text-cdm-fg' : 'text-cdm-fg-muted'
        }`}
      >
        <input
          type="checkbox"
          checked={useTicket}
          onChange={(e) => setUseTicket(e.target.checked)}
          disabled={ticketCount <= 0}
          className="mt-0.5 h-4 w-4 accent-cdm-primary"
        />
        <span>
          닉네임 변경권 사용 (쿨다운 우회) — <b className="tabular-nums">{ticketCount}</b>개 보유
          {ticketCount <= 0 && <> · <a href="/shop" className="underline">상점에서 구매</a></>}
        </span>
      </label>
      <p className="mt-2 text-xs text-cdm-fg-muted">
        ※ 가입 후 1분 이내, 또는 마지막 변경 후 30일이 지났다면 변경권 없이 변경할 수 있습니다.
      </p>
    </Modal>
  );
}

function WithdrawModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [confirm, setConfirm] = useState('');
  const [submitting, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      try {
        const supabase = getBrowserSupabase();
        try {
          await callRpc(supabase, 'withdraw_member', {
            p_confirm_nick: confirm.trim(),
          });
        } catch (rpcErr) {
          const code = (rpcErr as { code?: string }).code;
          if (code === '22023') {
            toast.error('닉네임이 일치하지 않습니다');
            return;
          }
          throw rpcErr;
        }
        window.location.href = '/auth/signout';
      } catch (e) {
        toast.error(`탈퇴 실패: ${(e as Error).message}`);
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="정말 탈퇴하시겠어요?"
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button variant="danger" onClick={handleSubmit} loading={submitting} disabled={confirm.trim().length < 2}>
            탈퇴
          </Button>
        </>
      }
    >
      <p className="text-sm text-cdm-fg-muted">
        탈퇴 후에는 사이트를 이용할 수 없습니다.
        <br />
        동일한 계정으로 재가입하려면 관리자 검토가 필요하며, 복구가 거절될 수 있습니다.
      </p>
      <div className="mt-4">
        <TextInput
          label="확인을 위해 본인 닉네임을 입력하세요"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoFocus
        />
      </div>
    </Modal>
  );
}
