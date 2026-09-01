import { isSfxMuted } from '@/lib/sfxSettings';

const MOVE_SOUND_PATH = '/audio/sfx/abstract-strategy-move.mp3';
const MOVE_SOUND_VOLUME = 0.55;

let moveSound: HTMLAudioElement | null = null;

/** 추상전략 보드에서 서버가 확정한 말 놓기·이동에 사용하는 공용 효과음. */
export function playAbstractStrategyMoveSfx(): void {
  if (typeof window === 'undefined' || isSfxMuted()) return;

  try {
    if (!moveSound) {
      moveSound = new Audio(MOVE_SOUND_PATH);
      moveSound.preload = 'auto';
      moveSound.volume = MOVE_SOUND_VOLUME;
    }

    moveSound.pause();
    moveSound.currentTime = 0;
    void moveSound.play().catch(() => {
      // 브라우저 자동 재생 정책 등으로 재생할 수 없으면 게임 진행은 그대로 유지한다.
    });
  } catch {
    // 오디오를 지원하지 않는 환경에서는 게임 진행만 유지한다.
  }
}
