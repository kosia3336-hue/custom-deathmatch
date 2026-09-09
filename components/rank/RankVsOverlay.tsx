'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useNicknameStore } from '@/stores/nickname';
import { useRankMatchStore } from '@/stores/rankMatch';
import { useLobbyChatStore } from '@/stores/lobbyChat';
import { useRoomStore } from '@/stores/room';
import { getSocket } from '@/lib/socket';
import { playRankMatchBellSfx } from '@/lib/sfx';
import { RANK_VS_NAV_SEC, RANK_VS_SEC, RankVsView } from '@/components/rank/RankVsView';
import type { GameResult, RankGameEndedPayload } from '@/shared/types';

function leaveVsToPlay(roomId: string, push: (href: string) => void) {
  useLobbyChatStore.getState().clearAll();
  useRoomStore.getState().reset();
  push(`/room/${roomId}/play`);
  useRankMatchStore.getState().clearMatched();
}

function leaveVsToResult(roomId: string, push: (href: string) => void) {
  useLobbyChatStore.getState().clearAll();
  useRankMatchStore.getState().clearMatched();
  push(`/room/${roomId}/result`);
}

export function RankVsOverlay() {
  const router = useRouter();
  const matched = useRankMatchStore((s) => s.matched);
  const nickname = useNicknameStore((s) => s.nickname);
  const [leftSec, setLeftSec] = useState(RANK_VS_SEC);
  const bellForRoom = useRef<string | null>(null);

  useEffect(() => {
    if (!matched) return;
    if (bellForRoom.current !== matched.roomId) {
      bellForRoom.current = matched.roomId;
      playRankMatchBellSfx();
    }
    setLeftSec(RANK_VS_SEC);
    const i = setInterval(() => setLeftSec((x) => Math.max(0, x - 1)), 1000);

    // 일반 랭크는 매칭 즉시 게임이 켜져 있다. 카운터는 서버가 6초 뒤에 켜므로
    // 클라 타이머로 /play 가면 몰수와 겹친다. 카운터는 room:game:started 를 기다린다.
    if (matched.hiddenMatch === true) {
      return () => clearInterval(i);
    }

    const go = setTimeout(() => {
      leaveVsToPlay(matched.roomId, router.push);
    }, RANK_VS_NAV_SEC * 1000);
    return () => {
      clearInterval(i);
      clearTimeout(go);
    };
  }, [matched, router]);

  useEffect(() => {
    if (!matched) return;
    const socket = getSocket();
    const roomId = matched.roomId;
    const isCounter = matched.hiddenMatch === true;

    const onRankEnded = (payload: RankGameEndedPayload) => {
      if (payload.roomId !== roomId) return;
      useRoomStore.getState().setRankGameEnded(payload);
    };
    const onEnded = (result: GameResult) => {
      if (result.roomId !== roomId) return;
      useRoomStore.getState().setGameResult(result);
      if (result.endedByForfeit) {
        toast.info('상대가 나가 게임이 종료되었습니다.');
      }
      leaveVsToResult(roomId, router.push);
    };
    const onGameStarted = () => {
      const live = useRankMatchStore.getState().matched;
      if (!live || live.roomId !== roomId) return;
      leaveVsToPlay(roomId, router.push);
    };
    const onDisbanded = () => {
      const live = useRankMatchStore.getState().matched;
      if (!live || live.roomId !== roomId) return;
      const stored = useRoomStore.getState().gameResult;
      if (stored?.roomId === roomId) {
        leaveVsToResult(roomId, router.push);
        return;
      }
      useRankMatchStore.getState().clearMatched();
      useRoomStore.getState().reset();
      toast.info('방이 종료되었습니다.');
      router.push('/lobby');
    };

    socket.on('rank:game:ended', onRankEnded);
    socket.on('game:ended', onEnded);
    socket.on('room:disbanded', onDisbanded);
    if (isCounter) socket.on('room:game:started', onGameStarted);

    const stuck = isCounter
      ? setTimeout(() => {
          const live = useRankMatchStore.getState().matched;
          if (!live || live.roomId !== roomId) return;
          const stored = useRoomStore.getState().gameResult;
          if (stored?.roomId === roomId) {
            leaveVsToResult(roomId, router.push);
            return;
          }
          toast.error('게임을 시작하지 못했습니다.');
          useRankMatchStore.getState().clearMatched();
          useRoomStore.getState().reset();
          router.push('/lobby');
        }, (RANK_VS_NAV_SEC + 8) * 1000)
      : null;

    return () => {
      socket.off('rank:game:ended', onRankEnded);
      socket.off('game:ended', onEnded);
      socket.off('room:disbanded', onDisbanded);
      if (isCounter) socket.off('room:game:started', onGameStarted);
      if (stuck) clearTimeout(stuck);
    };
  }, [matched, router]);

  useEffect(() => {
    if (!matched) bellForRoom.current = null;
  }, [matched]);

  if (!matched) return null;

  return (
    <RankVsView
      selfNickname={nickname ?? matched.selfNickname ?? '나'}
      matched={matched}
      leftSec={leftSec}
      hiddenMatch={matched.hiddenMatch === true}
    />
  );
}
