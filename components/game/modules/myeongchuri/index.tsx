'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { getSocket } from '@/lib/socket';
import { serverNow } from '@/lib/serverClock';
import { cn } from '@/lib/utils';
import { GameFrame } from '@/components/game/GameFrame';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { PlayerStrip } from '@/components/game/abstract-strategy';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { myeongchuriTileToken } from '@/shared/logic/myeongchuri';
import {
  MYEONGCHURI_LETTERS,
  MYEONGCHURI_LETTERS_PER_PICK,
  MYEONGCHURI_MAX_WARNINGS,
  MYEONGCHURI_SYMBOLS,
  type MyeongchuriGameData,
  type MyeongchuriLetter,
  type MyeongchuriRoundResult,
} from '@/shared/types/myeongchuri';

/** 메모·답에 고를 수 있는 값 — 숫자 1~9, 기호 7개 */
const TOKENS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ...MYEONGCHURI_SYMBOLS];
const MEMO_PREFIX = 'cdm-myeongchuri-memo:';

type Memo = Partial<Record<MyeongchuriLetter, string>>;

/** 내 메모는 이 기기에만 둔다(판마다 새로). 명추리를 선언하면 메모가 곧 답이 된다. */
function readMemo(key: string): Memo {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Memo) : {};
  } catch {
    return {};
  }
}

function writeMemo(key: string, memo: Memo) {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const stored = window.localStorage.key(i);
      if (stored && stored.startsWith(MEMO_PREFIX) && stored !== key) window.localStorage.removeItem(stored);
    }
    window.localStorage.setItem(key, JSON.stringify(memo));
  } catch {
    // 저장하지 못해도 이번 화면에서는 그대로 쓴다
  }
}

function useSecondsLeft(deadline: number | null) {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    if (deadline == null) return;
    const id = window.setInterval(() => setNow(serverNow()), 250);
    return () => window.clearInterval(id);
  }, [deadline]);
  return deadline == null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
}

function resultLabel(round: MyeongchuriRoundResult) {
  if (round.value != null) return round.value;
  return round.hidden === 'symbols' ? '비공개 (기호 3개 이상)' : '비공개 (숫자 3개 이상)';
}

export default function MyeongchuriGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const roomId = useRoomStore((s) => s.room?.id);
  const data = gameState?.gameData as MyeongchuriGameData | undefined;
  const myId = useMySocketId();

  if (!data || !gameState) {
    return (
      <div className="text-cdm-fg-muted flex h-full items-center justify-center">게임을 불러오는 중...</div>
    );
  }

  const memoKey = `${MEMO_PREFIX}${roomId ?? ''}:${gameState.startedAt ?? ''}`;
  return <MyeongchuriTable key={memoKey} data={data} myId={myId} memoKey={memoKey} />;
}

