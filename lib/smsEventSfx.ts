/**
 * 해달별 (이벤트) — Web Audio API SFX
 */

import { isSfxMuted, getSfxOutput } from '@/lib/sfxSettings';

type OscType = 'sine' | 'square' | 'sawtooth' | 'triangle';

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (isSfxMuted()) return null;
  try {
    if (!_ctx || _ctx.state === 'closed') _ctx = new AudioContext();
    if (_ctx.state === 'suspended') void _ctx.resume();
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
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + duration * 0.85);
  }
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

/** 선택 확정 */
export function sfxSmsPick() {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 520, 780, 0.1, 0.18, 'sine');
}

/** 공개 스텝 */
export function sfxSmsReveal() {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 640, 960, 0.09, 0.14, 'triangle');
}

/** 불빛 점등 */
export function sfxSmsLit() {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 440, 880, 0.2, 0.22, 'sine');
  tone(ctx, 660, 1320, 0.28, 0.18, 'sine', 0.08);
  tone(ctx, 880, 1760, 0.35, 0.14, 'triangle', 0.18);
}

/** 무효 판 */
export function sfxSmsVoid() {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 330, 220, 0.35, 0.2, 'sawtooth');
  tone(ctx, 220, 165, 0.3, 0.15, 'sine', 0.12);
}

/** 점수 획득 */
export function sfxSmsScore(roundScore: 1 | 3) {
  const ctx = getCtx();
  if (!ctx) return;
  if (roundScore === 3) {
    tone(ctx, 523, 784, 0.15, 0.25, 'sine');
    tone(ctx, 659, 988, 0.2, 0.22, 'sine', 0.12);
    tone(ctx, 784, 1175, 0.25, 0.2, 'sine', 0.24);
  } else {
    tone(ctx, 587, 880, 0.18, 0.2, 'sine');
  }
}

/** 감점 (-1) */
export function sfxSmsPenalty() {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 350, 180, 0.22, 0.2, 'sawtooth');
  tone(ctx, 260, 130, 0.18, 0.14, 'sine', 0.08);
}

/** 시간 초과 강퇴 */
export function sfxSmsTimeout() {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 380, 200, 0.28, 0.22, 'square');
  tone(ctx, 280, 140, 0.25, 0.16, 'sawtooth', 0.1);
}
