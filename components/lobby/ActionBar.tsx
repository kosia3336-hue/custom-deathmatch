'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useLobbyStore } from '@/stores/lobby';
import { useNicknameStore } from '@/stores/nickname';
import { useRankMatchStore } from '@/stores/rankMatch';
import { useLobbyChatStore } from '@/stores/lobbyChat';
import { getSocket } from '@/lib/socket';
import { fetchGames } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { GAME_IDS } from '@/shared/types';
import { GAME_CATEGORIES, getGameRule } from '@/lib/gameRules';
import { filterUnreleased } from '@/lib/unreleasedGames';
import type { Game, JoinRoomResult } from '@/shared/types';
import RankLobbyControls from '@/components/lobby/RankLobbyControls';
import type { TabFilter } from '@/stores/lobby';

interface Props {
  onCreateRoom: () => void;
  /** 출시 전 게임을 갈래 필터에 노출할지 (lib/unreleasedGames.ts) */
  isAdmin?: boolean;
}

export default function ActionBar({ onCreateRoom, isAdmin = false }: Props) {
  const router = useRouter();
  const {
    searchQuery, setSearchQuery,
    gameFilters, toggleGameFilter,
    tabFilters, toggleTabFilter,
    clearFilters, rooms,
  } = useLobbyStore();
  const requireNickname = useNicknameStore((s) => s.requireNickname);
  const queuing = useRankMatchStore((s) => s.queuing);
  const [games, setGames] = useState<Game[]>([]);
  const [quickJoining, setQuickJoining] = useState(false);


  useEffect(() => {
    fetchGames()
      .then((all) =>
        setGames(
          // 출시 전 게임은 갈래 필터에도 띄우지 않는다. 방 이름을 가려 놓고
          // 필터 목록에 종목이 남아 있으면 감춘 의미가 없다.
          filterUnreleased(
            all.filter(
              (g) => g.id !== GAME_IDS.INDIAN_POKER_EVENT && g.id !== GAME_IDS.SUN_MOON_STAR_EVENT,
            ),
            isAdmin,
          ),
        ),
      )
      .catch(() => {});
  }, [isAdmin]);

  // 방 종류별 카운트 — 드롭다운 라벨에 표시
  const counts = useMemo(
    () => ({
      all: rooms.length,
      rank: rooms.filter((r) => r.isRanked === true).length,
      public: rooms.filter((r) => r.roomType === 'public').length,
      private: rooms.filter((r) => r.roomType === 'private').length,
      playing: rooms.filter((r) => r.status === 'playing').length,
    }),
    [rooms],
  );

  // 게임을 5갈래(심리/추상전략/수리/언어/관찰)로 분류
  const gamesByCategory = useMemo(() => {
    const map = new Map<string, Game[]>();
    for (const cat of GAME_CATEGORIES) map.set(cat, []);
    const etc: Game[] = [];
    for (const g of games) {
      const cat = getGameRule(g.id)?.category;
      if (cat && map.has(cat)) map.get(cat)!.push(g);
      else etc.push(g);
    }
    return { map, etc };
  }, [games]);

  const handleQuickJoin = () => {
    if (queuing) {
      toast.error('랭크 큐 대기 중에는 게임에 참가할 수 없습니다.');
      return;
    }
    requireNickname(() => {
      setQuickJoining(true);
      const socket = getSocket();
      socket.emit('room:quickjoin', (res: JoinRoomResult) => {
        setQuickJoining(false);
        if (res.success && res.roomId) {
          useLobbyChatStore.getState().clearAll();
          router.push(`/room/${res.roomId}`);
        } else {
          toast.error(res.error ?? '빠른 입장에 실패했습니다.');
        }
      });
    });
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* 1줄: 검색 + 필터 드롭다운 (가로로 넓게) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-full sm:min-w-0 sm:flex-[2]">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="방 제목 검색..."
            className="pr-9"
          />
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-cdm-fg-muted"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
        {/* 통합 필터 드롭다운 — 체크박스로 방 종류 × 게임 이중 필터 */}
        <FilterDropdown
          counts={counts}
          tabFilters={tabFilters}
          toggleTabFilter={toggleTabFilter}
          gameFilters={gameFilters}
          toggleGameFilter={toggleGameFilter}
          clearFilters={clearFilters}
          gamesByCategory={gamesByCategory}
        />
      </div>

      {/* 2줄: 액션 버튼 — 모바일은 그리드로 줄바꿈 없이 정렬 */}
      <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
        <RankLobbyControls />
        <Button variant="secondary" onClick={handleQuickJoin} loading={quickJoining}>
          빠른 입장
        </Button>
        <Button
          onClick={() => {
            if (queuing) {
              toast.error('랭크 큐 대기 중에는 방을 만들 수 없습니다.');
              return;
            }
            requireNickname(onCreateRoom);
          }}
        >
          방 만들기
        </Button>
      </div>
    </div>
  );
}

