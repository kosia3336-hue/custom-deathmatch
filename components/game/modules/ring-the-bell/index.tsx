'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { getSocket } from '@/lib/socket';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { useGuildWarStore } from '@/stores/guildWar';
import {
  actionFlags,
  comboScore,
  isValidCombo,
  RTB_MAX_PER_GUILD,
  type RtbAction,
} from '@shared/guild-war';
import type { RtbKickedPayload, RtbSeatBlock } from '@shared/types/ring-the-bell';
import DesktopLayout from './DesktopLayout';
import MobileLayout from './MobileLayout';
import { SpectateHeaderButton } from './SpectateToggle';
import { ACTION_FLASH_MS, isPlayingThisSet, spectateToggleLabel, type PlayViewProps } from './play-view';

const SEAT_BLOCK_TEXT: Record<Exclude<RtbSeatBlock, null>, string> = {
  no_guild: '길드에 소속되어 있는 유저만 플레이할 수 있습니다.',
  no_chips: '길드 공유 칩이 없어 관전 중입니다. 길드 상점에서 살 수 있습니다.',
  guild_full: `같은 길드는 ${RTB_MAX_PER_GUILD}명까지 앉을 수 있습니다.`,
  room_full: '자리가 모두 찼습니다. 빈자리가 나면 눌러 앉을 수 있습니다.',
  in_progress: '세트가 진행 중입니다. 다음 세트부터 참여합니다.',
};

function useDeadline(endsAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (endsAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [endsAt]);
  if (endsAt == null) return null;
  return Math.max(0, endsAt - now);
}

/**
 * 기간 한정 길드전 「링 더 벨」 — 게임 모듈.
 * 서버(`guildWarRoom`)가 권위. 여기서는 마스킹된 상태를 그리고 행동만 올린다.
 */
