'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/room';
import { useNicknameStore } from '@/stores/nickname';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { Button } from '@/components/cdm/Button';
import { Countdown } from '@/components/cdm/Countdown';
import { GAME_IDS } from '@/shared/types/game';
import { Card } from '@/components/cdm/Card';
import RoomChat from '@/components/room/RoomChat';
import { VIEWER_MAP } from '@/components/archive/LogViewer';
import GameLogView from '@/components/game/GameLogView';
import { RankResultSection } from '@/components/game/RankResultSection';
import type { GameLogPlayer, GameLogMeta } from '@/components/game/GameLogView';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { useMySocketId } from '@/hooks/useMySocketId';
import ResultShareButton from './ResultShareButton';
import type { GameRecordFile } from '@/shared/types/archive';
import type { TitleColor } from '@/lib/supabase/database.types';
import { isRankQueueAcceptingNewJoins, isRankQueueOpen } from '@shared/rank/kst';
import { RANK_REJOIN_STORAGE_KEY } from '@/components/lobby/RankAutoJoinFromQuery';

const AUTO_LEAVE_SEC = 120;

/**
 * 게임 결과 화면 컨텍스트 래퍼.
 * 소켓 상태에서 데이터를 읽어 GameLogView에 전달하고,
 * 타이머 / 다시하기 / 결과 채팅을 추가한다.
 * 페이지 이동 없이 방 레이아웃 내에서 렌더된다.
 */
