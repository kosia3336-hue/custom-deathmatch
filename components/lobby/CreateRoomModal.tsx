'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { getSocket } from '@/lib/socket';
import { fetchGames } from '@/lib/api';
import { useNicknameStore } from '@/stores/nickname';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { GAME_IDS } from '@/shared/types';
import type { Game, PlayMode, RoomType } from '@/shared/types';

type Step = 'main' | 'detail';

const RANDOM_GAME: Game = {
  id: GAME_IDS.RANDOM,
  name: '랜덤',
  description: '무작위 배정',
  minPlayers: 2,
  maxPlayers: 2,
  supportsMulti: true,
  supportsCom: false,
  supportsSolo: false,
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
  rankingActive: true,
};

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * 랜덤·밴픽 행의 대표 이미지.
 *
 * 이 둘은 게임 카드와 달리 한 줄을 통째로 쓴다. 카드처럼 폭 비율(42%)로 잡으면
 * 이미지 영역이 300px 가까이 되어 너무 넓으므로, 오른쪽에 고정 폭 띠로 둔다.
 * 왼쪽으로 갈수록 사라져 글자와 겹치지 않는다.
 */
function ModeArt({ src }: { src: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 right-0 w-56 bg-cover bg-center opacity-35"
      style={{
        backgroundImage: `url(${src})`,
        maskImage: 'linear-gradient(to right, transparent, #000 70%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, #000 70%)',
      }}
    />
  );
}

