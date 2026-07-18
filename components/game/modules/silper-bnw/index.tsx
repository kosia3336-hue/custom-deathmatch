'use client';

import { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { toast } from 'sonner';
import type {
  SBNWGameData,
  SBNWPlayerInfo,
  SBNWRevealData,
  SBNWRoundRecord,
  SBNWTile,
} from '@/shared/types/silper-bnw';
import TileInput, { TILE_COLORS, MEOW_TILE_CLASS } from './TileInput';
import OpponentTileTracker from './OpponentTileTracker';
import MeowFieldFx from './skins/MeowFieldFx';
import { getSkinTheme } from '@/lib/skins/registry';
import { GAME_IDS } from '@/shared/types/game';

const WIN_TYPE_LABELS: Record<string, string> = {
  score: '승점 6선승',
  tiebreakTile: '최대 타일 비교 승',
  rematch: '재대결 결정',
  autoLoss: '타일 소진 자동 패배',
  timeout: '시간 초과',
  leave: '기권',
  draw: '무승부',
};

/* ── 대기 중 애니메이션 ── */
function WaitingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
    </span>
  );
}

function WaitingCard({ text, meow }: { text: string; meow?: boolean }) {
  if (meow) {
    return (
      <div className="skin-meow-panel flex flex-col items-center gap-2 p-6">
        <span className="inline-flex items-center gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="skin-meow-waiting-paw text-sm" style={{ animationDelay: `${i * 0.18}s` }}>
              🐾
            </span>
          ))}
        </span>
        <p className="skin-meow-subtext text-sm">{text}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-6">
      <WaitingDots />
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

/* ── 자릿수 힌트 패널 ── */
function DigitHintPanel({
  firstNick,
  firstDigits,
  myDigitsHint,
  isFirstSelf,
  meow,
}: {
  firstNick: string;
  firstDigits: number | null;
  myDigitsHint: number | null;
  isFirstSelf: boolean;
  meow?: boolean;
}) {
  if (firstDigits == null && myDigitsHint == null) return null;
  return (
    <div
      className={`digit-hint-enter flex w-full flex-col gap-1 px-4 py-3 text-center ${
        meow ? 'skin-meow-panel' : 'rounded-xl border border-indigo-200 bg-white'
      }`}
    >
      {firstDigits != null && (
        <p className={`text-sm ${meow ? 'skin-meow-heading' : 'text-gray-600'}`}>
          <span className="font-medium">{firstNick}</span>{' '}
          <span className={`text-xs ${meow ? 'skin-meow-subtext' : 'text-gray-400'}`}>(선플)</span> :{' '}
          <span className={`text-2xl font-bold tabular-nums ${meow ? 'skin-meow-heading' : 'text-indigo-700'}`}>{firstDigits}</span>자리
        </p>
      )}
      {isFirstSelf && firstDigits == null && myDigitsHint != null && myDigitsHint > 0 && (
        <p className={`text-xs ${meow ? 'skin-meow-subtext' : 'text-gray-500'}`}>
          내 제시:{' '}
          <span className={`font-bold tabular-nums ${meow ? 'skin-meow-heading' : 'text-indigo-700'}`}>{myDigitsHint}자리</span>
        </p>
      )}
    </div>
  );
}

