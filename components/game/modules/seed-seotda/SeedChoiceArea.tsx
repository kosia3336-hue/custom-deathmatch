'use client';
import { SeedSeotdaCard } from '@/components/game/cards';
import { useGameAction } from '@/components/game/GameActionContext';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { SeedSeotdaGameData } from '@/shared/types/seed-seotda';
import { useState } from 'react';
import styles from './seed-choice.module.css';

export function SeedChoiceArea({ gameData, myId }: { gameData: SeedSeotdaGameData; myId: string }) {
  const sendAction = useGameAction();
  const [discardIndex, setDiscardIndex] = useState<0 | 1 | null>(null);
  if (gameData.phase !== 'seed-choice') return null;
  const mine = gameData.players[myId];
  if (!mine) {
    return (
      <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-3 text-center">
        <p className="text-cdm-fg-muted animate-pulse text-sm font-bold">
          두 플레이어가 버릴 패를 고르고 있습니다
        </p>
      </div>
    );
  }

  /*
    동시 제출이다. 내가 냈으면 상대를 기다리고, 상대가 무엇을 골랐는지는 둘 다
    낼 때까지 보이지 않는다(서버가 감춘다).
  */
  if (mine.seedChoice !== 'pending') {
    return (
      <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-3 text-center">
        <p className="text-cdm-fg text-sm font-black">
          {mine.seedChoice === 'used' ? '패 한 장을 버렸습니다' : '패를 버리지 않았습니다'}
        </p>
        <p className="text-cdm-fg-muted mt-0.5 animate-pulse text-[11px] font-bold">
          상대의 제출을 기다리는 중입니다
        </p>
      </div>
    );
  }

  /*
    조작부는 낮게. 여기가 커지면 그만큼 무대(내 패·상대 패)가 눌려 잘린다.
    카드를 작게 하고 고르는 줄과 단추 줄을 한 칸씩만 쓴다.
  */
  return (
    <section className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-2 text-center">
      <p className="text-cdm-fg text-[11px] leading-4 font-black">
        버릴 패를 고르세요. 버리면 시드패와 남은 한 장으로 겨룹니다.
      </p>
      <div className={styles.choices}>
        <div className="mt-1.5 flex justify-center gap-2">
          {mine.cards.map((card, index) => (
            <button
              key={card?.id ?? index}
              type="button"
              className={cn(
                'rounded-cdm-md border-2 p-0.5 transition focus-visible:outline-2',
                discardIndex === index
                  ? 'border-cdm-accent bg-cdm-accent-soft outline-cdm-accent'
                  : 'hover:border-cdm-highlight outline-cdm-highlight border-transparent',
              )}
              onClick={() => setDiscardIndex(index as 0 | 1)}
              aria-label={`${index + 1}번째 카드를 버릴 패로 선택`}
            >
              <SeedSeotdaCard card={card} size="sm" />
              <span className="text-cdm-accent mt-0.5 block text-[11px] leading-3 font-black">
                {discardIndex === index ? '버릴 패' : '선택'}
              </span>
            </button>
          ))}
        </div>
        <div className="mx-auto mt-1.5 grid max-w-md grid-cols-2 gap-2">
          <Button
            disabled={discardIndex == null}
            onClick={() => {
              if (discardIndex == null) return;
              sendAction({ type: 'use-seed', discardIndex });
            }}
          >
            패 버리기
          </Button>
          <Button variant="secondary" onClick={() => sendAction({ type: 'skip-seed' })}>
            버리지 않기
          </Button>
        </div>
      </div>
    </section>
  );
}