function MyeongchuriTable({
  data,
  myId,
  memoKey,
}: {
  data: MyeongchuriGameData;
  myId: string;
  memoKey: string;
}) {
  const { setHud } = useRoomLayout();
  const [memo, setMemo] = useState<Memo>(() => readMemo(memoKey));
  const [confirmDeclare, setConfirmDeclare] = useState(false);
  /* 이번 차례(라운드·단계)에 고른 알파벳. 차례가 바뀌면 저절로 비워진다 */
  const pickKey = `${data.round}:${data.phase}`;
  const [selection, setSelection] = useState<{ key: string; letters: MyeongchuriLetter[] }>({
    key: pickKey,
    letters: [],
  });
  const selected = selection.key === pickKey ? selection.letters : [];
  /* 보낸 행동이 반영될 때까지 버튼을 잠근다. 서버가 받으면 signature 가 바뀌어 풀린다 */
  const signature = [
    data.round,
    data.phase,
    data.picks.join(''),
    data.thinkSkips.join(','),
    data.declaration?.playerId ?? '',
    data.declarations.length,
  ].join(':');
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);
  const pending = pendingSignature === signature;

  useEffect(() => {
    const socket = getSocket();
    const release = () => setPendingSignature(null);
    socket.on('error', release);
    return () => {
      socket.off('error', release);
    };
  }, []);

  const isPlayer = Boolean(data.players[myId]);
  const finished = data.phase === 'finished';
  const picking = data.phase === 'pick-first' || data.phase === 'pick-second';
  const myTurn = isPlayer && picking && data.currentPlayerId === myId;
  const declaring = data.declaration?.playerId === myId;
  const secondsLeft = useSecondsLeft(data.declaration?.deadline ?? null);
  const name = (id: string | null | undefined) =>
    id ? (id === myId ? '나' : (data.players[id]?.nickname ?? '상대')) : '';
  /* 솔로는 두 자리가 모두 내 자리다 — 이름을 붙이면 "선 나 / 후 나"가 되니 자리만 보인다 */
  const seatLabel = (seat: '선' | '후', id: string | null | undefined) =>
    data.isSolo ? seat : `${seat} ${name(id)}`;
  const secondId = Object.keys(data.players).find((id) => id !== data.firstPlayerId) ?? null;
  const lastRound = data.rounds.at(-1) ?? null;

  const emit = (action: Record<string, unknown>) => {
    setPendingSignature(signature);
    getSocket().emit('game:action', action);
  };

  const updateMemo = useCallback(
    (letter: MyeongchuriLetter, token: string) => {
      setMemo((previous) => {
        const next: Memo = { ...previous };
        if (token) next[letter] = token;
        else delete next[letter];
        writeMemo(memoKey, next);
        return next;
      });
    },
    [memoKey],
  );

  function toggleLetter(letter: MyeongchuriLetter) {
    if (!myTurn || pending || data.picks.includes(letter)) return;
    setSelection((previous) => {
      const letters = previous.key === pickKey ? previous.letters : [];
      const next = letters.includes(letter)
        ? letters.filter((l) => l !== letter)
        : letters.length >= MYEONGCHURI_LETTERS_PER_PICK
          ? [...letters.slice(1), letter]
          : [...letters, letter];
      return { key: pickKey, letters: next };
    });
  }

  const memoComplete = MYEONGCHURI_LETTERS.every((letter) => memo[letter]);

  useEffect(() => {
    setHud({
      round: `${data.round}R`,
      order: finished
        ? '종료'
        : data.phase === 'thinking'
          ? '생각'
          : data.isSolo
            ? data.phase === 'pick-second'
              ? '후'
              : '선'
            : myTurn
              ? '내 차례'
              : '상대 차례',
      memo: <RecordPanel data={data} name={name} memo={memo} onMemo={isPlayer ? updateMemo : undefined} />,
    });
    // name 은 data·myId 로만 정해진다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, memo, myId, myTurn, finished, isPlayer, updateMemo, setHud]);
  useEffect(() => () => setHud(null), [setHud]);

  /* 안내 문구 */
  const phaseStatus = finished
    ? (data.finishReason ?? '게임 종료')
    : !isPlayer
      ? data.phase === 'thinking'
        ? '생각 시간입니다.'
        : `관전 중 · ${name(data.currentPlayerId)} 님이 알파벳을 고르는 중입니다.`
      : data.phase === 'thinking'
        ? '생각 시간입니다. 두 사람이 모두 건너뛰기를 누르면 바로 다음 라운드로 넘어갑니다.'
        : myTurn
          ? data.phase === 'pick-first'
            ? '수식 앞 두 칸에 놓을 알파벳 2개를 골라야 합니다.'
            : '수식 뒤 두 칸에 놓을 알파벳 2개를 골라야 합니다. 앞 두 칸의 알파벳은 쓸 수 없습니다.'
          : `${name(data.currentPlayerId)} 님이 알파벳을 고르는 중입니다.`;
  const declarationStatus = data.declaration
    ? declaring
      ? `명추리 답 제출 · ${secondsLeft ?? 0}초 남음 — 모든 알파벳의 값을 골라 제출해야 합니다.`
      : `${name(data.declaration.playerId)} 님이 명추리 중입니다 (${secondsLeft ?? 0}초).`
    : null;

  const slotLetters = picking ? data.picks : (lastRound?.letters ?? []);

  return (
    <GameFrame
      info={
        <PlayerStrip
          entries={Object.entries(data.players).map(([id, player]) => ({
            id,
            name: player.nickname,
            isMe: id === myId,
            marker: (
              <span
                className={cn(
                  'text-[10px] font-black',
                  data.isSolo || id === data.firstPlayerId ? 'text-cdm-primary' : 'text-cdm-fg-muted',
                )}
              >
                {/* 솔로는 자리가 하나로 합쳐지니, 지금 두는 자리를 보인다 */}
                {data.isSolo
                  ? data.phase === 'pick-second'
                    ? '후'
                    : '선'
                  : id === data.firstPlayerId
                    ? '선'
                    : '후'}
              </span>
            ),
            detail: `경고 ${data.warnings[id] ?? 0}/${MYEONGCHURI_MAX_WARNINGS}`,
            active: !finished && data.currentPlayerId === id,
          }))}
        />
      }
      controls={
        <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-2">
          {declarationStatus && (
            <p
              className={cn(
                'mb-1 text-center text-[11px] font-bold',
                declaring ? 'text-cdm-accent' : 'text-cdm-primary',
              )}
            >
              {declarationStatus}
            </p>
          )}
          <p className="text-cdm-fg-muted flex min-h-5 items-center justify-center text-center text-[11px]">
            {phaseStatus}
          </p>

          {declaring && (
            <div className="mt-2">
              <MemoGrid memo={memo} onMemo={updateMemo} tone="light" />
              <div className="mt-2 flex justify-center">
                <ActionButton tone="accent" disabled={!memoComplete || pending} onClick={() => emit({
                  type: 'answer',
                  answer: Object.fromEntries(MYEONGCHURI_LETTERS.map((letter) => [letter, memo[letter]])),
                })}>
                  {memoComplete ? '답 제출' : '모든 알파벳의 값을 골라야 합니다'}
                </ActionButton>
              </div>
            </div>
          )}

          {!finished && isPlayer && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
              {myTurn && (
                <ActionButton
                  disabled={selected.length !== MYEONGCHURI_LETTERS_PER_PICK || pending}
                  onClick={() => emit({ type: 'pick', letters: selected })}
                >
                  {selected.length === MYEONGCHURI_LETTERS_PER_PICK
                    ? `${selected.join(' ')} 놓기`
                    : `알파벳 ${MYEONGCHURI_LETTERS_PER_PICK - selected.length}개 더 고르기`}
                </ActionButton>
              )}
              {data.phase === 'thinking' && (
                <ActionButton
                  tone="secondary"
                  disabled={pending || data.thinkSkips.includes(myId)}
                  onClick={() => emit({ type: 'skip-think' })}
                >
                  건너뛰기 {data.thinkSkips.length}/{Object.keys(data.players).length}
                </ActionButton>
              )}
              {!data.declaration &&
                (confirmDeclare ? (
                  <>
                    <ActionButton
                      tone="accent"
                      disabled={pending}
                      onClick={() => {
                        setConfirmDeclare(false);
                        emit({ type: 'declare' });
                      }}
                    >
                      명추리 선언 (1분 안에 답 제출)
                    </ActionButton>
                    <ActionButton tone="secondary" onClick={() => setConfirmDeclare(false)}>
                      취소
                    </ActionButton>
                  </>
                ) : (
                  <ActionButton tone="secondary" onClick={() => setConfirmDeclare(true)}>
                    명추리
                  </ActionButton>
                ))}
            </div>
          )}
        </div>
      }
      aside={<RecordPanel data={data} name={name} memo={memo} onMemo={isPlayer ? updateMemo : undefined} />}
    >
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 p-2">
        {/* 수식 4칸 — 앞 두 칸 선, 뒤 두 칸 후 */}
        <div className="flex w-full max-w-sm flex-col items-center gap-1">
          <div className="flex items-end gap-1.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex flex-col items-center gap-0.5">
                <span className="text-cdm-fg-subtle text-[10px] font-bold">
                  {index < 2
                    ? seatLabel('선', picking ? data.firstPlayerId : lastRound?.firstPlayerId)
                    : seatLabel('후', picking ? secondId : lastRound?.secondPlayerId)}
                </span>
                <span
                  className={cn(
                    'rounded-cdm-md flex h-11 w-11 items-center justify-center border-2 text-xl font-black',
                    slotLetters[index]
                      ? 'border-cdm-primary bg-cdm-primary-soft text-cdm-primary'
                      : 'border-cdm-border text-cdm-fg-subtle border-dashed',
                  )}
                >
                  {slotLetters[index] ?? ''}
                </span>
              </div>
            ))}
            {!picking && lastRound && (
              <span className="text-cdm-fg ml-1 pb-2.5 text-lg font-black tabular-nums">= {resultLabel(lastRound)}</span>
            )}
          </div>
          {picking && lastRound && (
            <p className="text-cdm-fg-muted text-[11px]">
              지난 결과 {lastRound.letters.join(' ')} = <b className="text-cdm-fg">{resultLabel(lastRound)}</b>
            </p>
          )}
        </div>

        {/* 3×3 타일 */}
        <div className="grid grid-cols-3 gap-2" style={{ width: 'min(19rem, 52cqh, 100%)' }}>
          {MYEONGCHURI_LETTERS.map((letter) => {
            const used = picking && data.picks.includes(letter);
            const chosen = selected.includes(letter);
            const clickable = myTurn && !pending && !used;
            const revealed = data.tiles ? myeongchuriTileToken(data.tiles[letter]) : null;
            return (
              <button
                key={letter}
                type="button"
                disabled={!clickable}
                onClick={() => toggleLetter(letter)}
                aria-pressed={chosen}
                className={cn(
                  'rounded-cdm-lg flex aspect-square flex-col items-center justify-center border-2 transition-colors',
                  chosen
                    ? 'border-cdm-primary bg-cdm-primary-soft'
                    : used
                      ? 'border-cdm-highlight bg-cdm-highlight/10'
                      : 'border-cdm-border bg-cdm-bg-elev-1',
                  clickable ? 'hover:border-cdm-primary cursor-pointer' : 'cursor-default',
                )}
              >
                <span className="text-cdm-fg text-2xl font-black leading-none">{letter}</span>
                <span
                  className={cn(
                    'mt-1 min-h-4 text-xs font-bold leading-none',
                    revealed ? 'text-cdm-primary' : 'text-cdm-fg-subtle',
                  )}
                >
                  {revealed ?? memo[letter] ?? ''}
                </span>
              </button>
            );
          })}
        </div>

        {finished && (
          <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center p-2">
            <div className="border-cdm-primary bg-cdm-bg/95 rounded-cdm-lg max-w-xs border px-5 py-3 text-center shadow-(--cdm-shadow-lg) backdrop-blur">
              <p className="text-cdm-primary text-base font-black">
                {data.winnerId ? `${data.players[data.winnerId]?.nickname ?? '플레이어'} 승리!` : '게임 종료'}
              </p>
              <p className="text-cdm-fg-muted mt-1 text-xs">{data.finishReason}</p>
            </div>
          </div>
        )}
      </div>
    </GameFrame>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone = 'primary',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'accent';
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-cdm-md min-h-10 px-3 text-xs font-black transition-colors disabled:opacity-40',
        tone === 'primary' && 'border-cdm-primary bg-cdm-primary hover:bg-cdm-primary-strong border text-white',
        tone === 'secondary' && 'border-cdm-primary bg-cdm-bg text-cdm-primary hover:bg-cdm-primary-soft border',
        tone === 'accent' && 'border-cdm-accent bg-cdm-accent border text-white',
      )}
    >
      {children}
    </button>
  );
}

