'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { getSocket } from '@/lib/socket';
import { fetchGames } from '@/lib/api';
import { useNicknameStore } from '@/stores/nickname';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { GAME_IDS } from '@/shared/types';
import type { Game, PlayMode, RoomType } from '@/shared/types';

const RANDOM_GAME: Game = {
  id: GAME_IDS.RANDOM,
  name: '랜덤',
  description: '무작위 배정',
  minPlayers: 2,
  maxPlayers: 2,
  supportsMulti: true,
  supportsCom: false,
  supportsSolo: false,
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CreateRoomModal({ open, onClose }: Props) {
  const router = useRouter();
  const requireNickname = useNicknameStore((s) => s.requireNickname);

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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setSelectedGame(null);
    setPlayMode('multi');
    setTitle('');
    setRoomType('public');
    setPassword('');
    setMaxPlayers(4);
    setTimeLimitEnabled(false);
    setTimeLimitMin(1);
    setTimeLimitSec(0);
    fetchGames()
      .then(setGames)
      .catch(() => setError('게임 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'));
  }, [open]);

  const isRandom = selectedGame?.id === GAME_IDS.RANDOM;

  const selectGame = (g: Game) => {
    setSelectedGame(g);
    if (g.supportsMulti) setPlayMode('multi');
    else if (g.supportsCom) setPlayMode('com');
    else if (g.supportsSolo) setPlayMode('solo');
    setMaxPlayers(g.maxPlayers);
  };

  const selectRandom = () => {
    setSelectedGame(RANDOM_GAME);
    setPlayMode('multi');
    setTimeLimitEnabled(false);
  };

  // COM/솔로/랜덤 모드는 항상 시간제한 무제한
  const computedTimeLimit = (timeLimitEnabled && playMode === 'multi' && !isRandom) ? timeLimitMin * 60 + timeLimitSec : null;

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

  const playerRange = selectedGame
    ? Array.from({ length: selectedGame.maxPlayers - selectedGame.minPlayers + 1 }, (_, i) => selectedGame.minPlayers + i)
    : [];

  return (
    <Modal open={open} onClose={onClose} title="새 방 만들기" className="max-w-lg">
      <div className="space-y-5">
        {/* 게임 선택 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">게임 선택</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button
              onClick={selectRandom}
              className={cn(
                'rounded-lg border p-3 text-left text-sm transition-colors',
                isRandom
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 hover:border-gray-300',
              )}
            >
              <div className="font-medium">🎲 랜덤</div>
              <div className="text-xs text-gray-500">무작위 배정</div>
            </button>
            {games.map((g) => (
              <button
                key={g.id}
                onClick={() => selectGame(g)}
                className={cn(
                  'rounded-lg border p-3 text-left text-sm transition-colors',
                  selectedGame?.id === g.id
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <div className="font-medium">{g.name}</div>
                <div className="text-xs text-gray-500">{g.minPlayers}~{g.maxPlayers}인</div>
              </button>
            ))}
          </div>
        </div>

        {/* 플레이 모드 */}
        {selectedGame && !isRandom && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">플레이 모드</label>
            <div className="flex gap-2">
              {[
                { key: 'multi' as PlayMode, label: '멀티', supported: selectedGame.supportsMulti },
                { key: 'com' as PlayMode, label: 'COM', supported: selectedGame.supportsCom },
                { key: 'solo' as PlayMode, label: '1:1 솔로', supported: selectedGame.supportsSolo },
              ].filter((m) => m.supported).map((m) => (
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
        <Input label="방 제목" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="초보 환영합니다!" maxLength={30} />

        {/* 방 유형 */}
        {playMode === 'multi' && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">방 유형</label>
            <div className="flex gap-2">
              <button
                onClick={() => setRoomType('public')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                  roomType === 'public' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300',
                )}
              >
                🔓 공개
              </button>
              <button
                onClick={() => setRoomType('private')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                  roomType === 'private' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300',
                )}
              >
                🔑 비밀
              </button>
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
        {playMode === 'multi' && selectedGame && !isRandom && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">최대 인원</label>
            <div className="flex gap-2">
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

        {/* 시간제한: 멀티 모드에서만 표시 (COM/솔로/랜덤은 항상 무제한) */}
        {playMode === 'multi' && !isRandom && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">시간제한</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTimeLimitEnabled(false)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                  !timeLimitEnabled ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300',
                )}
              >
                ∞ 무제한
              </button>
              <button
                onClick={() => setTimeLimitEnabled(true)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                  timeLimitEnabled ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300',
                )}
              >
                ⏱ 시간제한
              </button>
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

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button onClick={handleCreate} loading={loading}>만들기</Button>
        </div>
      </div>
    </Modal>
  );
}