export default function ResultLog() {
  const myId = useMySocketId();
  const router = useRouter();
  const gameResult = useRoomStore((s) => s.gameResult);
  const rankGameEnded = useRoomStore((s) => s.rankGameEnded);
  const room = useRoomStore((s) => s.room);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const { member } = useCurrentMember();
  const { setHeaderRight, setFooter } = useRoomLayout();
  const [cancelled, setCancelled] = useState(false);
  const nickname = useNicknameStore((s) => s.nickname);
  const [queueClock, setQueueClock] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setQueueClock((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const rankQueueOpenNow = isRankQueueOpen();
  const rankQueueCanJoinNow = isRankQueueAcceptingNewJoins();

  const isSpecialSolo =
    nickname === '천하' &&
    (room?.gameId === GAME_IDS.FOUR_GRAVITY || room?.gameId === GAME_IDS.DOUBLE_SIDED_CHESS) &&
    room?.playMode === 'solo';

  const handleLobby = useCallback(() => {
    getSocket().emit('game:leave');
    useRoomStore.getState().reset();
    router.push('/lobby');
  }, [router]);

  const handleRankRequeue = useCallback(() => {
    if (!member) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    if (!isRankQueueOpen()) {
      toast.error('랭크 운영 시간이 아닙니다. (평일 21:00~익일 01:00 KST / 주말 24시간)');
      return;
    }
    if (!isRankQueueAcceptingNewJoins()) {
      toast.error('운영 종료 1분 전입니다. 새 랭크 매칭을 시작할 수 없습니다.');
      return;
    }
    try {
      sessionStorage.setItem(RANK_REJOIN_STORAGE_KEY, '1');
    } catch {
      toast.error('브라우저 저장소를 사용할 수 없어 자동 매칭을 시작할 수 없습니다.');
      return;
    }
    getSocket().emit('game:leave');
    useRoomStore.getState().reset();
    router.push('/lobby');
  }, [member, router]);

  const handleRematch = useCallback(() => {
    if (!room) return;
    setCancelled(true);
    getSocket().emit('game:rematch');
    useRoomStore.getState().setGameResult(null);
    if (room.playMode === 'multi') {
      router.push(`/room/${room.id}`);
    } else {
      router.push(`/room/${room.id}/play`);
    }
  }, [room, router]);

  useEffect(() => {
    setHeaderRight(
      <Button variant="ghost" size="sm" onClick={handleLobby}>
        로비로
      </Button>,
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight, handleLobby]);

  useEffect(() => {
    if (!isSpecialSolo) return;
    const socket = getSocket();
    const handleGameState = () => {
      useRoomStore.getState().setGameResult(null);
      router.push(`/room/${room?.id}/play`);
    };
    socket.on('game:state', handleGameState);
    return () => { socket.off('game:state', handleGameState); };
  }, [isSpecialSolo, room?.id, router]);

  useEffect(() => {
    const showRankRequeue =
      !!gameResult
      && gameResult.isRanked === true
      && room?.isRanked === true
      && room.playMode === 'multi'
      && !isSpectator
      && !!member;

    setFooter(
      <>
        {!cancelled && (
          <span className="mr-auto inline-flex items-center gap-1 text-xs text-cdm-fg-muted">
            <Countdown seconds={AUTO_LEAVE_SEC} onComplete={handleLobby} format="mm:ss" />
            <span>후 자동 이동</span>
          </span>
        )}
        {isSpecialSolo && (
          <Button
            variant="secondary"
            onClick={() => { getSocket().emit('game:undo:request'); }}
          >
            무르기
          </Button>
        )}
        {showRankRequeue && (
          <Button
            variant="secondary"
            disabled={!rankQueueCanJoinNow}
            title={
              rankQueueCanJoinNow
                ? '로비로 이동 후 랭크 매칭을 다시 시작합니다'
                : rankQueueOpenNow
                  ? '운영 종료 1분 전에는 새 매칭을 시작할 수 없습니다'
                  : '평일 21:00~01:00 KST / 주말 24시간'
            }
            onClick={handleRankRequeue}
          >
            다시 큐
          </Button>
        )}
        {!room?.isRanked && <Button onClick={handleRematch}>다시하기</Button>}
        <Button variant="secondary" onClick={handleLobby}>로비로</Button>
      </>,
    );
    return () => setFooter(null);
  }, [
    setFooter,
    cancelled,
    isSpecialSolo,
    handleRematch,
    handleLobby,
    handleRankRequeue,
    gameResult,
    room,
    isSpectator,
    member,
    rankQueueOpenNow,
    rankQueueCanJoinNow,
    queueClock,
  ]);

  if (!gameResult) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-cdm-fg-muted">결과를 불러오는 중...</p>
      </div>
    );
  }

  const sortedRanks = [...gameResult.rankings].sort((a, b) => a.rank - b.rank);
  const isDoubleLoss = sortedRanks.length >= 2 && sortedRanks.every((r) => r.rank !== 1);
  const isDraw =
    !isDoubleLoss && sortedRanks.length >= 2 && sortedRanks[0].rank === sortedRanks[1].rank;
  const resignOf = (rank: number | undefined) =>
    gameResult.endedByForfeit === true && rank === 2 && !isDoubleLoss;
  const myRanking = gameResult.rankings.find((r) => r.playerId === myId);
  const shareResult = isDoubleLoss
    ? '양쪽 패배'
    : sortedRanks.length < 2
      ? '완료'
      : isDraw
        ? '무승부'
        : myRanking?.rank === 1
          ? '승리'
          : '패배';

  // GameLogView용 players 변환
  const players: GameLogPlayer[] = room
    ? room.players.map((p, i) => {
        const ranking = gameResult.rankings.find((r) => r.playerId === p.id);
        return {
          nickname: ranking?.nickname ?? p.nickname,
          title: p.displayedTitle
            ? {
                name: p.displayedTitle.name,
                color: p.displayedTitle.color as TitleColor,
                effect: p.displayedTitle.effect ?? null,
              }
            : null,
          turn: i === 0 ? 'first' : 'second',
          isWinner: !isDraw && !isDoubleLoss && ranking?.rank === 1,
          isDraw,
          isDoubleLoss,
          isResign: resignOf(ranking?.rank),
        };
      })
    : sortedRanks.map((r, i) => ({
        nickname: r.nickname,
        title: null,
        turn: i === 0 ? ('first' as const) : ('second' as const),
        isWinner: !isDraw && !isDoubleLoss && r.rank === 1,
        isDraw,
        isDoubleLoss,
        isResign: resignOf(r.rank),
      }));

  // GameLogView용 meta 변환
  const meta: GameLogMeta = {
    gameId: room?.gameId ?? '',
    gameName: room?.gameName ?? '',
    playedAt: new Date().toISOString(),
    playTimeMs: gameResult.playTime,
    totalTurns: gameResult.totalTurns,
    mode: room?.playMode ?? 'multi',
    countsForStats: room?.playMode === 'multi',
  };

  // archive viewer용 GameRecordFile
  const rankEndedMatch =
    rankGameEnded && rankGameEnded.roomId === gameResult.roomId ? rankGameEnded : null;

  const myRankOutcome = (() => {
    if (isSpectator || !member) return undefined;
    const fromEnded = gameResult.rankOutcome?.players.find((p) => p.memberId === member.id);
    if (fromEnded) return fromEnded;
    if (!rankEndedMatch) return undefined;
    return {
      memberId: member.id,
      nickname: nickname ?? '',
      rpDelta: rankEndedMatch.myRpChange,
      tierBefore: rankEndedMatch.tierBefore,
      tierAfter: rankEndedMatch.tierAfter,
      rpBefore: rankEndedMatch.rpBefore,
      rpAfter: rankEndedMatch.rpAfter,
      promoted: rankEndedMatch.promoted,
      demoted: rankEndedMatch.demoted,
      placementJustFinished: rankEndedMatch.placementJustFinished === true,
      placementMatch: rankEndedMatch.placementMatch === true,
    };
  })();

  const Viewer = room ? VIEWER_MAP[room.gameId] : undefined;

  const record: GameRecordFile | null = room
    ? {
        version: '2',
        gameId: room.gameId,
        gameName: room.gameName,
        playedAt: new Date().toISOString(),
        playMode: room.playMode,
        players: room.players.reduce<Record<string, { nickname: string }>>((acc, p) => {
          const ranking = gameResult.rankings.find((r) => r.playerId === p.id);
          acc[p.id] = { nickname: ranking?.nickname ?? p.nickname };
          return acc;
        }, {}),
        result: {
          rankings: gameResult.rankings.map((r) => ({
            nickname: r.nickname,
            rank: r.rank,
            score: r.score,
          })),
          playTime: gameResult.playTime,
          totalTurns: gameResult.totalTurns,
        },
        gameRecord: gameResult.gameResultData ?? null,
      }
    : null;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 md:px-6">
      {!isSpectator && myRanking && (
        <div className="mb-4 flex justify-end">
          <ResultShareButton
            summary={{
              gameName: room?.gameName ?? '게임',
              result: shareResult,
              playTimeMs: gameResult.playTime,
              totalTurns: gameResult.totalTurns,
            }}
          />
        </div>
      )}
      <GameLogView
        players={players}
        meta={meta}
        record={Viewer && record ? record : null}
        viewingAs="self"
      />

      {myRankOutcome ? (
        <RankResultSection outcome={myRankOutcome} rankEnded={rankEndedMatch} />
      ) : null}

      {/* 결과 채팅 (멀티 모드만) */}
      {room?.playMode === 'multi' && (
        <Card className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-cdm-fg">결과 채팅</h2>
          <RoomChat scope="room" />
        </Card>
      )}
    </div>
  );
}
