'use client';
import type { GS2PlayerPublic, GS2ResolveStep, GS2Side } from '@/shared/types/grape-sugar-2';
import { CARD_NAMES } from './constants';

export function ResolveStepRow({
  step,
  players,
  mySide,
}: {
  step: GS2ResolveStep;
  players: { p1: GS2PlayerPublic; p2: GS2PlayerPublic };
  mySide: GS2Side | null;
}) {
  const nick = (side: GS2Side) => (mySide === side ? '나' : players[side].nickname);
  let text = '';
  let cls = 'text-gray-700';

  switch (step.type) {
    case 'cancel':
      cls = 'text-indigo-700 font-bold';
      text = `${nick(step.bySide)}의 우주뿌셔! → ${nick(step.targetSide)} 무효`;
      break;
    case 'effect':
      text = `${nick(step.actor)}의 ${CARD_NAMES[step.card]}: ${nick(step.targetSide)} 설탕 ${step.before} → ${step.after} (${step.op})`;
      break;
    case 'dice':
      cls = 'text-yellow-700 font-bold';
      text = `${nick(step.actor)}의 주사위: ${step.roll} → ${
        step.branch === 'opp-3'
          ? '상대 -3'
          : step.branch === 'self-5'
            ? '본인 -5'
            : '미승리 시 상대 +2점 예약'
      }`;
      break;
    case 'final':
      cls = 'text-purple-700 font-bold';
      text = `최종 설탕: ${players.p1.nickname} ${step.roundSugar.p1} vs ${players.p2.nickname} ${step.roundSugar.p2}`;
      break;
    case 'winner':
      cls = 'text-emerald-700 font-bold';
      text = step.winner === 'tie' ? '라운드 무승부' : `${nick(step.winner)} 라운드 승! +1점`;
      break;
    case 'bless':
      cls =
        step.scoreDelta > 0
          ? 'text-purple-700 font-bold'
          : step.scoreDelta < 0
            ? 'text-red-600 font-bold'
            : 'text-gray-500';
      text = `${nick(step.actor)}의 포도의가호: ${
        step.outcome === 'win'
          ? `승리 → +${step.scoreDelta}점`
          : step.outcome === 'loss'
            ? `패배 → ${step.scoreDelta}점`
            : '무승부, 보정 없음'
      }`;
      break;
    case 'diceScore':
      cls = 'text-yellow-700 font-bold';
      text = `${nick(step.actor)}의 주사위 5·6 보너스 → ${nick(step.loserBonusTo)} +${step.amount}점`;
      break;
    case 'hrPenaltyScheduled':
      cls = 'text-orange-600 font-bold';
      text = `${nick(step.actor)}의 하이리스크 패배 → 다음 R 시작 시 설탕 ${step.amount}개 이전 예정`;
      break;
    case 'breathExtended':
      cls = 'text-teal-700 font-bold';
      text = '숨고르기! 게임이 9라운드로 연장됩니다.';
      break;
    case 'breathNoEffect':
      cls = 'text-gray-500';
      text = `${nick(step.actor)}의 숨고르기 무효 (${step.reason === 'alreadyExtended' ? '이미 연장됨' : '우주뿌셔!로 무효화'})`;
      break;
    case 'instantWin':
      cls = 'text-red-700 font-bold';
      text = `${nick(step.winner)} 즉시 게임 승리! (무행동 vs 우주뿌셔!)`;
      break;
    default:
      return null;
  }

  return (
    <div
      className={`flex items-center gap-1.5 rounded bg-white/70 px-2 py-1 text-xs lg:text-sm ${cls} animate-in fade-in slide-in-from-bottom-4 duration-700`}
    >
      <span className="min-w-0">{text}</span>
    </div>
  );
}
