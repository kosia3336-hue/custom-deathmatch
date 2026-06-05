'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import {
  sfxSmsLit,
  sfxSmsPenalty,
  sfxSmsPick,
  sfxSmsReveal,
  sfxSmsScore,
  sfxSmsVoid,
} from '@/lib/smsEventSfx';
import type {
  SmsMarkId,
  SmsRoundResultPayload,
  SmsStatePayload,
} from '@/shared/types/sun-moon-star-event';
import { SMSE_MARK_ICONS } from '@/shared/types/sun-moon-star-event';
import { SMSE_MARK_LABELS, SMSE_MARK_IDS } from '@/shared/types/sun-moon-star-event';
import { MARK_STYLES } from '@/components/game/modules/sun-moon-star-2/constants';
import SmsEventSpectatorPanel from './SmsEventSpectatorPanel';
import SmsPhaseOverlay from './SmsPhaseOverlay';
import SmsRevealBanner from './SmsRevealBanner';
import SmsLitArena from './SmsLitArena';
import SmsSeatChip from './SmsSeatChip';
import SmsRoundScoreList from './SmsRoundScoreList';
import { useSmsPhaseMessage } from './useSmsPhaseMessage';

interface Props {
  state: SmsStatePayload;
  roundOverlay: SmsRoundResultPayload | null;
  mySeatIdx: number | null;
}

export default function SmsGameBoard({ state, roundOverlay, mySeatIdx }: Props) {
  const { gameData: gd, role } = state;
  const isPlayer = role === 'player' && mySeatIdx !== null;
  const showSpectatorPanel = role === 'queued' || role === 'spectator';

  const canPick =
    isPlayer &&
    (gd.phase === 'pickFirst' || gd.phase === 'pickSecond') &&
    mySeatIdx !== null;

  const mySeat = mySeatIdx != null ? gd.seats[mySeatIdx] : null;
  const alreadyPicked =
    gd.phase === 'pickFirst' ? mySeat?.hasSubmittedFirst : mySeat?.hasSubmittedSecond;

  const participantSeats = gd.seats.filter((s): s is NonNullable<typeof s> => s !== null);
  const phaseMessage = useSmsPhaseMessage(gd);

  const prevRevealKey = useRef('');
  const prevResolveKey = useRef('');
  useEffect(() => {
    if (gd.phase !== 'revealFirst' && gd.phase !== 'revealSecond') return;
    const key = `${gd.phase}-${gd.revealIndex}`;
    if (key === prevRevealKey.current) return;
    prevRevealKey.current = key;
    sfxSmsReveal();
  }, [gd.phase, gd.revealIndex]);

  useEffect(() => {
    if (gd.phase !== 'resolve') return;
    const key = `${gd.roundNumber}-${gd.litMark ?? 'void'}`;
    if (key === prevResolveKey.current) return;
    prevResolveKey.current = key;
    if (gd.voidRound) sfxSmsVoid();
    else if (gd.litMark) sfxSmsLit();
  }, [gd.phase, gd.roundNumber, gd.litMark, gd.voidRound]);

  useEffect(() => {
    if (!roundOverlay || mySeatIdx == null) return;
    const me = roundOverlay.scorers.find((s) => s.seatIdx === mySeatIdx);
    if (!me) return;
    if (me.roundScore === 1 || me.roundScore === 2) sfxSmsScore(me.roundScore);
    else if (me.roundScore === -1) sfxSmsPenalty();
  }, [roundOverlay, mySeatIdx]);

  const handlePick = useCallback((mark: SmsMarkId) => {
    sfxSmsPick();
    getSocket().emit('game:action', { type: 'pick', mark });
  }, []);

  return (
    <>
      <style>{`
        @keyframes smsEvtBannerPop {
          from { opacity: 0; transform: scale(0.92) translateY(6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes smsEvtLitPulse {
          0%, 100% { transform: scale(1.05); filter: brightness(1); }
          50% { transform: scale(1.1); filter: brightness(1.15); }
        }
      `}</style>

      <SmsPhaseOverlay phase={gd.phase} isPlayer={isPlayer} />

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {showSpectatorPanel && <SmsEventSpectatorPanel state={state} />}

        <p
          className={`text-center text-sm ${
            gd.phase === 'waiting' && gd.nextRoundStartsAt != null
              ? 'font-medium text-indigo-600'
              : gd.phase === 'resolve' || gd.phase === 'resolveFirst'
                ? 'font-semibold text-violet-700'
                : 'text-cdm-fg'
          }`}
          aria-live="polite"
        >
          {phaseMessage}
        </p>

        <SmsRevealBanner gameData={gd} />

        <SmsLitArena gameData={gd} />

        {/* Seats */}
        <div className="mx-auto grid w-full max-w-xl grid-cols-2 gap-2.5 sm:grid-cols-4">
          {participantSeats.map((seat) => (
            <SmsSeatChip
              key={seat.seatIdx}
              seat={seat}
              isMe={seat.seatIdx === mySeatIdx}
            />
          ))}
        </div>

        {isPlayer && canPick && !alreadyPicked && (
          <div className="sticky bottom-0 mx-auto flex w-full max-w-lg gap-2 bg-cdm-bg/95 pt-2 pb-safe">
            {SMSE_MARK_IDS.map((mark) => {
              const style = MARK_STYLES[mark];
              return (
                <button
                  key={mark}
                  type="button"
                  onClick={() => handlePick(mark)}
                  className={`min-h-14 flex-1 rounded-cdm-lg border-2 text-center transition hover:scale-[1.02] ${style.borderSoft} ${style.bgSoft}`}
                  aria-label={`${SMSE_MARK_LABELS[mark]} 선택`}
                >
                  <span className="text-2xl">{SMSE_MARK_ICONS[mark]}</span>
                  <span className="block text-xs font-medium">{SMSE_MARK_LABELS[mark]}</span>
                </button>
              );
            })}
          </div>
        )}

        {isPlayer && canPick && alreadyPicked && (
          <p className="text-center text-sm text-cdm-muted">선택 완료. 다른 플레이어를 기다리는 중…</p>
        )}

        {!isPlayer && !showSpectatorPanel && gd.phase !== 'waiting' && (
          <div className="mx-auto flex w-full max-w-lg items-center justify-center rounded-cdm-md border border-dashed border-cdm-border py-4 text-sm text-cdm-fg-muted">
            관전 중 — 다음 판 시작 시 빈 자리가 있으면 자동 입장됩니다.
          </div>
        )}

        {roundOverlay && (
          <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
            <div className="max-w-sm animate-[smsEvtBannerPop_0.4s_ease-out] rounded-cdm-xl border border-cdm-border bg-cdm-bg p-6 text-center shadow-xl">
              {roundOverlay.void ? (
                <>
                  <p className="text-lg font-semibold">이번 판 무효</p>
                  <p className="mt-1 text-sm text-cdm-muted">세 곳이 동률입니다</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold">
                    불빛: {roundOverlay.litMark && SMSE_MARK_ICONS[roundOverlay.litMark]}{' '}
                    {roundOverlay.litMark && SMSE_MARK_LABELS[roundOverlay.litMark]}
                  </p>
                <SmsRoundScoreList scorers={roundOverlay.scorers} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
