import { create } from 'zustand';
import type { RankTier } from '@/shared/types/rank';
import type { DisplayedTitle } from '@/shared/types/room';

export interface RankMatchedPayload {
  roomId: string;
  opponentNickname: string;
  opponentDisplayedTitle: DisplayedTitle | null;
  opponentTier: RankTier;
  opponentRp: number;
  opponentIsPlacement: boolean;
  selfTier: RankTier;
  selfRp: number;
  selfIsPlacement: boolean;
}

export interface RankMatchTiers {
  selfTier: RankTier;
  selfRp: number;
  selfIsPlacement: boolean;
  opponentTier: RankTier;
  opponentRp: number;
  opponentIsPlacement: boolean;
}

interface RankMatchState {
  queuing: boolean;
  /** 큐 진입 시각 (Date.now()). 어느 컴포넌트에서든 경과 시간 계산에 사용 */
  queueStartedAt: number | null;
  /** 모바일 아이콘 탭 또는 자동 재큐 시 모달 표시 */
  queueModalOpen: boolean;
  serverWaitSeconds: number;
  matched: RankMatchedPayload | null;
  /** clearMatched 후에도 밴픽 화면에서 티어 표시용으로 유지 */
  rankMatchTiers: RankMatchTiers | null;
  setQueuing: (v: boolean) => void;
  setQueueModalOpen: (v: boolean) => void;
  setServerWaitSeconds: (n: number) => void;
  setMatched: (p: RankMatchedPayload | null) => void;
  clearMatched: () => void;
  resetQueueUi: () => void;
}

export const useRankMatchStore = create<RankMatchState>((set) => ({
  queuing: false,
  queueStartedAt: null,
  queueModalOpen: false,
  serverWaitSeconds: 0,
  matched: null,
  rankMatchTiers: null,
  setQueuing: (v) => set({ queuing: v, queueStartedAt: v ? Date.now() : null }),
  setQueueModalOpen: (v) => set({ queueModalOpen: v }),
  setServerWaitSeconds: (n) => set({ serverWaitSeconds: n }),
  setMatched: (p) => set({
    matched: p,
    queuing: false,
    queueModalOpen: false,
    rankMatchTiers: p ? {
      selfTier: p.selfTier,
      selfRp: p.selfRp,
      selfIsPlacement: p.selfIsPlacement,
      opponentTier: p.opponentTier,
      opponentRp: p.opponentRp,
      opponentIsPlacement: p.opponentIsPlacement,
    } : null,
  }),
  clearMatched: () => set({ matched: null }),
  resetQueueUi: () => set({ queuing: false, queueStartedAt: null, queueModalOpen: false, matched: null, serverWaitSeconds: 0, rankMatchTiers: null }),
}));
