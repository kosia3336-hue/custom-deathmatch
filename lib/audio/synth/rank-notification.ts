/**
 * 랭크 매칭 성사 알림음.
 *
 * 매칭은 탭이 뒤에 있을 때 잡히는 경우가 많다(다른 탭을 보거나 폰을 잠깐 내려둔 사이).
 * 화면 안의 오버레이만으로는 놓치기 쉬워서 소리로도 알린다.
 *
 * 브라우저 알림 권한은 요청하지 않는다 — 효과음 설정이 켜져 있으면 울리고,
 * 꺼져 있으면 울리지 않는다. 다른 효과음들과 같은 규칙을 따른다(lib/audio/settings).
 */

import { isSfxMuted, getSfxOutput } from '@/lib/audio/settings';

/** 매칭 성사 알림음. 효과음이 꺼져 있으면 아무것도 하지 않는다. */
export function notifyRankMatched(): void {
  if (isSfxMuted()) return;
  playChime();
}

/**
 * 짧은 상승음(솔 → 도). 오디오 파일을 하나 더 받게 하지 않으려고 WebAudio 로 만든다.
 * 탭이 백그라운드면 브라우저가 오디오를 막을 수 있는데, 그때는 조용히 실패한다.
 */
function playChime(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    const now = ctx.currentTime;
    [
      { freq: 784, at: 0, dur: 0.16 },
      { freq: 1047, at: 0.15, dur: 0.28 },
    ].forEach(({ freq, at, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.25, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
      osc.connect(gain).connect(getSfxOutput(ctx));
      osc.start(now + at);
      osc.stop(now + at + dur);
    });

    setTimeout(() => void ctx.close().catch(() => {}), 800);
  } catch {
    /* 오디오 정책으로 막히면 무시 */
  }
}
