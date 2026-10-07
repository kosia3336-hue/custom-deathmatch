'use client';
import styles from './layout.module.css';
import type {
  GS2PlayerPublic,
  GS2ResolveStep,
  GS2RoundRecord,
  GS2Side,
} from '@/shared/types/grape-sugar-2';
import { computeLiveSugar } from './computeLiveSugar';
import { CARD_NAMES, CARD_STYLES } from './constants';
import { LiveSugarBadge } from './LiveSugarBadge';
import { ResolveStepRow } from './ResolveStepRow';

export function ResolutionPanel({
  steps,
  cursor,
  players,
  mySide,
  roundResult,
  showFinal,
  candy,
}: {
  steps: GS2ResolveStep[];
  cursor: number;
  players: { p1: GS2PlayerPublic; p2: GS2PlayerPublic };
  mySide: GS2Side | null;
  roundResult: GS2RoundRecord | null;
  showFinal: boolean;
  candy?: boolean;
}) {
  const reveal = steps[0]?.type === 'reveal' ? steps[0] : null;
  const visibleSteps = steps.slice(0, cursor);
  const nicknameOf = (side: GS2Side) => (mySide === side ? '나' : players[side].nickname);
  const orderedSides: GS2Side[] = mySide === 'p2' ? ['p2', 'p1'] : ['p1', 'p2'];
  const liveSugar = computeLiveSugar(steps, cursor);

  return (
    <div
      className={`relative z-10 flex flex-col gap-3 p-4 lg:p-5 ${
        candy
          ? 'skin-candy-panel'
          : 'rounded-xl border border-purple-200 bg-linear-to-b from-purple-50 to-white'
      }`}
    >
      {/* 카드 + 설탕 동시 공개 */}
      {reveal && reveal.type === 'reveal' && (
        <div className="flex items-center justify-around gap-4">
          {orderedSides.map((side, idx) => {
            const action = reveal.actions[side];
            const card = action.card;
            const style = CARD_STYLES[card];
            return (
              <div
                key={side}
                className={`flex flex-col items-center gap-2 transition-all duration-500 ${
                  cursor >= 1 ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
                }`}
                style={{ transitionDelay: `${idx * 100}ms` }}
              >
                <span
                  className={`max-w-[100px] truncate text-xs ${candy ? 'skin-candy-subtext' : 'text-gray-500'}`}
                >
                  {nicknameOf(side)}
                </span>
                <div
                  className={
                    candy
                      ? `skin-candy-card skin-candy-card--${card} flex w-20 flex-col items-center justify-center lg:w-24`
                      : `${styles.card} flex w-20 flex-col items-center justify-center rounded-xl border-2 lg:w-24 ${style.bg} ${style.text} ${style.border}`
                  }
                >
                  <span className="text-3xl lg:text-4xl">{style.icon}</span>
                  <span className="mt-1 px-1 text-center text-xs font-bold">
                    {CARD_NAMES[card]}
                  </span>
                </div>
                <LiveSugarBadge value={liveSugar[side]} />
              </div>
            );
          })}
        </div>
      )}

      {/* 정산 단계 로그 */}
      <div className="flex flex-col gap-1">
        {visibleSteps.slice(1).map((step, i) => (
          <ResolveStepRow key={i} step={step} players={players} mySide={mySide} />
        ))}
      </div>

      {/* 최종 라운드 결과 */}
      {showFinal && roundResult && (
        <div className="animate-in fade-in flex items-center justify-around gap-3 rounded-lg border-2 border-purple-300 bg-purple-100 p-2.5 duration-500">
          {orderedSides.map((side) => {
            const isWinner = roundResult.winner === side;
            const isTie = roundResult.winner === 'tie';
            const sugar = roundResult.finalRoundSugar[side];
            const delta = roundResult.scoreDelta[side];
            return (
              <div key={side} className="flex flex-col items-center gap-1">
                <span className="max-w-[100px] truncate text-xs text-gray-500">
                  {nicknameOf(side)}
                </span>
                <div
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 ${
                    isWinner
                      ? 'bg-emerald-500 text-white'
                      : isTie
                        ? 'bg-gray-300 text-gray-700'
                        : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  <span className="font-bold">{sugar}</span>
                  <span className="text-xs font-bold">{isWinner ? '승' : isTie ? '무' : '패'}</span>
                </div>
                {delta !== 0 && (
                  <span
                    className={`text-xs font-bold ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}
                  >
                    {delta > 0 ? `+${delta}` : delta}점
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
