'use client';

import { Felt } from './Felt';
import { SeatPlate } from './SeatPlate';
import { seatedInTurnOrder, type PlayViewProps } from './play-view';
import styles from './desktop-table.module.css';

export function DesktopTable(props: PlayViewProps) {
  const { meId, state, flags, remaining, dispatch, idleSlot, onSitEmpty } = props;
  const seats = seatedInTurnOrder(state);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className={styles.seats}>
        {seats.map((player, i) => (
          <SeatPlate
            key={player?.id ?? `empty-${i}`}
            meId={meId}
            player={player}
            state={state}
            seatNo={i + 1}
            onSitEmpty={onSitEmpty}
            spectateReserved={props.spectateReserved}
          />
        ))}
      </div>
      <Felt
        meId={meId}
        state={state}
        flags={flags}
        remaining={remaining}
        dispatch={dispatch}
        idleSlot={idleSlot}
      />
    </div>
  );
}