const TAB_OPTIONS: { value: TabFilter; label: string; countKey: 'all' | 'rank' | 'public' | 'private' | 'playing' }[] = [
  { value: 'rank', label: '랭크', countKey: 'rank' },
  { value: 'public', label: '공개방', countKey: 'public' },
  { value: 'private', label: '비밀방', countKey: 'private' },
  { value: 'playing', label: '진행 중', countKey: 'playing' },
];

function FilterCheckbox({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer select-none items-center gap-1.5 rounded-cdm-md border px-2.5 py-1.5 text-sm transition-colors ${
        checked
          ? 'border-cdm-primary bg-cdm-primary-soft font-semibold text-cdm-primary'
          : 'border-cdm-border text-cdm-fg hover:border-cdm-border-strong hover:bg-cdm-bg-elev-1'
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="h-3.5 w-3.5 accent-(--cdm-primary)" />
      <span className="whitespace-nowrap">{label}</span>
    </label>
  );
}

function FilterDropdown({
  counts,
  tabFilters,
  toggleTabFilter,
  gameFilters,
  toggleGameFilter,
  clearFilters,
  gamesByCategory,
}: {
  counts: Record<'all' | 'rank' | 'public' | 'private' | 'playing', number>;
  tabFilters: TabFilter[];
  toggleTabFilter: (t: TabFilter) => void;
  gameFilters: string[];
  toggleGameFilter: (g: string) => void;
  clearFilters: () => void;
  gamesByCategory: { map: Map<string, Game[]>; etc: Game[] };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const allGames = [...gamesByCategory.map.values()].flat().concat(gamesByCategory.etc);
  const labels = [
    ...tabFilters.map((t) => TAB_OPTIONS.find((o) => o.value === t)?.label).filter(Boolean),
    ...gameFilters.map((f) =>
      f.startsWith('gcat:') ? `${f.slice(5)} 전체` : allGames.find((g) => g.id === f)?.name,
    ).filter(Boolean),
  ] as string[];
  const activeCount = labels.length;
  const summary =
    activeCount === 0 ? '전체' : labels.length <= 2 ? labels.join(' · ') : `${labels[0]} 외 ${labels.length - 1}`;

  return (
    <div ref={ref} className="relative min-w-0 flex-1 sm:max-w-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-cdm-md border bg-cdm-bg px-3 text-sm font-semibold transition-colors ${
          activeCount > 0 ? 'border-cdm-primary text-cdm-primary' : 'border-cdm-border-strong text-cdm-fg'
        }`}
      >
        <span className="truncate">
          {summary}
          <span className="ml-1.5 font-normal text-cdm-fg-muted">({counts.all})</span>
        </span>
        <span aria-hidden className="text-xs text-cdm-fg-muted">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-[min(92vw,40rem)] rounded-cdm-lg border border-cdm-border bg-cdm-bg p-4 shadow-(--cdm-shadow-lg)">
          {/* 1행: 방 종류 */}
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-cdm-fg-subtle">방 종류</p>
          <div className="flex flex-wrap gap-1.5">
            {TAB_OPTIONS.map((t) => (
              <FilterCheckbox
                key={t.value}
                checked={tabFilters.includes(t.value)}
                label={`${t.label} (${counts[t.countKey]})`}
                onToggle={() => toggleTabFilter(t.value)}
              />
            ))}
          </div>

          {/* 2행~: 게임 — 갈래별 행 구분 */}
          <div className="mt-4 flex flex-col gap-3 border-t border-cdm-border pt-3">
            {GAME_CATEGORIES.map((cat) => {
              const list = gamesByCategory.map.get(cat) ?? [];
              return (
                <div key={cat} className="flex flex-col gap-1.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-cdm-fg-subtle">게임 — {cat}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <FilterCheckbox
                      checked={gameFilters.includes(`gcat:${cat}`)}
                      label={`${cat} 전체`}
                      onToggle={() => toggleGameFilter(`gcat:${cat}`)}
                    />
                    {list.map((g) => (
                      <FilterCheckbox
                        key={g.id}
                        checked={gameFilters.includes(g.id)}
                        label={g.name}
                        onToggle={() => toggleGameFilter(g.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {gamesByCategory.etc.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-bold uppercase tracking-wide text-cdm-fg-subtle">게임 — 기타</p>
                <div className="flex flex-wrap gap-1.5">
                  {gamesByCategory.etc.map((g) => (
                    <FilterCheckbox
                      key={g.id}
                      checked={gameFilters.includes(g.id)}
                      label={g.name}
                      onToggle={() => toggleGameFilter(g.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 푸터: 초기화 */}
          <div className="mt-4 flex items-center justify-between border-t border-cdm-border pt-3">
            <p className="text-[11px] text-cdm-fg-subtle">같은 줄은 OR, 방 종류×게임은 AND 로 함께 적용됩니다. 여러 개 체크 가능.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="shrink-0 rounded-cdm-md px-2.5 py-1 text-xs font-semibold text-cdm-fg-muted hover:bg-cdm-bg-elev-1 hover:text-cdm-fg"
            >
              초기화
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
