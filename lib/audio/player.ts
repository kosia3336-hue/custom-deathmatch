import { CORE_SOUND_IDS, FILE_SOUND_BY_ID, type FileSoundId } from './catalog';
import { getSfxOutput, getSfxVolume, isSfxMuted, subscribeSfxSettings } from './settings';

let context: AudioContext | null = null;
let generation = 0;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
const active = new Set<() => void>();
const lastPlayed = new Map<FileSoundId, number>();
subscribeSfxSettings(() => { if (isSfxMuted() || getSfxVolume() === 0) stopFileAudio(); });

function getContext() {
  if (typeof window === 'undefined') return null;
  try { context ??= new AudioContext(); return context; } catch { return null; }
}

function load(audio: AudioContext, src: string) {
  let pending = buffers.get(src);
  if (!pending) {
    pending = fetch(src).then(response => {
      if (!response.ok) throw new Error('Audio unavailable');
      return response.arrayBuffer();
    }).then(raw => audio.decodeAudioData(raw)).catch(() => { buffers.delete(src); return null; });
    buffers.set(src, pending);
  }
  return pending;
}

/** Must be called by a pointer/key gesture. Only core samples are preloaded. */
export async function unlockFileAudio(ids: readonly FileSoundId[] = CORE_SOUND_IDS) {
  const audio = getContext();
  if (!audio) return;
  try {
    if (audio.state === 'suspended') await audio.resume();
    ids.forEach(id => { void load(audio, FILE_SOUND_BY_ID[id].src); });
  } catch { /* Autoplay restrictions cannot block input. */ }
}

export function stopFileAudio() {
  generation += 1;
  [...active].forEach(stop => stop());
  lastPlayed.clear();
}

/** Plays decoded assets through the shared live volume/mute output. No oscillators. */
export function playFileSound(id: FileSoundId, volume?: number) {
  if (typeof document === 'undefined' || document.hidden || isSfxMuted() || getSfxVolume() === 0) return;
  const audio = getContext();
  if (!audio) return;
  const sample = FILE_SOUND_BY_ID[id];
  const now = performance.now();
  if (now - (lastPlayed.get(id) ?? -Infinity) < 65) return;
  lastPlayed.set(id, now);
  const token = generation;
  void (async () => {
    try {
      if (audio.state === 'suspended') await audio.resume();
      const buffer = await load(audio, sample.src);
      if (!buffer || token !== generation || document.hidden || isSfxMuted() || getSfxVolume() === 0 || audio.state !== 'running' || performance.now() - now > 400) return;
      const source = audio.createBufferSource(), gain = audio.createGain();
      source.buffer = buffer;
      gain.gain.value = Math.max(0, Math.min(1, volume ?? sample.volume));
      source.connect(gain); gain.connect(getSfxOutput(audio));
      let done = false;
      const cleanup = () => { if (done) return; done = true; source.disconnect(); gain.disconnect(); active.delete(stop); };
      const stop = () => { try { source.stop(); } catch { /* Already ended. */ } cleanup(); };
      active.add(stop);
      source.onended = cleanup;
      source.start();
    } catch { /* Audio errors never prevent a move. */ }
  })();
}
