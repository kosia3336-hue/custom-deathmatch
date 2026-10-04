'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/cdm/Modal';
import { Button } from '@/components/cdm/Button';
import { PackArtwork } from './PackArtwork';
import {
  devPackSlots,
  rollDevPackPair,
  type DevPackGrade,
  type DevPackId,
  type DevPackReward,
} from '@/lib/shop/dev-pack';
import './pack-anim.css';

const GRADE_CLASS: Record<DevPackGrade, string> = {
  S: 'border-amber-300 bg-amber-300/15',
  A: 'border-violet-300 bg-violet-300/15',
  B: 'border-sky-300 bg-sky-300/15',
  C: 'border-cdm-border bg-cdm-bg-elev-1',
};

const GLOW_CLASS: Record<DevPackGrade, string> = {
  S: 'bg-amber-300 text-amber-950 shadow-[0_0_72px_24px_rgba(252,211,77,0.85)]',
  A: 'bg-violet-300 text-violet-950 shadow-[0_0_64px_20px_rgba(196,181,253,0.8)]',
  B: 'bg-sky-300 text-sky-950 shadow-[0_0_56px_16px_rgba(125,211,252,0.75)]',
  C: 'bg-zinc-200 text-zinc-700 shadow-[0_0_36px_10px_rgba(228,228,231,0.7)]',
};

type Phase = 'open' | 'glow' | 'choose' | 'resolve' | 'done';

interface Props {
  packId: DevPackId | null;
  packName: string;
  onClose: () => void;
  /** 운영 상점. 두 장은 서버가 정하고, 고른 쪽만 지급한다. */
  server?: { sessionId: string; pair: [DevPackReward, DevPackReward] } | null;
}

