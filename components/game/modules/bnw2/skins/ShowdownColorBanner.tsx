'use client';

import type { BNW2Color } from '@/shared/types/bnw2';

interface Props {
  color: BNW2Color;
  firstNick: string;
  stageBefore?: number | null;
  stageAfter?: number | null;
}

/**
 * 선플이 제시한 색을 현상금 포스터에 박힌 총알 자국으로 표현한다.
 * 정확한 포인트는 비공개, 총알 자국의 색(검정=흑 / 흰색=백)으로만 구분한다.
 */
export default function ShowdownColorBanner({ color, firstNick, stageBefore, stageAfter }: Props) {
  const isBlack = color === 'black';
  const stagesConsumed =
    stageBefore != null && stageAfter != null ? stageBefore - Math.max(stageAfter, 1) : null;

  return (
    <div className="skin-showdown-wanted">
      <div className="skin-showdown-wanted-poster" aria-hidden>
        <div className="skin-showdown-wanted-title">WANTED</div>
        <div className="skin-showdown-wanted-photo">
          <span
            className={`skin-showdown-bullet-hole skin-showdown-bullet-hole--${isBlack ? 'black' : 'white'}`}
          />
        </div>
        <div className="skin-showdown-wanted-sub">DEAD&nbsp;OR&nbsp;ALIVE</div>
      </div>
      <div className="skin-showdown-wanted-info">
        <p className="skin-showdown-wanted-nick">{firstNick}</p>
        <p className="skin-showdown-wanted-msg">
          <span
            className={`skin-showdown-wanted-chip skin-showdown-wanted-chip--${isBlack ? 'black' : 'white'}`}
          >
            {isBlack ? '■ 흑' : '□ 백'}
          </span>
          <span>을 제출했습니다</span>
        </p>
        {stagesConsumed != null && (
          <p className="skin-showdown-wanted-stage">
            {stagesConsumed > 0 ? `불이 ${stagesConsumed}칸 꺼집니다.` : '불이 꺼지지 않습니다.'}
          </p>
        )}
      </div>
    </div>
  );
}
