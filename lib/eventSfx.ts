/**
 * 인디언 홀덤 (이벤트) — Web Audio API 기반 SFX 유틸.
 * 파일 없이 프로그래밍 방식으로 소리를 생성한다.
 * 모든 함수는 브라우저 AudioContext 가 생성 가능한 환경에서만 동작한다.
 */

import { isSfxMuted, getSfxOutput } from '@/lib/sfxSettings';

type OscType = 'sine' | 'square' | 'sawtooth' | 'triangle';

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (isSfxMuted()) return null;
  try {
    if (!_ctx || _ctx.state === 'closed') {
      _ctx = new AudioContext();
    }
    if (_ctx.state === 'suspended') {
      void _ctx.resume();
    }
    return _ctx;
  } catch {
    return null;
  }
}

function tone(
  ctx: AudioContext,
  freq: number,
  endFreq: number,
  duration: number,
  volume: number,
  type: OscType = 'sine',
  startOffset = 0,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(getSfxOutput(ctx));
  osc.type = type;
  const t = ctx.currentTime + startOffset;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq !== freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + duration * 0.8);
  }
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.start(t);
  osc.stop(t + duration + 0.01);
}

// ── 개별 효과음 ────────────────────────────────────────────────────

/** 카드 딜 — 짧은 클릭 */
export function sfxDeal() {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 1200, 600, 0.06, 0.15, 'triangle');
}

/** 콜/체크 — 동전 */
export function sfxCall() {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 880, 440, 0.18, 0.2, 'sine');
  tone(ctx, 1100, 550, 0.12, 0.1, 'sine', 0.04);
}

/** 레이즈 — 묵직한 동전 */
export function sfxRaise() {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 660, 440, 0.22, 0.25, 'sine');
  tone(ctx, 990, 660, 0.18, 0.15, 'sine', 0.05);
  tone(ctx, 1320, 880, 0.15, 0.1, 'sine', 0.09);
}

/** 다이 — 하강 음 */
export function sfxDie() {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 400, 180, 0.35, 0.25, 'sawtooth');
  tone(ctx, 300, 120, 0.3, 0.15, 'sine', 0.08);
}

/** 더블 패널티 — 경고음 2회 */
export function sfxPenaltyDouble() {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 440, 440, 0.12, 0.3, 'square');
  tone(ctx, 440, 440, 0.12, 0.3, 'square', 0.18);
}

/** 스트레이트/트리플 패널티 — 강한 낮은 경고음 */
export function sfxPenaltyHeavy() {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 220, 180, 0.4, 0.4, 'sawtooth');
  tone(ctx, 330, 220, 0.35, 0.25, 'sawtooth', 0.1);
  tone(ctx, 220, 180, 0.4, 0.3, 'square', 0.22);
}

/** 승리 — 상승 멜로디 3음 */
export function sfxWin() {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 523, 523, 0.15, 0.3, 'sine');          // C5
  tone(ctx, 659, 659, 0.15, 0.3, 'sine', 0.14);    // E5
  tone(ctx, 784, 784, 0.25, 0.35, 'sine', 0.28);   // G5
  tone(ctx, 1047, 1047, 0.3, 0.4, 'sine', 0.42);  // C6
}

/** 패배/이월 — 하강 */
export function sfxLose() {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 392, 262, 0.3, 0.25, 'sine');           // G4 → C4
  tone(ctx, 330, 220, 0.28, 0.2, 'sine', 0.12);    // E4 → A3
  tone(ctx, 262, 196, 0.4, 0.3, 'sine', 0.24);     // C4 → G3
}

/** 무승부/이월 */
export function sfxDraw() {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 440, 440, 0.2, 0.2, 'sine');
  tone(ctx, 440, 380, 0.25, 0.15, 'sine', 0.22);
}

/** 내 차례 알림 — 짧은 핑 */
export function sfxMyTurn() {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 880, 1100, 0.12, 0.2, 'sine');
  tone(ctx, 1100, 1320, 0.12, 0.15, 'sine', 0.1);
}

// ── 핸드 결과 자동 선택 ────────────────────────────────────────────
import type { IPEHandResult } from '@/shared/types';
import { IPE_DIE_PENALTY } from '@/shared/types';

export function sfxHandResult(result: IPEHandResult, mySeatIdx: number | null) {
  const myEntry = mySeatIdx !== null
    ? result.entries.find((e) => e.seatIdx === mySeatIdx)
    : null;

  // 패널티 소리 (다이한 경우)
  if (myEntry?.isDie && myEntry.hand) {
    const penalty = IPE_DIE_PENALTY[myEntry.hand];
    if (penalty >= 10) {
      sfxPenaltyHeavy();
      return;
    }
    if (penalty >= 5) {
      sfxPenaltyDouble();
      return;
    }
  }

  if (result.winnerIds.length === 0) {
    sfxDraw();
    return;
  }

  if (myEntry?.isWinner) {
    sfxWin();
  } else {
    sfxLose();
  }
}
