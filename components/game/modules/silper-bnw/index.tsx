'use client';

import GameLoading from '@/components/game/GameLoading';

import { josa } from '@/shared/lib/josa';
import { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { toast } from 'sonner';
import { SBNW_MAX_SCORE, SBNW_TOTAL_ROUNDS } from '@/shared/types/silper-bnw';
import type {
  SBNWGameData,
  SBNWPlayerInfo,
  SBNWRevealData,
  SBNWRoundRecord,
  SBNWTile,
} from '@/shared/types/silper-bnw';
import TileInput, { TILE_COLORS } from './TileInput';
import OpponentTileTracker from './OpponentTileTracker';
import MeowFieldFx from './skins/MeowFieldFx';
import { getSkinTheme, type SkinTheme } from '@/lib/skins/registry';
import { GAME_IDS } from '@/shared/types/game';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { seatStage, turnStage, submitStage } from '@/lib/gameSeat';
import { GameScoreLine } from '@/components/game/GameScoreLine';

const WIN_TYPE_LABELS: Record<string, string> = {
  score: `승점 ${SBNW_MAX_SCORE}선승`,
  roundsScore: `${SBNW_TOTAL_ROUNDS}라운드 종료 후 승점 우세`,
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
        <div className="skin-meow-cat-img skin-meow-cat-img--sleep h-14 w-20" aria-hidden />
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
                  ? `skin-meow-tile-sprite skin-meow-tile-sprite--${t} inline-block h-9 shrink-0`
                  : `flex h-8 w-8 items-center justify-center rounded-lg border-2 text-sm font-bold ${c.bg} ${c.border} ${c.text}`
              }
            >
              {/* 냥냥: 숫자는 스프라이트에 포함 */}
              {!meow && t}
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

function SilperSidePanel({
  gameData,
  myId,
  opponentId,
  skin,
  showTracker,
}: {
  gameData: SBNWGameData;
  myId: string;
  opponentId: string | null;
  skin: SkinTheme | null;
  showTracker: boolean;
}) {
  const opponentUsed = opponentId ? computeOpponentUsed(gameData.roundHistory, opponentId) : null;
  return (
    <GameInfoStack>
      {showTracker && opponentUsed && (
        <GameInfoPart>
          <OpponentTileTracker opponentUsed={opponentUsed} rematchIndex={gameData.rematchIndex} skin={skin} />
        </GameInfoPart>
      )}
      <GameInfoPart title="점수">
        <div className="space-y-1.5">
          {Object.entries(gameData.players).map(([id, player]) => (
            <ScoreCard key={id} info={player} isMe={id === myId} isFirst={id === gameData.firstPlayerId} />
          ))}
        </div>
        {gameData.rematchIndex > 0 && (
          <p className="mt-2 rounded-md bg-cdm-accent/15 px-2 py-1.5 text-center text-xs font-bold text-cdm-accent">
            재대결 {gameData.rematchIndex}회차
          </p>
        )}
      </GameInfoPart>
      <GameInfoPart title="라운드 기록">
        {gameData.roundHistory.length ? (
          <RoundHistoryTable history={gameData.roundHistory} players={gameData.players} myId={myId} />
        ) : (
          <p className="text-xs text-cdm-ink-fg-muted">아직 기록이 없습니다.</p>
        )}
      </GameInfoPart>
      {gameData.segmentsHistory.length > 0 && (
        <GameInfoPart title="지난 세그먼트">
          <div className="space-y-1 text-xs text-cdm-ink-fg-muted">
            {gameData.segmentsHistory.map((segment) => (
              <div key={segment.rematchIndex} className="tabular-nums">
                #{segment.rematchIndex} · {segment.rounds.length}R ·{' '}
                {segment.resolution === 'rematchNeeded'
                  ? '재대결'
                  : segment.winnerId
                    ? `${gameData.players[segment.winnerId]?.nickname ?? '승자'} 승`
                    : '무승부'}
              </div>
            ))}
          </div>
        </GameInfoPart>
      )}
    </GameInfoStack>
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
          style={{ paddingBottom: 'max(16px, var(--cdm-safe-bottom, 0px))' }}
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
  /*
    상단 바 — 라운드·차례. 상대 잔여 타일은 좁은 화면에서 '메모' 로 연다.
    이 모듈은 아직 GameFrame 을 쓰지 않아 무대/조작 규약은 그대로 두었다.
  */
  const { setHud } = useRoomLayout();
  const sbRound = gameData?.round ?? 0;
  const sbOppId = gameData && myId
    ? (Object.keys(gameData.players).find((id) => id !== myId) ?? null)
    : null;
  /* 자리와 단계를 같이 (lib/gameSeat.ts) */
  const sbIsFirst = gameData ? myId === gameData.firstPlayerId : false;
  const sbSeat = isSpectator ? null : sbIsFirst ? '선' : '후';
  const sbPhaseLabel = seatStage(
    sbSeat,
    gameData?.phase === 'firstSubmit' || gameData?.phase === 'secondSubmit'
      ? turnStage({
          finished: false,
          isSpectator,
          isMyTurn:
            (gameData.phase === 'firstSubmit' && sbIsFirst) ||
            (gameData.phase === 'secondSubmit' && !sbIsFirst),
          spectatorStage: gameData.phase === 'firstSubmit' ? '선 선택' : '후 선택',
        })
      : gameData?.phase === 'reveal'
        ? '타일 공개'
        : gameData?.phase === 'finished'
          ? '종료'
          : undefined,
  );
  useEffect(() => {
    if (!gameData) return;
    setHud({
      round: `${sbRound} / ${SBNW_TOTAL_ROUNDS}R`,
      order: sbPhaseLabel,
      memo: <SilperSidePanel gameData={gameData} myId={myId} opponentId={sbOppId} skin={skin} showTracker={!isSpectator} />,
    });
    return () => setHud(null);
  }, [setHud, gameData, sbRound, myId, sbOppId, sbPhaseLabel, skin, isSpectator]);

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

  /*
    ── Reveal 단계별 타이머 ──

    'reveal' 과 'finished' 를 한 덩어리로 본다. 승부가 나는 라운드에서 서버는
    applyReveal 안에서 phase='reveal' 을 보내고 곧바로 resolveGame 이 'finished'
    를 보낸다 — 같은 tick 이라 클라이언트에는 사실상 'finished' 하나만 도착한다.
    'reveal' 만 조건으로 두면 그 마지막 라운드는 타이머가 아예 안 걸려, 승부를
    가른 타일이 ??? 인 채로 게임이 끝난다.
  */
  useEffect(() => {
    const phase = gameData?.phase;
    if (phase === undefined) return;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    const revealing = phase === 'reveal' || phase === 'finished';
    const wasRevealing = prev === 'reveal' || prev === 'finished';
    if (revealing && !wasRevealing) {
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
        <GameLoading label="게임을 불러오는 중" />
      </div>
    );
  }

  /* ── 파생 값 ── */
  const playerEntries = Object.entries(gameData.players);
  const myPlayer      = playerEntries.find(([id]) => id === myId)?.[1];

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
  const displayRevealStep =
    isReveal && (prevPhaseRef.current === 'reveal' || prevPhaseRef.current === 'finished')
      ? revealStep
      : 0;
  const firstDigits = gameData.firstHint?.digits ?? null;

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

            {/*
              점수는 늘 보이게 둔다 — 6선승이라 몇 대 몇인지가 판 전체의 상태다.
              메모 안에만 있으면 매 라운드 버튼을 눌러야 한다. 좁은 화면 몫이라
              넓은 화면에서는 오른쪽 패널이 이미 같은 것을 펴 놓고 있다.
              (components/game/GameScoreLine.tsx)
            */}
            <div className="w-full max-w-sm lg:hidden">
              <GameScoreLine
                entries={Object.values(gameData.players).map((p) => ({
                  label: p.id === myId ? '나' : p.nickname,
                  isMe: p.id === myId,
                  tag: p.id === gameData.firstPlayerId ? '선' : '후',
                  value: `${p.score}/${SBNW_MAX_SCORE}`,
                  // 상대 tiles 는 마스킹되어 null 이다. 공개값인 tileCount 를 쓴다.
                  hint: `${p.tileCount}장`,
                }))}
              />
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
                      ? `${josa(fp?.nickname ?? '선플', '이/가')} 타일 선택 중...`
                      : `${josa(sp?.nickname ?? '후플', '이/가')} 타일 선택 중...`
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
                      ? `${josa(fp?.nickname ?? '선플', '이/가')} 타일 선택 중...`
                      : `${josa(sp?.nickname ?? '후플', '이/가')} 타일 선택 중...`
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

            {gameData.finishReason && gameData.phase === 'finished' && (
              <div className="w-full max-w-sm rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-center text-sm text-indigo-700">
                {gameData.finishReason}
              </div>
            )}
          </div>

          {/* ══ 데스크톱 사이드 패널 ══ */}
          <div className="hidden lg:flex lg:w-72 lg:flex-col lg:p-3">
            <SilperSidePanel gameData={gameData} myId={myId} opponentId={sbOppId} skin={skin} showTracker={!isSpectator} />
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
