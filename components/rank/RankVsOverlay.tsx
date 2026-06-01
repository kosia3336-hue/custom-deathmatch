'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNicknameStore } from '@/stores/nickname';
import { useRankMatchStore } from '@/stores/rankMatch';
import { useLobbyChatStore } from '@/stores/lobbyChat';
import { useRoomStore } from '@/stores/room';
import { playRankMatchBellSfx } from '@/lib/sfx';
import { RankBadge } from '@/components/cdm/RankBadge';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import type { TitleColor } from '@/lib/supabase/database.types';
import type { RankTier } from '@/shared/types/rank';

const VS_SEC = 5;

export function RankVsOverlay() {
  const router = useRouter();
  const matched = useRankMatchStore((s) => s.matched);
  const nickname = useNicknameStore((s) => s.nickname);
  const [leftSec, setLeftSec] = useState(VS_SEC);
  const bellForRoom = useRef<string | null>(null);

  useEffect(() => {
    if (!matched) return;
    if (bellForRoom.current !== matched.roomId) {
      bellForRoom.current = matched.roomId;
      playRankMatchBellSfx();
    }
    setLeftSec(VS_SEC);
    const i = setInterval(() => setLeftSec((x) => Math.max(0, x - 1)), 1000);
    const go = setTimeout(() => {
      useLobbyChatStore.getState().clearAll();
      useRoomStore.getState().reset();
      router.push(`/room/${matched.roomId}/play`);
      useRankMatchStore.getState().clearMatched();
    }, VS_SEC * 1000);
    return () => {
      clearInterval(i);
      clearTimeout(go);
    };
  }, [matched, router]);

  useEffect(() => {
    if (!matched) bellForRoom.current = null;
  }, [matched]);

  const progress = useMemo(() => (matched ? leftSec / VS_SEC : 0), [matched, leftSec]);

  if (!matched) return null;

  const oppTitle = matched.opponentDisplayedTitle;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-cdm-bg/95 px-4 backdrop-blur-md">
      <div className="w-full max-w-3xl space-y-8 text-center">
        <p className="text-sm font-semibold text-cdm-highlight">🏆 랭크 매칭 성사</p>

        <div className="flex flex-col gap-6 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-6">
          <PlayerCard
            nickname={nickname ?? '나'}
            tier={matched.selfTier}
            rp={matched.selfRp}
            placement={matched.selfIsPlacement}
            side="left"
          />
          <div className="flex justify-center text-3xl font-black text-cdm-primary md:text-5xl">VS</div>
          <PlayerCard
            nickname={matched.opponentNickname}
            tier={matched.opponentTier}
            rp={matched.opponentRp}
            placement={matched.opponentIsPlacement}
            title={oppTitle}
            side="right"
          />
        </div>

        <div className="mx-auto max-w-md space-y-2">
          <p className="text-sm text-cdm-fg-muted">
            밴픽까지 <span className="font-semibold text-cdm-fg">{leftSec}</span>초 후...
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-cdm-bg-elev-2">
            <div
              className="h-full rounded-full bg-cdm-primary transition-[width] duration-1000 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerCard({
  nickname,
  tier,
  rp,
  placement,
  title,
  side,
}: {
  nickname: string;
  tier: RankTier | null;
  rp: number | null;
  placement: boolean | null;
  title?: { name: string; color: string } | null;
  side: 'left' | 'right';
}) {
  const boxAlign =
    side === 'left'
      ? 'items-center text-center md:items-end md:text-right'
      : 'items-center text-center md:items-start md:text-left';

  return (
    <div
      className={`flex flex-col rounded-cdm-lg border border-cdm-border bg-cdm-bg-elev-1 p-5 ${boxAlign}`}
    >
      <p className="text-lg font-bold text-cdm-fg">{nickname}</p>
      {title ? (
        <div
          className={`mt-2 flex justify-center ${side === 'left' ? 'md:justify-end' : 'md:justify-start'}`}
        >
          <TitleBadge name={title.name} color={title.color as TitleColor} size="sm" />
        </div>
      ) : null}
      <div className={`mt-3 flex flex-col gap-1 ${side === 'left' ? 'md:items-end' : 'md:items-start'}`}>
        {tier !== null ? (
          <>
            <RankBadge tier={tier} rp={placement ? undefined : (rp ?? undefined)} size="lg" showRp={!placement} />
            {placement ? (
              <span className="text-xs text-cdm-fg-muted">배치전 진행 중</span>
            ) : null}
          </>
        ) : (
          <span className="text-xs text-cdm-fg-muted">정보 비공개</span>
        )}
      </div>
    </div>
  );
}
