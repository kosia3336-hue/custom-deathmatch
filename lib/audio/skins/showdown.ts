import { playFileSound, unlockFileAudio } from '../player';
import { getSfxOutput } from '@/lib/audio/settings';
let ctx: AudioContext | null = null;
const MASTER = 2.4;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx || ctx.state === 'closed') ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** 도르래 한 칸 — 짧은 기계음 */
export function playShowdownReelTick(stepIndex: number, totalSteps: number) {
  try {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const t = totalSteps <= 1 ? 0 : stepIndex / Math.max(totalSteps - 1, 1);
    const freq = 480 + t * 420 + Math.min(totalSteps, 12) * 10;

    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 0.032);

    const vol = (totalSteps >= 8 ? 0.38 : totalSteps >= 3 ? 0.32 : 0.26) * MASTER;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(getSfxOutput(c));
    osc.start(now);
    osc.stop(now + 0.055);

    const bufLen = Math.ceil(c.sampleRate * 0.03);
    const buf = c.createBuffer(1, bufLen, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 800 + t * 700;
    bp.Q.value = 0.9;
    const nGain = c.createGain();
    nGain.gain.setValueAtTime((totalSteps >= 4 ? 0.22 : 0.14) * MASTER, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    src.connect(bp);
    bp.connect(nGain);
    nGain.connect(getSfxOutput(c));
    src.start(now);
    src.stop(now + 0.03);
  } catch {
    /* ignore */
  }
}

/** 큰 점프 시작 — 촤라락 */
export function playShowdownReelWhoosh(steps: number) {
  if (steps < 3) return;
  try {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const dur = Math.min(0.1 + steps * 0.022, 0.42);

    const bufLen = Math.ceil(c.sampleRate * dur);
    const buf = c.createBuffer(1, bufLen, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2600, now);
    bp.frequency.exponentialRampToValueAtTime(380, now + dur);
    bp.Q.value = 0.7;

    const g = c.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.42 * MASTER, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(bp);
    bp.connect(g);
    g.connect(getSfxOutput(c));
    src.start(now);
    src.stop(now + dur);
  } catch {
    /* ignore */
  }
}

/** File gunshot and synthesized reel motion share the global output settings. */
export function playShowdownSubmitSfx() { playFileSound('showdownGunshot'); }

export function unlockShowdownAudio() {
  getCtx();
  void unlockFileAudio(['showdownGunshot']);
}