export default function RingTheBellGame() {
  const router = useRouter();
  const { setHud } = useRoomLayout();
  const payload = useGuildWarStore((s) => s.state);
  const setState = useGuildWarStore((s) => s.setState);
  const setMeta = useGuildWarStore((s) => s.setMeta);
  const clear = useGuildWarStore((s) => s.clear);

  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(true);
  const flashTimer = useRef<number | null>(null);
  const lastLogRef = useRef<string | null>(null);
  const lastBlockRef = useRef<RtbSeatBlock>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const sock = getSocket();
    const onKicked = (p: RtbKickedPayload) => {
      toast.info(p.message);
      clear();
      router.push('/lobby');
    };

    sock.on('guildWar:state', setState);
    sock.on('guildWar:meta:changed', setMeta);
    sock.on('guildWar:kicked', onKicked);

    sock.emit('guildWar:join', (res) => {
      setBooting(false);
      if (!res.success) setBootError(res.error ?? '입장에 실패했습니다.');
    });

    return () => {
      sock.off('guildWar:state', setState);
      sock.off('guildWar:meta:changed', setMeta);
      sock.off('guildWar:kicked', onKicked);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 서버 로그 마지막 줄을 가운데 알림으로 흘린다.
  const lastLog = payload?.state.log.at(-1) ?? null;
  useEffect(() => {
    if (!lastLog || lastLog === lastLogRef.current) return;
    lastLogRef.current = lastLog;
    setFlash(lastLog);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), ACTION_FLASH_MS);
  }, [lastLog]);

  // 입장 때 길드·칩이 없으면 한 번만 알린다. 빈칸 클릭 실패는 sit 콜백에서.
  const seatBlock = payload?.seatBlock ?? null;
  useEffect(() => {
    if (seatBlock !== 'no_guild' && seatBlock !== 'no_chips') return;
    if (seatBlock === lastBlockRef.current) return;
    lastBlockRef.current = seatBlock;
    toast.info(SEAT_BLOCK_TEXT[seatBlock]);
  }, [seatBlock]);

  const dispatch = useCallback((_actorId: string, action: RtbAction) => {
    getSocket().emit('guildWar:action', action);
    if (action.type === 'combo' || action.type === 'discard' || action.type === 'pick') {
      setSelected([]);
    }
  }, []);

  const sitEmpty = useCallback(() => {
    getSocket().emit('guildWar:sit', (res) => {
      if (res.success) return;
      const code = res.errorCode as RtbSeatBlock | undefined;
      if (code && code in SEAT_BLOCK_TEXT) toast.info(SEAT_BLOCK_TEXT[code]);
      else toast.info(res.error ?? '앉을 수 없습니다.');
    });
  }, []);

  const toggleSpectate = useCallback(() => {
    getSocket().emit('guildWar:spectate', (res) => {
      if (!res.success) {
        toast.info(res.error ?? '관전으로 내릴 수 없습니다.');
        return;
      }
      if (res.reserved) toast.info('다음 세트부터 관전합니다.');
    });
  }, []);

  const state = payload?.state ?? null;
  const phase = state?.phase ?? null;
  const setIndex = state?.setIndex ?? 0;

  useEffect(() => {
    const s = payload?.state;
    const id = payload?.meId;
    if (!s || !id) {
      setHud(null);
      return;
    }
    const seated = s.roster.some((p) => p.id === id);
    setHud({
      round: `세트 ${s.setIndex}`,
      headerAction: seated ? (
        <SpectateHeaderButton
          label={spectateToggleLabel(payload.spectateReserved ?? false, isPlayingThisSet(s, id))}
          reserved={payload.spectateReserved ?? false}
          onClick={toggleSpectate}
        />
      ) : undefined,
    });
    return () => setHud(null);
  }, [payload, setHud, toggleSpectate]);

  useEffect(() => {
    setSelected([]);
  }, [phase, setIndex]);

  const deadline = !state
    ? null
    : state.phase === 'combo'
      ? state.comboEndsAt
      : state.phase === 'countdown'
        ? state.countdownEndsAt
        : state.turnEndsAt;
  const remaining = useDeadline(deadline);

  if (booting) {
    return (
      <div className="text-cdm-fg-muted flex h-full items-center justify-center text-sm">
        입장 중…
      </div>
    );
  }
  if (bootError) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-cdm-fg text-sm">{bootError}</p>
        <Button onClick={() => router.push('/lobby')}>로비로 돌아가기</Button>
      </div>
    );
  }
  if (!payload || !state) {
    return (
      <div className="text-cdm-fg-muted flex h-full items-center justify-center text-sm">
        테이블을 준비하는 중
      </div>
    );
  }

  const meId = payload.meId;
  const flags = actionFlags(state, meId);
  const myHand = state.hands[meId] ?? [];
  const selectedCards = myHand.filter((c) => selected.includes(c.id));
  const comboOk = isValidCombo(selectedCards);

  function toggleCard(id: string) {
    if (!state) return;
    if (state.phase === 'discard' && flags.canDiscard) {
      dispatch(meId, { type: 'discard', cardId: id });
      return;
    }
    if (state.phase === 'combo' && flags.comboOpen) {
      setSelected((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        if (prev.length >= 4) return prev;
        return [...prev, id];
      });
    }
  }

  let prompt = '';
  if (state.phase === 'discard' && flags.canDiscard) prompt = '버릴 카드 한 장 · 그 장이 새 앞면';
  if (state.phase === 'last_swap' && flags.isCurrent) prompt = '마지막 교환 · 칩 없음';
  if (state.phase === 'four_choice' && flags.canFour) prompt = '포카드로 이 세트를 끝낼까요?';
  if (flags.comboOpen) {
    prompt = comboOk
      ? `조합 ${comboScore(selectedCards)}점`
      : selected.length
        ? '같은 숫자 또는 같은 색만'
        : '1~4장을 고르세요';
  }

  const waitingNote =
    payload.role === 'player'
      ? '3명 이상이 되면 시작합니다'
      : state.roster.length >= 8
        ? '관전 중 · 빈자리가 나면 눌러 앉으세요'
        : '관전 중 · 빈자리를 눌러 앉으세요';

  const onTable = state.roster.some((p) => p.id === meId);

  const view: PlayViewProps = {
    meId,
    state,
    flags,
    selected,
    prompt,
    comboOk,
    remaining,
    flash,
    idleSlot: <p className="text-cdm-fg-muted text-xs font-bold">{waitingNote}</p>,
    dispatch,
    toggleCard,
    onSitEmpty: onTable ? undefined : sitEmpty,
    spectateReserved: payload.spectateReserved ?? false,
  };

  return (
    <div className="bg-cdm-bg absolute inset-0 min-h-0">
      {isDesktop ? <DesktopLayout {...view} /> : <MobileLayout {...view} />}
    </div>
  );
}
