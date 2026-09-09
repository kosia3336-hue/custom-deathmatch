'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { RankBadge } from '@/components/cdm/RankBadge';
import { TitleBadge, type TitleEffect } from '@/components/cdm/TitleBadge';
import { GuildMark } from '@/components/cdm/GuildMark';
import { cn } from '@/lib/utils';
import type { TitleColor } from '@/lib/supabase/database.types';
import type { RankMatchGuildSnap, RankMatchedPayload, RankTier } from '@/shared/types/rank';
import type { DisplayedTitle } from '@/shared/types/room';

/** 매칭 성사 카운트 시작 초(5 → 0). */
export const RANK_VS_SEC = 5;
/** 0초를 1초간 보여 준 뒤 밴픽. 운영 타이머 총 길이. */
export const RANK_VS_NAV_SEC = RANK_VS_SEC + 1;
/** 일반 VS로 보이다가 카운터(마왕성) 기운이 퍼지기 시작하는 시점. */
export const RANK_VS_HIDDEN_REVEAL_MS = 850;

export interface RankVsViewProps {
  selfNickname: string;
  matched: RankMatchedPayload;
  leftSec: number;
  /** true면 등장 직후 중앙에서 붉은 기운이 퍼진다. */
  hiddenMatch?: boolean;
}

/**
 * 랭크 매칭 성사 VS 화면. 정본.
 * `RankVsOverlay`(운영)와 `/dev/rank-match`(프리뷰)가 같이 쓴다.
 */
