'use client';

import { useState } from 'react';
import type { GameRecordFile, GrapeSugar2ArchiveRecord } from '@/shared/types/archive';
import type { GS2CardId, GS2RoundRecord, GS2Side } from '@/shared/types/grape-sugar-2';
import { CARD_IDS } from '@/shared/types/grape-sugar-2';
import { formatTime } from '@/lib/utils';

const CARD_NAMES: Record<GS2CardId, string> = {
  minus3: '-3', plus5: '+5', copy: '복사', grapeBless: '포도의가호',
  earthCrush: '지구뿌셔!', dice: '주사위', breath: '숨고르기',
  highRisk: '하이리스크', spaceCrush: '우주뿌셔!', noAction: '무행동',
};

/** 카드 통계 셀에 표시할 2~4글자 줄임명 */
const CARD_SHORT: Record<GS2CardId, string> = {
  minus3: '-3', plus5: '+5', copy: '복사', grapeBless: '포도',
  earthCrush: '지구', dice: '주사위', breath: '숨고르기',
  highRisk: '하이', spaceCrush: '우주', noAction: '무행동',
};

const CARD_STYLE: Record<GS2CardId, { bg: string; text: string; icon: string }> = {
  minus3: { bg: 'bg-rose-100', text: 'text-rose-700', icon: '−3' },
  plus5: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '+5' },
  copy: { bg: 'bg-sky-100', text: 'text-sky-700', icon: '×2' },
  grapeBless: { bg: 'bg-purple-100', text: 'text-purple-700', icon: '포도' },
  earthCrush: { bg: 'bg-amber-100', text: 'text-amber-700', icon: '지구' },
  dice: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '주사위' },
  breath: { bg: 'bg-teal-100', text: 'text-teal-700', icon: '숨' },
  highRisk: { bg: 'bg-orange-100', text: 'text-orange-700', icon: '×3' },
  spaceCrush: { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: '우주' },
  noAction: { bg: 'bg-gray-100', text: 'text-gray-600', icon: '∅' },
};

const WIN_TYPE_LABEL: Record<string, string> = {
  score: '승점',
  instantWin: '무행동 즉시 승리',
  timeout: '시간 초과',
  abandon: '기권',
  draw: '무승부',
};

interface Props {
  record: GameRecordFile;
}

