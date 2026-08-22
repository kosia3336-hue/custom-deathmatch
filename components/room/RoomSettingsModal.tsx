'use client';

import { useState, useEffect, useLayoutEffect } from 'react';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { getSocket } from '@/lib/socket';
import { fetchGames } from '@/lib/api';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { FC_DEFAULT_NUMBER_COUNT, GAME_IDS } from '@/shared/types';
import type { Game, Room, RoomType, UpdateRoomSettings } from '@/shared/types';
import type { GameCategory } from '@/lib/gameRules';
import {
  RoomModalShell,
  SettingsAccordion,
  SettingField,
  OptionButton,
  GameListPicker,
} from '@/components/room-modal/RoomModalKit';

interface Props {
  open: boolean;
  room: Room;
  onClose: () => void;
}

export default function RoomSettingsModal({ open, room, onClose }: Props) {
  const { setFooterHidden } = useRoomLayout();
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [title, setTitle] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('public');
  const [password, setPassword] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [timeLimitEnabled, setTimeLimitEnabled] = useState(false);
  const [timeLimitMin, setTimeLimitMin] = useState(1);
  const [timeLimitSec, setTimeLimitSec] = useState(0);
  const [initialChips, setInitialChips] = useState(25);
  const [formulaNumberCount, setFormulaNumberCount] = useState(FC_DEFAULT_NUMBER_COUNT);
  const [gameSearch, setGameSearch] = useState('');
  const [catFilter, setCatFilter] = useState<GameCategory | null>(null);
  /** 상세 설정도 게임 목록처럼 그 자리에서 접었다 편다 */
  const [detailOpen, setDetailOpen] = useState(false);
  /** 게임이 이미 정해져 있으므로 처음엔 접힌 채로 시작 — '변경' 으로 편다 */
  const [listOpen, setListOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const CHIPS_MIN = 10;
  const CHIPS_MAX = 200;
  const CHIPS_STEP = 5;
  const CHIPS_PRESETS = [10, 25, 50, 100];

  // paint 전에 sticky 푸터 바 제거 (게임 시작 버튼 클릭 가로채기 방지)
  useLayoutEffect(() => {
    if (!open) return;
    setFooterHidden(true);
    return () => setFooterHidden(false);
  }, [open, setFooterHidden]);

  // 모달 열릴 때 현재 방 설정으로 초기화
  useEffect(() => {
    if (!open) return;
    setError('');
    setPassword('');
    setGameSearch('');
    setCatFilter(null);
    setDetailOpen(false);
    setListOpen(false);
    setTitle(room.title);
    setRoomType(room.roomType);
    setMaxPlayers(room.maxPlayers);

    if (room.timeLimitSeconds != null) {
      setTimeLimitEnabled(true);
      setTimeLimitMin(Math.floor(room.timeLimitSeconds / 60));
      setTimeLimitSec(room.timeLimitSeconds % 60);
    } else {
      setTimeLimitEnabled(false);
      setTimeLimitMin(1);
      setTimeLimitSec(0);
    }

    const chips = typeof room.gameOptions?.initialChips === 'number'
      ? room.gameOptions.initialChips
      : 25;
    setInitialChips(chips);
    const numberCount = typeof room.gameOptions?.numberCount === 'number'
      ? room.gameOptions.numberCount
      : FC_DEFAULT_NUMBER_COUNT;
    setFormulaNumberCount(numberCount);

    fetchGames()
      .then((gsAll) => {
        const gs = gsAll.filter(
          (g) => g.id !== GAME_IDS.INDIAN_POKER_EVENT && g.id !== GAME_IDS.SUN_MOON_STAR_EVENT,
        );
        setGames(gs);
        const current = gs.find((g) => g.id === room.gameId) ?? null;
        setSelectedGame(current);
      })
      .catch(() => setError('게임 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const computedTimeLimit = room.playMode === 'multi' && timeLimitEnabled
    ? timeLimitMin * 60 + timeLimitSec
    : null;

  const playerRange = selectedGame
    ? Array.from(
        { length: selectedGame.maxPlayers - selectedGame.minPlayers + 1 },
        (_, i) => selectedGame.minPlayers + i,
      )
    : [];

  const selectGame = (g: Game) => {
    setListOpen(false);
    setSelectedGame(g);
    // 새 게임의 인원 범위로 조정
    setMaxPlayers(Math.max(Math.min(maxPlayers, g.maxPlayers), g.minPlayers));
    setError('');
  };

  const handleSave = () => {
    if (!selectedGame) return setError('게임을 선택해 주세요.');
    if (!title.trim() || title.length > 30) return setError('방 제목은 1~30자로 입력해 주세요.');
    if (roomType === 'private') {
      const isBecomingPrivate = room.roomType === 'public';
      if (isBecomingPrivate && (password.length < 4 || password.length > 8)) {
        return setError('비밀번호는 4~8자리로 입력해 주세요.');
      }
      if (!isBecomingPrivate && password.length > 0 && (password.length < 4 || password.length > 8)) {
        return setError('비밀번호는 4~8자리로 입력해 주세요.');
      }
    }
    if (timeLimitEnabled && (computedTimeLimit == null || computedTimeLimit < 10)) {
      return setError('시간제한은 최소 10초 이상이어야 합니다.');
    }
    if (timeLimitEnabled && computedTimeLimit != null && computedTimeLimit > 600) {
      return setError('시간제한은 최대 10분까지 설정할 수 있습니다.');
    }

    setLoading(true);
    setError('');

    const socket = getSocket();
    const gameOptions: Record<string, unknown> = {};
    if (selectedGame.id === GAME_IDS.INDIAN_POKER) {
      gameOptions.initialChips = initialChips;
    }
    if (selectedGame.id === GAME_IDS.FORMULA_COMPLETION) {
      gameOptions.numberCount = formulaNumberCount;
    }

    const isGameChanged = selectedGame.id !== room.gameId;
    const payload: UpdateRoomSettings = {
      title: title.trim(),
      gameId: isGameChanged ? selectedGame.id : undefined,
      maxPlayers,
      roomType,
      timeLimitSeconds: computedTimeLimit,
      gameOptions: Object.keys(gameOptions).length > 0 ? gameOptions : undefined,
    };

    // 비밀번호 처리
    if (roomType === 'public' && room.roomType === 'private') {
      payload.clearPassword = true;
    } else if (roomType === 'private' && password.length >= 4) {
      payload.password = password;
    }

    socket.emit('room:settings:update', payload);

    // 서버가 에러를 보내도 useRoom 훅에서 toast로 처리하므로
    // 짧은 딜레이 후 모달을 닫는다
    setTimeout(() => {
      setLoading(false);
      onClose();
    }, 300);
  };

  // 방 설정에서는 언제나 방 유형·시간제한 중 하나는 있다
  const hasDetailOptions = true;

  return (
    <RoomModalShell
      open={open}
      title="방 설정 변경"
      onClose={onClose}
      footer={(
        <>
          {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>취소</Button>
            <Button onClick={handleSave} loading={loading}>저장</Button>
          </div>
        </>
      )}
    >
      <GameListPicker
        games={games.filter((g) => g.supportsMulti)}
        activeGameId={selectedGame?.id ?? null}
        onSelectGame={selectGame}
        onSelectMode={() => {}}
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
        placeholder="방 제목"
        maxLength={30}
      />

      {/* 상세 설정 — 방 설정에서는 게임이 이미 정해져 있어 항상 열 수 있다 */}
      <SettingsAccordion open={detailOpen} onToggle={() => setDetailOpen((v) => !v)}>
        {!hasDetailOptions ? null : (
          <>
            {/* 방 유형 — 멀티 모드만 */}
            {room.playMode === 'multi' && (
              <>
                <SettingField label="방 유형">
                  <div className="flex gap-2">
                    {[
                      { key: 'public' as RoomType, label: '공개' },
                      { key: 'private' as RoomType, label: '비밀' },
                    ].map((rt) => (
                      <OptionButton
                        key={rt.key}
                        active={roomType === rt.key}
                        onClick={() => { setRoomType(rt.key); setPassword(''); }}
                      >
                        {rt.label}
                      </OptionButton>
                    ))}
                  </div>
                </SettingField>

                {/* 비밀번호 */}
                {roomType === 'private' && (
                  <Input
                    label={room.roomType === 'private' ? '새 비밀번호 (변경 시만 입력)' : '비밀번호'}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={room.roomType === 'private' ? '변경하지 않으면 기존 유지' : '4~8자리'}
                    maxLength={8}
                  />
                )}
              </>
            )}

            {/* 최대 인원 */}
            {selectedGame && playerRange.length > 1 && (
              <SettingField label="최대 인원">
                <div className="flex flex-wrap gap-2">
                  {playerRange.map((n) => (
                    <OptionButton key={n} size="square" active={maxPlayers === n} onClick={() => setMaxPlayers(n)}>
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
                  <span className="w-12 text-right text-sm font-bold text-cdm-fg">
                    {initialChips}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CHIPS_PRESETS.map((v) => (
                    <OptionButton key={v} size="sm" active={initialChips === v} onClick={() => setInitialChips(v)}>
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
                <p className="mt-2 text-xs text-cdm-fg-subtle">
                  숫자가 많을수록 조합할 수 있는 수식이 복잡해집니다.
                </p>
              </SettingField>
            )}

            {/* 시간제한 */}
            {room.playMode === 'multi' && (
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
                        className="h-10 rounded-lg border border-cdm-border px-3 text-sm focus:border-cdm-primary focus:outline-none"
                      >
                        {Array.from({ length: 11 }, (_, i) => (
                          <option key={i} value={i}>{i}</option>
                        ))}
                      </select>
                      <span className="text-sm text-cdm-fg-muted">분</span>
                      <select
                        value={timeLimitSec}
                        onChange={(e) => setTimeLimitSec(Number(e.target.value))}
                        className="h-10 rounded-lg border border-cdm-border px-3 text-sm focus:border-cdm-primary focus:outline-none"
                      >
                        {[0, 10, 15, 20, 30, 45].map((s) => (
                          <option key={s} value={s}>{String(s).padStart(2, '0')}</option>
                        ))}
                      </select>
                      <span className="text-sm text-cdm-fg-muted">초</span>
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
