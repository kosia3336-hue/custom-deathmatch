'use client';

import { useEffect, useRef, useState } from 'react';
import { FILE_SOUNDS, type FileSound } from '@/lib/audio/catalog';
import { getSfxVolume, isSfxMuted, subscribeSfxSettings } from '@/lib/audio/settings';
import { SoundSettings } from './SoundSettings';

const GROUPS = [
  ['cards', '카드'], ['chips', '칩'], ['match', '카운터 매치'], ['ui', '알림'], ['board', '보드'], ['skins', '스킨'],
] as const;

export function SoundLibrary() {
  const [group, setGroup] = useState<string>('cards');
  const elements = useRef(new Map<string, HTMLAudioElement>());
  const active = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const update = () => {
      FILE_SOUNDS.forEach(sound => {
        const audio = elements.current.get(sound.id);
        if (audio) audio.volume = isSfxMuted() ? 0 : sound.volume * getSfxVolume();
      });
    };
    update();
    const unsubscribe = subscribeSfxSettings(update);
    const hide = () => { if (document.hidden) active.current?.pause(); };
    document.addEventListener('visibilitychange', hide);
    return () => { unsubscribe(); document.removeEventListener('visibilitychange', hide); active.current?.pause(); };
  }, [group]);

  function play(audio: HTMLAudioElement, sound: FileSound) {
    if (active.current && active.current !== audio) { active.current.pause(); active.current.currentTime = 0; }
    active.current = audio;
    audio.volume = isSfxMuted() ? 0 : sound.volume * getSfxVolume();
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-cdm-fg sm:py-12">
      <a href="/lobby" className="text-sm font-semibold text-cdm-primary">← 로비</a>
      <h1 className="mt-7 text-3xl font-black">소리 모음</h1>
      <p className="mt-2 text-sm leading-6 text-cdm-fg-muted">카드, 칩, 매치와 스킨에서 사용하는 {FILE_SOUNDS.length}개 파일 음원입니다. 하나씩 재생해 비교해 보세요.</p>
      <div className="mt-6 max-w-lg rounded-cdm-lg border border-cdm-border p-4"><SoundSettings /></div>
      <nav aria-label="효과음 종류" className="mt-7 flex flex-wrap gap-2">
        {GROUPS.map(([id, name]) => <button key={id} type="button" aria-pressed={group === id} onClick={() => { active.current?.pause(); setGroup(id); }} className={`min-h-11 rounded-cdm-md border px-4 text-sm font-bold ${group === id ? 'border-cdm-primary bg-cdm-primary-soft text-cdm-primary' : 'border-cdm-border bg-cdm-bg text-cdm-fg-muted'}`}>{name} {FILE_SOUNDS.filter(sound => sound.category === id).length}</button>)}
      </nav>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {FILE_SOUNDS.filter(sound => sound.category === group).map(sound => (
          <article key={sound.id} className="min-w-0 rounded-cdm-lg border border-cdm-border bg-cdm-bg-elev-1 p-4">
            <div className="flex items-center justify-between gap-3"><h2 className="text-base font-extrabold">{sound.name}</h2><span className="text-xs font-bold text-cdm-fg-muted">{sound.src.split('.').pop()?.toUpperCase()}</span></div>
            <p className="mt-1 text-sm text-cdm-fg-muted">{sound.detail}</p>
            <audio ref={element => { if (element) elements.current.set(sound.id, element); else elements.current.delete(sound.id); }} src={sound.src} controls preload="none" aria-label={`${sound.name} 미리 듣기`} onPlay={event => play(event.currentTarget, sound)} className="mt-4 h-10 w-full" />
            <p className="mt-3 truncate font-mono text-[11px] text-cdm-fg-subtle" title={sound.src}>{sound.src}</p>
            {sound.sourceUrl && <a href={sound.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-cdm-primary underline">Kenney · {sound.license}</a>}
          </article>
        ))}
      </div>
      <p className="mt-6 text-xs leading-5 text-cdm-fg-muted">스킨·이벤트 전용 합성음은 lib/audio/synth와 lib/audio/skins에서 관리합니다. 기존 음원의 출처 기록은 public/audio/sfx/CREDITS.md에 있습니다.</p>
      <a href="https://dreamshop.choen.kr/sounds" target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-bold text-cdm-primary underline">드림샵 게임 소리 모음 ↗</a>
    </main>
  );
}
