'use client';

import { useEffect, useRef, useState } from 'react';
import { useSkinFx } from '@/lib/skins/useSkinFx';
import type { FTTower, FTTowerPublicInfo } from '@/shared/types/five-towers';
import { FT_HALF_MILESTONE } from '@/shared/types';
import { CITADEL_TOWER_CLASS } from './citadelTowerClasses';
import { useCitadelCountPulse } from './useCitadelCountPulse';
import { sfxCitadelCollapse, sfxCitadelComplete } from '@/lib/sfx';

interface CitadelTowerProps {
  id: FTTower;
  tower: FTTowerPublicInfo;
  userCount: number;
  gameKey: string;
  onSetCell: (tower: FTTower, level: number) => void;
  onResetTower: (tower: FTTower) => void;
}

function flameClass(count: number, completed: boolean): string {
  if (completed) return 'skin-citadel-flame--on';
  if (count >= 9) return 'skin-citadel-flame--high';
  if (count >= 6) return 'skin-citadel-flame--mid';
  if (count >= 1) return 'skin-citadel-flame--low';
  return 'skin-citadel-flame--dim';
}

export default function CitadelTower({
  id,
  tower,
  userCount,
  gameKey,
  onSetCell,
  onResetTower,
}: CitadelTowerProps) {
  const { reducedMotion } = useSkinFx();
  const isCompleted = tower.completed;
  const halfReached = tower.milestonesReached.half;
  const pulse = useCitadelCountPulse(userCount);

  const collapseKey = `${gameKey}:${id}`;
  const collapseShownRef = useRef<Set<string>>(new Set());
  const prevCompleted = useRef(isCompleted);

  // collapsing: 무너지는 애니메이션 재생 중
  // appeared: 완성 상태 등장 애니메이션
  const [collapsing, setCollapsing] = useState(false);
  const [appeared, setAppeared] = useState(false);
  const [countBump, setCountBump] = useState(false);

  useEffect(() => {
    if (isCompleted && !prevCompleted.current && !collapseShownRef.current.has(collapseKey)) {
      collapseShownRef.current.add(collapseKey);
      prevCompleted.current = isCompleted;
      if (reducedMotion) return;
      setCollapsing(true);
      sfxCitadelCollapse();
      const t1 = setTimeout(() => {
        setCollapsing(false);
        setAppeared(true);
        sfxCitadelComplete();
      }, 1500);
      const t2 = setTimeout(() => setAppeared(false), 2100);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    prevCompleted.current = isCompleted;
  }, [isCompleted, collapseKey, reducedMotion]);

  useEffect(() => {
    if (!pulse || reducedMotion) return;
    setCountBump(true);
    const t = setTimeout(() => setCountBump(false), 380);
    return () => clearTimeout(t);
  }, [pulse, reducedMotion]);

  // 무너지는 동안은 완성 전 상태처럼 표시
  const showCompleted = isCompleted && !collapsing;
  const waterPct = isCompleted ? 100 : Math.min(100, userCount * 10);

  return (
    <div
      className={[
        'skin-citadel-tower flex flex-col items-stretch overflow-hidden rounded-lg border-2',
        CITADEL_TOWER_CLASS[id],
        showCompleted ? 'skin-citadel-tower-complete' : '',
        collapsing ? 'skin-citadel-tower-collapsing' : '',
        appeared ? 'skin-citadel-tower-appeared' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="skin-citadel-cap" aria-hidden />
      {/* crack styles via ::before on skin-citadel-block */}

      <button
        type="button"
        onContextMenu={(e) => { e.preventDefault(); onResetTower(id); }}
        onDoubleClick={() => onResetTower(id)}
        disabled={isCompleted}
        className={`skin-citadel-pillar ${countBump ? 'skin-citadel-pillar--pulse' : ''} ${
          showCompleted ? 'skin-citadel-pillar--lit cursor-default' : ''
        }`}
        title={isCompleted ? '완성된 탑' : '더블클릭/우클릭으로 카운트 초기화'}
      >
        <span className="skin-citadel-pillar-label">{id}</span>
        <span className="skin-citadel-pillar-count tabular-nums">
          {/*
            아직 안 센 탑에 0 을 적지 않는다. 이름 옆에 붙어 'A0 B0 C0' 처럼 읽혀
            탑 이름이 A0 인 줄 알게 된다. 셈이 시작되면 그때 숫자가 나타난다.
          */}
          {showCompleted ? '완성' : userCount > 0 ? userCount : ''}
        </span>
        <span
          className={`skin-citadel-flame ${flameClass(collapsing ? 10 : userCount, showCompleted)}`}
          aria-hidden
        />
      </button>

      <div className="skin-citadel-stack relative flex flex-col">
        <div
          className="skin-citadel-waterline pointer-events-none"
          style={{ height: `${waterPct}%` }}
          aria-hidden
        />

        {Array.from({ length: 10 }, (_, i) => 10 - i).map((level) => {
          const isFilled = userCount >= level || collapsing;
          const isTop = userCount === level && userCount > 0 && !isCompleted;
          const isHalf = level === FT_HALF_MILESTONE;
          const placeUp = pulse?.dir === 'up' && pulse.level === level && isFilled && !reducedMotion;
          const placeDown = pulse?.dir === 'down' && pulse.level === level && !isFilled && !reducedMotion;

          return (
            <button
              key={level}
              type="button"
              onClick={() => onSetCell(id, level)}
              disabled={isCompleted}
              className={[
                'skin-citadel-cell',
                showCompleted
                  ? 'skin-citadel-cell--done'
                  : isFilled
                    ? 'skin-citadel-cell--filled'
                    : 'skin-citadel-cell--empty',
                isTop ? 'skin-citadel-cell--crest' : '',
                isHalf ? (halfReached ? 'skin-citadel-cell--half-reached' : 'skin-citadel-cell--half') : '',
                placeUp ? 'skin-citadel-cell--place-up' : '',
                placeDown ? 'skin-citadel-cell--place-down' : '',
              ].filter(Boolean).join(' ')}
            >
              {isHalf && !halfReached && (
                <span className="skin-citadel-gate-mark" aria-hidden />
              )}
              <span className="skin-citadel-block">
                <span className="skin-citadel-block-top" aria-hidden />
                <span className="skin-citadel-block-engrave tabular-nums">{level}</span>
              </span>
              {isHalf && halfReached && (
                <span className="skin-citadel-half-badge">6+</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
