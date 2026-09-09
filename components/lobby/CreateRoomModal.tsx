'use client';

import { useState, useEffect } from 'react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { getSocket } from '@/lib/socket';
import { fetchGames } from '@/lib/api';
import { useNicknameStore } from '@/stores/nickname';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { filterUnreleased } from '@/lib/unreleasedGames';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_ABSTRACT_AI_DIFFICULTY,
  DEFAULT_ABSTRACT_AI_THINK_SECONDS,
  FC_DEFAULT_NUMBER_COUNT,
  GAME_IDS,
  PLAY_MODES,
  PLAY_MODE_LABEL,
  gameSupportsPlayMode,
  isAbstractStrategyGameId,
  isSoloLikePlayMode,
} from '@/shared/types';
import type { AbstractAiDifficulty, Game, PlayMode, RoomType } from '@/shared/types';
import type { GameCategory } from '@/lib/gameRules';
import {
  RoomModalShell,
  SettingsAccordion,
  SettingField,
  EmptyDetailNotice,
  OptionButton,
  GameListPicker,
  type PickerMode,
} from '@/components/room-modal/RoomModalKit';
import AbstractAiThinkTimeField from '@/components/room-modal/AbstractAiThinkTimeField';
import AbstractAiDifficultyField from '@/components/room-modal/AbstractAiDifficultyField';

const COUNTER_MATCH_MODE_ID = 'counter-match';

const BASE_MODES: PickerMode[] = [
  { id: GAME_IDS.RANDOM, label: '랜덤', desc: '무작위 배정', art: '/games/random.webp' },
  { id: GAME_IDS.BAN_PICK, label: '밴픽', desc: '게임 선택 전 밴', art: '/games/ban-pick.webp' },
];

const COUNTER_MATCH_MODE: PickerMode = {
  id: COUNTER_MATCH_MODE_ID,
  label: '카운터 매치',
  desc: '동시 비공개 1밴',
  art: '/games/ban-pick.webp',
};

const RANDOM_GAME: Game = {
  id: GAME_IDS.RANDOM,
  name: '랜덤',
  description: '무작위 배정',
  minPlayers: 2,
  maxPlayers: 2,
  supportsMulti: true,
  supportsCom: false,
  supportsSolo: false,
  supportsTutorial: false,
  rankingActive: true,
};

