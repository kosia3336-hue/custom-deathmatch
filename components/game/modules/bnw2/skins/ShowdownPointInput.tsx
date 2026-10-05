'use client';

import { useState } from 'react';
import { getSocket } from '@/lib/socket';
import { playShowdownSubmitSfx, unlockShowdownAudio } from '@/lib/audio/skins/showdown';
import { useShowdownReel } from './useShowdownReel';

interface Props {
  remaining: number;
  actionType: 'submitFirst' | 'submitSecond';
  label: string;
}

export default function ShowdownPointInput({ remaining, actionType, label }: Props) {
  const [value, setValue] = useState(0);
  const { display, spinning, tickDir, tickKey, spinTo } = useShowdownReel(value, remaining, setValue);

  const spinToWrapped = (target: number) => {
    unlockShowdownAudio();
    spinTo(target);
  };

  const handleSubmit = () => {
    if (spinning) return;
    unlockShowdownAudio();
    playShowdownSubmitSfx();
    getSocket().emit('game:action', { type: actionType, points: display });
  };

  if (remaining === 0) {
    return (
      <div className="skin-showdown-input skin-showdown-input--panel">
        <p className="skin-showdown-input-label">{label}</p>
        <p className="skin-showdown-input-remaining">잔여 포인트가 없습니다. 0을 제시합니다.</p>
        <button type="button" className="skin-showdown-draw-btn" onClick={handleSubmit} disabled={spinning}>
          0 제시
        </button>
      </div>
    );
  }

  const prev = Math.max(0, display - 1);
  const next = Math.min(remaining, display + 1);

  const reelClass = [
    'skin-showdown-reel-column',
    tickDir === 'up' ? 'skin-showdown-reel-column--tick-up' : '',
    tickDir === 'down' ? 'skin-showdown-reel-column--tick-down' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="skin-showdown-input skin-showdown-input--panel">
      <p className="skin-showdown-input-label">{label}</p>
      <p className="skin-showdown-input-remaining">
        잔여 포인트: <strong>{remaining}</strong>
      </p>

      <div className="skin-showdown-quick-row">
        {([-10, -5, 5, 10] as const).map((delta) => (
          <button
            key={delta}
            type="button"
            className="skin-showdown-chip"
            disabled={spinning}
            onClick={() => spinToWrapped(display + delta)}
          >
            {delta > 0 ? `+${delta}` : delta}
          </button>
        ))}
      </div>

      <div className="skin-showdown-scope-wrap">
        <button
          type="button"
          className="skin-showdown-scope-btn"
          disabled={spinning || display <= 0}
          onClick={() => spinToWrapped(display - 1)}
          aria-label="1 감소"
        >
          −
        </button>

        <div className="skin-showdown-scope">
          <div className="skin-showdown-scope-ring" aria-hidden />
          <div className="skin-showdown-scope-cross-h" aria-hidden />
          <div className="skin-showdown-scope-cross-v" aria-hidden />
          <span className="skin-showdown-scope-notch skin-showdown-scope-notch--tl" aria-hidden />
          <span className="skin-showdown-scope-notch skin-showdown-scope-notch--tr" aria-hidden />
          <span className="skin-showdown-scope-notch skin-showdown-scope-notch--bl" aria-hidden />
          <span className="skin-showdown-scope-notch skin-showdown-scope-notch--br" aria-hidden />

          <div className="skin-showdown-reel-window">
            <div key={tickKey} className={reelClass}>
              <span className="skin-showdown-reel-num" aria-hidden={display <= 0}>
                {display > 0 ? prev : ''}
              </span>
              <span className="skin-showdown-reel-num skin-showdown-reel-num--current">{display}</span>
              <span className="skin-showdown-reel-num" aria-hidden={display >= remaining}>
                {display < remaining ? next : ''}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="skin-showdown-scope-btn"
          disabled={spinning || display >= remaining}
          onClick={() => spinToWrapped(display + 1)}
          aria-label="1 증가"
        >
          +
        </button>
      </div>

      <button type="button" className="skin-showdown-draw-btn" onClick={handleSubmit} disabled={spinning}>
        {display}포인트 제시
      </button>
    </div>
  );
}
