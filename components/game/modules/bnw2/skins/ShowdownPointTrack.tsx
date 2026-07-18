'use client';

import type { BNW2PlayerInfo } from '@/shared/types/bnw2';

interface Props {
  leftPlayer: BNW2PlayerInfo;
  rightPlayer: BNW2PlayerInfo;
  leftLabel: string;
  rightLabel: string;
}

const STAGES = Array.from({ length: 10 }, (_, i) => {
  const stage = 10 - i;
  const hi = stage * 20;
  const lo = (stage - 1) * 20;
  return { stage, label: lo === 0 ? '0~20' : `${lo + 1}~${hi}` };
});

type RowState = 'dim' | 'active' | 'lit';

function getRowState(rowStage: number, playerStage: number): RowState {
  const effective = playerStage === 0 ? 1 : playerStage;
  if (rowStage > effective) return 'dim';
  if (rowStage === effective) return 'active';
  return 'lit';
}

const BULLETS_PER_ROUND = 5;

function roundClass(side: 'left' | 'right', state: RowState) {
  return [
    'skin-showdown-round',
    side === 'left' ? 'skin-showdown-round--law' : 'skin-showdown-round--outlaw',
    `skin-showdown-round--${state}`,
  ].join(' ');
}

function tagClass(state: RowState) {
  return ['skin-showdown-hanging-tag', `skin-showdown-hanging-tag--${state}`].join(' ');
}

function BulletBundle({ side, state }: { side: 'left' | 'right'; state: RowState }) {
  return (
    <span className={roundClass(side, state)}>
      <span className="skin-showdown-round-loop" />
      <span className="skin-showdown-round-bullets">
        {Array.from({ length: BULLETS_PER_ROUND }, (_, i) => (
          <span key={i} className="skin-showdown-round-bullet">
            <span className="skin-showdown-cartridge-tip" />
            <span className="skin-showdown-cartridge-case" />
          </span>
        ))}
      </span>
    </span>
  );
}

export default function ShowdownPointTrack({ leftPlayer, rightPlayer, leftLabel, rightLabel }: Props) {
  return (
    <div className="skin-showdown-track-shell">
      {/* 트랙 카드 내부를 가로지르는 먼지바람 */}
      <div className="skin-showdown-dust-layer" aria-hidden>
        <span className="skin-showdown-dust skin-showdown-dust--1" />
        <span className="skin-showdown-dust skin-showdown-dust--2" />
        <span className="skin-showdown-dust skin-showdown-dust--3" />
        <span className="skin-showdown-dust skin-showdown-dust--4" />
        <span className="skin-showdown-dust skin-showdown-dust--5" />
      </div>

      <div className="skin-showdown-track">
        <div className="skin-showdown-track-header">
          <div className="skin-showdown-track-header-side skin-showdown-track-header-side--left">{leftLabel}</div>
          <div className="skin-showdown-track-header-gap" />
          <div className="skin-showdown-track-header-side skin-showdown-track-header-side--right">{rightLabel}</div>
        </div>

        <div className="skin-showdown-track-score-row">
          <div className="skin-showdown-track-score skin-showdown-track-score--left">{leftPlayer.score}</div>
          <div className="skin-showdown-track-score-label">점수</div>
          <div className="skin-showdown-track-score skin-showdown-track-score--right">{rightPlayer.score}</div>
        </div>

        <div className="skin-showdown-street-lane">
          <div className="skin-showdown-street-spine" aria-hidden />

          {STAGES.map(({ stage, label }) => {
            const leftState = getRowState(stage, leftPlayer.stage);
            const rightState = getRowState(stage, rightPlayer.stage);
            const tagState =
              leftState === 'active' || rightState === 'active'
                ? 'active'
                : leftState === 'lit' && rightState === 'lit'
                  ? 'lit'
                  : 'dim';

            return (
              <div key={stage} className="skin-showdown-stage-row">
                <div className="skin-showdown-round-slot" aria-hidden>
                  <BulletBundle side="left" state={leftState} />
                </div>

                <div className={tagClass(tagState)}>
                  <span className="skin-showdown-tag-string" aria-hidden />
                  <span className="skin-showdown-tag-plate">{label}</span>
                </div>

                <div className="skin-showdown-round-slot" aria-hidden>
                  <BulletBundle side="right" state={rightState} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="skin-showdown-track-footer">
          <div className="skin-showdown-track-footer-side">
            {leftPlayer.remainingPoints !== null ? `${leftPlayer.remainingPoints}p` : `${leftPlayer.stage}단계`}
          </div>
          <div className="skin-showdown-track-footer-gap" />
          <div className="skin-showdown-track-footer-side">
            {rightPlayer.remainingPoints !== null ? `${rightPlayer.remainingPoints}p` : `${rightPlayer.stage}단계`}
          </div>
        </div>
      </div>
    </div>
  );
}
