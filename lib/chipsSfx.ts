/**
 * 칩 소리 — 라운드가 끝나 팟이 넘어갈 때 한 번 울린다.
 *
 * 다른 SFX 와 달리 합성하지 않고 실제 녹음 파일을 쓴다. 칩이 촤르르 쏟아지는
 * 소리는 노이즈와 임펄스를 겹쳐 흉내 내면 '쉭' 하는 바람 소리에 가까워져,
 * 칩이라는 느낌이 나지 않는다.
 *
 * 음원: public/audio/sfx/chips-collect.ogg
 *   Kenney Casino Audio (kenney.nl) · CC0. 출처는 public/audio/sfx/CREDITS.md.
 *
 * 공통 SFX 출력단(getSfxOutput)을 거치므로 소리 설정의 음량·음소거를 그대로 따른다.
 */
import { getSfxOutput, isSfxMuted } from '@/lib/sfxSettings';

const CHIPS_SRC = '/audio/sfx/chips-collect.ogg';

let ctx: AudioContext | null = null;
let buffer: Promise<AudioBuffer | null> | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (isSfxMuted()) return null;
  try {
    if (!ctx || ctx.state === 'closed') ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function load(c: AudioContext): Promise<AudioBuffer | null> {
  if (buffer) return buffer;
  buffer = fetch(CHIPS_SRC)
    .then((response) =>
      response.ok ? response.arrayBuffer() : Promise.reject(new Error(String(response.status))),
    )
    .then((raw) => c.decodeAudioData(raw))
    .catch(() => {
      buffer = null; // 실패하면 다음에 다시 받아 본다
      return null;
    });
  return buffer;
}

/** 라운드 종료 칩 소리. 소리가 없거나 오디오를 못 쓰는 환경에서도 게임은 그대로 진행된다. */
export function playChipsSfx(volume = 0.55) {
  try {
    const c = getCtx();
    if (!c) return;
    void load(c).then((decoded) => {
      if (!decoded) return;
      const source = c.createBufferSource();
      source.buffer = decoded;
      const gain = c.createGain();
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(getSfxOutput(c));
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
      source.start();
    });
  } catch {
    /* 오디오를 지원하지 않는 환경에서는 조용히 넘어간다 */
  }
}