/* ── 타일 배열 표시 (RevealPanel용) — stagger 애니메이션 포함 ── */
function TileValueDisplay({
  tiles,
  valueStr,
  digits,
  visible,
  masked,
  meow,
}: {
  tiles: SBNWTile[];
  valueStr: string;
  digits: number;
  visible: boolean;
  /** 서버가 상대 타일을 숨긴 경우 (tilesUsed:[]) */
  masked: boolean;
  meow?: boolean;
}) {
  if (!visible) return <div className="py-4 text-xl text-gray-300">? ? ?</div>;

  // 상대 카드: 타일/값 숨김, 자릿수만 표시
  if (masked) {
    return (
      <div className="space-y-1 py-2 text-center">
        <div className="flex justify-center gap-0.5">
          {Array.from({ length: digits }).map((_, i) => (
            <span
              key={i}
              style={{ animation: `slotPush 300ms cubic-bezier(0.175,0.885,0.32,1.275) ${i * 80}ms both` }}
              className={
                meow
                  ? 'skin-meow-tile skin-meow-tile--0 flex h-8 w-8 items-center justify-center text-sm font-bold'
                  : 'flex h-8 w-8 items-center justify-center rounded-lg border-2 border-gray-300 bg-gray-100 text-sm font-bold text-gray-400'
              }
            >
              ?
            </span>
          ))}
        </div>
        <p className="text-[10px] text-gray-400">({digits}자리)</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 text-center">
      <div className="flex flex-wrap justify-center gap-0.5">
        {tiles.map((t, i) => {
          const c = TILE_COLORS[t];
          return (
            <span
              key={i}
              style={{
                animation: `slotPush 300ms cubic-bezier(0.175,0.885,0.32,1.275) ${i * 80}ms both`,
              }}
              className={
                meow
                  ? `${MEOW_TILE_CLASS[t]} flex h-8 w-8 items-center justify-center text-sm font-bold`
                  : `flex h-8 w-8 items-center justify-center rounded-lg border-2 text-sm font-bold ${c.bg} ${c.border} ${c.text}`
              }
            >
              {t}
            </span>
          );
        })}
      </div>
      <p className="text-sm font-bold tabular-nums text-gray-800">= {valueStr}</p>
      <p className="text-[10px] text-gray-400">({tiles.length}자리)</p>
    </div>
  );
}

/* ── Reveal 결과 패널 ── */
function RevealPanel({
  revealData,
  players,
  myId,
  firstPlayerId,
  step,
  meow,
}: {
  revealData: SBNWRevealData;
  players: Record<string, SBNWPlayerInfo>;
  myId: string;
  firstPlayerId: string;
  step: number;
  meow?: boolean;
}) {
  const firstInfo  = players[firstPlayerId];
  const secondId   = Object.keys(players).find((id) => id !== firstPlayerId) ?? '';
  const secondInfo = players[secondId];

  const firstWinner  = revealData.winnerId === firstPlayerId;
  const secondWinner = revealData.winnerId === secondId;
  const winnerVisible  = step >= 3;
  const firstVisible   = step >= 1;
  const secondVisible  = step >= 2;

  const renderCard = (
    pid: string,
    info: SBNWPlayerInfo | undefined,
    side: SBNWRevealData['first'],
    isWinner: boolean,
    isFirst: boolean,
    visible: boolean,
  ) => {
    const isMe   = pid === myId;
    // 서버가 tilesUsed:[] + valueStr:'' 로 보내면 상대 카드 → 마스킹
    const masked = !isMe && side.tilesUsed.length === 0 && side.valueStr === '';
    return (
      <div
        className={`rounded-xl border p-3 text-center transition-all duration-500 ${
          !visible
            ? 'border-gray-200 bg-gray-100 opacity-30'
            : winnerVisible && isWinner
              ? meow
                ? 'skin-meow-reveal-winner border'
                : 'border-emerald-300 bg-emerald-50 shadow-[0_0_12px_rgba(52,211,153,0.25)]'
              : winnerVisible && revealData.winnerId !== null
                ? 'border-gray-200 bg-gray-50 opacity-60'
                : 'border-gray-200 bg-white'
        }`}
      >
        <p className="mb-1 truncate text-xs font-medium text-gray-500">
          {isMe ? '나' : info?.nickname ?? pid}
          {isFirst && <span className="ml-1 text-xs text-amber-500">(선)</span>}
        </p>
        <TileValueDisplay
          tiles={side.tilesUsed}
          valueStr={side.valueStr}
          digits={side.digits}
          visible={visible}
          masked={masked}
          meow={meow}
        />
        {winnerVisible && isWinner && (
          <p className={`mt-1 text-xs font-bold ${meow ? 'skin-meow-heading' : 'text-emerald-600'}`}>
            {meow ? '🐾 +1점' : '+1점'}
          </p>
        )}
      </div>
    );
  };

  return (
    <div
      className={
        meow
          ? 'skin-meow-reveal-panel space-y-3 p-4'
          : 'space-y-3 rounded-xl border border-gray-200 bg-white p-4'
      }
    >
      <p className={`text-center text-sm font-semibold ${meow ? 'skin-meow-panel-title' : 'text-gray-700'}`}>
        {meow ? '🐱 라운드 결과' : '라운드 결과'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {renderCard(firstPlayerId, firstInfo, revealData.first,  firstWinner,  true,  firstVisible)}
        {renderCard(secondId,      secondInfo, revealData.second, secondWinner, false, secondVisible)}
      </div>
      {winnerVisible && revealData.winnerId === null && (
        <p className="text-center text-sm font-semibold text-amber-500">동률 — 승점 변동 없음</p>
      )}
    </div>
  );
}

/* ── 라운드 기록 테이블 ── */
function RoundHistoryTable({
  history,
  players,
  myId,
}: {
  history: SBNWRoundRecord[];
  players: Record<string, SBNWPlayerInfo>;
  myId: string;
}) {
  if (history.length === 0) return null;
  return (
    <div className="space-y-0.5 text-xs">
      {history.map((r) => {
        const fEntry = Object.entries(r.players).find(([id]) => id === r.firstPlayerId);
        const sEntry = Object.entries(r.players).find(([id]) => id !== r.firstPlayerId);
        if (!fEntry || !sEntry) return null;
        const [fid, fd] = fEntry;
        const [sid, sd] = sEntry;
        return (
          <div key={r.round} className="flex flex-wrap items-center gap-1 py-0.5 tabular-nums">
            <span className="w-6 shrink-0 font-medium text-gray-400">R{r.round}</span>
            {/* 선플 */}
            <span className="min-w-0 truncate text-gray-600">
              <span className={fid === myId ? 'font-bold text-indigo-700' : ''}>
                {fid === myId ? '나' : players[fid]?.nickname ?? ''}
              </span>
              <span className="mx-0.5 text-xs text-amber-500">(선)</span>
              <span className="text-gray-500">{fd.digits}자리</span>
              {fid === myId && fd.valueStr && (
                <span className="text-gray-400"> ={fd.valueStr}</span>
              )}
            </span>
            <span className="text-gray-300">vs</span>
            {/* 후플 */}
            <span className="min-w-0 truncate text-gray-600">
              <span className={sid === myId ? 'font-bold text-indigo-700' : ''}>
                {sid === myId ? '나' : players[sid]?.nickname ?? ''}
              </span>
              {' '}
              <span className="text-gray-500">{sd.digits}자리</span>
              {sid === myId && sd.valueStr && (
                <span className="text-gray-400"> ={sd.valueStr}</span>
              )}
            </span>
            {r.winnerId === null ? (
              <span className="text-gray-400">동률</span>
            ) : (
              <span className="text-emerald-600">
                {r.winnerId === myId ? '나' : players[r.winnerId]?.nickname ?? ''} +1
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── 점수 카드 ── */
function ScoreCard({
  info,
  isMe,
  isFirst,
}: {
  info: SBNWPlayerInfo;
  isMe: boolean;
  isFirst: boolean;
}) {
  const dots = Array.from({ length: 6 }, (_, i) => i < info.score);
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-lg border px-3 py-2 ${
        isMe ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`min-w-0 truncate text-sm font-medium ${
            isMe ? 'text-indigo-700' : 'text-gray-700'
          }`}
        >
          {isMe ? '나' : info.nickname}
          {isFirst && <span className="ml-1 text-xs text-amber-500">(선)</span>}
        </span>
        <span className="ml-2 shrink-0 text-sm font-bold tabular-nums">{info.score}/6</span>
      </div>
      <div className="flex items-center gap-0.5">
        {dots.map((filled, i) => (
          <span
            key={i}
            className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
              filled ? 'bg-emerald-400' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className="text-[10px] text-gray-500 tabular-nums">타일 {info.tileCount}개</p>
    </div>
  );
}

/* ── 모바일 바텀시트 ── */
function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-(--cdm-z-overlay) bg-black/40 transition-opacity duration-300 lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-(--cdm-z-modal) flex max-h-[85vh] flex-col rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl transition-transform duration-300 lg:hidden ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex shrink-0 justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>
        <div
          className="overflow-y-auto px-4 py-4"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          {children}
        </div>
      </div>
    </>
  );
}

/* ── 상대 사용 이력 계산 ── */
function computeOpponentUsed(
  history: SBNWRoundRecord[],
  opponentId: string,
): Record<SBNWTile, number> {
  const used: Record<SBNWTile, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const r of history) {
    const pd = r.players[opponentId];
    if (!pd) continue;
    for (const t of pd.tilesUsed) used[t as SBNWTile] += 1;
  }
  return used;
}

/* ══════════════════════════════════════════════
   메인 컴포넌트
══════════════════════════════════════════════ */
export default function SilperBnwGame() {
  const gameState  = useRoomStore((s) => s.gameState);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const gameData   = gameState?.gameData as SBNWGameData | undefined;
  const myId       = useMySocketId();
  useTurnTimer();

  const skin   = getSkinTheme(gameState?.activeSkin, GAME_IDS.SILPER_BNW);
  const isMeow = skin === 'meow';

  /* ── 상태 ── */
  const shownEndRef   = useRef<string | null>(null);
  const prevRoundRef  = useRef<number | null>(null);
  const prevPhaseRef  = useRef<string | null>(null);
  const prevRematchRef = useRef<number | null>(null);
  const prevWinTypeRef = useRef<string | null>(null);
  /** phase 변경 시 effect cleanup이 숨김 타이머를 지우지 않도록 ref로 관리 */
  const roundOverlayHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [roundOverlay,   setRoundOverlay]   = useState<{ round: number; firstNick: string } | null>(null);
  const [rematchOverlay, setRematchOverlay] = useState<number | null>(null);
  const [winsixOverlay,  setWinsixOverlay]  = useState<{ winnerNick: string } | null>(null);
  const [revealStep,     setRevealStep]     = useState(0);
  const [sheetOpen,      setSheetOpen]      = useState(false);
  const [mySlotLength,   setMySlotLength]   = useState(0);

  /* ── 언마운트 시 라운드 오버레이 타이머 정리 ── */
  useEffect(() => {
    return () => {
      if (roundOverlayHideTimerRef.current) {
        clearTimeout(roundOverlayHideTimerRef.current);
        roundOverlayHideTimerRef.current = null;
      }
    };
  }, []);

  /* ── 라운드/재대결 전환 시 슬롯 길이 리셋 ── */
  useEffect(() => {
    setMySlotLength(0);
  }, [gameData?.round, gameData?.rematchIndex]);

  /* ── 승리 토스트 ── */
  useEffect(() => {
    if (!gameData?.winType) return;
    const key = gameData.winner ?? 'draw';
    if (shownEndRef.current === key) return;
    shownEndRef.current = key;

    if (gameData.winType === 'draw') {
      toast.info(gameData.finishReason ?? '무승부!', { duration: 5000 });
    } else if (gameData.winner) {
      const winnerNick = gameData.players[gameData.winner]?.nickname ?? '???';
      const reason     = WIN_TYPE_LABELS[gameData.winType] ?? '';
      const isMe       = gameData.winner === myId;
      if (isMe) toast.success(`${winnerNick} 승리! ${reason}`, { duration: 5000 });
      else      toast.error(`${winnerNick} 승리! ${reason}`, { duration: 5000 });
    }
  }, [gameData?.winner, gameData?.winType, myId, gameData?.players, gameData?.finishReason]);

  /* ── 6선승 오버레이 ── */
  useEffect(() => {
    if (!gameData?.winType || !gameData?.winner) return;
    if (prevWinTypeRef.current === gameData.winType) return;
    prevWinTypeRef.current = gameData.winType;
    if (gameData.winType === 'score') {
      const winnerNick = gameData.players[gameData.winner]?.nickname ?? '???';
      setWinsixOverlay({ winnerNick });
      const t = setTimeout(() => setWinsixOverlay(null), 3000);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameData?.winType, gameData?.winner]);

  /* ── 라운드 전환 오버레이 (숨김 타이머는 phase 변경으로 취소되지 않게 ref 사용) ── */
  useEffect(() => {
    if (!gameData) return;
    const prevRound = prevRoundRef.current;
    prevRoundRef.current = gameData.round;
    if (prevRound === null) return;
    if (gameData.round > prevRound && gameData.phase === 'firstSubmit') {
      const firstNick = gameData.players[gameData.firstPlayerId]?.nickname ?? '선플';
      setRoundOverlay({ round: gameData.round, firstNick });
      if (roundOverlayHideTimerRef.current) clearTimeout(roundOverlayHideTimerRef.current);
      roundOverlayHideTimerRef.current = setTimeout(() => {
        setRoundOverlay(null);
        roundOverlayHideTimerRef.current = null;
      }, 1600);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameData?.round, gameData?.phase]);

  /* ── 재대결 오버레이 ── */
  useEffect(() => {
    if (!gameData) return;
    const prevRematch = prevRematchRef.current;
    prevRematchRef.current = gameData.rematchIndex;
    if (prevRematch !== null && gameData.rematchIndex > prevRematch) {
      setRematchOverlay(gameData.rematchIndex);
      const t = setTimeout(() => setRematchOverlay(null), 2400);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameData?.rematchIndex]);

  /* ── Reveal 단계별 타이머 ── */
  useEffect(() => {
    const phase = gameData?.phase;
    if (phase === undefined) return;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (phase === 'reveal' && prev !== 'reveal') {
      setRevealStep(0);
      const t1 = setTimeout(() => setRevealStep(1), 500);
      const t2 = setTimeout(() => setRevealStep(2), 1600);
      const t3 = setTimeout(() => setRevealStep(3), 2700);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [gameData?.phase]);

  /* ── 내 차례 시 바텀시트 자동 열기 ── */
  useEffect(() => {
    if (!gameData || isSpectator) return;
    const isMyTurn =
      (gameData.phase === 'firstSubmit'  && myId === gameData.firstPlayerId) ||
      (gameData.phase === 'secondSubmit' && myId !== gameData.firstPlayerId);
    const tid = setTimeout(() => setSheetOpen(isMyTurn), 0);
    return () => clearTimeout(tid);
  }, [gameData, myId, isSpectator]);

  /* ── 로딩 ── */
  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">게임을 불러오는 중...</p>
      </div>
    );
  }

  /* ── 파생 값 ── */
  const playerEntries = Object.entries(gameData.players);
  const myPlayer      = playerEntries.find(([id]) => id === myId)?.[1];
  const opponentEntry = playerEntries.find(([id]) => id !== myId);

  const isFirst = myId === gameData.firstPlayerId;
  const fp      = gameData.players[gameData.firstPlayerId];
  const secondId = playerEntries.find(([id]) => id !== gameData.firstPlayerId)?.[0];
  const sp       = secondId ? gameData.players[secondId] : undefined;

  const isMyTurn =
    !isSpectator &&
    ((gameData.phase === 'firstSubmit'  && isFirst) ||
     (gameData.phase === 'secondSubmit' && !isFirst));

  const isReveal = gameData.phase === 'reveal' || gameData.phase === 'finished';
  const inPlay   = gameData.phase === 'firstSubmit' || gameData.phase === 'secondSubmit';

  // prevPhaseRef는 effect 실행 후 갱신되므로, 새 reveal 첫 렌더 시점에는 아직 이전 phase 값.
  // revealStep이 이전 라운드의 3에서 리셋되기 전에 RevealPanel이 렌더되는 타이밍 버그 방지.
  const displayRevealStep = isReveal && prevPhaseRef.current === 'reveal' ? revealStep : 0;
  const firstDigits = gameData.firstHint?.digits ?? null;

  const opponentUsed =
    opponentEntry && !isSpectator
      ? computeOpponentUsed(gameData.roundHistory, opponentEntry[0])
      : null;

  /* ── 내 자릿수 힌트 (선플 대기 중) ── */
  const myDigitsHint =
    isFirst && gameData.phase === 'firstSubmit' ? mySlotLength : null;

  /* ── 힌트 패널 key (변경 시 remount → 애니메이션 재생) ── */
  const hintKey = firstDigits != null ? `hint-${firstDigits}` : myDigitsHint != null ? `my-${myDigitsHint}` : 'empty';

  /* ── 제시 입력 영역 ── */
  const inputContent =
    isMyTurn && myPlayer?.tiles ? (
      <div className="space-y-3">
        {/* 후플: 모바일 힌트 (BottomSheet 안) */}
        {!isFirst && firstDigits != null && (
          <div className="lg:hidden">
            <DigitHintPanel
              firstNick={fp?.nickname ?? '선플'}
              firstDigits={firstDigits}
              myDigitsHint={null}
              isFirstSelf={false}
              meow={isMeow}
            />
          </div>
        )}
        <TileInput
          key={`${gameData.rematchIndex}-${gameData.round}-${isFirst ? 'first' : 'second'}`}
          myTiles={myPlayer.tiles}
          actionType={isFirst ? 'submitFirst' : 'submitSecond'}
          label={isFirst ? '타일을 제시하세요 (선플)' : '타일을 제시하세요 (후플)'}
          firstDigits={firstDigits}
          onSlotLengthChange={setMySlotLength}
          skin={skin}
        />
      </div>
    ) : null;

  /* ══════════ JSX ══════════ */
  return (
    <>
      <style>{`
        @keyframes sbnwPopIn {
          0%   { transform: scale(0.85); opacity: 0; }
          70%  { transform: scale(1.05); }
          100% { transform: scale(1.0);  opacity: 1; }
        }
        @keyframes slotPush {
          from { transform: translateY(-10px) scale(0.75); opacity: 0; }
          to   { transform: translateY(0)     scale(1);    opacity: 1; }
        }
        @keyframes digitHintIn {
          0%   { transform: scale(0.5) translateY(-8px); opacity: 0; box-shadow: 0 0 0 0 rgba(99,102,241,0); }
          60%  { transform: scale(1.05) translateY(0);   opacity: 1; box-shadow: 0 0 20px 4px rgba(99,102,241,0.4); }
          100% { transform: scale(1)   translateY(0);    opacity: 1; box-shadow: 0 0 0 0 rgba(99,102,241,0); }
        }
        .digit-hint-enter { animation: digitHintIn 500ms cubic-bezier(0.175,0.885,0.32,1.275) forwards; }
        @keyframes winsixIn {
          0%   { transform: scale(0.6); opacity: 0; }
          60%  { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>

      <div className="flex h-full">
        <div className="flex flex-1 flex-col lg:flex-row">

          {/* ══ 메인 영역 ══ */}
          <div
            className={`flex flex-1 flex-col items-center gap-3 overflow-y-auto p-3 pb-24 lg:p-5 lg:pb-5 ${
              isMeow ? 'skin-meow-field' : ''
            }`}
          >
            {isMeow && <MeowFieldFx />}

            {/* 모바일 플레이어 요약 바 — 6칸 dot 포함 */}
            <div className="flex w-full max-w-sm gap-2 lg:hidden">
              {playerEntries.map(([id, p]) => {
                const isMe   = id === myId;
                const dots   = Array.from({ length: 6 }, (_, i) => i < p.score);
                return (
                  <div
                    key={id}
                    className={`flex flex-1 flex-col gap-0.5 rounded-lg border px-3 py-1.5 text-xs ${
                      isMe ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`truncate font-medium ${isMe ? 'text-indigo-700' : 'text-gray-700'}`}>
                        {isMe ? '나' : p.nickname}
                        {id === gameData.firstPlayerId && <span className="ml-1 text-xs text-amber-500">(선)</span>}
                      </span>
                      <span className="ml-1 shrink-0 tabular-nums text-gray-500">{p.tileCount}개</span>
                    </div>
                    <div className="flex gap-0.5">
                      {dots.map((filled, i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                            filled
                              ? isMe ? 'bg-indigo-400' : 'bg-gray-500'
                              : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 라운드 헤더 */}
            <div className="relative z-10 text-center">
              <div className={`text-xl font-bold ${isMeow ? 'skin-meow-heading' : 'text-gray-800'}`}>
                {isMeow ? '🐱 ' : ''}라운드 {gameData.round} / 11{isMeow ? ' 🐾' : ''}
              </div>
              {gameData.rematchIndex > 0 && (
                <div className="mt-0.5 inline-block rounded bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                  재대결 {gameData.rematchIndex}회차
                </div>
              )}
              {fp && (
                isMeow ? (
                  <div className="mt-1"><span className="skin-meow-ribbon">{fp.nickname} 선플</span></div>
                ) : (
                  <div className="mt-0.5 text-sm text-amber-600">{fp.nickname} 선플</div>
                )
              )}
            </div>

            {/* 상태 메시지 */}
            <div className={`relative z-10 text-center text-sm ${isMeow ? 'skin-meow-subtext' : 'text-gray-500'}`}>
              {gameState?.message}
            </div>

            {/* DigitHintPanel — key로 remount 시 팝인 애니메이션 */}
            {(gameData.phase === 'secondSubmit' || gameData.phase === 'firstSubmit') && (
              <div key={hintKey} className="w-full max-w-sm">
                <DigitHintPanel
                  firstNick={fp?.nickname ?? '선플'}
                  firstDigits={firstDigits}
                  myDigitsHint={myDigitsHint}
                  isFirstSelf={isFirst}
                  meow={isMeow}
                />
              </div>
            )}

            {/* 데스크톱: 페이즈별 메인 영역 */}
            <div className="hidden w-full max-w-sm lg:block">
              {isSpectator && inPlay ? (
                <WaitingCard text="플레이어들이 타일을 선택 중..." meow={isMeow} />
              ) : isReveal && gameData.revealData ? (
                <RevealPanel
                  revealData={gameData.revealData}
                  players={gameData.players}
                  myId={myId}
                  firstPlayerId={gameData.firstPlayerId}
                  step={displayRevealStep}
                  meow={isMeow}
                />
              ) : isMyTurn ? (
                inputContent
              ) : inPlay ? (
                <WaitingCard
                  text={
                    gameData.phase === 'firstSubmit'
                      ? `${fp?.nickname ?? '선플'}이 타일 선택 중...`
                      : `${sp?.nickname ?? '후플'}이 타일 선택 중...`
                  }
                  meow={isMeow}
                />
              ) : null}
            </div>

            {/* 모바일: RevealPanel */}
            {isReveal && gameData.revealData && (
              <div className="w-full max-w-sm lg:hidden">
                <RevealPanel
                  revealData={gameData.revealData}
                  players={gameData.players}
                  myId={myId}
                  firstPlayerId={gameData.firstPlayerId}
                  step={displayRevealStep}
                  meow={isMeow}
                />
              </div>
            )}

            {/* 모바일: 대기 카드 */}
            {!isMyTurn && !isReveal && inPlay && !isSpectator && (
              <div className="w-full max-w-sm lg:hidden">
                <WaitingCard
                  text={
                    gameData.phase === 'firstSubmit'
                      ? `${fp?.nickname ?? '선플'}이 타일 선택 중...`
                      : `${sp?.nickname ?? '후플'}이 타일 선택 중...`
                  }
                  meow={isMeow}
                />
              </div>
            )}

            {isSpectator && inPlay && (
              <div className="w-full max-w-sm lg:hidden">
                <WaitingCard text="플레이어들이 타일을 선택 중..." meow={isMeow} />
              </div>
            )}

            {/* 상대 Tracker: 데스크톱 — 메인 영역 내 (bnw2 패턴) */}
            {/* unmount 방지: inPlay가 아닐 때도 마운트 유지, CSS로만 숨김 */}
            {opponentUsed && !isSpectator && (
              <div className={`w-full max-w-sm ${inPlay ? 'hidden lg:block' : 'hidden'}`}>
                <OpponentTileTracker
                  opponentUsed={opponentUsed}
                  rematchIndex={gameData.rematchIndex}
                  skin={skin}
                />
              </div>
            )}

            {/* 상대 Tracker: 모바일 — 항상 메인 영역에 표시 (내 차례 포함) */}
            {opponentUsed && !isSpectator && (
              <div className={`w-full max-w-sm lg:hidden ${inPlay && !isReveal ? '' : 'hidden'}`}>
                <OpponentTileTracker
                  opponentUsed={opponentUsed}
                  rematchIndex={gameData.rematchIndex}
                  skin={skin}
                />
              </div>
            )}

            {/* 모바일: 라운드 기록 접기 */}
            {gameData.roundHistory.length > 0 && (
              <div className="w-full max-w-sm lg:hidden">
                <details className="rounded-lg border border-gray-200 bg-white">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-600">
                    라운드 기록 ({gameData.roundHistory.length})
                  </summary>
                  <div className="border-t border-gray-100 px-3 py-2">
                    <RoundHistoryTable
                      history={gameData.roundHistory}
                      players={gameData.players}
                      myId={myId}
                    />
                  </div>
                </details>
              </div>
            )}

            {gameData.finishReason && gameData.phase === 'finished' && (
              <div className="w-full max-w-sm rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-center text-sm text-indigo-700">
                {gameData.finishReason}
              </div>
            )}
          </div>

          {/* ══ 데스크톱 사이드 패널 ══ */}
          <div className="hidden lg:flex lg:w-64 lg:flex-col lg:gap-3 lg:border-l lg:border-gray-200 lg:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">점수</p>
            {playerEntries.map(([id, p]) => (
              <ScoreCard
                key={id}
                info={p}
                isMe={id === myId}
                isFirst={id === gameData.firstPlayerId}
              />
            ))}

            {gameData.rematchIndex > 0 && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-center text-xs font-semibold text-rose-700">
                Rematch #{gameData.rematchIndex}
              </div>
            )}

            {/* 라운드 기록 */}
            {gameData.roundHistory.length > 0 && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  라운드 기록
                </p>
                <div className="flex-1 overflow-y-auto">
                  <RoundHistoryTable
                    history={gameData.roundHistory}
                    players={gameData.players}
                    myId={myId}
                  />
                </div>
              </div>
            )}

            {/* 세그먼트 기록 */}
            {gameData.segmentsHistory.length > 0 && (
              <details className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
                <summary className="cursor-pointer font-semibold text-gray-500">
                  지난 세그먼트 ({gameData.segmentsHistory.length})
                </summary>
                <div className="mt-1 space-y-1 text-gray-500">
                  {gameData.segmentsHistory.map((seg) => (
                    <div key={seg.rematchIndex} className="tabular-nums">
                      #{seg.rematchIndex} · {seg.rounds.length}R ·{' '}
                      {seg.resolution === 'rematchNeeded'
                        ? '재대결'
                        : seg.winnerId
                          ? (gameData.players[seg.winnerId]?.nickname ?? '승자') + ' 승'
                          : '무승부'}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>

      {/* ══ 모바일 바텀시트 ══ */}
      {!isSpectator && (
        <>
          {isMyTurn && !sheetOpen && (
            <button
              onClick={() => setSheetOpen(true)}
              className={`fixed inset-x-4 bottom-20 z-(--cdm-z-modal) py-3 text-sm font-bold text-white shadow-lg lg:hidden ${
                isMeow ? 'skin-meow-cta' : 'rounded-xl bg-indigo-600'
              }`}
            >
              {isMeow ? '타일 제시하기 🐾' : '타일 제시하기 →'}
            </button>
          )}
          <BottomSheet open={sheetOpen && isMyTurn} onClose={() => setSheetOpen(false)}>
            {inputContent}
          </BottomSheet>
        </>
      )}

      {/* ══ 라운드 전환 오버레이 ══ */}
      <div
        className={`pointer-events-none fixed inset-0 z-(--cdm-z-modal) flex items-center justify-center transition-all duration-300 ${
          roundOverlay ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {roundOverlay && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-indigo-400/30 bg-indigo-900/90 px-10 py-6 text-center text-white shadow-2xl backdrop-blur-sm">
            <p className="text-2xl font-bold">라운드 {roundOverlay.round} 시작</p>
            <p className="text-sm text-indigo-300">{roundOverlay.firstNick} 선플</p>
          </div>
        )}
      </div>

      {/* ══ 재대결 오버레이 ══ */}
      <div
        className={`pointer-events-none fixed inset-0 z-(--cdm-z-modal) flex items-center justify-center transition-all duration-300 ${
          rematchOverlay != null ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {rematchOverlay != null && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-rose-400/50 bg-rose-900/95 px-12 py-8 text-center text-white shadow-2xl backdrop-blur-sm">
            <p className="text-3xl font-bold">재대결</p>
            <p className="text-lg font-medium text-rose-200">#{rematchOverlay}</p>
            <p className="text-sm text-rose-200">선후 교대 · 타일 리셋</p>
          </div>
        )}
      </div>

      {/* ══ 6선승 달성 오버레이 ══ */}
      <div
        className={`pointer-events-none fixed inset-0 z-(--cdm-z-modal) flex items-center justify-center transition-all duration-500 ${
          winsixOverlay ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {winsixOverlay && (
          <div
            style={{ animation: 'winsixIn 500ms cubic-bezier(0.175,0.885,0.32,1.275) forwards' }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-yellow-400/60 bg-indigo-900/95 px-12 py-8 text-center text-white shadow-2xl backdrop-blur-sm"
          >
            <p className="text-5xl"></p>
            <p className="text-3xl font-bold text-yellow-300">6점 달성!</p>
            <p className="text-lg font-medium text-indigo-200">{winsixOverlay.winnerNick} 승리</p>
          </div>
        )}
      </div>
    </>
  );
}
