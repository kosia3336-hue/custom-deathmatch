'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { AI_PLAYER_ID } from '@/shared/types';
import type { Player } from '@/shared/types';
import type { TitleColor } from '@/lib/supabase/database.types';
import { TitleBadge, type TitleEffect } from '@/components/cdm/TitleBadge';
import { TurnBadge } from '@/components/cdm/TurnBadge';
import { HostMark, MeLabel } from '@/components/cdm/Marks';

interface Props {
  player?: Player;
  isMe: boolean;
  isHostView: boolean;
  /** v1 호환 (미사용 - v2 에서는 player.turnPosition 사용) */
  colorLabel?: '흑' | '백';
  onKick?: (id: string) => void;
  onDelegate?: (id: string) => void;
  /** v2 — 게임 시작 후엔 토글 비활성 */
  isGameStarted?: boolean;
  onReport?: (memberId: string, nickname: string) => void;
}

export default function PlayerSlot({
  player,
  isMe,
  isHostView,
  onKick,
  onDelegate,
  isGameStarted,
  onReport,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (!player) {
    return (
      <div className="flex h-24 items-center justify-center rounded-cdm-lg border-2 border-dashed border-cdm-border text-sm text-cdm-fg-subtle">
        빈 자리
      </div>
    );
  }

  const isAI = player.id === AI_PLAYER_ID;
  const turn = player.turnPosition ?? null;
  const title = player.displayedTitle;

  return (
    <div
      className={cn(
        'relative flex flex-col gap-2 rounded-cdm-lg border p-4 transition-colors',
        isMe ? 'border-cdm-primary bg-cdm-primary-soft/40' : 'border-cdm-border bg-cdm-bg-elev-1',
      )}
    >
      {/* 헤더 라인: 칭호 + 닉 + 마크들 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {title && (
              <TitleBadge name={title.name} color={title.color as TitleColor} effect={title.effect as TitleEffect | null} size="sm" />
            )}
            <span className="font-semibold text-cdm-fg truncate">{player.nickname}</span>
            {isAI && (
              <span className="text-xs px-1.5 py-0.5 rounded-cdm-sm bg-cdm-bg-elev-2 text-cdm-fg-muted">
                COM
              </span>
            )}
            {player.isHost && <HostMark />}
            {isMe && <MeLabel />}
            {turn && <TurnBadge turn={turn} size="sm" />}
          </div>
        </div>

        {/* 다른 사람 슬롯 — 메뉴 (호스트: 위임·강퇴·신고 / 일반: 신고) */}
        {!isMe && !isAI && (isHostView || player.memberId) && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-cdm-md p-1.5 text-cdm-fg-muted hover:bg-cdm-bg-elev-2 hover:text-cdm-fg"
              aria-label="메뉴 열기"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-32 overflow-hidden rounded-cdm-md border border-cdm-border bg-cdm-bg shadow-(--cdm-shadow-md)">
                  {isHostView && !player.isHost && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onDelegate?.(player.id);
                          setMenuOpen(false);
                        }}
                        className="block w-full px-4 py-2 text-left text-sm text-cdm-fg hover:bg-cdm-bg-elev-1"
                      >
                        방장 위임
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onKick?.(player.id);
                          setMenuOpen(false);
                        }}
                        className="block w-full px-4 py-2 text-left text-sm text-cdm-accent hover:bg-cdm-bg-elev-1"
                      >
                        강퇴
                      </button>
                    </>
                  )}
                  {player.memberId && (
                    <button
                      type="button"
                      onClick={() => {
                        onReport?.(player.memberId!, player.nickname);
                        setMenuOpen(false);
                      }}
                      className="block w-full px-4 py-2 text-left text-sm text-cdm-danger hover:bg-cdm-bg-elev-1"
                    >
                      신고
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 준비 상태 */}
      {!player.isHost && !isAI && (
        <span
          className={cn(
            'text-xs',
            player.isReady ? 'text-cdm-success' : 'text-cdm-fg-muted',
          )}
        >
          {player.isReady ? '준비 완료' : '준비 대기'}
        </span>
      )}

    </div>
  );
}
