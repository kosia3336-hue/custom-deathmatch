'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/cdm/Modal';
import { Button } from '@/components/cdm/Button';
import { SKIN_REEL_GAPS_MS } from '@/lib/audio/synth/general';
import type { SkinMeta } from '@/lib/skins/registry';
import { GAME_RULES } from '@/lib/gameRules';

const GAME_NAME: Record<string, string> = Object.fromEntries(
  GAME_RULES.map((game) => [game.id, game.name]),
);

function skinLabel(skin: SkinMeta): string {
  const game = GAME_NAME[skin.gameId] ?? skin.gameId;
  return `${game}: ${skin.name}`;
}

function buildReel(pool: SkinMeta[], winner: SkinMeta): SkinMeta[] {
  const source = pool.length > 0 ? pool : [winner];
  const spin: SkinMeta[] = [];
  for (let i = 0; i < SKIN_REEL_GAPS_MS.length; i++) spin.push(source[i % source.length]!);
  spin.push(winner);
  return spin;
}

export function ChuseokSkinPickModal({
  skins,
  onPick,
  onClose,
}: {
  skins: SkinMeta[] | null;
  onPick: (skin: SkinMeta) => void;
  onClose: () => void;
}) {
  return (
    <Modal open={skins !== null} onClose={onClose} title="스킨 선택" size="md">
      <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
        {(skins ?? []).map((skin) => (
          <button
            key={skin.id}
            type="button"
            onClick={() => onPick(skin)}
            className="rounded-cdm-md border border-cdm-border px-3 py-2 text-left text-sm font-semibold text-cdm-fg transition-colors hover:border-cdm-primary hover:bg-cdm-primary/5"
          >
            {skinLabel(skin)}
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function ChuseokSkinRevealModal({
  skin,
  pool,
  onClose,
}: {
  skin: SkinMeta | null;
  pool: SkinMeta[];
  onClose: () => void;
}) {
  const [reel, setReel] = useState<SkinMeta[]>([]);
  const [index, setIndex] = useState(0);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    if (!skin) {
      setReel([]);
      setIndex(0);
      setLanded(false);
      return;
    }
    const sequence = buildReel(pool, skin);
    setReel(sequence);
    setIndex(0);
    setLanded(false);
    let step = 0;
    let timer = 0;
    const tick = () => {
      step += 1;
      setIndex(step);
      if (step >= sequence.length - 1) {
        setLanded(true);
        return;
      }
      timer = window.setTimeout(tick, SKIN_REEL_GAPS_MS[step] ?? 28);
    };
    timer = window.setTimeout(tick, SKIN_REEL_GAPS_MS[0] ?? 28);
    return () => window.clearTimeout(timer);
  }, [skin, pool]);

  return (
    <Modal
      open={skin !== null}
      onClose={landed ? onClose : undefined}
      title="스킨 획득"
      size="sm"
      closeOnBackdrop={landed}
      closeOnEscape={landed}
      footer={
        <Button variant="primary" onClick={onClose} disabled={!landed}>
          확인
        </Button>
      }
    >
      <div className="h-12 overflow-hidden rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1">
        <div
          className="transition-none"
          style={{ transform: `translateY(-${index * 3}rem)` }}
        >
          {reel.map((item, i) => (
            <p key={`${item.id}-${i}`} className="flex h-12 items-center justify-center text-lg font-bold text-cdm-fg">
              {skinLabel(item)}
            </p>
          ))}
        </div>
      </div>
    </Modal>
  );
}
