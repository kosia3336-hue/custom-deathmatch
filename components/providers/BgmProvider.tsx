'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';
import type { Json } from '@/lib/supabase/database.types';

const LS_MUTED = 'bgm-muted';
const LS_VOLUME = 'bgm-volume';

const DEFAULT_VOLUME = 0.3;
const MIN_AUDIBLE_VOLUME = 0.05;
const SAVE_DEBOUNCE_MS = 400;

interface BgmContextValue {
  ready: boolean;
  hasTracks: boolean;
  muted: boolean;
  volume: number;
  toggle: () => void;
  setMuted: (next: boolean) => void;
  setVolume: (next: number) => void;
}

const BgmContext = createContext<BgmContextValue | null>(null);

export function useBgm(): BgmContextValue {
  const ctx = useContext(BgmContext);
  if (!ctx) {
    return {
      ready: false,
      hasTracks: false,
      muted: false,
      volume: DEFAULT_VOLUME,
      toggle: () => {},
      setMuted: () => {},
      setVolume: () => {},
    };
  }
  return ctx;
}

interface InitialSettings {
  bgmMuted?: boolean;
  bgmVolume?: number;
}

interface Props {
  children: React.ReactNode;
  isLoggedIn: boolean;
  initial?: InitialSettings;
}

function readLocalBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === 'true';
}

