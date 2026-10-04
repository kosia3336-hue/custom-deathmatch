import { isSfxMuted, getSfxOutput } from '@/lib/audio/settings';

export function playSlashSound() {
  if (isSfxMuted()) return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    /* 슬래시 whoosh — 고주파 잡음 → 저주파 감쇠 */
    const bufLen = Math.floor(ctx.sampleRate * 0.18);
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 1.5);
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(3200, ctx.currentTime);
    bpf.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.16);
    bpf.Q.value = 0.9;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    /* 짧은 금속음 */
    const osc     = ctx.createOscillator();
    osc.type      = 'sine';
    osc.frequency.setValueAtTime(900, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.12);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.12, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    src.connect(bpf); bpf.connect(gain); gain.connect(getSfxOutput(ctx));
    osc.connect(oscGain); oscGain.connect(getSfxOutput(ctx));

    src.start(); src.stop(ctx.currentTime + 0.18);
    osc.start(); osc.stop(ctx.currentTime + 0.12);

    setTimeout(() => ctx.close(), 600);
  } catch {
    /* 오디오 미지원 환경에서는 무시 */
  }
}