/** 알파벳별 추리 메모 — 명추리를 선언하면 이 값이 그대로 답이 된다 */
function MemoGrid({
  memo,
  onMemo,
  tone,
}: {
  memo: Memo;
  onMemo?: (letter: MyeongchuriLetter, token: string) => void;
  tone: 'ink' | 'light';
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {MYEONGCHURI_LETTERS.map((letter) => (
        <label
          key={letter}
          className={cn(
            'flex items-center gap-1 rounded-md px-1.5 py-1',
            tone === 'ink' ? 'bg-white/5' : 'border-cdm-border bg-cdm-bg-elev-1 border',
          )}
        >
          <span className={cn('w-3 text-xs font-black', tone === 'ink' ? 'text-cdm-ink-fg' : 'text-cdm-fg')}>
            {letter}
          </span>
          <select
            value={memo[letter] ?? ''}
            disabled={!onMemo}
            onChange={(event) => onMemo?.(letter, event.target.value)}
            aria-label={`${letter} 메모`}
            className={cn(
              'min-w-0 flex-1 rounded bg-transparent text-xs font-bold',
              tone === 'ink' ? 'text-cdm-ink-fg' : 'text-cdm-fg',
            )}
          >
            <option value="">?</option>
            {TOKENS.map((token) => (
              <option key={token} value={token}>
                {token}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

function RecordPanel({
  data,
  name,
  memo,
  onMemo,
}: {
  data: MyeongchuriGameData;
  name: (id: string | null | undefined) => string;
  memo: Memo;
  onMemo?: (letter: MyeongchuriLetter, token: string) => void;
}) {
  return (
    <GameInfoStack>
      {onMemo && (
        <GameInfoPart title="메모">
          <MemoGrid memo={memo} onMemo={onMemo} tone="ink" />
        </GameInfoPart>
      )}
      <GameInfoPart title="라운드 기록">
        {data.rounds.length === 0 ? (
          <p className="text-cdm-ink-fg-muted text-xs">아직 결과가 없습니다.</p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {[...data.rounds].reverse().map((round) => (
              <li key={round.round} className="rounded-md bg-white/5 px-2 py-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-cdm-ink-fg-muted">
                    {round.round}R · 선 {name(round.firstPlayerId)}
                  </span>
                  <span className={cn('font-black tabular-nums', round.value == null ? 'text-cdm-ink-fg-muted' : 'text-cdm-ink-fg')}>
                    {resultLabel(round)}
                  </span>
                </div>
                <p className="text-cdm-ink-fg font-bold tracking-wider">
                  {round.letters.slice(0, 2).join(' ')} | {round.letters.slice(2).join(' ')}
                  {(round.randomFirst || round.randomSecond) && (
                    <span className="text-cdm-ink-fg-muted ml-1 font-normal tracking-normal">(시간 초과 무작위)</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </GameInfoPart>
      {data.declarations.length > 0 && (
        <GameInfoPart title="명추리">
          <ul className="space-y-0.5 text-xs">
            {data.declarations.map((entry, index) => (
              <li key={index} className="text-cdm-ink-fg-muted">
                {entry.round}R · <b className="text-cdm-ink-fg">{name(entry.playerId)}</b>{' '}
                {entry.success ? '성공' : entry.timedOut ? '실패 (제출 시간 초과)' : '실패'}
              </li>
            ))}
          </ul>
        </GameInfoPart>
      )}
    </GameInfoStack>
  );
}
