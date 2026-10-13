'use client';

import { useState, useEffect } from 'react';
import Modal from '@/classic-era/components/ui/Modal';
import Input from '@/classic-era/components/ui/Input';
import Button from '@/classic-era/components/ui/Button';
import { useNickname } from '@/classic-era/hooks/useNickname';
import { generateRandomNickname } from '@/classic-era/lib/utils';

export default function NicknameModal() {
  const { showModal, closeModal, submitNickname } = useNickname();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (showModal && !value) {
      setValue(generateRandomNickname());
    }
  }, [showModal]);

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (trimmed.length < 2 || trimmed.length > 12) {
      setError('2~12자로 입력해 주세요.');
      return;
    }
    setLoading(true);
    setError('');
    const res = await submitNickname(trimmed);
    setLoading(false);
    if (!res.success) setError(res.error ?? '닉네임 설정에 실패했습니다.');
  };

  const handleReroll = () => {
    setValue(generateRandomNickname());
    setError('');
  };

  return (
    <Modal open={showModal} onClose={closeModal} title="닉네임 설정">
      <p className="mb-4 text-sm text-gray-500">게임에 참여할 닉네임을 입력해 주세요</p>

      <Input
        value={value}
        onChange={(e) => { setValue(e.target.value); setError(''); }}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        error={error}
        placeholder="닉네임"
        maxLength={12}
        autoFocus
      />

      <button
        type="button"
        onClick={handleReroll}
        className="mt-2 text-xs text-indigo-500 hover:text-indigo-600"
      >
        다른 닉네임 추천
      </button>

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSubmit} loading={loading}>
          확인
        </Button>
      </div>
    </Modal>
  );
}
