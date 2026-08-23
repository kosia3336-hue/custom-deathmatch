'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNicknameStore } from '@/stores/nickname';
import { useRankMatchStore } from '@/stores/rankMatch';
import { useLobbyChatStore } from '@/stores/lobbyChat';
import { useRoomStore } from '@/stores/room';
import { playRankMatchBellSfx } from '@/lib/sfx';
import { RANK_VS_NAV_SEC, RANK_VS_SEC, RankVsView } from '@/components/rank/RankVsView';

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
    const go = setTimeout(() => {
      useLobbyChatStore.getState().clearAll();
      useRoomStore.getState().reset();
      router.push(`/room/${matched.roomId}/play`);
      useRankMatchStore.getState().clearMatched();
    }, RANK_VS_NAV_SEC * 1000);
    return () => {
      clearInterval(i);
      clearTimeout(go);
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
    />
  );
}