function readLocalNumber(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return fallback;
  const v = Number(raw);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(1, Math.max(0, v));
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function BgmProvider({ children, isLoggedIn, initial }: Props) {
  const [tracks, setTracks] = useState<string[]>([]);
  const [muted, setMutedState] = useState<boolean>(() =>
    initial?.bgmMuted ?? readLocalBoolean(LS_MUTED, false),
  );
  const [volume, setVolumeState] = useState<number>(() => {
    const v = initial?.bgmVolume;
    if (typeof v === 'number' && Number.isFinite(v)) {
      return Math.min(1, Math.max(0, v));
    }
    return readLocalNumber(LS_VOLUME, DEFAULT_VOLUME);
  });
  const [ready, setReady] = useState(false);

  // refs — Audio 생성 effect 의존성에 넣지 않고 최신값 유지
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(muted);
  const volumeRef = useRef(volume);
  const queueRef = useRef<string[]>([]);
  const queueIdxRef = useRef(0);
  const lastTrackRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSettingsRef = useRef<{ bgmMuted?: boolean; bgmVolume?: number }>({});
  // advance 를 ref 로 — Audio 생성 effect 가 advance 에 의존하지 않도록
  const advanceRef = useRef<() => void>(() => {});

  // mutedRef / volumeRef 항상 최신 유지
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  // ── 트랙 목록 로드 ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch('/api/bgm/tracks', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { tracks?: string[] }) => {
        if (cancelled) return;
        setTracks(Array.isArray(data.tracks) ? data.tracks : []);
      })
      .catch(() => { if (!cancelled) setTracks([]); });
    return () => { cancelled = true; };
  }, []);

  // ── 셔플 큐 빌드 ────────────────────────────────────────────────────
  const buildQueue = useCallback((srcs: string[]) => {
    if (srcs.length <= 1) {
      queueRef.current = srcs.slice();
      queueIdxRef.current = 0;
      return;
    }
    let q = shuffle(srcs);
    if (lastTrackRef.current && q[0] === lastTrackRef.current) {
      q = shuffle(srcs);
      if (q[0] === lastTrackRef.current && q.length > 1) {
        [q[0], q[1]] = [q[1], q[0]];
      }
    }
    queueRef.current = q;
    queueIdxRef.current = 0;
  }, []);

  // ── Audio 인스턴스 1회 생성 (의존성 최소화) ──────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (audioRef.current) return;
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.loop = false;
    audio.volume = mutedRef.current ? 0 : volumeRef.current;
    // ended/error 는 ref 를 통해 호출 → advance 가 바뀌어도 리스너 교체 불필요
    audio.addEventListener('ended', () => advanceRef.current());
    audio.addEventListener('error', () => setTimeout(() => advanceRef.current(), 200));
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── advance — 다음 트랙으로 이동 (tracks 변해도 Audio 재생성 X) ───────
  const advance = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || queueRef.current.length === 0) return;
    queueIdxRef.current += 1;
    if (queueIdxRef.current >= queueRef.current.length) {
      buildQueue(tracks);
    }
    const next = queueRef.current[queueIdxRef.current];
    if (!next) return;
    lastTrackRef.current = next;
    audio.src = next;
    audio.load();
    audio.play().catch(() => {});
  }, [tracks, buildQueue]);

  // advanceRef 항상 최신 유지
  useEffect(() => { advanceRef.current = advance; }, [advance]);

  // ── 트랙 로드 시 큐 초기화 + src 세팅 ────────────────────────────────
  useEffect(() => {
    if (tracks.length === 0) return;
    if (queueRef.current.length === 0) {
      buildQueue(tracks);
      const audio = audioRef.current;
      const first = queueRef.current[0];
      if (audio && first && !audio.src) {
        audio.src = first;
        lastTrackRef.current = first;
      }
    }
  }, [tracks, buildQueue]);

  // ── 볼륨/뮤트 → audio.volume 에 즉시 반영 (Audio 재생성 없음) ─────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
  }, [muted, volume]);

  // ── 첫 인터랙션 후 재생 시작 ──────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (ready) return;
    if (tracks.length === 0) return;

    const tryStart = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (mutedRef.current) {
        setReady(true);
        return;
      }
      if (!audio.src && queueRef.current[0]) {
        audio.src = queueRef.current[0];
        lastTrackRef.current = queueRef.current[0];
      }
      audio.play()
        .then(() => setReady(true))
        .catch(() => {});
    };

    tryStart();

    const onInteract = () => tryStart();
    window.addEventListener('pointerdown', onInteract, { once: false });
    window.addEventListener('keydown', onInteract, { once: false });
    return () => {
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('keydown', onInteract);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.length, ready]);

  // ── 뮤트 토글 시 재생/일시정지 ──────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (muted) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }, [muted, ready]);

  // ── 설정 저장 (localStorage + DB debounce) ────────────────────────
  const persist = useCallback(
    (patch: { bgmMuted?: boolean; bgmVolume?: number }) => {
      try {
        if (typeof window !== 'undefined') {
          if (patch.bgmMuted !== undefined)
            window.localStorage.setItem(LS_MUTED, String(patch.bgmMuted));
          if (patch.bgmVolume !== undefined)
            window.localStorage.setItem(LS_VOLUME, patch.bgmVolume.toFixed(2));
        }
      } catch {
        // localStorage 불가 환경 무시
      }
      if (!isLoggedIn) return;
      pendingSettingsRef.current = { ...pendingSettingsRef.current, ...patch };
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const supabase = getBrowserSupabase();
        const rpcPatch = pendingSettingsRef.current;
        pendingSettingsRef.current = {};
        callRpc(supabase, 'update_member_settings', {
          p_patch: rpcPatch as Json,
        }).catch(() => {});
      }, SAVE_DEBOUNCE_MS);
    },
    [isLoggedIn],
  );

  /*
    음소거를 풀 때 음량이 사실상 0 이면 기본 음량으로 되돌린다. 슬라이더를 0 까지
    내렸다가 상단 소리 버튼으로 켜면 '켜졌는데 안 들리는' 상태가 되기 때문이다.
    효과음 쪽(lib/sfxSettings.ts)도 같은 규칙을 따른다.
  */
  const setMuted = useCallback(
    (next: boolean) => {
      setMutedState(next);
      if (!next && volumeRef.current < MIN_AUDIBLE_VOLUME) {
        setVolumeState(DEFAULT_VOLUME);
        persist({ bgmMuted: next, bgmVolume: DEFAULT_VOLUME });
        return;
      }
      persist({ bgmMuted: next });
    },
    [persist],
  );

  const setVolume = useCallback(
    (next: number) => {
      const v = Math.min(1, Math.max(0, next));
      setVolumeState(v);
      persist({ bgmVolume: v });
    },
    [persist],
  );

  const toggle = useCallback(() => setMuted(!muted), [muted, setMuted]);

  const value = useMemo<BgmContextValue>(
    () => ({ ready, hasTracks: tracks.length > 0, muted, volume, toggle, setMuted, setVolume }),
    [ready, tracks.length, muted, volume, toggle, setMuted, setVolume],
  );

  return <BgmContext.Provider value={value}>{children}</BgmContext.Provider>;
}