export default function ShopPackOpenModal({ packId, packName, onClose, server = null }: Props) {
  const [used, setUsed] = useState<Set<string>>(() => new Set());
  const [pair, setPair] = useState<[DevPackReward, DevPackReward] | null>(() =>
    server?.pair ?? (packId ? rollDevPackPair(packId, new Set()) : null),
  );
  const [step, setStep] = useState(0);
  const [taken, setTaken] = useState<DevPackReward[]>([]);
  const [phase, setPhase] = useState<Phase>('open');
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const picking = useRef(false);
  const firstGrade = useRef(pair?.[0]?.grade);

  function later(ms: number, fn: () => void) {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(fn, ms);
  }

  useEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!packId) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setPhase('choose');
      return;
    }
    const openAt = window.setTimeout(() => setPhase('glow'), 520);
    const firstGlow = firstGrade.current === 'S' ? 1700 : 980;
    const chooseAt = window.setTimeout(() => setPhase('choose'), 520 + firstGlow);
    return () => {
      window.clearTimeout(openAt);
      window.clearTimeout(chooseAt);
    };
  }, [packId]);

  if (!packId || !pair) return null;
  const total = devPackSlots(packId);
  const done = phase === 'done';
  const grade = pair[0].grade;

  function choose(reward: DevPackReward) {
    if (!packId || !pair || phase !== 'choose' || picking.current) return;
    picking.current = true;
    setPickedKey(reward.key);
    setPhase('resolve');
    const choice = pair[0] === reward ? 0 : 1;
    void finishChoice(reward, choice);
  }

  async function finishChoice(reward: DevPackReward, choice: number) {
    let granted = reward;
    let nextPair: [DevPackReward, DevPackReward] | null = null;
    let finished = false;
    if (server) {
      try {
        const res = await fetch('/api/shop/pack/pick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: server.sessionId, choice }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          granted?: DevPackReward;
          replaced?: boolean;
          nextPair?: [DevPackReward, DevPackReward] | null;
        };
        if (!res.ok || !json.ok || !json.granted) {
          toast.error(json.error ?? '상품을 받지 못했습니다.');
          setPhase('choose');
          setPickedKey(null);
          picking.current = false;
          return;
        }
        granted = json.granted;
        nextPair = json.nextPair ?? null;
        finished = !json.nextPair;
        if (json.replaced) toast.message('받을 수 없어서 돋보기로 바뀌었습니다.');
      } catch {
        toast.error('상품을 받지 못했습니다.');
        setPhase('choose');
        setPickedKey(null);
        picking.current = false;
        return;
      }
    }
    const nextUsed = new Set(used);
    nextUsed.add(reward.key);
    const nextTaken = [...taken, granted];
    const nextStep = step + 1;
    later(320, () => {
      setUsed(nextUsed);
      setTaken(nextTaken);
      setStep(nextStep);
      setPickedKey(null);
      picking.current = false;
      if (server ? finished : nextStep >= total) {
        setPhase('done');
        return;
      }
      const rolled = server ? nextPair : packId ? rollDevPackPair(packId, nextUsed) : null;
      if (!rolled) {
        setPhase('done');
        return;
      }
      setPair(rolled);
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        setPhase('choose');
        return;
      }
      setPhase('glow');
      later(rolled[0].grade === 'S' ? 1700 : 900, () => setPhase('choose'));
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={done ? `${packName} 결과` : phase === 'choose' || phase === 'resolve' ? `${packName} ${step + 1}/${total}` : packName}
      size="md"
      hideClose={!done}
      closeOnBackdrop={done}
      closeOnEscape={done}
    >
      {done ? (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {taken.map((reward, index) => (
              <li key={`${reward.key}-${index}`} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold text-cdm-fg">{reward.name}</span>
                <span className="shrink-0 text-cdm-fg-muted">
                  {reward.grade} · {reward.detail}
                </span>
              </li>
            ))}
          </ul>
          <Button fullWidth onClick={onClose}>
            닫기
          </Button>
        </div>
      ) : phase === 'open' ? (
        <div className="relative flex h-72 items-center justify-center">
          <div className="relative h-52 w-36">
            <div className="pack-tear-up absolute inset-0">
              <div className="h-full [clip-path:inset(0_0_50%_0)]">
                <PackArtwork packId={packId} />
              </div>
            </div>
            <div className="pack-tear-down absolute inset-0">
              <div className="h-full [clip-path:inset(50%_0_0_0)]">
                <PackArtwork packId={packId} />
              </div>
            </div>
          </div>
        </div>
      ) : phase === 'glow' ? (
        <div className="relative flex h-72 items-center justify-center overflow-hidden">
          {grade === 'S' ? (
            <SBurst />
          ) : (
            <div
              className={`pack-glow flex h-28 w-28 items-center justify-center rounded-full text-3xl font-bold ${GLOW_CLASS[grade]}`}
              aria-label={`${grade} 등급`}
            >
              {grade}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-cdm-fg-muted">같은 등급 두 장 중 하나를 고르세요.</p>
          <div className="grid grid-cols-2 gap-3">
            {pair.map((reward) => {
              const motion =
                phase === 'resolve'
                  ? reward.key === pickedKey
                    ? 'pack-card-keep'
                    : 'pack-card-drop'
                  : 'pack-card-in';
              return (
                <button
                  key={`${step}-${reward.key}`}
                  type="button"
                  disabled={phase !== 'choose'}
                  onClick={() => choose(reward)}
                  className={`flex min-h-36 cursor-pointer flex-col items-start justify-between rounded-cdm-md border p-3 text-left disabled:cursor-default ${GRADE_CLASS[reward.grade]} ${motion}`}
                >
                  <span className="text-xs font-bold text-cdm-fg">{reward.grade}</span>
                  <span className="text-sm font-semibold text-cdm-fg">{reward.name}</span>
                  <span className="text-xs text-cdm-fg-muted">{reward.detail}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}

const S_SPARKS = [
  { left: '16%', top: '28%', delay: '0.05s' },
  { left: '78%', top: '22%', delay: '0.18s' },
  { left: '84%', top: '58%', delay: '0.08s' },
  { left: '12%', top: '62%', delay: '0.28s' },
  { left: '48%', top: '12%', delay: '0.12s' },
  { left: '62%', top: '78%', delay: '0.22s' },
  { left: '30%', top: '80%', delay: '0.32s' },
  { left: '70%', top: '40%', delay: '0.02s' },
];

function SBurst() {
  return (
    <div className="relative flex h-full w-full items-center justify-center" aria-label="S 등급">
      <div className="pack-s-flash" />
      <div className="pack-s-rays" />
      {S_SPARKS.map((spark) => (
        <span
          key={`${spark.left}-${spark.top}`}
          className="pack-s-spark"
          style={{ left: spark.left, top: spark.top, animationDelay: spark.delay }}
        />
      ))}
      <span className="pack-s-letter">S</span>
    </div>
  );
}