export default function GrapeSugar2Viewer({ record }: Props) {
  const gameRecord = record.gameRecord as GrapeSugar2ArchiveRecord | null;
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const [expandedRound, setExpandedRound] = useState<string | null>(null);
  if (!gameRecord) return <p className="text-sm text-gray-500">기보 데이터가 없습니다.</p>;

  const stages = gameRecord.stages ?? [];
  const sides = gameRecord.sides ?? { p1: '', p2: '' };

  const playerNicknames: Record<GS2Side, string> = {
    p1: gameRecord.players?.[sides.p1]?.nickname ?? record.players?.[sides.p1]?.nickname ?? 'P1',
    p2: gameRecord.players?.[sides.p2]?.nickname ?? record.players?.[sides.p2]?.nickname ?? 'P2',
  };

  const winnerEntry = record.result.rankings.find((r) => r.rank === 1);
  const winnerNick = winnerEntry?.nickname;
  const winTypeLabel = gameRecord.winType ? (WIN_TYPE_LABEL[gameRecord.winType] ?? gameRecord.winType) : null;

  const activeStage = stages[activeStageIdx] ?? stages[0];

  return (
    <div className="space-y-4">
      {/* 결과 요약 */}
      <div className="rounded-xl border border-purple-200 bg-linear-to-br from-purple-50 to-fuchsia-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-purple-500">최종 결과</span>
            <span className="text-2xl font-bold text-purple-900">
              {gameRecord.winType === 'draw' || !winnerNick
                ? '무승부'
                : `${winnerNick} 승리`}
            </span>
            {winTypeLabel && <span className="text-xs text-purple-600">{winTypeLabel}</span>}
          </div>
          <div className="flex gap-4">
            {(['p1', 'p2'] as const).map((side) => (
              <div key={side} className="flex flex-col items-center">
                <span className="text-xs text-gray-500 truncate max-w-[120px]">
                  {playerNicknames[side]}
                </span>
                <span className={`text-3xl font-bold ${
                  (gameRecord.finalScores[sides[side]] ?? 0) < 0 ? 'text-red-500' : 'text-purple-700'
                }`}>
                  {gameRecord.finalScores[sides[side]] ?? 0}
                </span>
                <span className="text-[10px] text-gray-400">점</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 카드 사용 통계 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-bold text-gray-700">카드 사용 통계</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(['p1', 'p2'] as const).map((side) => {
            const usage = gameRecord.cardUsage?.[side] ?? [];
            const usageMap = new Map(usage.map((u) => [u.card, u.count]));
            return (
              <div key={side} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="mb-3 text-sm font-bold text-gray-600 truncate">
                  {playerNicknames[side]}
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {CARD_IDS.map((c) => {
                    const count = usageMap.get(c) ?? 0;
                    const style = CARD_STYLE[c];
                    return (
                      <div
                        key={c}
                        className={`flex flex-col items-center justify-center rounded py-2.5 gap-1 ${
                          count > 0 ? `${style.bg} ${style.text}` : 'bg-white text-gray-300'
                        }`}
                        title={CARD_NAMES[c]}
                      >
                        <span className="text-base lg:text-lg leading-none">{style.icon}</span>
                        <span className="text-[9px] lg:text-[11px] leading-none font-medium truncate w-full text-center px-0.5">{CARD_SHORT[c]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 스테이지 탭 */}
      {stages.length > 1 && (
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1">
          {stages.map((stage, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveStageIdx(i)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-bold transition-colors lg:text-sm ${
                activeStageIdx === i
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {stage.extension === 0 ? '본 게임' : `${stage.extension}차 연장`}
              <span className="ml-1 text-[10px] opacity-70">({stage.rounds.length}R)</span>
            </button>
          ))}
        </div>
      )}

      {/* 라운드 기록 */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 text-sm font-medium text-gray-700">
          <span>라운드 기록</span>
          <span className="text-xs text-gray-500">
            {activeStage?.extension === 0 ? '본 게임' : `${activeStage?.extension}차 연장`} · 총 {activeStage?.rounds.length ?? 0}R
          </span>
        </div>
        <div className="p-3 space-y-2">
          {(activeStage?.rounds ?? []).map((r, idx) => {
            const key = `${r.extension}-${r.round}-${idx}`;
            const expanded = expandedRound === key;
            return (
              <RoundCard
                key={key}
                round={r}
                playerNicknames={playerNicknames}
                expanded={expanded}
                onToggle={() => setExpandedRound(expanded ? null : key)}
              />
            );
          })}
        </div>
      </div>

      {/* 게임 메타 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
          <span>
            <span className="text-gray-400">게임</span>{' '}
            <span className="font-medium text-gray-800">{record.gameName}</span>
          </span>
          <span>
            <span className="text-gray-400">모드</span>{' '}
            <span className="font-medium text-gray-800">
              {record.playMode === 'multi' ? '멀티' : record.playMode === 'com' ? '1:COM' : '솔로'}
            </span>
          </span>
          <span>
            <span className="text-gray-400">일시</span>{' '}
            <span className="font-medium text-gray-800">
              {new Date(record.playedAt).toLocaleDateString('ko-KR', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </span>
          <span>
            <span className="text-gray-400">시간</span>{' '}
            <span className="font-medium text-gray-800">{formatTime(record.result.playTime)}</span>
          </span>
          <span>
            <span className="text-gray-400">총 라운드</span>{' '}
            <span className="font-medium text-gray-800">{gameRecord.totalRounds}R</span>
          </span>
          {gameRecord.extensions > 0 && (
            <span>
              <span className="text-gray-400">연장</span>{' '}
              <span className="font-medium text-gray-800">{gameRecord.extensions}차</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────── 라운드 카드 ────────── */

function RoundCard({
  round, playerNicknames, expanded, onToggle,
}: {
  round: GS2RoundRecord;
  playerNicknames: Record<GS2Side, string>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const winner = round.winner;
  const isTie = winner === 'tie';
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-3 text-left hover:bg-white"
      >
        {/* 1행: 라운드 번호 + 닉네임 + 결과 + 토글 */}
        <div className="flex items-center gap-2">
          <span className="shrink-0 rounded bg-white px-2 py-0.5 text-xs font-bold text-gray-700 border border-gray-200">
            R{round.round}
          </span>
          <div className="flex flex-1 items-center gap-1 min-w-0">
            {(['p1', 'p2'] as const).map((side, i) => {
              const isWin = winner === side;
              return (
                <span key={side} className="flex items-center gap-0.5 min-w-0">
                  {i === 1 && <span className="text-gray-300 shrink-0">vs</span>}
                  <span className={`truncate text-xs font-bold ${isWin ? 'text-emerald-600' : isTie ? 'text-gray-500' : 'text-gray-500'}`}>
                    {playerNicknames[side]}
                  </span>
                </span>
              );
            })}
          </div>
          <span className="shrink-0 text-xs text-gray-400">{expanded ? '▲' : '▼'}</span>
        </div>

        {/* 2행: 카드 + 설탕 정보 */}
        <div className="mt-2 flex items-center gap-2">
          {(['p1', 'p2'] as const).map((side, i) => {
            const a = round.actions[side];
            const style = CARD_STYLE[a.card];
            const delta = round.scoreDelta[side];
            return (
              <div key={side} className={`flex flex-1 items-center gap-1.5 rounded px-1.5 py-1 ${
                winner === side ? 'bg-emerald-50' : isTie ? 'bg-gray-100' : 'bg-white'
              }`}>
                {i === 1 && <span className="text-[10px] text-gray-300">|</span>}
                <span className={`shrink-0 inline-flex h-6 w-8 items-center justify-center rounded text-[11px] font-bold ${style.bg} ${style.text}`}
                  title={CARD_NAMES[a.card]}>
                  {style.icon}
                </span>
                <span className="text-[10px] text-gray-500 whitespace-nowrap">
                  {a.sugar}→{round.finalRoundSugar[side]}
                </span>
                <span className={`text-[10px] font-bold whitespace-nowrap ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {delta > 0 ? `+${delta}` : delta}점
                </span>
              </div>
            );
          })}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 bg-white p-3">
          <p className="mb-2 text-[11px] font-bold text-gray-500">정산 단계</p>
          <div className="space-y-1">
            {round.steps.map((step, i) => (
              <ResolveStepLine key={i} step={step} playerNicknames={playerNicknames} />
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-1 border-t border-gray-100 pt-2 text-[11px] text-gray-500">
            <span>최종 설탕: {playerNicknames.p1} {round.finalRoundSugar.p1} vs {playerNicknames.p2} {round.finalRoundSugar.p2}</span>
            <span>누적 점수: {playerNicknames.p1} {round.scoreAfter.p1}점 / {playerNicknames.p2} {round.scoreAfter.p2}점</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ResolveStepLine({
  step, playerNicknames,
}: {
  step: GS2RoundRecord['steps'][number];
  playerNicknames: Record<GS2Side, string>;
}) {
  const nick = (side: GS2Side) => playerNicknames[side];
  let text = '';
  let cls = 'text-gray-600';

  switch (step.type) {
    case 'reveal':
      text = `공개: ${nick('p1')} ${CARD_NAMES[step.actions.p1.card]}+${step.actions.p1.sugar} | ${nick('p2')} ${CARD_NAMES[step.actions.p2.card]}+${step.actions.p2.sugar}`;
      break;
    case 'cancel':
      cls = 'text-indigo-700 font-bold';
      text = `${nick(step.bySide)} 우주뿌셔! → ${nick(step.targetSide)} 무효`;
      break;
    case 'effect':
      text = `${nick(step.actor)} ${CARD_NAMES[step.card]}: ${nick(step.targetSide)} 설탕 ${step.before}→${step.after} (${step.op})`;
      break;
    case 'dice':
      cls = 'text-yellow-700';
      text = `${nick(step.actor)} 주사위: ${step.roll} (${
        step.branch === 'opp-3' ? '상대 -3'
        : step.branch === 'self-5' ? '본인 -5'
        : '미승리 시 상대 +2점'
      })`;
      break;
    case 'final':
      cls = 'text-purple-700 font-bold';
      text = `최종: ${nick('p1')} ${step.roundSugar.p1} vs ${nick('p2')} ${step.roundSugar.p2}`;
      break;
    case 'winner':
      cls = 'text-emerald-700 font-bold';
      text = step.winner === 'tie' ? '라운드 무승부' : `${nick(step.winner)} 승 (+1점)`;
      break;
    case 'bless':
      text = `${nick(step.actor)} 포도의가호: ${step.outcome === 'win' ? '+2점' : step.outcome === 'loss' ? '-1점' : '무효'}`;
      break;
    case 'diceScore':
      text = `${nick(step.actor)} 주사위 5·6 보너스 → ${nick(step.loserBonusTo)} +${step.amount}점`;
      break;
    case 'hrPenaltyScheduled':
      cls = 'text-orange-600';
      text = `${nick(step.actor)} 하이리스크 패배 → 다음 R 시작 시 설탕 ${step.amount}개 이전 예정`;
      break;
    case 'breathExtended':
      cls = 'text-teal-700 font-bold';
      text = '숨고르기! 9R로 연장';
      break;
    case 'breathNoEffect':
      text = `${nick(step.actor)}의 숨고르기 무효 (${step.reason === 'alreadyExtended' ? '이미 연장됨' : '우주뿌셔!로 무효화'})`;
      break;
    case 'instantWin':
      cls = 'text-red-700 font-bold';
      text = `${nick(step.winner)} 즉시 승리! (무행동 vs 우주뿌셔!)`;
      break;
  }

  return (
    <div className={`flex items-center gap-1.5 text-[11px] ${cls}`}>
      <span className="min-w-0">{text}</span>
    </div>
  );
}