const BAN_PICK_GAME: Game = {
  id: GAME_IDS.BAN_PICK,
  name: '밴픽',
  description: '게임 선택 전 밴',
  minPlayers: 2,
  maxPlayers: 2,
  supportsMulti: true,
  supportsCom: true,
  supportsSolo: false,
  supportsTutorial: false,
  rankingActive: true,
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CreateRoomModal({ open, onClose }: Props) {
  const router = useRouter();
  const requireNickname = useNicknameStore((s) => s.requireNickname);
  const { member } = useCurrentMember();
  const isAdmin = member?.role === 'admin';

  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [playMode, setPlayMode] = useState<PlayMode>('multi');
  const [title, setTitle] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('public');
  const [password, setPassword] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [timeLimitEnabled, setTimeLimitEnabled] = useState(false);
  const [timeLimitMin, setTimeLimitMin] = useState(1);
  const [timeLimitSec, setTimeLimitSec] = useState(0);
  const [initialChips, setInitialChips] = useState(25);
  const [formulaNumberCount, setFormulaNumberCount] = useState(FC_DEFAULT_NUMBER_COUNT);
  const [abstractAiThinkSeconds, setAbstractAiThinkSeconds] = useState(
    DEFAULT_ABSTRACT_AI_THINK_SECONDS,
  );
  const [abstractAiDifficulty, setAbstractAiDifficulty] = useState<AbstractAiDifficulty>(
    DEFAULT_ABSTRACT_AI_DIFFICULTY,
  );
  const [banCount, setBanCount] = useState(3);
  const [hiddenMatch, setHiddenMatch] = useState(false);
  const [gameSearch, setGameSearch] = useState('');
  const [catFilter, setCatFilter] = useState<GameCategory | null>(null);
  /** 상세 설정도 게임 목록처럼 그 자리에서 접었다 편다 */
  const [detailOpen, setDetailOpen] = useState(false);
  /** 게임을 고르면 긴 목록을 접는다 — '변경' 으로 다시 편다 */
  const [listOpen, setListOpen] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const CHIPS_MIN = 10;
  const CHIPS_MAX = 200;
  const CHIPS_STEP = 5;
  const CHIPS_PRESETS = [10, 25, 50, 100];

  useEffect(() => {
    if (!open) return;
    setError('');
    setSelectedGame(null);
    setPlayMode('multi');
    setTitle(`초보 환영합니다! ${Math.floor(Math.random() * 900) + 100}`);
    setGameSearch('');
    setCatFilter(null);
    setDetailOpen(false);
    setListOpen(true);
    setRoomType('public');
    setPassword('');
    setMaxPlayers(4);
    setTimeLimitEnabled(false);
    setTimeLimitMin(1);
    setTimeLimitSec(0);
    setInitialChips(25);
    setFormulaNumberCount(FC_DEFAULT_NUMBER_COUNT);
    setAbstractAiThinkSeconds(DEFAULT_ABSTRACT_AI_THINK_SECONDS);
    setAbstractAiDifficulty(DEFAULT_ABSTRACT_AI_DIFFICULTY);
    setBanCount(3);
    setHiddenMatch(false);
    fetchGames()
      .then((all) =>
        setGames(
          filterUnreleased(
            all.filter(
              (g) => g.id !== GAME_IDS.INDIAN_POKER_EVENT && g.id !== GAME_IDS.SUN_MOON_STAR_EVENT,
            ),
            isAdmin,
          ),
        ),
      )
      .catch(() => setError('게임 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'));
  }, [open, isAdmin]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const isRandom = selectedGame?.id === GAME_IDS.RANDOM;
  const isBanPick = selectedGame?.id === GAME_IDS.BAN_PICK;
  const modes = isAdmin ? [...BASE_MODES, COUNTER_MATCH_MODE] : BASE_MODES;
  const activeModeId = isRandom
    ? GAME_IDS.RANDOM
    : isBanPick
      ? hiddenMatch
        ? COUNTER_MATCH_MODE_ID
        : GAME_IDS.BAN_PICK
      : null;
  const canConfigureTimeLimit =
    playMode === 'multi' && !isRandom && selectedGame?.id !== GAME_IDS.KNIGHTS_TOUR;
  const showsAbstractAiThinkTime =
    playMode === 'com' && isAbstractStrategyGameId(selectedGame?.id);
  const showsAbstractAiDifficulty = showsAbstractAiThinkTime;
  const computedTimeLimit =
    timeLimitEnabled && canConfigureTimeLimit ? timeLimitMin * 60 + timeLimitSec : null;

  // 상세 설정에 표시할 항목이 하나라도 있는지 — 플레이 모드는 게임을 고르면 항상 뜬다
  const hasDetailOptions =
    (Boolean(selectedGame) && !isRandom) ||
    playMode === 'multi' ||
    selectedGame?.id === GAME_IDS.INDIAN_POKER ||
    isBanPick;

  const selectGame = (g: Game) => {
    setListOpen(false);
    setSelectedGame(g);
    setHiddenMatch(false);
    if (g.supportsMulti) setPlayMode('multi');
    else if (g.supportsCom) setPlayMode('com');
    else if (g.supportsSolo) setPlayMode('solo');
    else if (g.supportsTutorial) setPlayMode('tutorial');
    setMaxPlayers(g.maxPlayers);
    setError('');
  };

  const selectMode = (modeId: string) => {
    setListOpen(false);
    setError('');
    if (modeId === GAME_IDS.RANDOM) {
      setHiddenMatch(false);
      setSelectedGame(RANDOM_GAME);
      setPlayMode('multi');
      setTimeLimitEnabled(false);
      return;
    }
    setSelectedGame(BAN_PICK_GAME);
    setPlayMode('multi');
    setMaxPlayers(2);
    setHiddenMatch(modeId === COUNTER_MATCH_MODE_ID);
  };

  const handleCreate = () => {
    requireNickname(() => {
      if (!selectedGame) return setError('게임을 선택해 주세요.');
      if (!title.trim() || title.length > 30) return setError('방 제목은 1~30자로 입력해 주세요.');
      if (
        !isSoloLikePlayMode(playMode) &&
        roomType === 'private' &&
        (password.length < 4 || password.length > 8)
      ) {
        return setError('비밀번호는 4~8자리로 입력해 주세요.');
      }
      if (
        canConfigureTimeLimit &&
        timeLimitEnabled &&
        (computedTimeLimit == null || computedTimeLimit < 10)
      ) {
        return setError('시간제한은 최소 10초 이상이어야 합니다.');
      }
      if (
        canConfigureTimeLimit &&
        timeLimitEnabled &&
        computedTimeLimit != null &&
        computedTimeLimit > 600
      ) {
        return setError('시간제한은 최대 10분까지 설정할 수 있습니다.');
      }

      setLoading(true);
      setError('');
      const socket = getSocket();
      const gameOptions: Record<string, unknown> = {};
      if (selectedGame.id === GAME_IDS.INDIAN_POKER) {
        gameOptions.initialChips = initialChips;
      }
      if (selectedGame.id === GAME_IDS.BAN_PICK && !(isAdmin && hiddenMatch)) {
        gameOptions.banCount = banCount;
      }
      if (selectedGame.id === GAME_IDS.FORMULA_COMPLETION) {
        gameOptions.numberCount = formulaNumberCount;
      }
      if (showsAbstractAiThinkTime) {
        gameOptions.aiThinkSeconds = abstractAiThinkSeconds;
      }
      if (showsAbstractAiDifficulty) {
        gameOptions.aiDifficulty = abstractAiDifficulty;
      }
      const useHidden = isAdmin && hiddenMatch && playMode === 'multi';
      socket.emit(
        'room:create',
        {
          gameId: useHidden ? GAME_IDS.BAN_PICK : selectedGame.id,
          title: title.trim(),
          playMode,
          roomType: isSoloLikePlayMode(playMode) ? 'public' : roomType,
          password:
            !isSoloLikePlayMode(playMode) && roomType === 'private' ? password : undefined,
          maxPlayers: useHidden ? 2 : maxPlayers,
          timeLimitSeconds: computedTimeLimit,
          gameOptions: Object.keys(gameOptions).length > 0 ? gameOptions : undefined,
          ...(useHidden ? { hiddenMatch: true } : {}),
        },
        (res) => {
          setLoading(false);
          if (res.success && res.roomId) {
            onClose();
            if (isSoloLikePlayMode(playMode)) {
              router.push(`/room/${res.roomId}/play`);
            } else {
              router.push(`/room/${res.roomId}`);
            }
          } else {
            setError(res.error ?? '방 생성에 실패했습니다.');
          }
        },
      );
    });
  };

  const playerRange = selectedGame
    ? Array.from(
        { length: selectedGame.maxPlayers - selectedGame.minPlayers + 1 },
        (_, i) => selectedGame.minPlayers + i,
      )
    : [];

  return (
    <RoomModalShell
      open={open}
      title="새 방 만들기"
      onClose={onClose}
      footer={
        <>
          {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button onClick={handleCreate} loading={loading}>
              만들기
            </Button>
          </div>
        </>
      }
    >
      <GameListPicker
        games={games}
        modes={modes}
        activeGameId={!isRandom && !isBanPick ? (selectedGame?.id ?? null) : null}
        activeModeId={activeModeId}
        onSelectGame={selectGame}
        onSelectMode={selectMode}
        listOpen={listOpen}
        onOpenList={() => setListOpen(true)}
        search={gameSearch}
        onSearchChange={setGameSearch}
        catFilter={catFilter}
        onCatFilterChange={setCatFilter}
      />

      {/* 방 제목 */}
      <Input
        label="방 제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="초보 환영합니다!"
        maxLength={30}
      />

      {/* 상세 설정 — 게임을 골라야 열린다. 아직이면 접은 채로 안내만 띄운다 */}
      <SettingsAccordion
        open={detailOpen}
        onToggle={() => setDetailOpen((v) => !v)}
        blocked={!selectedGame}
        onBlockedClick={() => setError('게임을 먼저 선택해 주세요.')}
      >
        {!hasDetailOptions ? (
          <EmptyDetailNotice />
        ) : (
          <>
            {/* 플레이 모드 */}
            {selectedGame && !isRandom && (
              <SettingField label="플레이 모드">
                <div className="flex flex-wrap gap-2">
                  {PLAY_MODES.filter(
                    (key) =>
                      gameSupportsPlayMode(selectedGame, key) && (!hiddenMatch || key === 'multi'),
                  ).map((key) => (
                    <OptionButton
                      key={key}
                      active={playMode === key}
                      onClick={() => {
                        setPlayMode(key);
                        if (key !== 'multi') setHiddenMatch(false);
                      }}
                    >
                      {PLAY_MODE_LABEL[key]}
                    </OptionButton>
                  ))}
                </div>
              </SettingField>
            )}

            {/* 방 유형 */}
            {!isSoloLikePlayMode(playMode) && (
              <SettingField label="방 유형">
                <div className="flex gap-2">
                  {[
                    { key: 'public' as RoomType, label: '공개' },
                    { key: 'private' as RoomType, label: '비밀' },
                  ].map((rt) => (
                    <OptionButton
                      key={rt.key}
                      active={roomType === rt.key}
                      onClick={() => setRoomType(rt.key)}
                    >
                      {rt.label}
                    </OptionButton>
                  ))}
                </div>
              </SettingField>
            )}

            {/* 비밀번호 */}
            {!isSoloLikePlayMode(playMode) && roomType === 'private' && (
              <Input
                label="비밀번호"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="4~8자리"
                maxLength={8}
              />
            )}

            {/* 최대 인원 */}
            {playMode === 'multi' && selectedGame && !isRandom && playerRange.length > 1 && (
              <SettingField label="최대 인원">
                <div className="flex flex-wrap gap-2">
                  {playerRange.map((n) => (
                    <OptionButton
                      key={n}
                      size="square"
                      active={maxPlayers === n}
                      onClick={() => setMaxPlayers(n)}
                    >
                      {n}
                    </OptionButton>
                  ))}
                </div>
              </SettingField>
            )}

            {/* 초기 칩 (인디언홀덤Q) */}
            {selectedGame?.id === GAME_IDS.INDIAN_POKER && (
              <SettingField label="초기 칩" hint="(기본 25)">
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={CHIPS_MIN}
                    max={CHIPS_MAX}
                    step={CHIPS_STEP}
                    value={initialChips}
                    onChange={(e) => setInitialChips(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-cdm-fg w-12 text-right text-sm font-bold">
                    {initialChips}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CHIPS_PRESETS.map((v) => (
                    <OptionButton
                      key={v}
                      size="sm"
                      active={initialChips === v}
                      onClick={() => setInitialChips(v)}
                    >
                      {v}개
                    </OptionButton>
                  ))}
                </div>
              </SettingField>
            )}

            {/* 제시 숫자 개수 (수식완성N) */}
            {selectedGame?.id === GAME_IDS.FORMULA_COMPLETION && (
              <SettingField label="제시 숫자 N" hint="(기본 4)">
                <div className="flex gap-2">
                  {[4, 5, 6].map((count) => (
                    <OptionButton
                      key={count}
                      size="square"
                      active={formulaNumberCount === count}
                      onClick={() => setFormulaNumberCount(count)}
                    >
                      {count}
                    </OptionButton>
                  ))}
                </div>
                <p className="text-cdm-fg-subtle mt-2 text-xs">
                  숫자가 많을수록 조합할 수 있는 수식이 복잡해집니다.
                </p>
              </SettingField>
            )}

            {/* 밴 개수 (밴픽 모드) */}
            {isBanPick && !hiddenMatch && (
              <SettingField label="밴 개수" hint="(1인당, 기본 1)">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setBanCount(Math.max(1, banCount - 1))}
                    disabled={banCount <= 1}
                    className="border-cdm-border text-cdm-fg-muted hover:bg-cdm-bg-elev-1 flex h-9 w-9 items-center justify-center rounded-lg border text-lg font-bold transition-colors disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="text-cdm-ink-fg w-8 text-center text-base font-bold">
                    {banCount}
                  </span>
                  <button
                    onClick={() => setBanCount(Math.min(6, banCount + 1))}
                    disabled={banCount >= 6}
                    className="border-cdm-border text-cdm-fg-muted hover:bg-cdm-bg-elev-1 flex h-9 w-9 items-center justify-center rounded-lg border text-lg font-bold transition-colors disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </SettingField>
            )}

            {showsAbstractAiThinkTime && (
              <AbstractAiThinkTimeField
                value={abstractAiThinkSeconds}
                onChange={setAbstractAiThinkSeconds}
              />
            )}

            {showsAbstractAiDifficulty && (
              <AbstractAiDifficultyField
                gameId={selectedGame?.id ?? ''}
                value={abstractAiDifficulty}
                onChange={setAbstractAiDifficulty}
              />
            )}

            {/* 시간제한 */}
            {canConfigureTimeLimit && (
              <SettingField label="시간제한">
                <div className="flex gap-2">
                  {[
                    { enabled: false, label: '∞ 무제한' },
                    { enabled: true, label: '시간제한' },
                  ].map((opt) => (
                    <OptionButton
                      key={String(opt.enabled)}
                      active={timeLimitEnabled === opt.enabled}
                      onClick={() => setTimeLimitEnabled(opt.enabled)}
                    >
                      {opt.label}
                    </OptionButton>
                  ))}
                </div>

                {timeLimitEnabled && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={timeLimitMin}
                        onChange={(e) => setTimeLimitMin(Number(e.target.value))}
                        className="border-cdm-border focus:border-cdm-primary h-10 rounded-lg border px-3 text-sm focus:outline-none"
                      >
                        {Array.from({ length: 11 }, (_, i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </select>
                      <span className="text-cdm-fg-muted text-sm">분</span>
                      <select
                        value={timeLimitSec}
                        onChange={(e) => setTimeLimitSec(Number(e.target.value))}
                        className="border-cdm-border focus:border-cdm-primary h-10 rounded-lg border px-3 text-sm focus:outline-none"
                      >
                        {[0, 10, 15, 20, 30, 45].map((s) => (
                          <option key={s} value={s}>
                            {String(s).padStart(2, '0')}
                          </option>
                        ))}
                      </select>
                      <span className="text-cdm-fg-muted text-sm">초</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: '30초', min: 0, sec: 30 },
                        { label: '1분', min: 1, sec: 0 },
                        { label: '2분', min: 2, sec: 0 },
                        { label: '3분', min: 3, sec: 0 },
                        { label: '5분', min: 5, sec: 0 },
                      ].map((p) => (
                        <OptionButton
                          key={p.label}
                          size="sm"
                          active={timeLimitMin === p.min && timeLimitSec === p.sec}
                          onClick={() => {
                            setTimeLimitMin(p.min);
                            setTimeLimitSec(p.sec);
                          }}
                        >
                          {p.label}
                        </OptionButton>
                      ))}
                    </div>
                  </div>
                )}
              </SettingField>
            )}
          </>
        )}
      </SettingsAccordion>
    </RoomModalShell>
  );
}
