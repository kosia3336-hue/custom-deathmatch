/**
 * 인디언홀덤Q 스킨 — Web Audio SFX (파일 없음).
 * eventSfx 패턴 재사용. 스킨 OFF 시 호출하지 않는다.
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
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + duration * 0.85);
  }
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

/** 카드 스냅 — 촤락 */
export function sfxDealSnap(variant: 'normal' | 'forehead' = 'normal') {
  const ctx = getCtx();
  if (!ctx) return;
  const base = variant === 'forehead' ? 980 : 1100;
  tone(ctx, base, base * 0.55, 0.055, 0.18, 'triangle');
}

/** 연속 딜 — prepMs 후 stepMs 간격, SFX는 장 등장 직후 약간 늦게 */
export function sfxDealSequence(count: number, stepMs: number, prepMs = 0): number[] {
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(
      window.setTimeout(
        () => sfxDealSnap(i === count - 1 ? 'forehead' : 'normal'),
        prepMs + (i + 1) * stepMs + 35,
      ),
    );
  }
  return ids;
}

/** 무월 — 은청 톤 베팅 SFX */
export function sfxNocturneCall() {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 920, 520, 0.16, 0.15, 'sine');
}

export function sfxNocturneRaise() {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 720, 1040, 0.2, 0.18, 'sine');
  tone(ctx, 1040, 1380, 0.14, 0.11, 'sine', 0.06);
}

export function sfxNocturneDie() {
  const ctx = getCtx();
  if (!ctx) return;
  tone(ctx, 340, 140, 0.32, 0.18, 'sawtooth');
}