export function RankVsView({
  selfNickname,
  matched,
  leftSec,
  hiddenMatch = false,
}: RankVsViewProps) {
  const progress = leftSec / RANK_VS_SEC;
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!hiddenMatch) {
      setRevealed(false);
      return;
    }
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setRevealed(true);
      return;
    }
    setRevealed(false);
    const t = window.setTimeout(() => setRevealed(true), RANK_VS_HIDDEN_REVEAL_MS);
    return () => window.clearTimeout(t);
  }, [hiddenMatch]);

  return (
    <div
      className={cn(
        'rank-vs fixed inset-0 z-(--cdm-z-overlay) flex flex-col items-center justify-center px-3 py-4 md:px-4 md:py-10',
        revealed && 'rank-vs--hidden',
      )}
    >
      {revealed ? (
        <>
          <span className="rank-vs-hidden-realm" aria-hidden>
            <span className="rank-vs-hidden-embers">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </span>
          </span>
          <span className="rank-vs-hidden-shock" aria-hidden />
          <span className="rank-vs-hidden-shock rank-vs-hidden-shock--late" aria-hidden />
          <span className="rank-vs-hidden-core" aria-hidden />
        </>
      ) : null}

      <p
        className={cn(
          'rank-vs-fore rank-vs-kicker font-bold',
          revealed
            ? 'text-cdm-ink-fg'
            : 'text-base tracking-[0.14em] text-cdm-fg md:text-xl md:tracking-[0.16em]',
        )}
      >
        {revealed ? '카운터 매치' : '랭크 매칭'}
      </p>

      <div className="rank-vs-fore mt-4 grid w-full max-w-4xl grid-cols-1 items-stretch gap-3 md:mt-12 md:grid-cols-[1fr_auto_1fr] md:gap-10">
        <Fighter
          nickname={selfNickname}
          title={matched.selfDisplayedTitle}
          guild={matched.selfGuild}
          winStreak={matched.selfWinStreak}
          tier={matched.selfTier}
          rp={matched.selfRp}
          placement={matched.selfIsPlacement}
          side="left"
        />
        <div className="flex items-center justify-center py-0">
          <span
            className={cn(
              'rank-vs-vs text-2xl font-black leading-none md:text-5xl',
              revealed ? 'text-cdm-accent' : 'text-cdm-primary',
            )}
          >
            VS
          </span>
        </div>
        <Fighter
          nickname={matched.opponentNickname}
          title={matched.opponentDisplayedTitle}
          guild={matched.opponentGuild}
          winStreak={matched.opponentWinStreak}
          tier={matched.opponentTier}
          rp={matched.opponentRp}
          placement={matched.opponentIsPlacement}
          side="right"
        />
      </div>

      <div className="rank-vs-fore mt-4 w-full max-w-md space-y-1.5 md:mt-12 md:space-y-2">
        <p className={cn('text-center text-sm', revealed ? 'text-cdm-ink-fg-muted' : 'text-cdm-fg-muted')}>
          밴픽까지{' '}
          <span
            className={cn(
              'tabular-nums font-semibold',
              revealed ? 'text-cdm-ink-fg' : 'text-cdm-fg',
            )}
          >
            {leftSec}
          </span>
          초
        </p>
        <div className="rank-vs-bar-track h-1.5 overflow-hidden rounded-full bg-cdm-bg-elev-3">
          <div
            className={cn(
              'rank-vs-bar h-full rounded-full',
              revealed ? 'bg-cdm-accent' : 'bg-cdm-primary',
            )}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Fighter({
  nickname,
  title,
  guild,
  winStreak,
  tier,
  rp,
  placement,
  side,
}: {
  nickname: string;
  title: DisplayedTitle | null;
  guild: RankMatchGuildSnap | null;
  winStreak: number | null;
  tier: RankTier | null;
  rp: number | null;
  placement: boolean | null;
  side: 'left' | 'right';
}) {
  const hidden = tier === null;
  const showStreak = (winStreak ?? 0) > 0;
  const showGuild = guild != null;
  const markUrl = guild?.markUrl;
  const skin: RankTier = hidden ? 'unranked' : tier;
  const isChallenger = skin === 'challenger' && !hidden;

  return (
    <article
      className={cn(
        'rank-vs-fighter rank-vs-card',
        `rank-vs-tier--${skin}`,
        side === 'right' && 'rank-vs-fighter--right',
      )}
    >
      {isChallenger ? (
        <span className="rank-vs-challenger-fx" aria-hidden>
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </span>
      ) : null}

      {guild ? (
        <div className="rank-vs-layer rank-vs-guild flex flex-col items-center">
          {markUrl ? (
            <GuildMark
              mark={{ url: markUrl, name: guild.name }}
              size="xl"
              className="rank-vs-guild-mark h-14 w-14 rounded-cdm-md ring-2 ring-cdm-border md:h-24 md:w-24 md:rounded-cdm-lg"
            />
          ) : null}
          <span
            className={cn(
              'max-w-full truncate text-base font-bold tracking-tight text-cdm-fg md:text-xl',
              markUrl && 'mt-1 md:mt-2',
            )}
          >
            {guild.name}
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          'rank-vs-layer flex flex-1 flex-col items-center justify-center',
          showGuild ? 'mt-2.5 md:mt-5' : 'mt-1',
        )}
      >
        <Emblem tier={skin} hidden={hidden} />
        <div className="mt-3 flex max-w-full flex-wrap items-center justify-center gap-1.5 md:mt-7 md:gap-2">
          {title ? (
            <TitleBadge
              name={title.name}
              color={title.color as TitleColor}
              effect={title.effect as TitleEffect | null}
              size="md"
              className="shrink-0"
            />
          ) : null}
          <h2 className="min-w-0 truncate text-lg font-bold tracking-tight text-cdm-fg md:text-3xl">
            {nickname}
          </h2>
        </div>
      </div>

      <div className="rank-vs-layer mt-3 flex min-h-0 w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-cdm-border pt-2.5 md:mt-8 md:min-h-8 md:gap-x-3 md:gap-y-2 md:pt-5">
        {hidden ? (
          <span className="text-xs text-cdm-fg-muted">정보 비공개</span>
        ) : (
          <>
            <RankBadge
              tier={tier}
              rp={placement ? undefined : (rp ?? undefined)}
              size="md"
              showRp={!placement}
              className="md:hidden"
            />
            <RankBadge
              tier={tier}
              rp={placement ? undefined : (rp ?? undefined)}
              size="lg"
              showRp={!placement}
              className="hidden md:inline-flex"
            />
            {placement ? <span className="text-xs text-cdm-fg-muted">배치전</span> : null}
            {showStreak ? (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums',
                  (winStreak ?? 0) >= 2
                    ? 'bg-cdm-highlight-soft text-cdm-highlight-strong'
                    : 'bg-cdm-bg-elev-2 text-cdm-fg-muted',
                )}
              >
                {winStreak}연승
              </span>
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}

function Emblem({ tier, hidden }: { tier: RankTier; hidden: boolean }) {
  return (
    <span className="rank-vs-emblem-wrap">
      <Image
        src={`/rank/tier-${tier}.png`}
        alt=""
        width={128}
        height={128}
        priority
        className={cn('rank-vs-emblem h-16 w-16 md:h-28 md:w-28', hidden && 'opacity-40')}
      />
    </span>
  );
}
