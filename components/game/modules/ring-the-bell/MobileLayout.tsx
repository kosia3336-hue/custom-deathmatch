'use client';

import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/cdm/BottomSheet';
import { Felt } from './Felt';
import { MobileActionPanel } from './MobileActionPanel';
import { SeatPlate } from './SeatPlate';
import { needsActionSheet, seatedInTurnOrder, type PlayViewProps } from './play-view';
import styles from './mobile-table.module.css';

export default function MobileLayout(props: PlayViewProps) {
  const { state, flags, flash } = props;
  const seats = seatedInTurnOrder(state);
  const mine = needsActionSheet(flags, state.phase);
  const seated = state.players.some((p) => p.id === props.meId);
  const dead = seated && !flags.alive;
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setSheetOpen(mine), 0);
    return () => window.clearTimeout(t);
  }, [mine, state.currentId, state.phase, state.setIndex]);

  return (
    <div className="bg-cdm-bg relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className={styles.seats}>
          {seats.map((player, i) => (
            <SeatPlate
              key={player?.id ?? `empty-${i}`}
              meId={props.meId}
              player={player}
              state={state}
              seatNo={i + 1}
              compact
            />
          ))}
        </div>
        <Felt
          meId={props.meId}
          state={state}
          flags={flags}
          remaining={props.remaining}
          dispatch={props.dispatch}
          idleSlot={props.idleSlot}
          compact
        />
        <div className="min-h-0 flex-1" aria-hidden />
      </div>

      {dead && (
        <div className="border-cdm-border bg-cdm-bg-elev-1 flex shrink-0 items-center justify-center border-t py-2">
          <p className="text-cdm-fg-muted text-sm font-bold">다이</p>
        </div>
      )}

      {mine && (
        <div className="shrink-0 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="bg-cdm-primary w-full rounded-xl py-3 text-sm font-bold text-white shadow-lg"
          >
            행동하기 →
          </button>
        </div>
      )}

      {flash && (
        <div className={styles.flash} role="status">
          <p className={styles.flashCard}>{flash}</p>
        </div>
      )}

      <BottomSheet open={sheetOpen && mine} onClose={() => setSheetOpen(false)} title="내 차례">
        <MobileActionPanel {...props} />
      </BottomSheet>
    </div>
  );
}
