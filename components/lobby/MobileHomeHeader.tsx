'use client';

/**
 * 모바일 홈(로비) 상단 헤더 — 앱 재설계안 적용.
 *
 * 디자인 결정: 1c(리스트형 밀도) + 1b 의 랭크 표시.
 * - 위쪽 ink 헤더에는 로고와 소리·채팅·우편·로그인만 둔다.
 * - 랭크 표시와 랭크 매칭·빠른 입장·방 만들기는 한 덩어리로 탭 바 바로 위에 고정한다.
 *   내 시즌 상태를 보고 바로 누르는 흐름이고, 한 손으로 쥐었을 때 엄지가 닿는 자리다.
 * - 방 목록 필터는 1c 의 칩 줄로 옮겼다.
 *
 * 데스크톱에서는 렌더하지 않는다(기존 ActionBar 가 그대로 담당).
 */

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { useLobbyStore, type TabFilter } from '@/stores/lobby';
import { useRankMatchStore } from '@/stores/rankMatch';
import { useNicknameStore } from '@/stores/nickname';
import { useLobbyChatStore } from '@/stores/lobbyChat';
import { isRankQueueAcceptingNewJoins, isRankQueueOpen } from '@shared/rank/kst';
import type { RankTier } from '@shared/types/rank';
import type { JoinRoomResult } from '@/shared/types';
import { cn } from '@/lib/utils';
import { Icon, BgmButton } from '@/components/cdm';
import { Logo } from '@/components/cdm/Logo';
import { OnlineUsersModalButton } from '@/components/lobby/OnlineUsersPanel';
import { MailboxModalButton } from '@/components/lobby/MailboxDialog';
import { useQueueElapsed } from '@/components/rank/RankQueueFloatingIndicator';
import { formatQueueElapsed } from '@/components/rank/RankQueueModal';

interface Props {
  onCreateRoom: () => void;
}

const TIER_LABEL: Record<RankTier, string> = {
  unranked: '언랭크',
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
  diamond: '다이아',
  challenger: '챌린저',
};

/** 다음 티어와 승급까지 남은 RP. 챌린저는 상한이 없어 null. */
const NEXT_TIER: Partial<Record<RankTier, { label: string; at: number }>> = {
  bronze: { label: '실버', at: 100 },
  silver: { label: '골드', at: 100 },
  gold: { label: '다이아', at: 100 },
  diamond: { label: '챌린저', at: 150 },
};

interface RankStats {
  tier: RankTier;
  rp: number;
  placement_done: boolean;
  placement_games: number;
  win_streak: number;
}

interface RankResponse {
  season: { id: number; name: string } | null;
  stats: RankStats | null;
}