export default function CreateRoomModal({ open, onClose }: Props) {
  const router = useRouter();
  const requireNickname = useNicknameStore((s) => s.requireNickname);
  const [mounted, setMounted] = useState(false);

  const [step, setStep] = useState<Step>('main');
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
  const [banCount, setBanCount] = useState(3);
  const [gameSearch, setGameSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const CHIPS_MIN = 10;
  const CHIPS_MAX = 200;
  const CHIPS_STEP = 5;
  const CHIPS_PRESETS = [10, 25, 50, 100];

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setStep('main');
    setError('');
    setSelectedGame(null);
    setPlayMode('multi');
    setTitle(`초보 환영합니다! ${Math.floor(Math.random() * 900) + 100}`);
    setGameSearch('');
    setRoomType('public');
    setPassword('');
    setMaxPlayers(4);
    setTimeLimitEnabled(false);
    setTimeLimitMin(1);
    setTimeLimitSec(0);
    setInitialChips(25);
    setBanCount(3);
    fetchGames()
      .then((all) =>
        setGames(
          all.filter(
            (g) => g.id !== GAME_IDS.INDIAN_POKER_EVENT && g.id !== GAME_IDS.SUN_MOON_STAR_EVENT,
          ),
        ),
      )
      .catch(() => setError('게임 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'));
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

  const isRandom = selectedGame?.id === GAME_IDS.RANDOM;
  const isBanPick = selectedGame?.id === GAME_IDS.BAN_PICK;
  const computedTimeLimit = (timeLimitEnabled && playMode === 'multi' && !isRandom)
    ? timeLimitMin * 60 + timeLimitSec
    : null;

  // 상세 설정 탭에 표시할 항목이 하나라도 있는지
  const hasDetailOptions =
    playMode === 'multi' ||
    selectedGame?.id === GAME_IDS.INDIAN_POKER ||
    isBanPick;

  const selectGame = (g: Game) => {
    setSelectedGame(g);
    if (g.supportsMulti) setPlayMode('multi');
    else if (g.supportsCom) setPlayMode('com');
    else if (g.supportsSolo) setPlayMode('solo');
    setMaxPlayers(g.maxPlayers);
    setError('');
  };

  const selectRandom = () => {
    setSelectedGame(RANDOM_GAME);
    setPlayMode('multi');
    setTimeLimitEnabled(false);
    setError('');
  };

  const selectBanPick = () => {
    setSelectedGame(BAN_PICK_GAME);
    setPlayMode('multi');
    setMaxPlayers(2);
    setError('');
  };

  const handleCreate = () => {
    requireNickname(() => {
      if (!selectedGame) return setError('게임을 선택해 주세요.');
      if (!title.trim() || title.length > 30) return setError('방 제목은 1~30자로 입력해 주세요.');
      if (playMode === 'multi' && roomType === 'private' && (password.length < 4 || password.length > 8)) {
        return setError('비밀번호는 4~8자리로 입력해 주세요.');
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
      if (selectedGame.id === GAME_IDS.BAN_PICK) {
        gameOptions.banCount = banCount;
      }
      socket.emit(
        'room:create',
        {
          gameId: selectedGame.id,
          title: title.trim(),
          playMode,
          roomType: playMode === 'multi' ? roomType : 'public',
          password: roomType === 'private' ? password : undefined,
          maxPlayers,
          timeLimitSeconds: computedTimeLimit,
          gameOptions: Object.keys(gameOptions).length > 0 ? gameOptions : undefined,
        },
        (res) => {
          setLoading(false);
          if (res.success && res.roomId) {
            onClose();
            if (playMode === 'solo') {
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

  const filteredGames = gameSearch.trim()
    ? games.filter((g) => g.name.includes(gameSearch.trim()))
    : games;

  const playerRange = selectedGame
    ? Array.from(
        { length: selectedGame.maxPlayers - selectedGame.minPlayers + 1 },
        (_, i) => selectedGame.minPlayers + i,
      )
    : [];

  /* ── 공용 아이콘 ── */
  const CloseIcon = () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

  const BackIcon = () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        /* 배경 + 정렬 컨테이너 */
        <motion.div className="fixed inset-0 z-(--cdm-z-modal) flex items-end sm:items-center justify-center sm:p-4">
          {/* 백드롭 */}
          <motion.div
            className="fixed inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* 모달 패널 */}
          <motion.div
            className="relative z-10 flex w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-xl"
            style={{ maxHeight: 'min(92dvh, 92vh)' }}
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* ── 헤더 (고정) ── */}
            <div className="flex flex-shrink-0 items-center border-b border-cdm-ink-border bg-cdm-ink px-5 py-4">
              <AnimatePresence mode="wait" initial={false}>
                {step === 'main' ? (
                  <motion.div
                    key="h-main"
                    className="flex flex-1 items-center justify-between"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                  >
                    <h2 className="text-lg font-bold text-cdm-ink-fg">새 방 만들기</h2>
                    <button
                      onClick={onClose}
                      className="rounded-md p-1 text-cdm-ink-fg-muted hover:bg-white/10 hover:text-white"
                      aria-label="닫기"
                    >
                      <CloseIcon />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="h-detail"
                    className="flex flex-1 items-center justify-between"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                  >
                    <button
                      onClick={() => { setStep('main'); setError(''); }}
                      className="flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    >
                      <BackIcon />
                      돌아가기
                    </button>
                    <h2 className="absolute left-1/2 -translate-x-1/2 text-base font-bold text-cdm-ink-fg">
                      상세 설정
                    </h2>
                    <button
                      onClick={onClose}
                      className="rounded-md p-1 text-cdm-ink-fg-muted hover:bg-white/10 hover:text-white"
                      aria-label="닫기"
                    >
                      <CloseIcon />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── 본문 (스크롤) ── */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AnimatePresence mode="wait" initial={false}>
                {step === 'main' ? (
                  <motion.div
                    key="b-main"
                    className="space-y-5 px-5 py-5"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    {/* 게임 선택 */}
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">게임 선택</label>
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={gameSearch}
                            onChange={(e) => setGameSearch(e.target.value)}
                            placeholder="검색"
                            className="h-7 w-full rounded-md border border-gray-200 pl-2 pr-6 text-xs focus:border-indigo-400 focus:outline-none"
                          />
                          {gameSearch && (
                            <button
                              onClick={() => setGameSearch('')}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              aria-label="검색 초기화"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      {/* 게임 목록 — 한 줄에 하나씩. 오른쪽에 대표 이미지를 흐리게 깐다.
                          이미지는 public/games/<gameId>.webp 를 배경으로 불러오므로,
                          파일이 없는 게임은 아무것도 안 보이고 레이아웃만 그대로 간다
                          (배경 이미지라 404 여도 깨진 아이콘이 뜨지 않는다). */}
                      <div className="max-h-[260px] overflow-y-auto rounded-lg border border-gray-100 sm:max-h-[320px]">
                        <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3">
                          {/* 랜덤·밴픽은 게임이 아니라 '방식' 이라 한 줄을 통째로 쓴다 */}
                          <button
                            onClick={selectRandom}
                            className={cn(
                              'relative col-span-2 h-20 overflow-hidden rounded-lg border text-left transition-colors sm:col-span-3',
                              isRandom
                                ? 'border-indigo-500 bg-indigo-50'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                            )}
                          >
                            <ModeArt src="/games/random.webp" />
                            <span className="relative flex h-full flex-col justify-center pl-3">
                              <span
                                className={cn(
                                  'text-sm font-semibold',
                                  isRandom ? 'text-indigo-700' : 'text-gray-800',
                                )}
                              >
                                랜덤
                              </span>
                              <span className="mt-0.5 text-xs text-gray-500">무작위 배정</span>
                            </span>
                          </button>

                          {!gameSearch.trim() && (
                            <button
                              onClick={selectBanPick}
                              className={cn(
                                'relative col-span-2 h-20 overflow-hidden rounded-lg border text-left transition-colors sm:col-span-3',
                                isBanPick
                                  ? 'border-indigo-500 bg-indigo-50'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                              )}
                            >
                              <ModeArt src="/games/ban-pick.webp" />
                              <span className="relative flex h-full flex-col justify-center pl-3">
                                <span
                                  className={cn(
                                    'text-sm font-semibold',
                                    isBanPick ? 'text-indigo-700' : 'text-gray-800',
                                  )}
                                >
                                  밴픽
                                </span>
                                <span className="mt-0.5 text-xs text-gray-500">게임 선택 전 밴</span>
                              </span>
                            </button>
                          )}

                          {filteredGames.map((g) => (
                            <button
                              key={g.id}
                              onClick={() => selectGame(g)}
                              className={cn(
                                'relative h-20 overflow-hidden rounded-lg border text-left transition-colors',
                                selectedGame?.id === g.id
                                  ? 'border-indigo-500 bg-indigo-50'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                              )}
                            >
                              {/* 대표 이미지 — 꾸밈용이라 오른쪽 영역에만 흐리게 깐다.
                                  글자 영역(왼쪽)과 폭을 나눠 두어 서로 침범하지 않는다.
                                  파일이 없는 게임은 배경이 비어 아무것도 안 보인다. */}
                              <span
                                aria-hidden
                                className="pointer-events-none absolute inset-y-0 right-0 w-[42%] bg-cover bg-center opacity-35"
                                style={{
                                  backgroundImage: `url(/games/${g.id}.webp)`,
                                  maskImage: 'linear-gradient(to right, transparent, #000 70%)',
                                  WebkitMaskImage: 'linear-gradient(to right, transparent, #000 70%)',
                                }}
                              />
                              <span className="relative flex h-full w-[58%] flex-col justify-center pl-3">
                                <span
                                  className={cn(
                                    'text-sm leading-tight font-semibold break-keep',
                                    selectedGame?.id === g.id ? 'text-indigo-700' : 'text-gray-800',
                                  )}
                                >
                                  {g.name}
                                </span>
                                <span className="mt-0.5 text-xs text-gray-500">
                                  {g.minPlayers === g.maxPlayers
                                    ? `${g.minPlayers}인`
                                    : `${g.minPlayers}~${g.maxPlayers}인`}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 플레이 모드 */}
                    {selectedGame && !isRandom && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">플레이 모드</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: 'multi' as PlayMode, label: '멀티', supported: selectedGame.supportsMulti },
                            { key: 'com' as PlayMode, label: 'COM', supported: selectedGame.supportsCom },
                            { key: 'solo' as PlayMode, label: '1:1 솔로', supported: selectedGame.supportsSolo },
                          ]
                            .filter((m) => m.supported)
                            .map((m) => (
                              <button
                                key={m.key}
                                onClick={() => setPlayMode(m.key)}
                                className={cn(
                                  'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                                  playMode === m.key
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                    : 'border-gray-200 hover:border-gray-300',
                                )}
                              >
                                {m.label}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* 방 제목 */}
                    <Input
                      label="방 제목"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="초보 환영합니다!"
                      maxLength={30}
                    />

                    {/* 상세 설정 진입 버튼 */}
                    <button
                      onClick={() => { setStep('detail'); setError(''); }}
                      className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
                    >
                      <span className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        상세 설정
                      </span>
                      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="b-detail"
                    className="space-y-5 px-5 py-5"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.15 }}
                  >
                    {!hasDetailOptions ? (
                      /* 표시할 항목 없음 */
                      <div className="flex flex-col items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-10 text-center">
                        <p className="text-sm text-gray-500">이 모드에서는 추가 설정이 없습니다.</p>
                      </div>
                    ) : (
                      <>
                        {/* 방 유형 */}
                        {playMode === 'multi' && (
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">방 유형</label>
                            <div className="flex gap-2">
                              {[
                                { key: 'public' as RoomType, label: '공개' },
                                { key: 'private' as RoomType, label: '비밀' },
                              ].map((rt) => (
                                <button
                                  key={rt.key}
                                  onClick={() => setRoomType(rt.key)}
                                  className={cn(
                                    'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                                    roomType === rt.key
                                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                      : 'border-gray-200 hover:border-gray-300',
                                  )}
                                >
                                  {rt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 비밀번호 */}
                        {playMode === 'multi' && roomType === 'private' && (
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
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">최대 인원</label>
                            <div className="flex flex-wrap gap-2">
                              {playerRange.map((n) => (
                                <button
                                  key={n}
                                  onClick={() => setMaxPlayers(n)}
                                  className={cn(
                                    'h-10 w-10 rounded-lg border text-sm font-medium transition-colors',
                                    maxPlayers === n
                                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                      : 'border-gray-200 hover:border-gray-300',
                                  )}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 초기 칩 (인디언홀덤Q) */}
                        {selectedGame?.id === GAME_IDS.INDIAN_POKER && (
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                              초기 칩{' '}
                              <span className="font-normal text-gray-400">(기본 25)</span>
                            </label>
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
                              <span className="w-12 text-right text-sm font-bold text-gray-900">
                                {initialChips}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {CHIPS_PRESETS.map((v) => (
                                <button
                                  key={v}
                                  onClick={() => setInitialChips(v)}
                                  className={cn(
                                    'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                                    initialChips === v
                                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                      : 'border-gray-200 hover:border-gray-300',
                                  )}
                                >
                                  {v}개
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 밴 개수 (밴픽 모드) */}
                        {isBanPick && (
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                              밴 개수{' '}
                              <span className="font-normal text-gray-400">(1인당, 기본 1)</span>
                            </label>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setBanCount(Math.max(1, banCount - 1))}
                                disabled={banCount <= 1}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-lg font-bold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-30"
                              >
                                −
                              </button>
                              <span className="w-8 text-center text-base font-bold text-cdm-ink-fg">
                                {banCount}
                              </span>
                              <button
                                onClick={() => setBanCount(Math.min(6, banCount + 1))}
                                disabled={banCount >= 6}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-lg font-bold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-30"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 시간제한 */}
                        {playMode === 'multi' && !isRandom && (
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">시간제한</label>
                            <div className="flex gap-2">
                              {[
                                { enabled: false, label: '∞ 무제한' },
                                { enabled: true, label: '시간제한' },
                              ].map((opt) => (
                                <button
                                  key={String(opt.enabled)}
                                  onClick={() => setTimeLimitEnabled(opt.enabled)}
                                  className={cn(
                                    'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                                    timeLimitEnabled === opt.enabled
                                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                      : 'border-gray-200 hover:border-gray-300',
                                  )}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>

                            {timeLimitEnabled && (
                              <div className="mt-3 space-y-3">
                                <div className="flex items-center gap-2">
                                  <select
                                    value={timeLimitMin}
                                    onChange={(e) => setTimeLimitMin(Number(e.target.value))}
                                    className="h-10 rounded-lg border border-gray-200 px-3 text-sm focus:border-indigo-500 focus:outline-none"
                                  >
                                    {Array.from({ length: 11 }, (_, i) => (
                                      <option key={i} value={i}>{i}</option>
                                    ))}
                                  </select>
                                  <span className="text-sm text-gray-600">분</span>
                                  <select
                                    value={timeLimitSec}
                                    onChange={(e) => setTimeLimitSec(Number(e.target.value))}
                                    className="h-10 rounded-lg border border-gray-200 px-3 text-sm focus:border-indigo-500 focus:outline-none"
                                  >
                                    {[0, 10, 15, 20, 30, 45].map((s) => (
                                      <option key={s} value={s}>{String(s).padStart(2, '0')}</option>
                                    ))}
                                  </select>
                                  <span className="text-sm text-gray-600">초</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {[
                                    { label: '30초', min: 0, sec: 30 },
                                    { label: '1분', min: 1, sec: 0 },
                                    { label: '2분', min: 2, sec: 0 },
                                    { label: '3분', min: 3, sec: 0 },
                                    { label: '5분', min: 5, sec: 0 },
                                  ].map((p) => (
                                    <button
                                      key={p.label}
                                      onClick={() => { setTimeLimitMin(p.min); setTimeLimitSec(p.sec); }}
                                      className={cn(
                                        'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                                        timeLimitMin === p.min && timeLimitSec === p.sec
                                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                          : 'border-gray-200 hover:border-gray-300',
                                      )}
                                    >
                                      {p.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── 푸터 (고정) ── */}
            <div className="flex-shrink-0 border-t border-gray-100 px-5 py-4">
              {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={onClose}>취소</Button>
                <Button onClick={handleCreate} loading={loading}>만들기</Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
