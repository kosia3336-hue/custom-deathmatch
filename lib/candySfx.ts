/**
 * 유리설탕(candy) 스킨 효과음 — 잼 병 뚜껑 '뽁' (public/audio/skins/candy/button.mp3)
 *
 * 'sfx-muted' localStorage 키(효과음 전역 토글)를 존중한다.
 */

let ctx: AudioContext | null = null;
let bufferPromise: Promise<AudioBuffer | null> | null = null;

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

function loadBuffer(c: AudioContext): Promise<AudioBuffer | null> {
  if (bufferPromise) return bufferPromise;
  bufferPromise = fetch('/audio/skins/candy/button.mp3')
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
    .then((buf) => c.decodeAudioData(buf))
    .catch(() => {
      bufferPromise = null; // 실패 시 재시도 가능하게
      return null;
    });
  return bufferPromise;
}

/** 유리설탕 스킨 버튼 클릭음 재생 */
export function playCandyButtonSfx() {
  try {
    const c = getCtx();
    if (!c) return;
    void loadBuffer(c).then((buf) => {
      if (!buf) return;
      const src = c.createBufferSource();
      src.buffer = buf;
      const gain = c.createGain();
      gain.gain.value = 0.5;
      src.connect(gain);
      gain.connect(c.destination);
      src.start();
    });
  } catch {}
}
