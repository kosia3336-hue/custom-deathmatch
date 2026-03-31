'use client';

import { useState, useRef } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { getSocket } from '@/lib/socket';
import { useRouter } from 'next/navigation';
import type { RoomSummary } from '@/shared/types';

interface Props {
  open: boolean;
  onClose: () => void;
  room: RoomSummary | null;
  mode?: 'join' | 'spectate';
}

export default function PasswordModal({ open, onClose, room, mode = 'join' }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const lockTimer = useRef<NodeJS.Timeout | null>(null);

  const handleSubmit = () => {
    if (!room || locked) return;

    setLoading(true);
    setError('');
    const socket = getSocket();

    if (mode === 'spectate') {
      socket.emit('spectate:join', { roomId: room.id, password }, (res) => {
        setLoading(false);
        if (res.success) {
          onClose();
          router.push(`/room/${room.id}`);
        } else {
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          setError(res.error ?? '비밀번호가 틀렸습니다.');
          if (newAttempts >= 3) {
            setLocked(true);
            lockTimer.current = setTimeout(() => {
              setLocked(false);
              setAttempts(0);
            }, 10000);
          }
        }
      });
    } else {
      socket.emit('room:join', { roomId: room.id, password }, (res) => {
        setLoading(false);
        if (res.success) {
          onClose();
          router.push(`/room/${room.id}`);
        } else {
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          setError(res.error ?? '비밀번호가 틀렸습니다.');
          if (newAttempts >= 3) {
            setLocked(true);
            lockTimer.current = setTimeout(() => {
              setLocked(false);
              setAttempts(0);
            }, 10000);
          }
        }
      });
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    setAttempts(0);
    setLocked(false);
    if (lockTimer.current) clearTimeout(lockTimer.current);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={mode === 'spectate' ? '비밀방 관전' : '비밀방 입장'}>
      {room && (
        <div className="mb-4">
          <p className="text-sm text-gray-500">&quot;{room.title}&quot;</p>
          <p className="text-sm text-gray-500">방장: {room.hostNickname}</p>
        </div>
      )}

      <Input
        type="password"
        value={password}
        onChange={(e) => { setPassword(e.target.value); setError(''); }}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        error={error}
        placeholder="비밀번호"
        disabled={locked}
        autoFocus
      />

      {locked && <p className="mt-2 text-xs text-orange-500">잠시 후 다시 시도해 주세요 (10초)</p>}

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={handleClose}>취소</Button>
        <Button onClick={handleSubmit} loading={loading} disabled={locked}>
          {mode === 'spectate' ? '관전' : '입장'}
        </Button>
      </div>
    </Modal>
  );
}
