'use client';

import { create } from 'zustand';
import type { DisplayedTitle } from '@/shared/types/room';
import type { GuildSummary, MyGuildState } from '@/lib/guild/types';
import type { GuildV4Snapshot } from '@/lib/guild-v4/types';
import type { RankCardShopSkinId } from '@shared/rank-card-skins';
import type {
  DevGuildContribScores,
  DevGuildGrantLog,
  DevGuildInvestLog,
  DevGuildNotice,
  DevGuildSponsor,
} from './dummy';
import type { DevGuildRankScores } from './rankScore';
import { DEV_DEFAULT_TILE_ORDER, normalizeTileOrder, type DevTileId } from './tiles';

const EMPTY_MY: MyGuildState = {
  guild: null,
  role: null,
  members: [],
  pendingRequests: [],
  myRequest: null,
  charterCount: 0,
};

export type GuildLiveState = {
  hydrated: boolean;
  meId: string;
  meNickname: string;
  guilds: GuildSummary[];
  my: MyGuildState;
  notices: DevGuildNotice[];
  contribs: Record<string, DevGuildContribScores>;
  titles: Record<string, DisplayedTitle | null>;
  sponsors: Record<string, DevGuildSponsor>;
  investLogs: DevGuildInvestLog[];
  grantLogs: DevGuildGrantLog[];
  rankScores: Record<string, DevGuildRankScores>;
  myCdp: number;
  tileOrder: DevTileId[];
  rankCards: Record<string, RankCardShopSkinId>;
  rankCard: { skinId: RankCardShopSkinId; expiresAt: string } | null;
  warChips: number;
  hydrate: (snap: GuildV4Snapshot) => void;
};

export const useGuildDevStore = create<GuildLiveState>()((set) => ({
  hydrated: false,
  meId: '',
  meNickname: '',
  guilds: [],
  my: EMPTY_MY,
  notices: [],
  contribs: {},
  titles: {},
  sponsors: {},
  investLogs: [],
  grantLogs: [],
  rankScores: {},
  myCdp: 0,
  tileOrder: [...DEV_DEFAULT_TILE_ORDER],
  rankCards: {},
  rankCard: null,
  warChips: 0,
  hydrate: (snap) =>
    set({
      hydrated: true,
      meId: snap.meId,
      meNickname: snap.meNickname,
      guilds: snap.guilds,
      my: snap.my,
      notices: snap.notices,
      contribs: snap.contribs,
      titles: snap.titles,
      sponsors: snap.sponsors,
      investLogs: snap.investLogs,
      grantLogs: snap.grantLogs,
      rankScores: snap.rankScores,
      myCdp: snap.myCdp,
      tileOrder: normalizeTileOrder(snap.tileOrder),
      rankCards: snap.rankCards ?? {},
      rankCard: snap.rankCard ?? null,
      warChips: snap.warChips ?? 0,
    }),
}));

export function useGuildDevStoreApi() {
  return useGuildDevStore;
}
