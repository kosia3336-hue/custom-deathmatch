import { getSfxOutput } from '@/lib/sfxSettings';
/**
 * 유리설탕(candy) 스킨 효과음.
 *   button — 잼 병 뚜껑 여는 '뽁' (설탕 +/MAX 버튼)
 *   card   — 유리잔 부딪힘 (카드 선택 버튼)
 *   minus  — 잼 병 뚜껑 닫는 소리 (설탕 -5/-1 버튼)
 *
 * 'sfx-muted' localStorage 키(효과음 전역 토글)를 존중한다.
 */

type CandySound = 'button' | 'card' | 'minus';

const SOUND_FILES: Record<CandySound, string> = {
  button: '/audio/skins/candy/button.mp3',
  card: '/audio/skins/candy/card.mp3',
  minus: '/audio/skins/candy/minus.mp3',
};

let ctx: AudioContext | null = null;
const buffers = new Map<CandySound, Promise<AudioBuffer | null>>();

function sfxMuted(): boolean {
  try {
    return window.localStorage.getItem('sfx-muted') === '1';
  } catch {
    return false;
  }
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (sfxMuted()) return null;
  try {
    if (!ctx || ctx.state === 'closed') ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function loadBuffer(c: AudioContext, sound: CandySound): Promise<AudioBuffer | null> {
  const cached = buffers.get(sound);
  if (cached) return cached;
  const p = fetch(SOUND_FILES[sound])
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
    .then((buf) => c.decodeAudioData(buf))
    .catch(() => {
      buffers.delete(sound); // 실패 시 재시도 가능하게
      return null;
    });
  buffers.set(sound, p);
  return p;
}

function playCandySfx(sound: CandySound, volume = 0.5) {
  try {
    const c = getCtx();
    if (!c) return;
    void loadBuffer(c, sound).then((buf) => {
      if (!buf) return;
      const src = c.createBufferSource();
      src.buffer = buf;
      const gain = c.createGain();
      gain.gain.value = volume;
      src.connect(gain);
      gain.connect(getSfxOutput(c));
      src.start();
    });
  } catch {}
}

/** 설탕 +/MAX/제출 버튼 — 잼 병 '뽁' */
export function playCandyButtonSfx() {
  playCandySfx('button');
}

/** 카드 선택 버튼 — 유리잔 부딪힘 */
export function playCandyCardSfx() {
  playCandySfx('card', 0.55);
}

/** 설탕 -5/-1 버튼 — 잼 병 닫는 소리 */
export function playCandyMinusSfx() {
  playCandySfx('minus');
}