export default function MobileHomeHeader({ onCreateRoom }: Props) {
  const router = useRouter();
  const { member } = useCurrentMember();
  const requireNickname = useNicknameStore((s) => s.requireNickname);
  const queuing = useRankMatchStore((s) => s.queuing);
  const setQueuing = useRankMatchStore((s) => s.setQueuing);
  const setQueueModalOpen = useRankMatchStore((s) => s.setQueueModalOpen);
  const queueElapsed = useQueueElapsed();

  const { tabFilters, toggleTabFilter, clearFilters, rooms } = useLobbyStore();

  const [rank, setRank] = useState<RankResponse | null>(null);
  const [quickJoining, setQuickJoining] = useState(false);

  useEffect(() => {
    if (!member) {
      setRank(null);
      return;
    }
    fetch('/api/me/rank')
      .then((r) => r.json())
      .then((d: RankResponse) => setRank(d))
      .catch(() => {});
  }, [member?.id]);

  const stats = rank?.stats ?? null;
  const tier: RankTier = stats?.tier ?? 'unranked';
  const rp = stats?.rp ?? 0;
  const next = NEXT_TIER[tier];
  // 언랭크(배치 전)는 진행률이 의미 없다 — 0 으로 두고 안내 문구로 대체한다.
  const progress = tier === 'unranked' ? 0 : next ? Math.min(100, Math.round((rp / next.at) * 100)) : 100;
  const inPlacement = stats != null && !stats.placement_done;

  const waitingCount = rooms.filter((r) => r.status === 'waiting').length;

  // 고정 행동 바 높이를 --cdm-lobby-bar-h 로 알려, 본문 하단 여백이 바에 가리지 않게 한다.
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const root = document.documentElement;
    const sync = () => root.style.setProperty('--cdm-lobby-bar-h', `${el.offsetHeight}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--cdm-lobby-bar-h');
    };
  }, []);

  const handleRank = () => {
    // 이미 대기 중이면 대기 화면을 다시 연다(내려둔 상태에서 돌아오는 입구)
    if (queuing) {
      setQueueModalOpen(true);
      return;
    }
    if (!member) {
      toast.error('랭크 게임은 로그인 후 이용할 수 있습니다.');
      return;
    }
    if (!isRankQueueOpen() || !isRankQueueAcceptingNewJoins()) {
      toast.error('랭크 운영 시간이 아닙니다. (평일 21:00~익일 01:00 KST / 주말 24시간)');
      return;
    }
    setQueuing(true);
    getSocket().emit('rank:queue:join', (res: { success: boolean; error?: string }) => {
      if (!res.success) {
        toast.error(res.error ?? '랭크 큐 참여에 실패했습니다.');
        setQueuing(false);
      } else {
        toast.success('랭크 매칭을 시작합니다.');
      }
    });
  };

  const handleQuickJoin = () => {
    if (queuing) {
      toast.error('랭크 큐 대기 중에는 게임에 참가할 수 없습니다.');
      return;
    }
    requireNickname(() => {
      setQuickJoining(true);
      getSocket().emit('room:quickjoin', (res: JoinRoomResult) => {
        setQuickJoining(false);
        if (res.success && res.roomId) {
          useLobbyChatStore.getState().clearAll();
          router.push(`/room/${res.roomId}`);
        } else {
          toast.error(res.error ?? '빠른 입장에 실패했습니다.');
        }
      });
    });
  };

  const chips: { key: TabFilter | 'all'; label: string }[] = [
    // 전체 수는 바로 위 '지금 열린 방' 제목이 말한다
    { key: 'all', label: '전체' },
    { key: 'waiting', label: `대기 ${waitingCount}` },
    { key: 'rank', label: '랭크' },
    { key: 'private', label: '비밀방' },
  ];

  return (
    <div className="-mx-4 -mt-4 mb-3 sm:hidden">
      {/* ── ink 헤더: 로고 + 소리·채팅·우편·로그인 ── */}
      <div className="bg-cdm-ink px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/lobby" aria-label="홈" className="flex min-w-0 shrink items-center">
            <Logo size="md" className="h-5 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            {/*
              GNB 헤더가 모바일 로비에서 숨겨지므로, 거기 있던 소리·로비 채팅·
              로그인만 이 줄로 옮겨 온다. 메뉴 시트는 하단 탭바의 '메뉴' 가,
              공지는 그 시트 안 항목이 맡는다.
            */}
            <BgmButton className="text-cdm-ink-fg-muted hover:bg-white/10 hover:text-white" />
            <OnlineUsersModalButton />
            {member && <MailboxModalButton />}
            {!member && (
              <Link
                href="/login"
                className="flex h-8 items-center rounded-cdm-md bg-white px-3 text-xs font-semibold whitespace-nowrap text-cdm-ink"
              >
                로그인
              </Link>
            )}
          </div>
        </div>
      </div>

      {/*
        ── 하단 행동 바: 랭크 표시 + 랭크 매칭·빠른 입장·방 만들기 ──
        내 티어를 보고 바로 누르는 한 덩어리라 붙여 두고, 한 손으로 쥐었을 때 엄지가
        닿도록 하단 탭 바 바로 위에 고정한다. 대기 중이면 랭크 버튼이 경과 시간을
        보여 주고, 누르면 대기 화면을 다시 연다.
      */}
      <div
        ref={barRef}
        className="lobby-action-bar fixed inset-x-0 z-(--cdm-z-sticky) border-t border-cdm-ink-border bg-cdm-ink/95 px-3 pt-2.5 pb-2 backdrop-blur"
        style={{ bottom: 'calc(var(--cdm-tabbar-h) + env(safe-area-inset-bottom))' }}
      >
        <Link
          href="/ranking"
          aria-label={`${TIER_LABEL[tier]} ${rp} RP · 티어표와 랭킹 보기`}
          className="mb-2.5 flex items-center gap-2.5 px-1"
        >
          {/* 티어는 옆 글자가 말하므로 엠블럼은 꾸밈으로 둔다 */}
          <Image
            src={`/rank/tier-${tier}.png`}
            alt=""
            width={36}
            height={36}
            className="size-9 flex-none object-contain"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="shrink-0 text-sm font-extrabold tracking-tight text-white">
                {TIER_LABEL[tier]}{' '}
                <span className="text-xs font-bold text-cdm-highlight tabular-nums">{rp} RP</span>
              </p>
              <p className="flex min-w-0 gap-1.5 text-[11px] text-cdm-ink-fg-muted">
                <span className="truncate">
                  {tier === 'unranked' || inPlacement
                    ? `배치전 ${stats?.placement_games ?? 0}/5`
                    : next
                      ? `${next.label}까지 ${Math.max(0, next.at - rp)} RP`
                      : '최고 티어'}
                </span>
                {(stats?.win_streak ?? 0) >= 2 && (
                  <span className="shrink-0 font-semibold text-cdm-success">{stats?.win_streak}연승</span>
                )}
              </p>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/13">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, var(--cdm-primary), #8b90e0)',
                }}
              />
            </div>
          </div>
          <Icon name="chevronRight" size="sm" className="flex-none text-cdm-ink-fg-muted" />
        </Link>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRank}
            className="flex h-12 flex-[1.5] items-center justify-center gap-1.5 rounded-cdm-md bg-cdm-primary text-[15px] font-bold text-white"
          >
            <Icon name="bolt" size="sm" />
            {queuing ? (
              <span>
                매칭 중 <span className="tabular-nums">{formatQueueElapsed(queueElapsed)}</span>
              </span>
            ) : (
              '랭크 매칭'
            )}
          </button>
          <button
            type="button"
            onClick={handleQuickJoin}
            disabled={quickJoining}
            className="h-12 flex-1 rounded-cdm-md border border-white/16 bg-white/10 text-sm font-bold text-cdm-ink-fg disabled:opacity-60"
          >
            빠른 입장
          </button>
          <button
            type="button"
            onClick={onCreateRoom}
            className="h-12 flex-1 rounded-cdm-md border border-white/16 bg-white/10 text-sm font-bold text-cdm-ink-fg"
          >
            방 만들기
          </button>
        </div>
      </div>

      {/* ── 지금 열린 방: 제목 + 필터 칩 줄 ── */}
      <h2 className="px-4 pt-5 pb-2 text-base font-extrabold tracking-tight text-cdm-fg">
        지금 열린 방{' '}
        <span className="text-[13px] font-semibold text-cdm-fg-muted tabular-nums">{rooms.length}</span>
      </h2>
      <div className="flex gap-1.5 overflow-x-auto px-4 pb-2.5">
        {chips.map((c) => {
          const active = c.key === 'all' ? tabFilters.length === 0 : tabFilters.includes(c.key as TabFilter);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => (c.key === 'all' ? clearFilters() : toggleTabFilter(c.key as TabFilter))}
              className={cn(
                'h-8 flex-none rounded-full px-3.5 text-xs font-semibold transition-colors',
                active
                  ? 'bg-cdm-fg text-cdm-bg'
                  : 'border border-cdm-border bg-cdm-bg-elev-1 text-cdm-fg-muted',
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
