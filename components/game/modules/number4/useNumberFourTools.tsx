'use client';
import { useMemo } from 'react';
import type { NumberFourGameData } from '@/shared/types/number4';
import { INITIAL_WHITE, INITIAL_BLACK } from '@/shared/types/number4';
import { buildNumberFourViewModel } from '@/lib/numberFourView';
import type { SkinTheme } from '@/lib/skins/registry';
import { useGameToolsRegistration, type GameTool } from '@/contexts/GameToolsContext';
import InfoPanel from './InfoPanel';
import RoundHistory from './RoundHistory';
import TileTracker from './TileTracker';
import { useNumberFourNotes } from './useNumberFourNotes';
import styles from './number-four.module.css';

/** PC 도킹과 모바일 상·하 배치가 동일한 상태/내용을 사용한다. */
export function useNumberFourTools(
  data: NumberFourGameData,
  myId: string,
  spectator: boolean,
  skin?: SkinTheme | null,
) {
  const desktop = useGameToolsRegistration()?.desktop ?? false;
  const model = useMemo(
    () => buildNumberFourViewModel(data, myId, spectator),
    [data, myId, spectator],
  );
  const memo = useNumberFourNotes(
    data.round,
    model.trackerEntries.map(([id]) => id),
  );
  const { notes, round, selectRound, setNote, clearNote } = memo;
  const info = useMemo(
    () => <InfoPanel gameData={data} myId={myId} predictions={notes[data.round] ?? {}} />,
    [data, myId, notes],
  );
  const tracker = useMemo(
    () => (
      <div className={styles.trackerGroup}>
        {model.trackerEntries.map(([id, p]) => (
          <TileTracker
            key={id}
            playerNickname={spectator ? p.nickname : undefined}
            {...(notes[round]?.[id] ?? { white: INITIAL_WHITE, black: INITIAL_BLACK })}
            round={round}
            currentRound={data.round}
            onSelectRound={selectRound}
            showTitle={false}
            skin={skin}
            onSet={(color, value) => setNote(id, color, value)}
            onClear={() => clearNote(id)}
          />
        ))}
      </div>
    ),
    [model, spectator, notes, round, data.round, selectRound, skin, setNote, clearNote],
  );
  const tools = useMemo<GameTool[]>(
    () => [
      {
        id: 'score',
        title: '점수판',
        kind: 'score',
        content: info,
        defaultOrder: 0,
        preferredBodyHeight: 210,
      },
      {
        id: 'round-history',
        title: '라운드 기록',
        kind: 'history',
        content: <RoundHistory gameData={data} compact={false} notes={notes} showTitle={false} />,
        defaultOrder: 20,
        preferredBodyHeight: 260,
      },
      {
        id: 'tracker',
        title: '메모 - 상대 타일 추리',
        content: tracker,
        kind: 'memo',
        defaultOrder: 30,
        preferredBodyHeight: spectator ? 400 : 260,
        sizeToContent: true,
      },
    ],
    [info, tracker, spectator, data, notes],
  );
  return { desktop, info, tracker, tools, model };
}
